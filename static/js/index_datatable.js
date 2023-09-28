var divCount = 1;
var modbus_setting_data = [{ "id": 1, "is_log": false, "title": "", "point": 3002, "data_type": "int32", "data_sort": 1, "now_value": "", "scale": 1, "decimal": 0 }]

var language = {
    "processing": "處理中...",
    "loadingRecords": "載入中...",
    "lengthMenu": "顯示 _MENU_ 項結果",
    "zeroRecords": "沒有符合的結果",
    "info": "顯示第 _START_ 至 _END_ 項結果，共 _TOTAL_ 項",
    "infoEmpty": "顯示第 0 至 0 項結果，共 0 項",
    "infoFiltered": "(從 _MAX_ 項結果中過濾)",
    "infoPostFix": "",
    "search": "搜尋:",
    "paginate": {
        "first": "第一頁",
        "previous": "上一頁",
        "next": "下一頁",
        "last": "最後一頁"
    },
    "aria": {
        "sortAscending": ": 升冪排列",
        "sortDescending": ": 降冪排列"
    }
}

var columns = [
    {
        className: 'dt-control',
        orderable: false,
        data: null,
        defaultContent: '',
    },
    {
        className: 'dt-text',
        data: "title"
    },
    {
        className: 'dt-text',
        data: "point"
    },
    {
        className: 'dt-text',
        data: "data_type"
    },
    {
        className: 'dt-text',
        data: "now_value"
    },
]

var columnDefs = [{
    "targets": 1,
    'className': 'text-center'
}, {
    "targets": 2,
    'className': 'text-center'
}, {
    "targets": 4,
    'className': 'text-end',
},]

var modbus_setting_table = $('#modbus_setting_table').DataTable({
    'language': language,
    'data': modbus_setting_data,
    'columns': columns,
    'columnDefs': columnDefs,
    "order": [[2, "asc"]],
    'info': false,
    'paging': false,
});

var history_table = $('#history_table').DataTable({
    'language': language,
    'data': [],
    'columnDefs': [{ "targets": 0, 'className': 'text-center' }],
    'columns': [{ className: 'dt-text', data: "date_time" }],
    "lengthMenu": [
        [20, 50, 100, 200],
        [20, 50, 100, 200]
    ]
});

var history_columns_list = []

var history_islog_dict = {}



$('#modbus_setting_table tbody').on('click', 'td.dt-text', function () { // 點位表 選取功能
    if ($(this).parent().hasClass('selected')) {
        $(this).parent().removeClass('selected');
    } else {
        modbus_setting_table.$('tr.selected').removeClass('selected');
        $(this).parent().addClass('selected');
    }
});

$('#modbus_setting_table tbody').on('click', 'td.dt-control', function () { // 點位表 顯示隱藏明細
    var tr = $(this).closest('tr');
    var row = modbus_setting_table.row(tr);
    if (row.child.isShown()) {
        row.child.hide();
        tr.removeClass('shown');
    } else {
        row.child(open_row(row.data())).show();
        tr.addClass('shown');
    }
});


$("#modbus_setting_table").on("change", "input, select", function () { // 點位表 資料變更
    tr = $(this).closest('tr').prev();
    var row = modbus_setting_table.row(tr);

    // 有在表格上 沒在表格上 方法不一樣
    name = $(this).attr("name")
    if (name === "title") {
        modbus_setting_table.cell(row, 1).data($(this).val())
    } else if (name === "address") {
        if ($(this).val() === '') {
            $(this).addClass('is-invalid')
        } else {
            modbus_setting_table.cell(row, 2).data($(this).val())
            $(this).removeClass('is-invalid')
        }
    } else if (name === "data_type") {
        modbus_setting_table.cell(row, 3).data($(this).val())
    } else if (name === "log") {
        modbus_setting_table.row(row).data().is_log = $(this).prop('checked')
    } else if (name === "data_sort") {
        modbus_setting_table.row(row).data().data_sort = $(this).val()
    } else if (name === "scale") {
        if ($(this).val() === '') {
            $(this).addClass('is-invalid')
        } else {
            modbus_setting_table.row(row).data().scale = $(this).val()
            $(this).removeClass('is-invalid')
        }
    } else if (name === "decimal") {
        if ($(this).val() === '') {
            $(this).addClass('is-invalid')
        } else {
            modbus_setting_table.row(row).data().decimal = $(this).val()
            $(this).removeClass('is-invalid')
        }
    }
    socket.emit("update_point_data", [row.data()], '');
});


