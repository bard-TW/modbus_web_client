var divCount = 1;

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

function connect_modbus() {
    // 連線
    ip = $("#ip").val()
    port = $("#port").val()

    agreement_type = $("#agreement_type").val()
    framer_type = $("#framer_type").val()

    if (socket.connected === true) {
        socket.emit("connect_modbus", ip, port, agreement_type, framer_type);

        $("#connect_modbus_btu").prop("disabled", true);
        $("#ip").prop("disabled", true);
        $("#port").prop("disabled", true);
        $("#agreement_type").prop("disabled", true);
        $("#framer_type").prop("disabled", true);

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
        $("#agreement_type").prop("disabled", false);
        $("#framer_type").prop("disabled", false);

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
    for (const [index, value] of tabledata.entries()) {
        if (value.is_log === true) {
            history_islog_dict[value.id] = value.name

            targets_index++
            html_text += `
            <div class="col-auto">
            <input class="form-check-input" type="checkbox" id="show${value.id}" value="${targets_index}" checked>
            <label class="form-check-label" for="show${value.id}">
                ${value.name}
            </label>
            </div>
            `
            history_columnDefs.push({ "targets": targets_index, 'className': 'text-start' })
            history_columns.push({ className: 'dt-text', data: value.id })
            table_title += `<th>${value.name}</th>`
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

$("#show_switch").on("change", "input, select", function () { // logs表 隱藏顯示欄位
    var column = history_table.column($(this).attr('value'));
    column.visible(!column.visible());
});
