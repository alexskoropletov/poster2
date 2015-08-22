var config = require('./../bin/config'),
    mongoose = require('mongoose'),
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
  Source.find({}, function(err, sources) {
    async.forEach(sources, function(source, callback){
      client.posts(source.url, {type: 'photo'}, function(err, res) {
        if (err) {
          console.log("Ошибка работы с блогом", source.url, err);
          callback();
        } else {
          SourcePost.find({source: source._id}, function(err, sourcePosts) {
            var sourcePostIds = [];
            async.forEach(sourcePosts, function(sourcePost, sourcePostCallback) {
              sourcePostIds.push(parseInt(sourcePost.post_id));
              sourcePostCallback();
            }, function(err) {
              async.forEach(res.posts, function(post, callbackInner) {
                if (sourcePostIds.indexOf(parseInt(post.id)) == -1) {
                  new SourcePost({
                    post_id: post.id,
                    image: post.photos[0].original_size.url,
                    image_preview: typeof post.photos[0].alt_sizes[3] != 'undefined' ? post.photos[0].alt_sizes[3].url : post.photos[0].original_size.url,
                    source: source._id
                  }).save(function(err, sourcePost, count) {
                      //добавить пост в очередь, добавить картинки к посту
                      Post.find({}).sort({"when": -1}).limit(1).exec(function(err, latest_post) {
                        var nextWhen = Date.now();
                        if (typeof latest_post[0] != 'undefined') {
                          latest_post[0].when.getTime()
                        }
                        nextWhen += config.random() + config.get("post.distance");
                        new Post({
                          title: "autopost from " + source.url,
                          when: nextWhen
                        }).save(function(err, mypost, count) {
                            async.forEach(post.photos, function (val, callbackPostSaving) {
                              new PostImage({
                                image_url: val.original_size.url,
                                image_preview_url: typeof val.alt_sizes[3] != 'undefined' ? val.alt_sizes[3].url : val.original_size.url,
                                type: val.original_size.url.indexOf(".gif") > -1 ? 'document' : 'image',
                                post: mypost._id
                              }).save(function (err, postImage, count) {
                                  callbackPostSaving();
                                });
                            }, function(err) {
                              callbackInner();
                            });
                          });
                      });
                    });
                } else {
                  callbackInner();
                }
              }, function(err){
                callback();
              });
            });
          });
        }
      });
    }, function(err) {
      complete();
    });
  });
};