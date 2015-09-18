var express = require('express'),
  router = express.Router(),
  mongoose = require('mongoose'),
  User = mongoose.model('User'),
  user_m = require('../bin/user'),
  config = require('../bin/config'),
  https = require('https'),
  moment = require('moment'),
  tz = require('moment-timezone'),
  async = require('async');

router.all('*', function(req, res, next) {
  res.locals.title = config.get('common.title');
  res.locals.config = config;
  res.locals.moment = moment;
  res.locals.tz = tz;
  res.locals.current_user = req.session.user || {};
  console.log(req.url);
  if (req.url.indexOf("/vk_code") < 0 && req.url != "/users/logout" && req.url != "/personal" && req.session.user && (!req.session.user.vk_id || !req.session.user.vk_token)) {
    res.render(
      'common/personal',
      {
        subtitle: "Мои настройки",
        error: [
          "Поле 'Id в VK' обязательно для заполнения",
          "Нужно обязательно получить токен доступа"
        ]
      }
    );
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
    vk_id: "Поле 'Id в VK' обязательно для заполнения"
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
                        user_m.getAccessToken(user, function(err, user) {
                          if (err) {
                            res.render('common/personal', {subtitle: "Мои настройки", error: ['Ошибка сохранения']});
                          } else {
                            req.session.user = user;
                            res.locals.current_user = user;
                            res.render('common/personal', {subtitle: "Мои настройки", error: ['Изменения сохранены']});
                          }
                        });
                      }
                    });
                  });
                } else {
                  user.save(function(err, user) {
                    if (err) {
                      res.render('common/personal', {subtitle: "Мои настройки", error: ['Ошибка сохранения']});
                    } else {
                      user_m.getAccessToken(user, function(err, user) {
                        if (err) {
                          res.render('common/personal', {subtitle: "Мои настройки", error: ['Ошибка сохранения']});
                        } else {
                          req.session.user = user;
                          res.locals.current_user = user;
                          res.render('common/personal', {subtitle: "Мои настройки", error: ['Изменения сохранены']});
                        }
                      });
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

router.get("/vk_code/:user_id", function(req, res) {
  //если пользователь авторизован и его ID совпадает с ID из адресной строки
  if (req.session.user && JSON.stringify(req.session.user._id) == JSON.stringify(req.params.user_id)) {
    User.findOne({_id: req.params.user_id, is_active: true}, function(err, user) {
      //если такой пользватель еще существует в базе
      if (user) {
        //если VK API вернул запрашиваемый code
        if (typeof req.query.code != 'undefined') {
          //формируем https.get запрос с параметрами
          var getOptions = [
            "client_id=" + config.get('vk.appID'),
            "client_secret=" + config.get('vk.appSecret'),
            "code=" + req.query.code
//            "redirect_uri=" + encodeURIComponent("http://wizee.ninja/vk_code/" + req.params.user_id)
          ];
          var options = {
            host: 'oauth.vk.com',
            path: '/access_token?' + getOptions.join("&")
          };
          var request = https.get(options, function(response) {
            var bodyChunks = [];
            response.on('data', function(chunk) {
              bodyChunks.push(chunk);
            }).on('end', function() {
                //ответ получен. парсим JSON
                var body = JSON.parse(Buffer.concat(bodyChunks));
                console.log(body);
                //если токен получен, и в ответе VK API тот же ID пользователя, что и в базе
                if (body && body.access_token && body.user_id == user.vk_id) {
                  user.vk_token = body.access_token;
                  user.save(function(err, user) {
                    if (err) {
                      res.redirect("/");
                    } else {
                      req.session.user = user;
                      res.locals.current_user = user;
                      res.redirect("/personal");
                    }
                  });
                } else {
                  res.redirect("/");
                }
              })
          });
          request.on('socket', function(socket) {
            socket.setTimeout(30000);
            socket.on('timeout', function() {
              console.log('Преывшен таймаут в 30 секунд для GET-запроса');
              request.abort();
            });
          });
          request.on('error', function(e) {
            callback(e, null)
          });
        } else {
          res.redirect("/");
        }
      } else {
        res.redirect("/");
      }
    });
  } else {
    res.redirect("/");
  }
});

module.exports = router;
