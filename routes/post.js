var express = require('express'),
  router = express.Router(),
  mongoose = require('mongoose'),
  Source = mongoose.model('Source'),
  User = mongoose.model('User'),
  Group = mongoose.model('Group'),
  Post = mongoose.model('Post'),
  PostImage = mongoose.model('PostImage'),
  PostAudio = mongoose.model('PostAudio'),
  async = require('async'),
  poster2 = require('../bin/post'),
  vk = require('../bin/vk'),
  config = require('../bin/config'),
  tumblr = require('../bin/tumblr');

router.all('*', function(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect("/users/login");
  }
});

/* постим посты */
router.get('/do_post/:post_id', function (req, res) {
  var thisMinute = new Date();
  var filter = {
    when: {
      "$gt": thisMinute,
      "$lte": new Date(thisMinute.getTime() + 60 * 1000)
    },
    posted: false,
    approved: true
  };
  if (req.params.post_id != '0') {
    filter = {
      _id: req.params.post_id,
      posted: false,
      approved: true
    };
  }
  poster2.doPost(filter, function(err, user, group) {
    if (err) {
      console.log("Ошибка запроса к API VK", err, user, group);
      if (err.error && err.error.error_code == 14) {
        var renderData = {
          subtitle: "Капча VK",
          sid: err.error.captcha_sid,
          img: err.error.captcha_img,
          user: user.vk_id
        };
        if (group) {
          renderData.group = group.vk_id;
        }
        res.render(
          'common/vkcaptcha',
          renderData
        );
      } else {
        console.log(err);
        res.redirect('/post/page1');
      }
    } else {
      res.redirect('/post/page1');
    }
  });
});
router.post('/captcha', function(req, res) {
  User.findOne({vk_id: req.body.user}, function(err, user) {
    if (user) {
      if (req.body.group) {
        vk.getGroupImageUploadUrlCaptcha(req.body, user, function(err, response) {
          if (err) {
            if (err.error_code == 14) {
              res.render('common/vkcaptcha', {subtitle: "Капча VK", sid: err.captcha_sid, img: err.captcha_img});
            } else if (err.error_code == 17) {
              res.redirect(err.redirect_uri);
            } else {
              res.send(err);
            }
          } else {
            res.redirect('/post/page1');
          }
        });
      } else {
        vk.getImageUploadUrlCaptcha(req.body, user, function(err, response) {
          if (err) {
            if (err.error_code == 14) {
              res.render('common/vkcaptcha', {subtitle: "Капча VK", sid: err.captcha_sid, img: err.captcha_img});
            } else if (err.error_code == 17) {
              res.redirect(err.redirect_uri);
            } else {
              res.send(err);
            }
          } else {
            res.redirect('/post/page1');
          }
        });
      }
    } else {
      res.redirect('/post/page1');
    }
  });
});

/* работа с постами */
router.get('/page:page', function (req, res) {
  poster2.getList(req, function(parameters) {
    res.render(
      'post/list',
      parameters
    );
  });
});
/* работа с постами */
router.get('/', function (req, res) {
  res.redirect("/post/page1");
});

/* форма добавления */
router.get('/add', function (req, res) {
  Post.findOne({posted: false, user: req.session.user._id}).sort({when: -1}).exec(function(err, post) {
    if (!post) {
      post = {when: new Date()};
    }
    Group.find({user: req.session.user._id}, function(err, groups) {
      config.getNextPostTime(req.session.user, {}, post, function(nextWhen) {
        res.render(
          'post/add',
          {
            subtitle: 'Добавить пост',
            post: {when: nextWhen},
            groups: groups,
            images: {}
          }
        );
      });
    });
  });
});

/* сохранение */
router.post('/save', function (req, res) {
  poster2.savePost(req, function(err, post) {
    if (err) {
      res.redirect('/post/add');
    } else {
      poster2.savePostImages(post, req, function() {
        poster2.savePostAudio(post, req, function() {
          res.redirect('/post/page1');
        });
      });
    }
  });
});

/* удаление */
router.get('/destroy/:id/:current_page', function (req, res) {
  poster2.destroy(req.params.id, function() {
    res.redirect("/post/page" + req.params.current_page);
  });
});
router.post('/destroy', function (req, res) {
  poster2.destroy(req.body.post_id, function() {
    res.json({res:'ok'});
  });
});

/* редактирование */
router.get('/edit/:id', function (req, res) {
  Post.findOne({_id: req.params.id, user: req.session.user._id}, function (err, post) {
    PostImage.find({post: post._id}, function(err, images) {
      PostAudio.find({post: post._id}, function(err, audios) {
        Group.find({user: req.session.user._id}, function(err, groups) {
          res.render(
            'post/update',
            {
              subtitle: 'Редактирование поста',
              post: post,
              groups: groups,
              images: images,
              audios: audios
            }
          );
        });
      });
    });
  });
});

router.post('/update/:id', function (req, res) {
  Post.findById(req.params.id, function (err, post) {
    poster2.savePostAudio(post, req, function() {
      poster2.savePostImages(post, req, function() {
        console.log("request body", req.body);
        post.when = Date.parse(req.body.when);
        post.group = req.body.group.length ? req.body.group : null;
        post.description = req.body.description;
        post.save(function (err, post) {
          console.log(err);
          res.redirect('/post/edit/' + req.params.id);
        });
      });
    });
  });
});

router.post('/approve', function (req, res) {
  Post.findOne({_id: req.body.id}, function(err, post) {
    if (post) {
      post.approved = post.approved ? false : true;
      post.save(function(err, post, count) {
        if (post.approved) {
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

router.get('/fix', function (req, res) {
  poster2.catchUp(req.session.user._id, function() {
    poster2.fix(req.session.user, function() {
      res.redirect('/post/page1');
    });
  });
});

router.get('/schedule', function (req, res) {
  poster2.compressTime(req.session.user, function() {
    poster2.schedule(req.session.user, function() {
      res.redirect("/post/page1");
    });
  });
});

router.post('/get_audio', function(req, res) {
  vk.searchAudio(req.session.user, req.body.q, function(err, result) {
    res.render('post/audio/search', {result: result});
  });
});

router.post('/audio_button', function(req, res) {
  res.render(
    'post/audio/audio',
    {
      aid: req.body.aid,
      artist: req.body.artist,
      title: req.body.title,
      owner_id: req.body.owner_id
    }
  );
});

module.exports = router;