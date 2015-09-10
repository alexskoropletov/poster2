var config = require('../bin/config');
var restler = require('restler');
var request = require('request');
var fs = require('fs');
var mime = require('mime');
var async = require('async');
var https = require('https');

getRequest = function(getOptions, method, callback) {
  console.log("Обращение к api.vk.com", method, getOptions);
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

getUploadUrl = function(type, user, group_id, callback) {
  var getOptions = [
    'access_token=' + user.vk_token
//    'access_token=' + config.get("vk.access_token")
  ];
  if (group_id) {
    getOptions.push('group_id=' + group_id);
  } else {
    getOptions.push('user_id=' + user.vk_id);
  }
  var method = type != 'image' ? 'docs.getWallUploadServer' : 'photos.getWallUploadServer';
  getRequest(getOptions, method, function(err, res) {
    if (!res || err) {
      console.log("Ошибка обращения к API VK: ", res, err);
      callback(err, null);
    } else {
      callback(null, res.response.upload_url);
    }
  });
};

exports.getImageUploadUrl = function(user, callback) {
  getUploadUrl('image', user, null, callback);
};

exports.getDocUploadUrl = function(user, callback) {
  getUploadUrl('doc', user, null, callback);
};

exports.getGroupImageUploadUrl = function(user, group_id, callback) {
  getUploadUrl('image', user, group_id, callback);
};

exports.getGroupDocUploadUrl = function(user, group_id, callback) {
  getUploadUrl('doc', user, group_id, callback);
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

exports.saveUserImage = function(user, response, callback) {
  if (response) {
    var getOptions = [
      'user_id=' + user.vk_id,
      'access_token=' + user.vk_token,
//      'access_token=' + config.get("vk.access_token"),
      'photo=' + response.photo,
      'server=' + response.server,
      'hash=' + response.hash
    ];
    saveImage(getOptions, callback);
  } else {
    callback({error: new Error("empty vk response on image save")});
  }
};

exports.saveGroupImage = function(user, group_id, response, callback) {
  if (response) {
    var getOptions = [
      'group_id=' + group_id,
      'access_token=' + user.vk_token,
//      'access_token=' + config.get("vk.access_token"),
      'photo=' + response.photo,
      'server=' + response.server,
      'hash=' + response.hash
    ];
    saveImage(getOptions, callback);
  } else {
    callback({error: new Error("empty vk response on image save")});
  }
};

function saveImage(getOptions, callback) {
  getRequest(getOptions, 'photos.saveWallPhoto', function(err, res) {
    if (res && res.response) {
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
}

exports.saveDoc = function(user, response, callback) {
  if (response) {
    var getOptions = [
      'user_id=' + user.vk_id,
      'access_token=' + user.vk_token,
//      'access_token=' + config.get("vk.access_token"),
      'file=' + response.file
    ];
    getRequest(getOptions, 'docs.save', function(err, res) {
      callback(res.response);
    });
  } else {
    callback({error: new Error("empty vk response on file save")});
  }
};

exports.wallPost = function(user, group_id, post, posts, callback) {
  var attachments = [];
  async.forEach(posts, function(post, callbackInner) {
    attachments.push(post[0].id);
    callbackInner();
  }, function(err) {
    var getOptions = [
      'owner_id=' + (group_id ? "-" + group_id : user.vk_id),
      'access_token=' + user.vk_token,
//      'access_token=' + (user.vk_id == 1549016 ? config.get("vk.access_token") : user.vk_token),
//      'access_token=' + config.get("vk.access_token"),
      'from_group=1',
      'attachments=' + attachments.join(","),
      'message=' + (typeof post.description != 'undefined' ? encodeURIComponent(post.description) : '')
    ];
    console.log("Параметры запроса добавления поста", getOptions, "\n");
    getRequest(getOptions, 'wall.post', function(err, res) {
      if (err) {
        callback(err, null);
      } else {
        callback(null, res);
      }
    });
  });
};

exports.getImageUploadUrlCaptcha = function(body, user, callback) {
  getRequest(
    [
      'user_id=' + user.vk_id,
      'access_token=' + user.vk_token,
//      'access_token=' + config.get("vk.access_token"),
      'captcha_key=' + body.captcha_key,
      'captcha_sid=' + body.sid
    ],
    'photos.getWallUploadServer',
    function(err, res) {
      if (err) {
        console.log(err);
      } else {
        callback(null, res.response.upload_url);
      }
    }
  );
};

exports.getGroupImageUploadUrlCaptcha = function(body, user, callback) {
  getRequest(
    [
      'group_id=' + body.group,
      'access_token=' + user.vk_token,
//      'access_token=' + config.get("vk.access_token"),
      'captcha_key=' + body.captcha_key,
      'captcha_sid=' + body.sid
    ],
    'photos.getWallUploadServer',
    function(err, res) {
      if (err) {
        console.log(err);
      } else {
        callback(null, res.response.upload_url);
      }
    }
  );
};