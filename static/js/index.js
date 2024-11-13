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
        $("#agreement_type").prop("disabled", false);
        $("#framer_type").prop("disabled", false);

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
    socket.emit("update_point_data", tabledata);
});

socket.on('modbus_value', function (data) {
    // 連線成功 結果寫入即時資料
    for (var key in data) {
        table_point.updateData([{id:key, now_value: data[key].now_value}])
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
