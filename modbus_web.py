# import subprocess
import argparse
import os
import subprocess
import sys
import time
import traceback
from threading import Event, Thread

from engineio.async_drivers import \
    threading  # * 替代解決辦法 socketio使用threading 打包才能執行
from flask import Flask, jsonify, render_template, request
from flask_socketio import SocketIO, emit
from ping3 import ping
from pymodbus import Framer
from pymodbus.client import ModbusSerialClient, ModbusTcpClient, ModbusTlsClient, ModbusUdpClient
from pymodbus.constants import Endian
from pymodbus.payload import BinaryPayloadDecoder

# request.sid 連線房間

app = Flask(__name__)
socketio = SocketIO(app, async_mode="threading")

modbus_connect_room = {} # sid: obj

@app.route('/clean-pme')
def clean_pme():
    return render_template('clean_pme.html')

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('connect')
def handle_connect():
    return jsonify(
        {"response": "ok"}
    )

@socketio.on('connect_modbus')
def connect_modbus(ip, port, agreement_type, framer_type):
    if ip == '' or port == '':
        emit('connect_modbus_error', {'data': '輸入錯誤'}, room=request.sid)
        return
    modbusThread = ModbusThread(ip, port, request.sid, agreement_type, framer_type)
    modbusThread.start()
    modbus_connect_room[request.sid] = modbusThread
    # emit('status_response', {'data': data}, room=request.sid)

@socketio.on('disconnect_modbus')
def disconnect_modbus():
    if request.sid in modbus_connect_room:
        emit('connect_modbus', {'progress': "50%",  "msg": "中斷連線中"}, room=request.sid)
        modbus_connect_room[request.sid].exit_signal.set()

@socketio.on('disconnect')
def handle_disconnect():
    if request.sid in modbus_connect_room:
        modbus_connect_room[request.sid].exit_signal.set()

@socketio.on('update_point_data')
def update_point_data(datas):
    if request.sid not in modbus_connect_room:
        return

    modbus_connect_room[request.sid].point_data = {}
    print(datas)
    for data in datas:
        # 判斷是否有效狀態
        if data["is_valid"] == True:
            modbus_connect_room[request.sid].point_data[data["id"]] = data

    point_list = []
    for value in datas:
        if value["is_valid"] == False:
            continue
        bit_num = int(value.get('bit_num', 32))
        point = int(value.get('point', 3000))
        data_type = value.get('data_type', '')

        point_list.append(point)
        if data_type == 'boolean':
            point_list.append(point+1)
        elif bit_num == 16:
            point_list.append(point+1)
        elif bit_num == 32:
            point_list.append(point+2)
        elif bit_num == 64:
            point_list.append(point+4)
    grouped_numbers = group_nearby_numbers(point_list)
    modbus_connect_room[request.sid].grouped_numbers = grouped_numbers

def group_nearby_numbers(numbers: list):
    # 演算法, 變更請小心
    # 將list 根據數字 區分成多個list (ex: [3, 2, 70, 10, 50, 65, 1] >> [[1, 2, 3, 10], [50], [65, 70]])
    # threshold 閥值 數字超過多少 會換下一個list
    threshold = 10
    numbers.sort()

    result = []
    current_group = []
    for num in numbers:
        if not current_group:
            current_group.append(num)
        elif num - current_group[-1] <= threshold:
            current_group.append(num)
        else:
            result.append(current_group)
            current_group = [num]
    if current_group:
        result.append(current_group)
    return result

@socketio.on('del_point_data')
def del_point_data(data):
    if request.sid in modbus_connect_room:
        if data['id'] in modbus_connect_room[request.sid].point_data:
            del modbus_connect_room[request.sid].point_data[data['id']]

@socketio.on('update_basic_data')
def update_basic_data(data):
    if request.sid in modbus_connect_room:
        ModbusObj:ModbusThread = modbus_connect_room[request.sid]
        ModbusObj.time_sleep = int(data.get('time_sleep', 1))
        ModbusObj.point_type = data.get('point_type', "3")
        ModbusObj.slave = int(data.get('slave', 1))
        modbus_connect_room[request.sid].basic_data = data


