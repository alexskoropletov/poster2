var express = require('express'),
  router = express.Router(),
  mongoose = require('mongoose'),
  Source = mongoose.model('Source'),
  Group = mongoose.model('Group'),
  async = require('async');

router.all('*', function(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect("/users/login");
  }
});

/* список */
router.get('/', function (req, res) {
  Source.find({user: req.session.user._id}, function (err, sources) {
    Group.find({user: req.session.user._id}, function(err, groups) {
      res.render('source/list', {subtitle: 'Список источников', groups: groups, sources: sources});
    });
  });
});
router.get('/list', function (req, res) {
  res.redirect('/source/');
});

/* добавление */
router.get('/add', function (req, res) {
  Group.find({user: req.session.user._id}, function(err, groups) {
    res.render('source/add', {source: {}, groups: groups, subtitle: 'Добавление источника'});
  });
});
router.post('/save', function (req, res) {
  new Source({
    url: req.body.url,
    comment: req.body.comment,
    user: req.session.user._id,
    approved: req.body.approved,
    group: req.body.group || null,
    updated_at: Date.now()
  }).save(function (err, source, count) {
      res.redirect('/source/');
    });
});

/* удаление */
router.get('/destroy/:id', function (req, res) {
  Source.findOne({_id: req.params.id, user: req.session.user._id}, function (err, source) {
    if (source) {
      source.remove(function (err, source) {
        res.redirect('/source/');
      });
    } else {
      res.redirect('/source/');
    }
  });
});

/* редактирование */
router.get('/edit/:id', function (req, res) {
  Source.findOne({_id: req.params.id, user: req.session.user._id}, function (err, source) {
    if (source) {
      Group.find({user: req.session.user._id}, function(err, groups) {
        res.render(
          'source/update',
          {
            source: source,
            groups: groups,
            subtitle: 'Редактирование источника'
          }
        );
      });
    } else {
      res.redirect('/source/');
    }
  });
});

router.post('/update/:id', function (req, res) {
  Source.findOne({_id: req.params.id, user: req.session.user._id}, function (err, source) {
    if (source) {
      source.url = req.body.url;
      source.comment = req.body.comment;
      source.user = req.session.user._id;
      source.approved = req.body.approved;
      source.group = req.body.group || null;
      source.updated_at = Date.now();
      source.save(function (err, source, count) {
        if (err) {
          console.log(err);
        }
        res.redirect('/source/');
      });
    } else {
      res.redirect('/source/');
    }
  });
});

module.exports = router;