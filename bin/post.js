var mongoose = require('mongoose'),
    Source = mongoose.model('Source'),
    Post = mongoose.model('Post'),
    PostImage = mongoose.model('PostImage'),
    vk = require('../bin/vk'),
    config = require('../bin/config'),
    async = require('async');

exports.compressTime = function(callback) {
  Post.findOne(
    {
      posted: false,
      when: {$gt: new Date()}
    }
  )
    .sort({when: 1})
    .exec(function(err, post) {
      post.when = Date.now() + config.get("post.first");
      console.log(post);
      post.save(function(err, post) {
        var new_time = Date.now() + config.get("post.next");
        Post.update(
          {
            _id: {$ne: post._id},
            posted: false,
            when: {"$gt": new Date()}
          },
          {$set: {when: new Date(new_time)}},
          {multi: true}
        ).exec(function(err, posts) {
            console.log(posts);
            callback();
          });
      });
    });
}

function addPostTime(date, end) {
  Post.findOne(
    {
      posted: false,
      when: {
        "$gt": new Date(date)
      }
    }
  ).sort({"when": 1}).exec(function (err, startpost) {
      if (startpost) {
        Post.find(
          {
            posted: false,
            when: {
              "$gt": new Date(startpost.when.getTime()),
              "$lte": new Date(startpost.when.getTime() + config.get("post.distance"))
            }
          }
        ).sort({"when": 1}).exec(function(err, posts) {
            async.forEach(posts, function(post, callback) {
              post.when = new Date(post.when.getTime() + config.get("post.distance") + config.random());
              post.save(function(err, post) {
                callback();
              });
            }, function(err) {
              addPostTime(startpost.when.getTime() + config.get("post.distance"), end);
            });
          });
      } else {
        end();
      }
    });
}

exports.addPostTime = addPostTime;

exports.getMainPage = function(page, user_id, showList) {
  var postImages = {};
  Post.count({posted: false}, function(err, count) {
    var per_page = 50;
    var skip = (page - 1) * per_page > count ? 0 : (page - 1) * per_page;
    var pages = {};
    for (var x = 1; x <= Math.ceil(count / per_page); x++) {
      pages[x] = "/post/page" + x;
    }
    Post.find({posted: false}).sort({"when": 1}).limit(per_page).skip(skip).exec(function (err, posts) {
      async.forEach(posts, function (post, callback){
        PostImage.find({post: post._id}, function(err, images) {
          postImages[post._id] = images;
          callback();
        });
      }, function(err) {
        showList(
          {
            title: 'Очередь постов',
            user: user_id,
            posts: posts,
            postImages: postImages,
            pages: pages,
            current_page: page
          }
        );
      });
    });
  });
};

exports.catchUp = function(catchUpCallback) {
  Post.findOne({}).sort({"when": -1}).exec(function(err, latestPost) {
    Post.find({when: {"$lt": new Date()}}, function(err, posts) {
      async.forEach(posts, function(post, callback) {
//        post.when = new Date(latestPost.when.getTime() + 5 * 60 * 1000);
        post.posted = true;
        post.save(function(err, post) {
          callback();
        });
      }, function(err) {
        catchUpCallback();
      });
    });
  });
};

exports.destroy = function(post_id, callback) {
  Post.findById(post_id, function (err, schedule_post) {
    if (schedule_post) {
      PostImage.find({post: schedule_post._id}, function(err, images) {
        async.forEach(images, function (image, callback){
          image.remove(function (err, image) {
            if (err) {
              console.log("Ошибка удаления изображения ", image, err);
            }
            callback();
          });
        }, function(err) {
          if (err) {
            console.log("Ошибка удаления изображений ", images, err);
            callback();
          }
          schedule_post.remove(function(err, schedule_post) {
            callback();
          });
        });
      });
    } else {
      callback();
    }
  });
};

exports.doPost = function(filter, doAfterPost) {
  Post.findOne(
    filter,
    function(err, post) {
      if (post) {
        console.log("Post exists", "\n");
        vk.getImageUploadUrl(function(err, image_upload_url) {
          if (err) {
            console.log(err);
            doAfterPost(err);
          } else {
            console.log("Image upload url", image_upload_url, "\n");
            vk.getDocUploadUrl(function(err, doc_upload_url) {
              if (err) {
                console.log(err);
                doAfterPost(err)
              } else {
                console.log("File upload url", doc_upload_url, "\n");
                PostImage.find({post: post._id}, function(err, images) {
                  var saveImage = [];
                  async.forEach(images, function(image, callback) {
                    //добавляем функцию сохранения изображения
                    saveImage.push(function(saveImageCallback) {
                      setTimeout(function() {
                        if (image.type == 'document') {
                          vk.uploadDoc(image, doc_upload_url, function(vk_res) {
                            vk.saveDoc(vk_res, function(response) {
                              if (response.error) {
                                saveImageCallback(response.error);
                              } else {
                                console.log(response);
                                response[0].id = 'doc' + response[0].owner_id + "_" + response[0].did;
                                saveImageCallback(null, response);
                              }
                            });
                          });
                        } else {
                          vk.uploadImage(image, image_upload_url, function(vk_res) {
                            console.log("vk.uploadImage function response ", vk_res);
                            vk.saveImage(JSON.parse(vk_res), function(response) {
                              console.log("vk.saveImage function response ", response);
                              if (response.error) {
                                saveImageCallback(response.error);
                              } else {
                                saveImageCallback(null, response);
                              }
                            });
                          });
                        }
                        console.log("Файл отправлен в ВК", "\n");
                      }, 1000);
                    });
                    callback();
                  }, function(err) {
                    async.series(
                      saveImage,
                      function(err, results) {
                        if (err) {
                          console.log('В процессе сохранения изображений произошла ошибка', err, "\n");
                          doAfterPost(err);
                        } else {
                          console.log('Будут сохранены следущюие данные', results, "\n");
                          if (results) {
                            vk.wallPost(post, results, function(postSaved) {
                              console.log('Ответ сервера на запрос добавления поста на стену', postSaved, "\n");
                              if (typeof postSaved.response != 'undefined') {
                                console.log("Отмечаем пост как отправленный", post);
                                post.posted = true;
                                post.save(function(err, post) {
                                  doAfterPost();
                                });
                              } else {
                                doAfterPost(postSaved);
                              }
                            });
                          } else {
                            doAfterPost({error: 'empty posts list'});
                          }
                        }
                      }
                    );
                  });
                });
              }
            });
          }
        });
      } else {
        console.log("No post");
        doAfterPost();
      }
    }
  );
};