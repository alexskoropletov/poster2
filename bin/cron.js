var CronJob = require('cron').CronJob,
  tumblr = require('./tumblr'),
  poster2 = require('./post'),
  async = require('async')
  mongoose = require('mongoose'),
  User = mongoose.model('User');

var corovanJob = new CronJob({
  cronTime: '00 */10 * * * *',
  onTick: function() {
    tumblr.parseBlog(function() {
      console.log('parsed');
    });
  },
  start: true,
  timeZone: 'Europe/Moscow'
});

var postJob = new CronJob({
  cronTime: '00 * * * * *',
  onTick: function() {
    var thisMinute = new Date();
    var filter = {
      posted: false,
      approved: true,
      when: {
        "$gt": thisMinute,
        "$lte": new Date(thisMinute.getTime() + 60 * 1000)
      }
    };
    poster2.doPost(filter, function(err) {
      if (err) {
        console.log(err);
      } else {
        console.log('posted');
      }
    });
  },
  start: true,
  timeZone: 'Europe/Moscow'
});

var catchUpJob = new CronJob({
  cronTime: '00 */15 * * * *',
  onTick: function() {
    User.find({is_active: true}, function(err, users) {
      async.forEach(users, function(user, callback) {
        poster2.catchUp(user, function() {
          callback();
        });
      }, function(err) {
        console.log('catch', new Date());
      });
    });
  },
  start: true,
  timeZone: 'Europe/Moscow'
});

////var scheduleJob = new CronJob({
////  cronTime: '00 */30 * * * *',
////  onTick: function() {
////    poster2.addPostTime(Date.now(), function() {
////      console.log('scheduled');
////    });
////  },
////  start: true,
////  timeZone: 'Europe/Moscow'
////});
//
exports.corovanJob = corovanJob;
exports.postJob = postJob;
exports.catchUpJob = catchUpJob;
////exports.scheduleJob = scheduleJob;