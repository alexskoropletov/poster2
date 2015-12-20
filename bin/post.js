var mongoose = require('mongoose'),
  Source = mongoose.model('Source'),
  Group = mongoose.model('Group'),
  User = mongoose.model('User'),
  Post = mongoose.model('Post'),
  PostImage = mongoose.model('PostImage'),
  PostAudio = mongoose.model('PostAudio'),
  vk = require('../bin/vk'),
  config = require('../bin/config'),
  moment = require('moment'),
  tz = require('moment-timezone'),
  async = require('async');

exports.compressTime = function (user, compressCallback) {
  Post.findOne(
    {
      user: user._id,
      posted: false,
      when: {$gt: new Date()}
    }
  )
    .sort({when: 1})
    .exec(function (err, post) {
      post.when = Date.now() + config.get("post.first");
      post.save(function (err, post) {
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
        ).exec(function (err, posts) {
            compressCallback();
          });
      });
    });
};

exports.fix = function (user, callback) {
  Post.update(
    {
      user: user._id,
      failed: true,
      posted: false
    },
    {$set: {failed: false, when: new Date(Date.now() + 60 * 60 * 5 * 1000)}},
    {multi: true}
  ).exec(function (err, posts) {
      callback();
    });
};

exports.schedule = function (user, scheduled) {
  Group.find({user: user._id}, function (err, groups) {
    groups.push({});
    async.forEach(groups, function (group, groupsCallback) {
      Post.find(
        {
          user: user._id,
          group: group._id,
          posted: false,
          when: {
            "$gt": new Date()
          }
        })
        .sort({created_at: 1})
        .exec(
        function (err, posts) {
          var postTimeCalls = [];
          async.forEach(posts, function (post, callback) {
            postTimeCalls.push(function (postSaved) {
              Post.findOne({
                user: user._id,
                posted: false,
                group: group._id
              }).sort({"when": -1}).exec(function (err, latest_post) {
                config.getNextPostTime(user, group, latest_post, function (nextWhen) {
                  post.when = nextWhen;
                  post.save(function (err, post) {
                    postSaved();
                  });
                });
              });
            });
            callback();
          }, function (err) {
            async.series(
              postTimeCalls,
              function (err, result) {
                groupsCallback();
              }
            );
          });
        }
      );
    }, function (err) {
      scheduled();
    });
  });
};

function addPostTime(date, user, end) {
  Post.findOne(
    {
      user: user._id,
      posted: false,
      when: {
        "$gt": new Date(date)
      }
    }
  ).sort({"when": 1}).exec(function (err, startpost) {
      if (startpost) {
        Post.find(
          {
            user: user._id,
            posted: false,
            when: {
              "$gt": new Date(startpost.when.getTime()),
              "$lte": new Date(startpost.when.getTime() + config.get("post.distance"))
            }
          }
        ).sort({"when": 1}).exec(function (err, posts) {
            async.forEach(posts, function (post, callback) {
              Group.findOne({_id: post.group}, function (err, group) {
                config.getNextPostTime(user, group, post, function (nextWhen) {
                  post.when = nextWhen;
                  post.save(function (err, post) {
                    callback();
                  });
                });
              });
            }, function (err) {
              addPostTime(startpost.when.getTime() + config.get("post.distance"), user, end);
            });
          });
      } else {
        end();
      }
    });
}

exports.addPostTime = addPostTime;

fillPostsWithData = function (req, posts, callback) {
  Group.find({user: req.session.user._id}, '_id name', function (err, groups) {
    async.forEachOf(posts, function (post, index, callback) {
      if (post) {
        async.forEach(groups, function (group, callback) {
          if (JSON.stringify(group._id) == JSON.stringify(post.group)) {
            posts[index].group_name = group.name;
          }
          callback();
        }, function (err) {
          PostImage.find({post: post._id}, function (err, images) {
            posts[index].images = images;
            PostAudio.find({post: post._id}, function (err, audios) {
              posts[index].audios = audios;
              callback();
            });
          });
        });
      } else {
        callback();
      }
    }, function (err) {
      callback(posts, groups);
    });
  });
};

