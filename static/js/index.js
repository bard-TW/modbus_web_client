var socket = io.connect();

socket.on('disconnect', function (data) {
    disconnect_modbus()
    alert('與伺服器連線中斷，請重新整理頁面')
});

socket.on('connect_modbus', function (data) {
    // 連線中
    console.log(data)
    $("#progressbar").css("width", data.progress);
    $("#progressbar").text(data.msg);

    if (data.progress === '0%') {
        $("#connect_modbus_btu").prop("disabled", false);
        $("#ip").prop("disabled", false);
        $("#port").prop("disabled", false);
        $("#disconnect_modbus_btu").hide()
        $("#connect_modbus_btu").show()
        $("#disconnect_modbus_btu").prop("disabled", false);
    }
});

socket.on('wait_time_progress', function (data) {
    $("#wait_time_progress").css("width", data.progress);
});

socket.on('connect_modbus_error', function (data) {
    // 無法連線
    alert(data.data)
    $("#connect_modbus_btu").prop("disabled", false);

    $("#progressbar").css("width", "0%");
    $("#progressbar").text("連線失敗");

    $("#ip").prop("disabled", false);
    $("#port").prop("disabled", false);

    $("#disconnect_modbus_btu").hide()
    $("#connect_modbus_btu").show()

});

socket.on('connect_modbus_success', function (data) {
    // 連線成功
    $("#progressbar").css("width", "100%");
    $("#progressbar").text("連線成功");

    $("#connect_modbus_btu").hide()
    $("#disconnect_modbus_btu").show()

    $("#slave").change()
    socket.emit("update_point_data", modbus_setting_data, '');
});

socket.on('modbus_value', function (data) {
    // 連線成功
    for (const [index, value] of modbus_setting_data.entries()) {
        if (value.id in data) {
            modbus_setting_table.cell(index, 4).data(data[value.id].now_value)
        }
    }
});

socket.on('update_history', function (data) {
    // 連線成功
    // console.log(arraysAreEqual(history_columns_list, Object.keys(data)))

    historys = data.history
    if (arraysAreEqual(history_columns_list, Object.keys(historys)) === false) {
        reset_history_checkbox()
        history_columns_list = Object.keys(historys)
    }
    

    history_table.row.add(historys).draw()
    rowCount = history_table.rows().count();
    if (rowCount > 1000) {
        history_table.row(0).remove().draw(false);
    }
    update_chart(historys)

    $("#number_success").html(data.number_success)


});



$("#basic_inforation").on("change", "input", function () { // ip port 空值驗證
    attr_id = $(this).attr("id")
    if ($(this).val() === '') {
        $(this).addClass('is-invalid')
    } else {
        $(this).removeClass('is-invalid')
    }
})

$("#basic_setting").on("change", "input, select", function () { // slave type sleep 資料變更
    slave = null
    time_sleep = null

    if ($("#slave").val() === '') {
        $("#slave").addClass('is-invalid')
    } else {
        slave = $("#slave").val()
        $("#slave").removeClass('is-invalid')
    }

    if ($("#time_sleep").val() === '') {
        $("#time_sleep").addClass('is-invalid')
    } else {
        time_sleep = $("#time_sleep").val()
        $("#time_sleep").removeClass('is-invalid')
    }

    if (slave === null || time_sleep === null) {
        return
    }
    point_type = $("#point_type").val()
    socket.emit("update_basic_data", { 'slave': slave, 'point_type': point_type, 'time_sleep': time_sleep });
});



function export_point_data() { // 匯出功能
    point_datas = []
    for (const [index, value] of modbus_setting_data.entries()) {
        copiedObj = Object.assign({}, value);
        delete copiedObj.id
        point_datas.push(copiedObj)
    }

    export_data = {
        'point_datas': point_datas,
        'point_type': $("#point_type").val(),
        'slave': $("#slave").val(),
        'time_sleep': $("#time_sleep").val()
    }
    var jsonString = JSON.stringify(export_data);
    var blob = new Blob([jsonString], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "data.json";
    a.click();
    URL.revokeObjectURL(a.href);
}

const fileInput = document.getElementById('fileInput'); // 匯入功能
fileInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (event) {
            const fileContent = event.target.result;

            try {
                data_length = modbus_setting_data.length
                for (var i = 0; i < data_length; i++) {
                    modbus_setting_table.row(0).remove().draw();
                    modbus_setting_data.splice(0, 1)
                }
                const jsonData = JSON.parse(fileContent);

                $("#point_type").val(jsonData.point_type)
                $("#slave").val(jsonData.slave)
                $("#time_sleep").val(jsonData.time_sleep)

                console.log(jsonData.point_datas)

                for (const [index, value] of jsonData.point_datas.entries()) {
                    divCount = index + 1
                    value.id = divCount
                    value.now_value = ''
                    modbus_setting_data.push(value)
                    modbus_setting_table.row.add(value).draw();
                }
                socket.emit("update_point_data", modbus_setting_data, 'ALL');

            } catch (error) {
                alert(`無法解析 JSON 資料:${error}`)
            }
        };
        reader.readAsText(file);
    }
});