$("#show_switch").on("change", "input, select", function () { // logs表 隱藏顯示欄位
    var column = history_table.column($(this).attr('value'));
    column.visible(!column.visible());
});



function open_row(data_row) {
    return (`
        <div class="row pb-2" name="point">
            <div class="input-group">
                <span class="input-group-text" name="id" title="ID">${data_row.id}</span>

                <label class="input-group-text" name="log" for="log${data_row.id}">
                    <input class="form-check-input mt-0" type="checkbox"
                        aria-label="Checkbox for following text input" name="log" title="紀錄Logs" ${data_row.is_log == true ? "checked" : ""}>
                </label>

                <div class="form-floating">
                    <input type="text" class="form-control" id="title${data_row.id}" name="title" placeholder="欄位名稱" value="${data_row.title}" title="歷史紀錄的欄位名稱">
                    <label>欄位名稱</label>
                </div>

                <div class="form-floating">
                    <input type="number" class="form-control" name="scale" placeholder="比例" value="${data_row.scale}" max="100" min="1" title="結果除與這個數字(通常除以1, 10, 100, 1000...)">
                    <label>比例</label>
                </div>

                <div class="form-floating">
                    <input type="number" class="form-control" name="decimal" placeholder="小數點位數" value="${data_row.decimal}" max="10" min="0" title="要顯示小數點後幾位">
                    <label>小數點位數</label>
                </div>
            </div>

            <div class="input-group">
                <div class="form-floating">
                    <input type="number" class="form-control" name="address" placeholder="點位" value="${data_row.point}" max="9999" min="1" >
                    <label>點位</label>
                </div>

                <div class="form-floating">
                    <select class="form-select" name="data_type">
                        <option value="int16" ${data_row.data_type == "int16" ? "selected" : ""}>int16</option>
                        <option value="int32" ${data_row.data_type == "int32" ? "selected" : ""}>int32</option>
                        <option value="int64" ${data_row.data_type == "int64" ? "selected" : ""}>int64</option>
                        <option value="uint16" ${data_row.data_type == "uint16" ? "selected" : ""}>uint16</option>
                        <option value="uint32" ${data_row.data_type == "uint32" ? "selected" : ""}>uint32</option>
                        <option value="uint64" ${data_row.data_type == "uint64" ? "selected" : ""}>uint64</option>
                        <option value="float16" ${data_row.data_type == "float16" ? "selected" : ""}>float16</option>
                        <option value="float32" ${data_row.data_type == "float32" ? "selected" : ""}>float32</option>
                        <option value="float64" ${data_row.data_type == "float64" ? "selected" : ""}>float64</option>
                    </select>
                    <label>資料型態</label>
                </div>

                <div class="form-floating">
                    <select class="form-select" name="data_sort">
                        <option value=1 ${data_row.data_sort == 1 ? "selected" : ""}>低到高</option>
                        <option value=2 ${data_row.data_sort == 2 ? "selected" : ""}>高到低</option>
                    </select>
                    <label>位元排序</label>
                </div>
            </div>
        </div>
        `
    );
}

function add_point() {
    divCount++
    // 新增
    copiedObj = { "id": divCount, "is_log": false, "title": "", "point": 3000, "data_type": "int32", "data_sort": 1, "now_value": "", "scale": 1, "decimal": 0 }
    modbus_setting_data.push(copiedObj)
    modbus_setting_table.row.add(copiedObj).draw();
    socket.emit("update_point_data", modbus_setting_data, '');
}

