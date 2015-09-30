$(function() {
  $(".add_audio").on("click", function() {
    var audio = JSON.parse($(this).data('info').split("||").join('"'));
    if (!$("#audio" + audio.aid).size()) {
      $("#audios").append(
        '<button class="remove_audio btn" type="button" id="audio' + audio.aid + '">'
          + '<input type="hidden" name="audio_name[]" value="' + audio.artist + " - " + audio.title + '">'
          + '<input type="hidden" name="audio_id[]" value="audio' + audio.owner_id + "_" + audio.aid + '">'
          + audio.artist
          + " - "
          + audio.title
        + '</button>'
      );
      addListeners();
    }
  });
  function addListeners() {
    $(".remove_audio").off("click").on("click", function() {
      $(this).replaceWith("");
    });
  }
});