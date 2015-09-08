var express = require('express'),
  router = express.Router(),
  mongoose = require('mongoose'),
  Source = mongoose.model('Source'),
  Post = mongoose.model('Post'),
  PostImage = mongoose.model('PostImage'),
  async = require('async'),
  poster2 = require('../bin/post'),
  vk = require('../bin/vk'),
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
    posted: false
  };
  if (req.params.post_id != '0') {
    filter = {
      _id: req.params.post_id,
      posted: false
    };
  }
  console.log("Фильтр: ", filter);
  poster2.doPost(filter, function(err) {
    if (err) {
      if (err.error && err.error.error_code == 14) {
        res.render('common/vkcaptcha', {subtitle: "Капча VK", sid: err.error.captcha_sid, img: err.error.captcha_img});
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
  vk.getImageUploadUrlCaptcha(req.body, function(err, response) {
    if (err) {
      if (err.error_code == 14) {
        res.render('common/vkcaptcha', {subtitle: "Капча VK", sid: err.captcha_sid, img: err.captcha_img});
      } else {
        res.send(err);
      }
    } else {
      res.redirect('/post/page1');
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
  poster2.compressTime(function() {
    res.redirect('/post/page1');
  });
});

/* работа с постами */
router.get('/page:page', function (req, res, next) {
  poster2.getMainPage(req, function(parameters) {
    res.render(
      'post/list',
      parameters
    );
  });
});

/* форма добавления */
router.get('/add', function (req, res) {
  Post.findOne({posted: false}).sort({when: -1}).exec(function(err, post) {
    res.render('post/add', {subtitle: 'Добавить пост', post: {when: new Date(post.when.getTime() + 46 * 60 + 60 * 1000)}, images: {} });
  });
});

/* сохранение */
router.post('/save', function (req, res) {
  if (req.body['imageUrl[]'].length) {
    new Post({
      when: Date.parse(req.body.when),
      subtitle: req.body.title,
      description: req.body.description
    }).save(function(err, post, count) {
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
  Post.findById(req.params.id, function (err, post) {
    PostImage.find({post: post._id}, function(err, images) {
      res.render('post/update', {subtitle: 'Редактирование поста', post: post, images: images});
    });
  });
});

router.post('/update/:id', function (req, res) {
  Post.findById(req.params.id, function (err, post) {
    post.when = Date.parse(req.body.when);
    post.title = req.body.title;
    post.description = req.body.description;
    post.save(function (err, post) {
      res.redirect('/post/edit/' + req.params.id);
    });
  });
});

router.get('/schedule', function (req, res) {
  poster2.addPostTime(Date.now(), function() {
    res.redirect("/post/page1");
  });
});

router.get('/catchup', function (req, res) {
  poster2.catchUp(function() {
    res.redirect("/post/page1");
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

module.exports = router;