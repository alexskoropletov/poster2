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

parseUserBlog = function (user, callback) {
  Source.find({user: user._id}, function (err, sources) {
    //console.log("Запускается ASYNC для sources", sources);
    async.forEach(sources, function (source, sourceCallback) {
      console.log("Парсим блог ", source.url);
      //вытаскиваем посты из источника
      client.posts(source.url, {type: 'photo'}, function (err, res) {
        if (err) {
          console.log("Ошибка работы с блогом", source.url, err);
          sourceCallback();
        } else {
          var postIds = res.posts.map(function (post) {
            return post.id;
          });
          //находим все ранее сохраненные посты из этого источника
          SourcePost.find({
            source: source._id
          }, {"post_id": true}, function (err, sourcePosts) {
            var sourcePostIds = sourcePosts.map(function (sourcePost) {
              return parseInt(sourcePost.post_id);
            });

            //console.log("Запускается ASYNC для res.posts", res.posts);
            async.forEach(res.posts, function (post, callbackInner) {
              //для каждого поста из источника проверяем, был ли он сохранен ранее
              //если не - добавляем пост в список сохраненных
              if (sourcePostIds.indexOf(parseInt(post.id)) == -1) {
                console.log("Добавление нового поста ", post.id, " из блога ", source.url);
                new SourcePost({
                  post_id: post.id,
                  image: post.photos[0].original_size.url,
                  image_preview: typeof post.photos[0].alt_sizes[3] != 'undefined' ? post.photos[0].alt_sizes[3].url : post.photos[0].original_size.url,
                  source: source._id
                }).save(function (err, sourcePost, count) {
                    if (err) {
                      console.log("Ошибка 2", err);
                      callbackInner();
                    }
                    //добавляем пост в очередь
                    Group.findOne({_id: source.group}, function (err, group) {
                      if (!group) {
                        group = {};
                      }
                      Post.findOne({
                        user: user._id,
                        group: group._id
                      }).sort({"when": -1}).exec(function (err, latest_post) {
                        //console.log("latest post found", latest_post);
                        config.getNextPostTime(user, group, latest_post, function (nextWhen) {
                          new Post({
                            when: nextWhen,
                            user: user._id,
                            group: source.group || null,
                            approved: source.approved
                          }).save(function (err, newpost, count) {
                              if (err) {
                                console.log("Ошибка newpost", err);
                              }
                              //сохраняем картинки поста
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
                              }, function (err) {
                                if (err) {
                                  console.log("Ошибка 4", err);
                                }
                                callbackInner();
                              });
                            });
                        });
                      });
                    });
                  });
              } else {
                callbackInner();
              }
            }, function (err) {
              if (err) {
                console.log("Ошибка 5", err);
              }
              console.log("Все посты из блога ", source.url, " проверены");
              sourceCallback();
            });
          });
        }
      });
    }, function (err) {
      if (err) {
        console.log("Ошибка 6", err);
      }
      console.log('Вызываем userCallback');
      callback();
    });
  });
};

exports.parseUserBlog = parseUserBlog;

exports.parseBlog = function (complete) {
  User.find({is_active: true}, function (err, users) {
    //для всех активных пользователей находим источники
    console.log("Запускается ASYNC для users", users);
    async.forEach(users, function (user, userCallback) {

      parseUserBlog(user, userCallback);

    }, function (err) {
      if (err) {
        console.log("Ошибка 7", err);
      }
      console.log('All sources of all users have been parsed');
      complete();
    });
  });
};