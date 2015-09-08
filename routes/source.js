var express = require('express'),
  router = express.Router(),
  mongoose = require('mongoose'),
  Source = mongoose.model('Source');

router.all('*', function(req, res, next) {
  if (req.session.user_id) {
    next();
  } else {
    res.redirect("/users/login");
  }
});

/* работа с источниками картинок */
router.get('/', function (req, res) {
  res.redirect('/source/list');
});

/* список */
router.get('/list', function (req, res) {
  Source.find({}, function (err, sources) {
    res.render('source/list', {user: req.session.user_id, title: 'Список источников', sources: sources});
  });
});

/* добавление */
router.get('/add', function (req, res) {
  res.render('source/add', {user: req.session.user_id, source: {}, title: 'Добавление источника'});
});
router.post('/save', function (req, res) {
  new Source({
    url: req.body.url,
    latest: req.body.latest,
    rate: req.body.rate,
    updated_at: Date.now()
  }).save(function (err, todo, count) {
      res.redirect('/source/list');
    });
});

/* удаление */
router.get('/destroy/:id', function (req, res) {
  Source.findById(req.params.id, function (err, source) {
    source.remove(function (err, source) {
      res.redirect('/source/list');
    });
  });
});

/* редактирование */
router.get('/edit/:id', function (req, res) {
  Source.findById(req.params.id, function (err, source) {
    res.render('source/update', {user: req.session.user_id, title: 'Редактирование источника', source: source});
  });
});

router.post('/update/:id', function (req, res) {
  Source.findById(req.params.id, function (err, source) {
    source.url = req.body.url;
    source.latest = req.body.latest;
    source.rate = req.body.rate;
    source.updated_at = Date.now();
    source.save(function (err, source, count) {
      res.redirect('/source/list');
    });
  });
});

module.exports = router;