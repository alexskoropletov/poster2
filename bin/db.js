var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

var User = new Schema({
  is_active: Boolean,
  name: String,
  login: {type: String, index: { unique: true }},
  password: String,
  email: {type: String, index: { unique: true }},
  vk_id: {type: String, index: { unique: true }},
  vk_token: String,
  post_interval: String,
  post_hours: String,
  post_random: {type: String, default: 0},
  role: {type: String, enum: ['admin','user']},
  last_login: {type: Date, default: Date.now},
  updated_at: Date
});


var Group = new Schema({
  user: {type: ObjectId, ref: 'User'},
  name: String,
  vk_id: String,
  url: String,
  post_interval: String,
  post_hours: String,
  post_random: {type: String, default: 0},
  updated_at: Date
});

var Source = new Schema({
  user: {type: ObjectId, ref: 'User'},
  url: String,
  comment: String,
  approved: {type: Boolean, default: false},
  group: {type: ObjectId, ref: 'Group'},
  updated_at: Date
});
var SourcePost = new Schema({
  post_id: String,
  image: String,
  image_preview: String,
  source: {type: ObjectId, ref: 'Source'}
});

//source.url - выбрать из source where sourcepost.source = source.id where sourcepost.image = postimage.image_url where postimage.post = post.id

var Post = new Schema({
  when: {type: Date, default: Date.now},
  description: String,
  user: {type: ObjectId, ref: 'User'},
  group: {type: ObjectId, ref: 'Group'},
  approved: {type: Boolean, default: false},
  posted: {type: Boolean, default: false},
  failed: {type: Boolean, default: false},
  original_post: {type: String, default: null},
  created_at: {type: Date, default: Date.now}
});
var PostImage = new Schema({
  image_url: String,
  image_preview_url: String,
  type: {type: String, enum: ['image','document']},
  post: {type: ObjectId, ref: 'Post'}
});
var PostAudio = new Schema({
  attachments_name: String,
  attachments_id: String,
  post: {type: ObjectId, ref: 'Post'}
});

mongoose.model('User', User);
mongoose.model('Group', Group);
mongoose.model('Source', Source);
mongoose.model('SourcePost', SourcePost);
mongoose.model('Post', Post);
mongoose.model('PostImage', PostImage);
mongoose.model('PostAudio', PostAudio);
mongoose.connect('mongodb://localhost/express-poster');