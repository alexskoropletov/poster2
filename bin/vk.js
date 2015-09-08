var config = require('../bin/config');
var VK = require('vksdk');
var restler = require('restler');
var request = require('request');
var fs = require('fs');
var mime = require('mime');
var async = require('async');
var https = require('https');

var vk = new VK({
  'appId': config.get("vk.appID"),
  'appSecret': config.get("vk.appSecret"),
  'secure': true
});
vk.setToken(config.get("vk.access_token"));

getRequest = function(getOptions, method, callback) {
  var options = {
    host: 'api.vk.com',
    path: '/method/' + method + '?' + getOptions.join("&")
  };
  console.log("get request options", options, "\n");
  var req = https.get(options, function(res) {
    var bodyChunks = [];
    res.on('data', function(chunk) {
      console.log('chunk revieved\n');
      bodyChunks.push(chunk);
    }).on('end', function() {
        var body = JSON.parse(Buffer.concat(bodyChunks));
        if (typeof body.response != 'undefined') {
          callback(null, body);
        } else {
          callback(body, null);
        }
      })
  });
  req.on('socket', function(socket) {
    socket.setTimeout(30000);
    socket.on('timeout', function() {
      console.log('Преывшен таймаут в 30 секунд для GET-запроса');
      req.abort();
    });
  });
  req.on('error', function(e) {
    callback(e, null)
  });
};

getUploadUrl = function(type, callback) {
  var getOptions = [
    'user_id=' + config.get("vk.user_id"),
    'access_token=' + config.get("vk.access_token")
  ];
  var method = 'photos.getWallUploadServer';
  if (type != 'image') {
    method = 'docs.getWallUploadServer';
  }
  getRequest(getOptions, method, function(err, res) {
    if (!res || err) {
      console.log("Ошибка обращения к API VK: ", res, err);
      callback(err, null);
    } else {
      callback(null, res.response.upload_url);
    }
  });
};

exports.getImageUploadUrl = function(callback) {
  getUploadUrl('image', callback);
};

exports.getDocUploadUrl = function(callback) {
  getUploadUrl('doc', callback);
};

uploadFile = function(type, image, upload_url, callback) {
  if (image.image_url) {
    var new_file_name = "log/" + image._id + (image.image_url.indexOf(".gif") > -1 ? ".gif" : ".jpg");
    var r = request(image.image_url).pipe(fs.createWriteStream(new_file_name));
    r.on('finish', function () {
      fs.stat(new_file_name, function(err, stats) {
        var data = {};
        data[type] = restler.file(new_file_name, null, stats.size, null, mime.lookup(new_file_name));
        restler.post(
          upload_url,
          {
            multipart: true,
            data: data
          }
        ).on("error", function(err, response) {
            console.log(err);
            console.log(response);
            fs.unlink(new_file_name, function() {
              callback(null);
            });
          }).on("fail", function(data, response) {
            console.log(data);
            console.log(response);
          }).on("complete", function(data) {
            fs.unlink(new_file_name, function() {
              callback(data);
            });
          });
      });
    });
  } else {
    callback('');
  }
};

exports.uploadImage = function(image, upload_url, callback) {
  uploadFile('photo', image, upload_url, callback);
};

exports.uploadDoc = function(image, upload_url, callback) {
  uploadFile('file', image, upload_url, callback);
};

exports.saveImage = function(response, callback) {
  if (response) {
    var getOptions = [
      'user_id=' + config.get("vk.user_id"),
      'access_token=' + config.get("vk.access_token"),
      'photo=' + response.photo,
      'server=' + response.server,
      'hash=' + response.hash
    ];
    getRequest(getOptions, 'photos.saveWallPhoto', function(err, res) {
      if (res.response) {
        callback(res.response);
      } else {
        console.log(err);
        callback({
          error: new Error("empty vk response on photos.saveWallPhoto"),
          res: res,
          err: err
        });
      }
    });
  } else {
    callback({error: new Error("empty vk response on image save")});
  }
};

exports.saveDoc = function(response, callback) {
  if (response) {
    var getOptions = [
      'user_id=' + config.get("vk.user_id"),
      'access_token=' + config.get("vk.access_token"),
      'file=' + response.file
    ];
    getRequest(getOptions, 'docs.save', function(err, res) {
      callback(res.response);
    });
  } else {
    callback({error: new Error("empty vk response on file save")});
  }
};

exports.wallPost = function(post, posts, callback) {
  var attachments = [];
  async.forEach(posts, function(post, callbackInner) {
    attachments.push(post[0].id);
    callbackInner();
  }, function(err) {
    var getOptions = [
      'owner_id=' + config.get("vk.user_id"),
      'access_token=' + config.get("vk.access_token"),
      'message=' + (typeof post.description != 'undefined' ? encodeURIComponent(post.description) : ''),
      'attachments=' + attachments.join(",")
    ];
    console.log("Параметры запроса добавления поста", getOptions, "\n");
    getRequest(getOptions, 'wall.post', function(err, res) {
      console.log(res);
      callback(res);
    });
  });
};

exports.getImageUploadUrlCaptcha = function(body, callback) {
  vk.request(
    'photos.getWallUploadServer',
    {
      'user_id' : config.get("vk.user_id"),
      captcha_key: body.captcha_key,
      captcha_sid: body.sid
    },
    function(res) {
      console.log(res);
      if (typeof res.response != 'undefined') {
        callback(null, res.response.upload_url);
      } else {
        callback(res.error, null);
      }
    }
  );
};