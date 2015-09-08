var express = require('express'),
  router = express.Router(),
  mongoose = require('mongoose'),
  User = mongoose.model('User'),
  config = require('../bin/config'),
  async = require('async');

router.all('*', function(req, res, next) {
  res.locals.title = config.get('common.title');
  res.locals.config = config;
  res.locals.current_user = req.session.user || {};
  if (req.url != "/personal" && req.session.user && !req.session.user.vk_user_id) {
    res.render('common/personal', {subtitle: "Мои настройки", error: ["Поле 'Id в VK' обязательно для заполнения"]});
  } else {
    next();
  }
});

/* глагне */
router.get('/', function (req, res) {
  res.render('common/hello');
});

/* настройки */
router.all('/personal', function(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect("/users/login");
  }
});
router.get('/personal', function (req, res) {
  res.render('common/personal', {subtitle: "Мои настройки", error: []});
});
router.post('/personal', function (req, res) {
  var required = {
    login: "Поле 'Логин' обязательно для заполнения",
    email: "Поле 'E-mail' обязательно для заполнения",
    vk_user_id: "Поле 'Id в VK' обязательно для заполнения"
  };
  var error = [];
  async.forEachOf(req.body, function(val, key, callback) {
    if (required[key] && !val.trim().length) {
      error.push(required[key]);
    }
    callback();
  }, function(err) {
    if (error.length) {
      res.render('common/personal', {subtitle: "Мои настройки", error: error});
    } else {
      User.findOne({_id: req.session.user._id}, function(err, user) {
        if (user) {
          User.find(
            {
              $or:[
                {login: req.body.login},
                {email: req.body.email}
              ]
            },
            function(err, users) {
              if (users && users.length > 1) {
                res.render('common/personal', {subtitle: "Мои настройки", error: ["Такие логин и/или адрес e-mail уже заняты"]});
              } else {
                for(var key in req.body) {
                  if (key != '_id' && key != 'password') {
                    user[key] = req.body[key];
                  }
                }
                if (req.body.password) {
                  bcrypt.hash(req.body.password, 10, function(err, hash) {
                    user.password = hash;
                    user.save(function(err, user) {
                      if (err) {
                        res.render('common/personal', {subtitle: "Мои настройки", error: ['Ошибка сохранения']});
                      } else {
                        req.session.user = user;
                        res.locals.current_user = user;
                        res.render('common/personal', {subtitle: "Мои настройки", error: ['Изменения сохранены']});
                      }
                    });
                  });
                } else {
                  user.save(function(err, user) {
                    if (err) {
                      res.render('common/personal', {subtitle: "Мои настройки", error: ['Ошибка сохранения']});
                    } else {
                      req.session.user = user;
                      res.locals.current_user = user;
                      res.render('common/personal', {subtitle: "Мои настройки", error: ['Изменения сохранены']});
                    }
                  });
                }
              }
            }
          );
        } else {
          res.redirect("/users/login");
        }
      });
    }
  });
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
