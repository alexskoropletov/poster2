var express = require('express'),
  router = express.Router(),
  mongoose = require('mongoose'),
  Group = mongoose.model('Group'),
  config = require('../bin/config'),
  vk = require('../bin/vk');

router.all('*', function(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect("/users/login");
  }
});

/* список */
router.get('/', function (req, res) {
  Group.find({user: req.session.user._id}, function (err, groups) {
    res.render('group/list', {subtitle: 'Список групп', groups: groups});
  });
});
router.get('/list', function (req, res) {
  res.redirect('/group/');
});

/* добавление */
router.get('/add', function (req, res) {
  res.render('group/add', {group: {}, subtitle: 'Добавление группы'});
});
router.post('/save', function (req, res) {
  config.parseGroupUrl(req.body.url, function(err, group_id) {
    vk.getGroupInfo(group_id, function(err, group_info) {
      new Group({
        name: req.body.name || group_info.name,
        url: req.body.url,
        vk_id: req.body.vk_id || group_info.gid,
        user: req.session.user._id,
        post_interval: req.body.post_interval,
        post_hours: req.body.post_hours,
        post_random: req.body.post_random || 0,
        updated_at: Date.now()
      }).save(function (err, todo, count) {
          res.redirect('/group/');
        });
    });
  });
});

/* удаление */
router.get('/destroy/:id', function (req, res) {
  Group.findOne(
    {
      _id: req.params.id,
      user: req.session.user._id
    },
    function (err, group) {
      if (group) {
        group.remove(function (err, group) {
          res.redirect('/group/');
        });
      } else {
        res.redirect('/group/');
      }
    }
  );
});

/* редактирование */
router.get('/edit/:id', function (req, res) {
  Group.findOne(
    {
      _id: req.params.id,
      user: req.session.user._id
    },
    function (err, group) {
      if (group) {
        res.render('group/update', {subtitle: 'Редактирование группы', group: group});
      } else {
        res.redirect('/group/');
      }
    }
  );
});

router.post('/update/:id', function (req, res) {
  Group.findOne(
    {
      _id: req.params.id,
      user: req.session.user._id
    },
    function (err, group) {
      if (group) {
        config.parseGroupUrl(req.body.url, function(err, group_id) {
          vk.getGroupInfo(group_id, function(err, group_info) {
            group.name = req.body.name || group_info.name;
            group.vk_id = req.body.vk_id || group_info.gid;
            group.url = req.body.url;
            group.updated_at = Date.now();
            group.post_interval = req.body.post_interval;
            group.post_hours = req.body.post_hours;
            group.post_random = req.body.post_random || 0;
            group.save(function (err, group) {
              res.redirect('/group/');
            });
          });
        });
      } else {
          res.redirect('/group/');
        }
    }
  );
});

module.exports = router;