class ModbusThread(Thread):
    def __init__(self, ip, port, room, agreement_type, framer_type):
        super(ModbusThread, self).__init__()
        self.ip = ip
        self.port = port
        self.room = room
        self.exit_signal = Event()
        self.time_sleep = 1
        self.point_type = '3'
        self.slave = 1
        self.agreement_type = agreement_type
        self.framer_type = framer_type
        self.point_data = {}
        # {1: {'id': "1", 'is_valid': True, 'is_log': False, 'name': '測試', 'point': 3306, 'data_type': 'int32', 'scale': 1, 'data_sort': '低到高', 'decimal': 0}}
        self.grouped_numbers = []

        self.number_of_success = 0
        self.number_of_connect = 0

    def test_connection(self, client):
        connection = client.connect()
        error_msg = ''
        if not connection:
            error_msg += 'step 1. modbus 連線失敗\n'
            with app.app_context():
                emit('connect_modbus', {'progress': "50%",  "msg": "ping測試"}, namespace='/', broadcast=True, room=self.room)

            time.sleep(1)
            is_ping = ping_ip(self.ip)
            if is_ping == True:
                error_msg += 'step 2. ping 成功\n'
            else:
                error_msg += 'step 2. ping 失敗\n'

            with app.app_context():
                emit('connect_modbus', {'progress': "75%",  "msg": "嘗試連線"}, namespace='/', broadcast=True, room=self.room)
            connection = client.connect()

        if not connection:
            with app.app_context():
                error_msg += 'step 3. modbus 第2次連線失敗'
                emit('connect_modbus_error', {'data': error_msg}, namespace='/', broadcast=True, room=self.room)
            return False
        return True

    def run(self):
        try:
            framer = Framer.RTU
            if self.framer_type == 'ASCII':
                framer = Framer.ASCII
            elif self.framer_type == 'BINARY':
                framer = Framer.BINARY
            elif self.framer_type == 'SOCKET':
                framer = Framer.SOCKET
            elif self.framer_type == 'TLS':
                framer = Framer.TLS

            if self.agreement_type == 'Serial':
                client = ModbusSerialClient(self.ip, port=int(self.port), timeout=3, framer=framer)
            elif self.agreement_type == 'Tcp':
                client = ModbusTcpClient(self.ip, port=int(self.port), timeout=3, framer=framer)
            elif self.agreement_type == 'Tls':
                client = ModbusTlsClient(self.ip, port=int(self.port), timeout=3, framer=framer)
            elif self.agreement_type == 'Udp':
                client = ModbusUdpClient(self.ip, port=int(self.port), timeout=3, framer=framer)
        except:
            client.close()
            del modbus_connect_room[self.room]
            print("剩餘modbus連線數:", len(modbus_connect_room))
            with app.app_context():
                emit('connect_modbus', {'progress': "0%",  "msg": "已中斷連線"}, namespace='/', broadcast=True, room=self.room)

        try:
            if self.test_connection(client) == False:
                return

            with app.app_context():
                emit('connect_modbus_success', {'data': 'modbus 連線成功'}, namespace='/', broadcast=True, room=self.room)

            while not self.exit_signal.is_set():
                # 秒數對齊，下一輪等待秒數-現在時間，取餘數(毫秒)，取出來先sleep，回應過慢還是會有問題
                now_time = time.time()
                next_time = int(now_time) + self.time_sleep
                sleep_second = next_time - (self.time_sleep-1) - now_time
                time.sleep(sleep_second if sleep_second > 0 else 0)

                with app.app_context():
                    emit('wait_time_progress', {'progress': f"{0}%"}, namespace='/', broadcast=True, room=self.room)

                for x in range(self.time_sleep-1, 0, -1):
                    time.sleep(1)
                    if self.time_sleep >=5:
                        with app.app_context():
                            emit('wait_time_progress', {'progress': f"{int((self.time_sleep-x)/(self.time_sleep-1)*100)}%"}, namespace='/', broadcast=True, room=self.room)

                    if x > self.time_sleep or self.exit_signal.is_set():
                        break

                current_time = time.localtime()

                if self.point_type == '1':
                    read_funt = client.read_coils
                elif self.point_type == '2':
                    read_funt = client.read_discrete_inputs
                elif self.point_type == '4':
                    read_funt = client.read_input_registers
                else:
                    read_funt = client.read_holding_registers

                if len(self.point_data) == 0:
                    continue

                grouped_registers = []
                for numbers in self.grouped_numbers:
                    self.number_of_connect += 1
                    count = numbers[-1] - numbers[0]
                    count = 1 if count == 0 else count

                    result = read_funt(numbers[0]-1, count=count, slave=self.slave) # 修正為從0開始

                    if result.isError() == True:
                        grouped_registers.append([])
                        continue
                    grouped_registers.append(result.registers)
                    self.number_of_success += 1

                print('點位分區:', self.grouped_numbers)
                print('分區資料:', grouped_registers)

                history_data = {}
                for key, value in self.point_data.items():

                    is_log = value.get('is_log', False)
                    # title = value.get('title', '')
                    point = int(value.get('point', 3000))
                    data_type = value.get('data_type', 'int')
                    bit_num = int(value.get('bit_num', 32))
                    mask = value.get('mask', 0)

                    for i, array in enumerate(self.grouped_numbers):
                        if point not in array:
                            continue
                        registers = grouped_registers[i]
                        start_list_point1 = point - array[0]
                        break

                    count = int(bit_num / 16)
                    if data_type == 'boolean':
                        count = 1

                    parser_list = registers[start_list_point1: start_list_point1+count]

                    data_sort = value.get('data_sort', "低到高")
                    if data_sort == "高到低":
                        parser_list = parser_list[::-1]
                    scale = float(value.get('scale', "1"))
                    decimal = int(value.get('decimal', "0"))
                    try:
                        decoder = BinaryPayloadDecoder.fromRegisters(parser_list, byteorder=Endian.BIG, wordorder=Endian.LITTLE)
                        if parser_list == []:
                            active_power = '未取得資料'
                        elif data_type == 'int':
                            if bit_num == 16:
                                active_power = decoder.decode_16bit_int()
                            elif bit_num == 32:
                                active_power = decoder.decode_32bit_int()
                            elif bit_num == 64:
                                active_power = decoder.decode_64bit_int()
                            else:
                                active_power = '為支援此位元數'
                        elif data_type == 'uint':
                            if bit_num == 16:
                                active_power = decoder.decode_16bit_uint()
                            elif bit_num == 32:
                                active_power = decoder.decode_32bit_uint()
                            elif bit_num == 64:
                                active_power = decoder.decode_64bit_uint()
                            else:
                                active_power = '為支援此位元數'
                        elif data_type == 'float':
                            if bit_num == 16:
                                active_power = decoder.decode_16bit_float()
                            elif bit_num == 32:
                                active_power = decoder.decode_32bit_float()
                            elif bit_num == 64:
                                active_power = decoder.decode_64bit_float()
                            else:
                                active_power = '為支援此位元數'
                        elif data_type == 'ascii':
                            active_power = ''.join(chr(i) for i in parser_list)

                        elif data_type == 'boolean':
                            num = decoder.decode_16bit_int()
                            active_power = (num & int(mask, 16)) >> 1 # 取得重疊位置，並移到第一位，確保值是0 or 1

                        if type(active_power) != str:
                            # 計算比例 小數點
                            active_power = active_power / scale
                            active_power = f"{active_power:.{decimal}f}"

                    except Exception as e:
                        traceback.print_exc()
                        print(e)
                        active_power = "異常"
                    self.point_data[key]['now_value'] = active_power

                    if is_log:
                        history_data[key] = active_power

                with app.app_context():
                    emit('modbus_value', self.point_data, namespace='/', broadcast=True, room=self.room)
                    if history_data:
                        history_data['date_time'] = time.strftime("%Y-%m-%d %H:%M:%S", current_time)
                        # emit('update_history', {'history': history_data, 'number_success': f'{self.number_of_success}/{self.number_of_connect}'}, namespace='/', broadcast=True, room=self.room)
                        emit('update_history', {'history': history_data, 'number_success': f'傳送次數:{self.number_of_success}/回應次數:{self.number_of_connect}, 丟包率:{round(1-self.number_of_success/self.number_of_connect, 2)}%'}, namespace='/', broadcast=True, room=self.room)
        finally:
            # print('斷開連線', self.room)
            client.close()
            del modbus_connect_room[self.room]
            print("剩餘modbus連線數:", len(modbus_connect_room))
            with app.app_context():
                emit('connect_modbus', {'progress': "0%",  "msg": "已中斷連線"}, namespace='/', broadcast=True, room=self.room)

def ping_ip(ip_address):
    response_time = ping(ip_address)
    if response_time is not None:
        return True
    else:
        return False


def get_commandline():
    """可輸入參數"""
    parser = argparse.ArgumentParser(description="Command line options")
    parser.add_argument("--port", help="port", default=8000, type=int)
    parser.add_argument("--ip", help="IP", default="127.0.0.1", type=str)
    args = parser.parse_args()
    print(args.port, args.ip)
    return args.port, args.ip

if __name__ == '__main__':
    lock_file = "modbus_web.lock"
    # from waitress import serve
    # serve(app, host="0.0.0.0", port=8080)

    if os.path.exists(lock_file):
        print("程式執行中")
        sys.exit()

    # 創建鎖定文件
    with open(lock_file, 'w') as f:
        f.write("lock")

    try:
        port, ip = get_commandline()
        url = f"http://{ip}:{port}"
        subprocess.Popen(["start", url], shell=True)
        socketio.run(app, debug=False, host=ip, port=port)
    finally:
        os.remove(lock_file)  # 刪除鎖定文件
