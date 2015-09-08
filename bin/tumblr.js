var config = require('./../bin/config'),
    mongoose = require('mongoose'),
    User = mongoose.model('User'),
    Group = mongoose.model('Group'),
    Source = mongoose.model('Source'),
    SourcePost = mongoose.model('SourcePost'),
    Post = mongoose.model('Post'),
    PostImage = mongoose.model('PostImage'),
    async = require('async'),
    tumblr = require('tumblr.js');

var client = tumblr.createClient({
  consumer_key: config.get("tumblr.consumer_key"),
  consumer_secret: config.get("tumblr.consumer_secret"),
  token: config.get("tumblr.token"),
  token_secret: config.get("tumblr.token_secret")
});

exports.parseBlog = function(complete) {
  User.find({is_active: true}, function(err, users) {
    //для всех активных пользователей находим источники
    console.log("Запускается ASYNC для users");
    async.forEach(users, function(user, userCallback) {
      Source.find({user: user._id}, function(err, sources) {
        console.log("Запускается ASYNC для sources");
        async.forEach(sources, function(source, sourceCallback) {
          //вытаскиваем посты из источника
          client.posts(source.url, {type: 'photo'}, function(err, res) {
            if (err) {
              console.log("Ошибка работы с блогом", source.url, err);
              sourceCallback();
            } else {
              //находим все ранее сохраненные посты из этого источника
              SourcePost.find({source: source._id}, function(err, sourcePosts) {
                var sourcePostIds = [];
                console.log("Запускается ASYNC для sourcePosts");
                async.forEach(sourcePosts, function(sourcePost, sourcePostCallback) {
                  sourcePostIds.push(parseInt(sourcePost.post_id));
                  sourcePostCallback();
                }, function(err) {
                  if (err) {
                    console.log("Ошибка 1", err);
                  }
                  console.log("Запускается ASYNC для res.posts");
                  async.forEach(res.posts, function(post, callbackInner) {
                    //для каждого поста из источника проверяем, был ли он сохранен ранее
                    //если не - добавляем пост в список сохраненных
                    if (sourcePostIds.indexOf(parseInt(post.id)) == -1) {
                      new SourcePost({
                        post_id: post.id,
                        image: post.photos[0].original_size.url,
                        image_preview: typeof post.photos[0].alt_sizes[3] != 'undefined' ? post.photos[0].alt_sizes[3].url : post.photos[0].original_size.url,
                        source: source._id
                      }).save(function(err, sourcePost, count) {
                          if (err) {
                            console.log("Ошибка 2", err);
                          }
                          //добавляем пост в очередь
                          Post.find({}).sort({"when": -1}).limit(1).exec(function(err, latest_post) {
                            var nextWhen = Date.now();
                            if (typeof latest_post[0] != 'undefined') {
                              latest_post[0].when.getTime()
                            }
                            nextWhen += config.random() + config.get("post.distance");
                            new Post({
                              when: nextWhen,
                              user: user._id,
                              group: source.group || null,
                              approved: source.approved
                            }).save(function(err, newpost, count) {
                                if (err) {
                                  console.log("Ошибка newpost", err);
                                }
                                //сохраняем картинки поста
                                console.log("Запускается ASYNC для post.photos");
                                async.forEach(post.photos, function (val, callbackPostSaving) {
                                  new PostImage({
                                    image_url: val.original_size.url,
                                    image_preview_url: typeof val.alt_sizes[3] != 'undefined' ? val.alt_sizes[3].url : val.original_size.url,
                                    type: val.original_size.url.indexOf(".gif") > -1 ? 'document' : 'image',
                                    post: newpost._id
                                  }).save(function (err, postImage, count) {
                                      if (err) {
                                        console.log("Ошибка 3", err);
                                      }
                                      callbackPostSaving();
                                    });
                                }, function(err) {
                                  if (err) {
                                    console.log("Ошибка 4", err);
                                  }
                                  console.log('callbackInner');
                                  callbackInner();
                                });
                              });
                          });
                        });
                    } else {
                      callbackInner();
                    }
                  }, function(err){
                    if (err) {
                      console.log("Ошибка 5", err);
                    }
                    console.log('sourceCallback');
                    sourceCallback();
                  });
                });
              });
            }
          });
        }, function(err) {
          if (err) {
            console.log("Ошибка 6", err);
          }
          console.log('userCallback');
          userCallback();
        });
      });
    }, function(err) {
      if (err) {
        console.log("Ошибка 7", err);
      }
      console.log('All sources of all users have been parsed');
      complete();
    });
  });
//  Source.find({}, function(err, sources) {
//    async.forEach(sources, function(source, callback){
//      client.posts(source.url, {type: 'photo'}, function(err, res) {
//        if (err) {
//          console.log("Ошибка работы с блогом", source.url, err);
//          callback();
//        } else {
//          SourcePost.find({source: source._id}, function(err, sourcePosts) {
//            var sourcePostIds = [];
//            async.forEach(sourcePosts, function(sourcePost, sourcePostCallback) {
//              sourcePostIds.push(parseInt(sourcePost.post_id));
//              sourcePostCallback();
//            }, function(err) {
//              async.forEach(res.posts, function(post, callbackInner) {
//                if (sourcePostIds.indexOf(parseInt(post.id)) == -1) {
//                  new SourcePost({
//                    post_id: post.id,
//                    image: post.photos[0].original_size.url,
//                    image_preview: typeof post.photos[0].alt_sizes[3] != 'undefined' ? post.photos[0].alt_sizes[3].url : post.photos[0].original_size.url,
//                    source: source._id
//                  }).save(function(err, sourcePost, count) {
//                      //добавить пост в очередь, добавить картинки к посту
//                      Post.find({}).sort({"when": -1}).limit(1).exec(function(err, latest_post) {
//                        var nextWhen = Date.now();
//                        if (typeof latest_post[0] != 'undefined') {
//                          latest_post[0].when.getTime()
//                        }
//                        nextWhen += config.random() + config.get("post.distance");
//                        new Post({
//                          title: "autopost from " + source.url,
//                          when: nextWhen
//                        }).save(function(err, mypost, count) {
//                            async.forEach(post.photos, function (val, callbackPostSaving) {
//                              new PostImage({
//                                image_url: val.original_size.url,
//                                image_preview_url: typeof val.alt_sizes[3] != 'undefined' ? val.alt_sizes[3].url : val.original_size.url,
//                                type: val.original_size.url.indexOf(".gif") > -1 ? 'document' : 'image',
//                                post: mypost._id
//                              }).save(function (err, postImage, count) {
//                                  callbackPostSaving();
//                                });
//                            }, function(err) {
//                              callbackInner();
//                            });
//                          });
//                      });
//                    });
//                } else {
//                  callbackInner();
//                }
//              }, function(err){
//                callback();
//              });
//            });
//          });
//        }
//      });
//    }, function(err) {
//      complete();
//    });
//  });
};