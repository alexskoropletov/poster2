$(function() {
  $('.datepicker').datepicker({
    format: 'mm/dd/yyyy',
    startDate: '+1d'
  });
  $('#more-images').click(function() {
    var newImage = $(".cloning-image-url:last").clone();
    newImage.find('input').val('');
    newImage.find('select').val('image');
    newImage.appendTo('.images-container');
  });
  $('#datetimepicker2').datetimepicker({
    format: 'YYYY-MM-DD HH:mm',
    locale: 'ru',
    date: new Date($('#inputWhen').data('date'))
  });
  $(".delete_link").click(function() {
    var id = "#postid" + $(this).data('post');
    $.post("/post/destroy", {post_id: $(this).data('post')}, function(data) {
      if (data.res == 'ok') {
        $(id).replaceWith("");
      } else {
        alert("При удалении поста возникла ошибка");
      }
    }, 'json');
    return false;
  });
});