var mongoose = require('mongoose'),
    Source = mongoose.model('Source'),
    Group = mongoose.model('Group'),
    User = mongoose.model('User'),
    Post = mongoose.model('Post'),
    PostImage = mongoose.model('PostImage'),
    vk = require('../bin/vk'),
    config = require('../bin/config'),
    moment = require('moment'),
    async = require('async');

exports.compressTime = function(user, compressCallback) {
  Post.findOne(
    {
      user: user._id,
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
            user: user._id,
            _id: {$ne: post._id},
            posted: false,
            failed: false,
            when: {"$gt": new Date()}
          },
          {$set: {when: new Date(new_time)}},
          {multi: true}
        ).exec(function(err, posts) {
            console.log(posts);
            compressCallback();
          });
      });
    });
};

exports.fix = function(user, callback) {
  Post.update(
    {
      user: user._id,
      failed: true,
      posted: false
    },
    {$set: {failed: false, when: new Date(Date.now() + 60 * 60 * 5 * 1000)}},
    {multi: true}
  ).exec(function(err, posts) {
      console.log(posts);
      callback();
    });
};

function addPostTime(date, user, end) {
  Post.findOne(
    {
      user: user,
      posted: false,
      when: {
        "$gt": new Date(date)
      }
    }
  ).sort({"when": 1}).exec(function (err, startpost) {
      if (startpost) {
        Post.find(
          {
            user: user,
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
              addPostTime(startpost.when.getTime() + config.get("post.distance"), user, end);
            });
          });
      } else {
        end();
      }
    });
}

exports.addPostTime = addPostTime;

exports.getMainPage = function(req, showList) {
  var postImages = {};
  var filter = {
    when: {
      "$gt": req.query.from_date ? moment(req.query.from_date) : new Date()
    },
    user: req.session.user._id
  };
  if (req.query.posted) {
    filter.posted = req.query.posted == 'true' ? true : false;
  }
  if (req.query.failed) {
    filter.failed = req.query.failed == 'true' ? true : false;
  }
  console.log("List page filter", filter);
  Post.count(filter, function(err, count) {
    var per_page = 50;
    var skip = (req.params.page- 1) * per_page > count ? 0 : (req.params.page - 1) * per_page;
    var pages = {};
    for (var x = 1; x <= Math.ceil(count / per_page); x++) {
      pages[x] = "/post/page" + x;
    }
    Post.find(filter).sort({"when": 1}).limit(per_page).skip(skip).exec(function (err, posts) {
      async.forEachOf(posts, function (post, index, callback) {
        PostImage.find({post: post._id}, function(err, images) {
          postImages[post._id] = images;
          posts[index].group_name = "111";
          callback();
        });
      }, function(err) {
        Group.find({user: req.session.user._id}, '_id name', function(err, groups) {
          showList(
            {
              subtitle: 'Очередь постов',
              posts: posts,
              postImages: postImages,
              pages: pages,
              groups: groups,
              current_page: req.params.page
            }
          );
        });
      });
    });
  });
};

exports.catchUp = function(user, callback) {
  Post.update(
    {
      user: user._id,
      when: {"$lt": new Date()},
      posted: false
    },
    {$set: {failed: true}},
    {multi: true}
  ).exec(function(err, posts) {
      console.log(posts);
      callback();
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
        if (!post.group) {
          postToUserPage(post, doAfterPost);
        } else {
          postToGroupPage(post, doAfterPost);
        }
      } else {
        doAfterPost({error: 'Post not found', filter: filter});
      }
    }
  );
};

function postToUserPage(post, doAfterPost) {
  User.findOne({_id: post.user, is_active: true}, function(err, user) {
    if (user) {
      vk.getImageUploadUrl(user, function(err, image_upload_url) {
        if (err) {
          console.log(err);
          doAfterPost(err, user);
        } else {
          console.log("Image upload url", image_upload_url, "\n");
          vk.getDocUploadUrl(user, function(err, doc_upload_url) {
            if (err) {
              console.log(err);
              doAfterPost(err, user)
            } else {
              console.log("File upload url", doc_upload_url, "\n");
              PostImage.find({post: post._id}, function(err, images) {
                var saveImage = [];
                async.forEach(images, function(image, callback) {
                  //добавляем функцию сохранения изображения
                  saveImage.push(function(saveImageCallback) {
                    setTimeout(function() {
                      console.log('Тип документа', image.type, image);
                      if (image.type == 'document') {
                        vk.uploadDoc(image, doc_upload_url, function(vk_res) {
                          console.log("vk.uploadDoc function response ", vk_res);
                          vk.saveDoc(user, vk_res, function(response) {
                            console.log("vk.saveDoc function response ", response);
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
                          vk.saveUserImage(user, JSON.parse(vk_res), function(response) {
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
                          vk.wallPost(user, null, post, results, function(err, postSaved) {
                            if (err) {
                              doAfterPost(err, user);
                            } else {
                              console.log('Ответ сервера на запрос добавления поста на стену', postSaved, "\n");
                              if (typeof postSaved.response != 'undefined') {
                                console.log("Отмечаем пост как отправленный", post);
                                post.posted = true;
                                post.save(function(err, post) {
                                  doAfterPost();
                                });
                              } else {
                                doAfterPost(postSaved, user);
                              }
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
      doAfterPost({error: "Нет такого пользователя"});
    }
  });
}

function postToGroupPage(post, doAfterPost) {
  User.findOne({_id: post.user, is_active: true}, function(err, user) {
    if (user) {
      Group.findOne({user: user._id, _id: post.group}, function(err, group) {
        if (group) {
          vk.getGroupImageUploadUrl(user, group.vk_id, function(err, image_upload_url) {
            if (err) {
              console.log(err);
              doAfterPost(err, user, group);
            } else {
              console.log("Image upload url", image_upload_url, "\n");
              vk.getGroupDocUploadUrl(user, group.vk_id, function(err, doc_upload_url) {
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
                          console.log('Тип документа', image.type, image);
                          if (image.type == 'document') {
                            vk.uploadDoc(image, doc_upload_url, function(vk_res) {
                              console.log("vk.uploadDoc function response ", vk_res);
                              vk.saveDoc(user, vk_res, function(response) {
                                console.log("vk.saveDoc function response ", response);
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
                              vk.saveGroupImage(user, group.vk_id, JSON.parse(vk_res), function(response) {
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
                              vk.wallPost(user, group.vk_id, post, results, function(err, postSaved) {
                                if (err) {
                                  doAfterPost(err);
                                } else {
                                  console.log('Ответ сервера на запрос добавления поста на стену', postSaved, "\n");
                                  if (typeof postSaved.response != 'undefined') {
                                    console.log("Отмечаем пост как отправленный", post);
                                    post.posted = true;
                                    post.save(function(err, post) {
                                      if (err) {
                                        doAfterPost({
                                          err: err,
                                          error: 'Ошибка сохранения поста после отправки'
                                        });
                                      } else {
                                        doAfterPost();
                                      }
                                    });
                                  } else {
                                    doAfterPost(postSaved);
                                  }
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
          doAfterPost({error: "User group not found"});
        }
      });
    } else {
      doAfterPost({error: "User not found"});
    }
  });
}