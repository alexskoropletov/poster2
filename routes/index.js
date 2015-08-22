var express = require('express'),
    router = express.Router();


/* глагне и пагинация */
router.get('/', function (req, res, next) {
  res.render('common/hello', {title: "Какое-то приложение 2", user: req.session.user_id});
});

router.get("/vk_code", function(req, res) {
//  if (typeof req.query.code != 'undefined') {
//    res.redirect('https://oauth.vk.com/access_token?client_id=' + config.appID + '&redirect_uri=http://wizee.ninja/vk_code&client_secret=' + config.appSecret + '&code=' + req.query.code);
//  } else {
//    res.redirect("https://oauth.vk.com/authorize?client_id=" + config.appID + "&scope=friends,photos,audio,video,docs,wall,offline&response_type=code&redirect_uri=http://wizee.ninja/vk_code")
//  }
  res.send("code");
});

module.exports = router;
