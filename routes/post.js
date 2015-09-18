var express = require('express'),
  router = express.Router(),
  mongoose = require('mongoose'),
  Source = mongoose.model('Source'),
  User = mongoose.model('User'),
  Group = mongoose.model('Group'),
  Post = mongoose.model('Post'),
  PostImage = mongoose.model('PostImage'),
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
  console.log("Фильтр: ", filter);
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
  console.log(req.body);
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
  poster2.getMainPage(req, function(parameters) {
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
      res.render(
        'post/add',
        {
          subtitle: 'Добавить пост',
          post: {when: new Date(post.when.getTime() + config.get("post.distance"))},
          groups: groups,
          images: {}
        }
      );
    });
  });
});

/* сохранение */
router.post('/save', function (req, res) {
  if (req.body['imageUrl[]'].length) {
    new Post({
      user: req.session.user._id,
      when: Date.parse(req.body.when),
      group: req.body.group || null,
      description: req.body.description
    }).save(function(err, post, count) {
        if (err) {
          console.log("Ошибка сохранения нового поста", err);
          res.redirect('/post/add');
        } else {
          if (req.body['imageUrl[]'].constructor !== Array) {
            req.body['imageUrl[]'] = [req.body['imageUrl[]']];
            req.body['imageType[]'] = [req.body['imageType[]']];
          }
          async.forEachOf(req.body['imageUrl[]'], function (val, key, callback){
            new PostImage({
              image_url: val,
              image_preview_url: val,
              type: req.body['imageType[]'][key],
              post: post._id
            }).save(function (err, postImage, count) {
                callback();
              });
          }, function(err) {
            res.redirect('/post/page1');
          });
        }
      });
  } else {
    new Post({
      user: req.session.user._id,
      when: Date.parse(req.body.when),
      group: req.body.group || null,
      description: req.body.description
    }).save(function(err, post, count) {
      res.redirect('/post/page1');
    });
  }
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
      Group.find({user: req.session.user._id}, function(err, groups) {
        res.render(
          'post/update',
          {
            subtitle: 'Редактирование поста',
            post: post,
            groups: groups,
            images: images
          }
        );
      });
    });
  });
});

router.post('/update/:id', function (req, res) {
  Post.findById(req.params.id, function (err, post) {
    post.when = Date.parse(req.body.when);
    post.title = req.body.title;
    post.group = req.body.group;
    post.description = req.body.description;
    post.save(function (err, post) {
      res.redirect('/post/edit/' + req.params.id);
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

/* грабим корованы */
router.get('/corovan', function (req, res) {
  tumblr.parseBlog(function() {
    res.redirect('/post/page1');
  });
});

/* грабим корованы */
router.get('/compress', function (req, res) {
  poster2.compressTime(req.session.user, function() {
    res.redirect('/post/page1');
  });
});

/* грабим корованы */
router.get('/fix', function (req, res) {
  poster2.fix(req.session.user, function() {
    res.redirect('/post/page1');
  });
});

router.get('/schedule', function (req, res) {
  poster2.schedule(req.session.user, function() {
    res.redirect("/post/page1");
  });
//  poster2.addPostTime(Date.now(), req.session.user, function() {
//    res.redirect("/post/page1");
//  });
});

router.get('/catchup', function (req, res) {
  poster2.catchUp(req.session.user._id, function() {
    res.redirect("/post/page1");
  });
});

module.exports = router;