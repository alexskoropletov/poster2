var express = require('express'),
  mongoose = require('mongoose'),
  User = mongoose.model('User'),
  bcrypt = require('bcrypt'),
  router = express.Router();

router.get('/', function (req, res, next) {
  if (req.session.user_id) {
    User.find({}, function(err, users) {
      res.render('user/list', {user: req.session.user_id, title: 'Список пользователей', users: users});
    });
  } else {
    res.redirect("/users/login");
  }
});

router.get('/login', function (req, res) {
  res.render('user/login', {user: req.session.user_id, title: 'Авторизация', message: ''});
});
router.post('/login', function (req, res) {
  User.findOne({login: req.body.login}, function(err, user) {
    if (user) {
      bcrypt.compare(req.body.password, user.password, function(err, result) {
        if (result) {
          req.session.user_id = user._id;
          res.redirect("/post/page1");
        } else {
          res.render('user/login', {title: 'Авторизация', message: 'Логин/пароль указаны неправильно'});
        }
      });
    } else {
      res.render('user/login', {title: 'Авторизация', message: 'Логин/пароль указаны неправильно'});
    }
  });
});

router.get('/create', function (req, res) {
  if (req.session.user_id) {
    res.render('user/create', {user: req.session.user_id, title: 'Создание пользователя'});
  } else {
    res.redirect("/users/login");
  }
});
router.post('/create', function (req, res) {
  if (req.session.user_id) {
    bcrypt.hash(req.body.password, 10, function(err, hash) {
      new User({
        login: req.body.login,
        password: hash
      }).save(function(err, user, count) {
          res.redirect("/users/")
        });
    });
  } else {
    res.redirect("/users/login");
  }
});

module.exports = router;
