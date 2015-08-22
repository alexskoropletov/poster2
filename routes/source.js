var express = require('express'),
  router = express.Router(),
  mongoose = require('mongoose'),
  Source = mongoose.model('Source');

/* работа с источниками картинок */
router.get('/', function (req, res) {
  if (req.session.user_id) {
    res.redirect('/source/list');
  } else {
    res.redirect("/users/login");
  }
});

/* список */
router.get('/list', function (req, res) {
  if (req.session.user_id) {
    Source.find({}, function (err, sources) {
      res.render('source/list', {user: req.session.user_id, title: 'Список источников', sources: sources});
    });
  } else {
    res.redirect("/users/login");
  }
});

/* добавление */
router.get('/add', function (req, res) {
  if (req.session.user_id) {
    res.render('source/add', {user: req.session.user_id, source: {}, title: 'Добавление источника'});
  } else {
    res.redirect("/users/login");
  }
});
router.post('/save', function (req, res) {
  if (req.session.user_id) {
    new Source({
      url: req.body.url,
      latest: req.body.latest,
      rate: req.body.rate,
      updated_at: Date.now()
    }).save(function (err, todo, count) {
        res.redirect('/source/list');
      });
  } else {
    res.redirect("/users/login");
  }
});

/* удаление */
router.get('/destroy/:id', function (req, res) {
  if (req.session.user_id) {
    Source.findById(req.params.id, function (err, source) {
      source.remove(function (err, source) {
        res.redirect('/source/list');
      });
    });
  } else {
    res.redirect("/users/login");
  }
});

/* редактирование */
router.get('/edit/:id', function (req, res) {
  if (req.session.user_id) {
    Source.findById(req.params.id, function (err, source) {
      res.render('source/update', {user: req.session.user_id, title: 'Редактирование источника', source: source});
    });
  } else {
    res.redirect("/users/login");
  }
});

router.post('/update/:id', function (req, res) {
  if (req.session.user_id) {
    Source.findById(req.params.id, function (err, source) {
      source.url = req.body.url;
      source.latest = req.body.latest;
      source.rate = req.body.rate;
      source.updated_at = Date.now();
      source.save(function (err, source, count) {
        res.redirect('/source/list');
      });
    });
  } else {
    res.redirect("/users/login");
  }
});

module.exports = router;