function copy_point() {
    // 取得選取
    selected = modbus_setting_table.$('tr.selected')
    // 取得列
    data_row = modbus_setting_table.row(selected)

    if (data_row.length >= 1) {
        // 取得資料
        data = modbus_setting_table.row('.selected').data()
        // 複製對象
        copiedObj = Object.assign({}, data);
        divCount++
        copiedObj.id = divCount
        // 複製
        modbus_setting_data.push(copiedObj)
        modbus_setting_table.row.add(copiedObj).draw();
        socket.emit("update_point_data", modbus_setting_data, '');
    }
}

function del_point() {
    // 取得選取
    selected = modbus_setting_table.$('tr.selected')
    next_tr = selected.next('tr')
    if (next_tr.length >= 1) {
        next_tr.addClass('selected')
    }

    // 取得列 (需要後台先刪除才不會出錯)
    data_row = modbus_setting_table.row(selected)

    // socket.emit("del_point_data", data_row.data());
    if (data_row.data()) {
        socket.emit("del_point_data", data_row.data());
    }

    if (data_row.length >= 1) {
        modbus_setting_table.row(data_row[0]).remove().draw();
    }
    modbus_setting_data.splice(data_row[0], 1)
}

function connect_modbus() {
    // 連線
    ip = $("#ip").val()
    port = $("#port").val()
    if (socket.connected === true) {
        socket.emit("connect_modbus", ip, port);

        $("#connect_modbus_btu").prop("disabled", true);
        $("#ip").prop("disabled", true);
        $("#port").prop("disabled", true);

        $("#progressbar").css("width", "25%");
        $("#progressbar").text("嘗試連線");
    } else {
        alert('與伺服器連線中斷，請確認是否開啟')
    }
}

function disconnect_modbus() {
    // 中斷連線
    socket.emit("disconnect_modbus");
    if (socket.connected === true) {
        $("#disconnect_modbus_btu").prop("disabled", true);
    } else {
        $("#connect_modbus_btu").prop("disabled", false);

        $("#progressbar").css("width", "0%");
        $("#progressbar").text("連線失敗");

        $("#ip").prop("disabled", false);
        $("#port").prop("disabled", false);

        $("#disconnect_modbus_btu").hide()
        $("#connect_modbus_btu").show()
    }
}


function arraysAreEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) {
        return false;
    }
    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) {
            return false;
        }
    }
    return true;
}


function reset_history_checkbox() {
    html_text = '<div class="col-auto">篩選欄位：</div>'
    table_title = '<th>時間</th>'
    history_columnDefs = [{ "targets": 0, 'className': 'text-center' }]
    history_columns = [{ className: 'dt-text', data: "date_time" }]
    targets_index = 0
    history_columns_list = ['date_time']
    for (const [index, value] of modbus_setting_data.entries()) {
        if (value.is_log === true) {
            history_islog_dict[value.id] = value.title

            targets_index++
            html_text += `
            <div class="col-auto">
            <input class="form-check-input" type="checkbox" id="show${value.id}" value="${targets_index}" checked>
            <label class="form-check-label" for="show${value.id}">
                ${value.title}
            </label>
            </div>
            `
            history_columnDefs.push({ "targets": targets_index, 'className': 'text-start' })
            history_columns.push({ className: 'dt-text', data: value.id })
            table_title += `<th>${value.title}</th>`
            history_columns_list.push(`${value.id}`)
        }
    }
    $("#show_switch").html(html_text)

    history_table.destroy();
    $("#history_table").html(`<thead><tr>${table_title}</tr></thead>`)

    if (history_columns.length === 1) {
        history_table = $('#history_table').DataTable({
            'language': language,
            "lengthMenu": [
                [20, 50, 100, 200],
                [20, 50, 100, 200]
            ]
        });
    } else {
        // console.log(history_columnDefs)
        // console.log(history_columns)
        history_table = $('#history_table').DataTable({
            'language': language,
            'data': [],
            'columnDefs': history_columnDefs,
            'columns': history_columns,
            "lengthMenu": [
                [20, 50, 100, 200],
                [20, 50, 100, 200]
            ],
            "order": [[0, "desc"]],
        });
    }
}

