$(function () {
  //posts
  $('.datepicker').datepicker({
    format: 'mm/dd/yyyy',
    startDate: '+1d'
  });
  $('#more-images').click(function () {
    var newImage = $(".cloning-image-url:last").clone();
    newImage.find('input').val('');
    newImage.find('select').val('image');
    newImage.appendTo('.images-container');
  });
  $(".remove-image").click(function () {
    $(this).parents(".images-container").replaceWith("");
  });
  //post form audio
  $(".audio-search").keyup(function () {
    if ($.trim($(this).val()).length >= 3) {
      $.post("/post/get_audio", {q: $(this).val()}, function (data) {
        $("#search_results").html(data);
      });
    } else {
      $("#search_results").html("");
    }
  });
  $("#clear_audio").click(function () {
    $("#search_results").html("");
    $(".audio-search").val("");
  });
  // post form audio
  $('#datetimepicker2').datetimepicker({
    format: 'YYYY-MM-DD HH:mm',
    locale: 'ru',
    sideBySide: true,
    date: new Date($('#inputWhen').data('date'))
  });
  $('#filter_from_date').datetimepicker({
    format: 'YYYY-MM-DD HH:mm',
    locale: 'ru',
    sideBySide: true,
    date: $("#filter_from_date").val()
  });
  $(".delete_link").on("click", function () {
    var id = "#postid" + $(this).data('post');
    var sendData = {
      post_id: $(this).data('post'),
      page: $(this).data('page'),
      from_date: $("#filter_from_date").val(),
      group: $("#filter_group").val(),
      approved: $("#filter_approved").val(),
      posted: $("#filter_posted").val(),
      failed: $("#filter_failed").val()
    };
    $.post("/post/destroy", sendData, function (data) {
      //if (data.res == 'ok') {
      if (data) {
        $(id).replaceWith("");
        $("#post_list").append(data);
      } else {
        alert("При удалении поста возникла ошибка");
      }
    });
    return false;
  });
  $(".post_approved").click(function () {
    var self = this;
    $.post("/post/approve", {id: $(this).data('id')}, function (data) {
      $(self).html(data);
    });
  });
  //users
  $(".user_active").click(function () {
    var self = this;
    $.post("/users/active", {id: $(this).data('id')}, function (data) {
      $(self).html(data);
    });
  });
  $(".user_delete").click(function () {
    var id = "#user" + $(this).data('id');
    $.post("/users/destroy", {id: $(this).data('id')}, function (data) {
      if (data.res == 'ok') {
        $(id).replaceWith("");
      } else {
        alert("При удалении пользователя возникла ошибка");
      }
    }, 'json');
    return false;
  });
  addListeners();
  $('#vkcodeframe').load(function () {
    console.log($(this).attr("src"));
  });
  $("#getcode").click(function () {
    $("#vkcodeframe").attr('src', $(this).data('url'));
  });
});

function addListeners() {
  $(".remove_audio").off("click").on("click", function () {
    $(this).replaceWith("");
  });
  $(".add_audio").off("click").on("click", function () {
    var audio = JSON.parse($(this).data('info').split("||").join('"'));
    if (!$("#audio" + audio.owner_id + "_" + audio.aid).size()) {
      $.post("/post/audio_button", audio, function (data) {
        $("#audios").append(data);
        addListeners();
      });
    }
  });
}