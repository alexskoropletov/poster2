var mongoose = require('mongoose'),
  User = mongoose.model('User'),
  Group = mongoose.model('Group'),
  Source = mongoose.model('Source'),
  SourcePost = mongoose.model('SourcePost'),
  Post = mongoose.model('Post'),
  PostImage = mongoose.model('PostImage'),
  PostAudio = mongoose.model('PostAudio'),
  vk = require('../bin/vk'),
  config = require('../bin/config'),
  moment = require('moment'),
  https = require('https'),
  async = require('async');

exports.getAccessToken = function(user, callback) {
  if (user.vk_code) {
    var getOptions = [
      "client_id=" + config.get('vk.appID'),
      "client_secret=" + config.get('vk.appSecret'),
      "code=" + user.vk_code
    ];
    var options = {
      host: 'oauth.vk.com',
      path: '/access_token?' + getOptions.join("&")
    };
    var request = https.get(options, function(response) {
      var bodyChunks = [];
      response.on('data', function(chunk) {
        bodyChunks.push(chunk);
      }).on('end', function() {
          var body = JSON.parse(Buffer.concat(bodyChunks));
          //если токен получен, и в ответе VK API тот же ID пользователя, что и в базе
          if (body && body.access_token && body.user_id == user.vk_id) {
            user.vk_token = body.access_token;
            user.code = null;
            user.save(function(err, user) {
              if (err) {
                callback(err, null);
              } else {
                callback(null, user);
              }
            });
          } else {
            callback(null, user);
          }
        })
    });
    request.on('socket', function(socket) {
      socket.setTimeout(15000);
      socket.on('timeout', function() {
        console.log('Преывшен таймаут в 30 секунд для GET-запроса');
        request.abort();
      });
    });
    request.on('error', function(e) {
      callback(e, null)
    });
  } else {
    callback(null, user);
  }
};

exports.destroyUser = function(user_id, callback) {
  User.findOne({_id: user_id}, function(err, user) {
    if (user) {
      Group.find({user: user_id}).remove(function() {
        Source.find({user: user_id}, function(err, sources) {
          async.forEach(sources, function(source, sources_callback) {
            SourcePost.find({source: source._id}).remove(function() {
              source.remove(function() {
                sources_callback();
              });
            });
          }, function(err) {
            Post.find({user: user_id}, function(err, posts) {
              async.forEach(posts, function(post, posts_callback) {
                PostImage.find({post: post._id}).remove(function() {
                  PostAudio.find({post: post._id}).remove(function() {
                    post.remove(function() {
                      posts_callback();
                    });
                  });
                });
              }, function(err) {
                user.remove(function() {
                  callback("ok");
                });
              });
            });
          });
        });
      });
    } else {
      callback("error");
    }
  });
};