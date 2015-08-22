var CronJob = require('cron').CronJob,
    tumblr = require('./tumblr'),
    poster2 = require('./post');

var postJob = new CronJob({
  cronTime: '00 * * * * *',
  onTick: function() {
    var thisMinute = new Date();
    var filter = {
      posted: false,
      when: {
        "$gt": thisMinute,
        "$lte": new Date(thisMinute.getTime() + 60 * 1000)
      }
    };
    poster2.doPost(filter, function() {
      console.log('posted');
    });
  },
  start: true,
  timeZone: 'Europe/Moscow'
});

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

var catchUpJob = new CronJob({
  cronTime: '00 */15 * * * *',
  onTick: function() {
    poster2.catchUp(function() {
      console.log('catched');
    });
  },
  start: true,
  timeZone: 'Europe/Moscow'
});

var scheduleJob = new CronJob({
  cronTime: '00 */30 * * * *',
  onTick: function() {
    poster2.addPostTime(Date.now(), function() {
      console.log('scheduled');
    });
  },
  start: true,
  timeZone: 'Europe/Moscow'
});

exports.scheduleJob = scheduleJob;
exports.postJob = postJob;
exports.corovanJob = corovanJob;
exports.catchUpJob = catchUpJob;