exports.getList = function (req, showList) {
  var pagination_tail = [];
  if (req.query.from_date) {
    pagination_tail.push("from_date=" + req.query.from_date);
  }
  var filter = {
    when: {
      "$gt": req.query.from_date ? moment(req.query.from_date).tz('Europe/Moscow') : moment().tz('Europe/Moscow')
    },
    user: req.session.user._id
  };
  if (req.query.group) {
    filter.group = req.query.group == 'null' ? null : req.query.group;
    pagination_tail.push("group=" + req.query.group);
  }
  if (req.query.approved) {
    filter.approved = req.query.approved == 'null' ? null : req.query.approved;
    pagination_tail.push("approved=" + req.query.approved);
  }
  if (req.query.posted) {
    filter.posted = req.query.posted == 'true';
    pagination_tail.push("posted=" + req.query.posted);
  }
  if (req.query.failed) {
    filter.failed = req.query.failed == 'true';
    pagination_tail.push("failed=" + req.query.failed);
  }
  Post.count(filter, function (err, count) {
    var per_page = 50;
    var skip = (req.params.page - 1) * per_page > count ? 0 : (req.params.page - 1) * per_page;
    var pages = {};
    for (var x = 1; x <= Math.ceil(count / per_page); x++) {
      pages[x] = "/post/page" + x;
      if (pagination_tail.length) {
        pages[x] += "?" + pagination_tail.join("&");
      }
    }
    Post.find(filter).sort({"when": 1}).limit(per_page).skip(skip).exec(function (err, posts) {
      fillPostsWithData(req, posts, function (posts, groups) {
        showList(
          {
            subtitle: 'Очередь постов',
            posts: posts,
            pages: pages,
            groups: groups,
            current_page: req.params.page,
            filter: filter
          }
        );
      });
    });
  });
};

exports.getLastPagePost = function (req, callback) {
  var filter = {
    when: {
      "$gt": req.body.from_date ? moment(req.body.from_date).tz('Europe/Moscow') : moment().tz('Europe/Moscow')
    },
    user: req.session.user._id
  };
  if (req.body.group) {
    filter.group = req.body.group == 'null' ? null : req.body.group;
  }
  if (req.body.approved) {
    filter.approved = req.body.approved == 'null' ? null : req.body.approved;
  }
  if (req.body.posted) {
    filter.posted = req.body.posted == 'true';
  }
  if (req.body.failed) {
    filter.failed = req.body.failed == 'true';
  }
  Post.count(filter, function (err, count) {
    var skip = (req.body.page - 1) * 50 + 49;
    Post.findOne(filter).sort({"when": 1}).skip(skip).exec(function (err, post) {
      fillPostsWithData(req, [post], function (posts, groups) {
        callback(posts[0]);
      });
    });
  });
};

exports.catchUp = function (user, callback) {
  Post.update(
    {
      user: user._id,
      when: {"$lt": new Date()},
      posted: false
    },
    {$set: {failed: true}},
    {multi: true}
  ).exec(function (err, posts) {
      callback();
    });
};

exports.destroy = function (post_id, callback) {
  Post.findById(post_id, function (err, schedule_post) {
    if (schedule_post) {
      PostImage.find({post: schedule_post._id}, function (err, images) {
        async.forEach(images, function (image, callback) {
          image.remove(function (err, image) {
            if (err) {
              console.log("Ошибка удаления изображения ", image, err);
            }
            callback();
          });
        }, function (err) {
          if (err) {
            console.log("Ошибка удаления изображений ", images, err);
            callback();
          }
          schedule_post.remove(function (err, schedule_post) {
            callback();
          });
        });
      });
    } else {
      callback();
    }
  });
};

moveFailedPost = function (post, callback) {
  if (post) {
    // добавляем посту 1 минуты, чтобы он был отправлен позже
    // в случае ошибки
    post.when = post.when.getTime() + config.get('vk.post_penalty');
    post.save(function (err) {
      callback();
    });
  } else {
    callback();
  }
};
exports.moveFailedPost = moveFailedPost;

