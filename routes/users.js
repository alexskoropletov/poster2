var express = require('express'),
  mongoose = require('mongoose'),
  User = mongoose.model('User'),
  bcrypt = require('bcrypt'),
  router = express.Router();

router.all('*', function(req, res, next) {
  var access = [
    '/login',
    '/logout',
    '/register'
  ];
  if (access.indexOf(req.url) >= 0 || (req.session.user && req.session.user.role == 'admin')) {
    next();
  } else {
    res.redirect("/users/login");
  }
});

router.get('/', function (req, res, next) {
  User.find({}, function(err, users) {
    res.render('user/list', {subtitle: 'Список пользователей', users: users});
  });
});
router.get('/list', function (req, res, next) {
  res.redirect("/users/");
});

router.get('/edit/:id', function (req, res) {
  User.findOne({_id: req.params.id}, function(err, user) {
    if (user) {
      res.render('user/add', {subtitle: 'Редактирование пользователя', user: user});
    } else {
      res.redirect('/users/');
    }
  });
});

router.get('/loginas/:id', function (req, res) {
  User.findOne({_id: req.params.id}, function(err, user) {
    if (user) {
      req.session.user = user;
    }
    res.redirect('/post/');
  });
});

router.get('/register', function (req, res) {
  res.render('user/register', {subtitle: 'Регистрация', message: ''});
});
router.post('/register', function(req, res) {
  var message = '';
  console.log(req.body);
  for (var k in req.body) {
    if (!req.body[k].trim()) {
      message = 'Ошибка. Все поля должны быть заполнены';
    }
  }
  if (message) {
    res.render('user/register', {subtitle: 'Регистрация', message: message});
  } else {
    User.findOne(
      {$or:[
        {login: req.body.login},
        {email: req.body.email}
      ]}, function(err, user) {
      if (user) {
        res.render('user/register', {subtitle: 'Регистрация', message: 'Ошибка. Такой логин и/или E-mail уже используются.'});
      } else {
        bcrypt.hash(req.body.password, 10, function(err, hash) {
          new User({
            is_active: false,
            name: req.body.name,
            email: req.body.email,
            login: req.body.login,
            password: hash,
            role: 'user'
          }).save(function(err, user, count) {
              if (err) {
                console.log(err);
                res.render('user/register', {subtitle: 'Регистрация', message: 'Ошибка создания пользователя'});
              } else {
                res.render('user/success', {subtitle: 'Регистрация'});
              }
            });
        });
      }
    });
  }
});

router.get('/login', function (req, res) {
  res.render('user/login', {subtitle: 'Авторизация', message: ''});
});
router.post('/login', function (req, res) {
  User.findOne({login: req.body.login, is_active: true}, function(err, user) {
    if (user) {
      bcrypt.compare(req.body.password, user.password, function(err, result) {
        if (result) {
          req.session.user = user;
          res.redirect("/post/page1");
        } else {
          res.render('user/login', {subtitle: 'Авторизация', message: 'Логин/пароль указаны неправильно'});
        }
      });
    } else {
      res.render('user/login', {subtitle: 'Авторизация', message: 'Логин/пароль указаны неправильно'});
    }
  });
});

router.get('/logout', function (req, res) {
  req.session.user = null;
  res.redirect("/");
});

router.get('/add', function (req, res) {
  res.render('user/add', {subtitle: 'Создание пользователя', user: {}});
});

router.post('/save', function (req, res) {
  if (!req.body.id) {
    bcrypt.hash(req.body.password, 10, function(err, hash) {
      new User({
        is_active: false,
        name: req.body.name,
        email: req.body.email,
        login: req.body.login,
        password: hash,
        role: 'user'
      }).save(function(err, user, count) {
          res.redirect("/users/")
        });
    });
  } else {
    User.findOne({_id: req.body.id}, function(err, user) {
      if (user) {
        // TODO: добавить проверку полей
        for(var key in req.body) {
          if (key != '_id' && key != 'password') {
            user[key] = req.body[key];
          }
        }
        if (req.body.password) {
          bcrypt.hash(req.body.password, 10, function(err, hash) {
            user.password = hash;
            user.save(function(err, user) {
              res.redirect("/users/edit/" + user._id);
            });
          });
        } else {
          user.save(function(err, user) {
            res.redirect("/users/edit/" + user._id);
          });
        }
      } else {
        res.redirect("/users/");
      }
    });
  }
});

router.post('/active', function (req, res) {
  User.findOne({_id: req.body.id}, function(err, user) {
    if (user) {
      user.is_active = user.is_active ? false : true;
      user.save(function(err, user, count) {
        if (user.is_active) {
          res.render('common/item_active');
        } else {
          res.render('common/item_inactive');
        }
      });
    } else {
      res.render('common/item_inactive');
    }
  });
});

module.exports = router;