exports.doPost = function (filter, doAfterPost) {
  Post.findOne(
    filter,
    function (err, post) {
      if (post) {
        moveFailedPost(post, function () {
          if (!post.group) {
            postToUserPage(post, doAfterPost);
          } else {
            postToGroupPage(post, doAfterPost);
          }
        });
      } else {
        doAfterPost({error: 'Post not found', filter: filter});
      }
    }
  );
};

function postToUserPage(post, doAfterPost) {
  User.findOne({_id: post.user, is_active: true}, function (err, user) {
    if (user) {
      vk.getImageUploadUrl(user, function (err, image_upload_url) {
        if (err) {
          doAfterPost(err, user);
        } else {
          console.log("Image upload url", image_upload_url, "\n");
          vk.getDocUploadUrl(user, function (err, doc_upload_url) {
            if (err) {
              console.log(err);
              doAfterPost(err, user)
            } else {
              console.log("File upload url", doc_upload_url, "\n");
              PostImage.find({post: post._id}, function (err, images) {
                var saveImage = [];
                async.forEach(images, function (image, callback) {
                  //добавляем функцию сохранения изображения
                  saveImage.push(function (saveImageCallback) {
                    setTimeout(function () {
                      console.log('Тип документа', image.type, image);
                      if (image.type == 'document') {
                        vk.uploadDoc(image, doc_upload_url, function (vk_res) {
                          console.log("vk.uploadDoc function response ", vk_res);
                          if (!vk_res) {
                            saveImageCallback({error: "vk.uploadImage empty response"});
                          } else {
                            vk.saveDoc(user, vk_res, function (response) {
                              console.log("vk.saveDoc function response ", response);
                              if (response.error) {
                                saveImageCallback(response.error);
                              } else {
                                console.log(response);
                                response[0].id = 'doc' + response[0].owner_id + "_" + response[0].did;
                                console.log("Файл отправлен в ВК", "\n");
                                saveImageCallback(null, response);
                              }
                            });
                          }
                        });
                      } else {
                        vk.uploadImage(image, image_upload_url, function (vk_res) {
                          console.log("vk.uploadImage function response ", vk_res);
                          if (!vk_res) {
                            saveImageCallback({error: "vk.uploadImage empty response"});
                          } else {
                            vk.saveUserImage(user, JSON.parse(vk_res), function (response) {
                              console.log("vk.saveImage function response ", response);
                              if (response.error) {
                                saveImageCallback(response.error);
                              } else {
                                console.log("Файл отправлен в ВК", "\n");
                                saveImageCallback(null, response);
                              }
                            });
                          }
                        });
                      }
                    }, 1000);
                  });
                  callback();
                }, function (err) {
                  if (err) {
                    console.log('В процессе сохранения изображений произошла ошибка', err, "\n");
                    doAfterPost(err);
                  } else {
                    async.series(
                      saveImage,
                      function (err, results) {
                        if (err) {
                          console.log('В процессе сохранения изображений произошла ошибка', err, "\n");
                          doAfterPost(err);
                        } else {
                          console.log('Будут сохранены следущюие данные', results, "\n");
                          if (results) {
                            PostAudio.find({post: post._id}, 'attachments_id', function (err, audios) {
                              async.forEach(audios, function (audio, callback) {
                                results.push([{id: audio.attachments_id}]);
                                console.log("results and audios \n", audios, "\n", results);
                                callback();
                              }, function (err) {
                                vk.wallPost(user, null, post, results, function (err, postSaved) {
                                  if (err) {
                                    doAfterPost(err, user);
                                  } else {
                                    console.log('Ответ сервера на запрос добавления поста на стену', postSaved, "\n");
                                    if (typeof postSaved.response != 'undefined') {
                                      console.log("Отмечаем пост как отправленный", post);
                                      post.posted = true;
                                      post.save(function (err, post) {
                                        doAfterPost();
                                      });
                                    } else {
                                      doAfterPost(postSaved, user);
                                    }
                                  }
                                });
                              });
                            });
                          } else {
                            doAfterPost({error: 'empty posts list'});
                          }
                        }
                      }
                    );
                  }
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
  User.findOne({_id: post.user, is_active: true}, function (err, user) {
    if (user) {
      Group.findOne({user: user._id, _id: post.group}, function (err, group) {
        if (group) {
          vk.getGroupImageUploadUrl(user, group.vk_id, function (err, image_upload_url) {
            if (err) {
              console.log(err);
              doAfterPost(err, user, group);
            } else {
              console.log("Image upload url", image_upload_url, "\n");
              vk.getGroupDocUploadUrl(user, group.vk_id, function (err, doc_upload_url) {
                if (err) {
                  console.log(err);
                  doAfterPost(err)
                } else {
                  console.log("File upload url", doc_upload_url, "\n");
                  PostImage.find({post: post._id}, function (err, images) {
                    var saveImage = [];
                    async.forEach(images, function (image, callback) {
                      //добавляем функцию сохранения изображения
                      saveImage.push(function (saveImageCallback) {
                        setTimeout(function () {
                          console.log('Тип документа', image.type, image);
                          if (image.type == 'document') {
                            vk.uploadDoc(image, doc_upload_url, function (vk_res) {
                              console.log("vk.uploadDoc function response ", vk_res);
                              vk.saveDoc(user, vk_res, function (response) {
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
                            vk.uploadImage(image, image_upload_url, function (vk_res) {
                              console.log("vk.uploadImage function response ", vk_res);
                              vk.saveGroupImage(user, group.vk_id, JSON.parse(vk_res), function (response) {
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
                    }, function (err) {
                      async.series(
                        saveImage,
                        function (err, results) {
                          if (err) {
                            console.log('В процессе сохранения изображений произошла ошибка', err, "\n");
                            doAfterPost(err);
                          } else {
                            console.log('Будут сохранены следущюие данные', results, "\n");
                            if (results) {
                              vk.wallPost(user, group.vk_id, post, results, function (err, postSaved) {
                                if (err) {
                                  doAfterPost(err);
                                } else {
                                  console.log('Ответ сервера на запрос добавления поста на стену', postSaved, "\n");
                                  if (typeof postSaved.response != 'undefined') {
                                    console.log("Отмечаем пост как отправленный", post);
                                    post.posted = true;
                                    post.save(function (err, post) {
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

exports.savePost = function (req, callback) {
  new Post({
    user: req.session.user._id,
    when: Date.parse(req.body.when),
    group: req.body.group || null,
    description: req.body.description
  }).save(function (err, post, count) {
      callback(err, post);
    });
};

exports.savePostImages = function (post, req, callback) {
  PostImage.find({post: post._id}).remove(function () {
    if (req.body['imageUrl[]'] && req.body['imageUrl[]'].length) {
      if (req.body['imageUrl[]'].constructor !== Array) {
        req.body['imageUrl[]'] = [req.body['imageUrl[]']];
      }
      if (req.body['imagePreview[]'] && req.body['imagePreview[]'].constructor !== Array) {
        req.body['imagePreview[]'] = [req.body['imagePreview[]']];
      }
      if (req.body['imageType[]'].constructor !== Array) {
        req.body['imageType[]'] = [req.body['imageType[]']];
      }
      async.forEachOf(req.body['imageUrl[]'], function (val, key, callback) {
        if (val) {
          new PostImage({
            image_url: val,
            image_preview_url: req.body['imagePreview[]'] && req.body['imagePreview[]'][key] ? req.body['imagePreview[]'][key] : val,
            type: req.body['imageType[]'][key],
            post: post._id
          }).save(function () {
              callback();
            });
        } else {
          callback();
        }
      }, function (err) {
        callback();
      });
    } else {
      callback();
    }
  });
};

exports.savePostAudio = function (post, req, callback) {
  PostAudio.find({post: post._id}).remove(function () {
    if (req.body['audio_name[]'] && req.body['audio_name[]'].length) {
      if (req.body['audio_name[]'].constructor !== Array) {
        req.body['audio_name[]'] = [req.body['audio_name[]']];
        req.body['audio_id[]'] = [req.body['audio_id[]']];
      }
      async.forEachOf(req.body['audio_name[]'], function (val, key, async_callback) {
        new PostAudio({
          attachments_name: val,
          attachments_id: req.body['audio_id[]'][key],
          post: post._id
        }).save(function () {
            async_callback();
          });
      }, function (err) {
        callback();
      });
    } else {
      callback();
    }
  });
};