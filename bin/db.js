var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

var User = new Schema({
  is_active: Boolean,
  name: String,
  login: {type: String, index: { unique: true }},
  password: String,
  email: {type: String, index: { unique: true }},
  vk_user_id: {type: String, index: { unique: true }},
  vk_token: String,
  role: {type: String, enum: ['admin','user']},
  updated_at: Date
});


var Group = new Schema({
  user: {type: ObjectId, ref: 'User'},
  name: String,
  vk_id: String,
  url: String,
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

var Post = new Schema({
  when: {type: Date, default: Date.now},
  description: String,
  user: {type: ObjectId, ref: 'User'},
  group: {type: ObjectId, ref: 'Group'},
  approved: {type: Boolean, default: false},
  posted: {type: Boolean, default: false},
  failed: {type: Boolean, default: false}
});
var PostImage = new Schema({
  image_url: String,
  image_preview_url: String,
  type: {type: String, enum: ['image','document']},
  post: {type: ObjectId, ref: 'Post'}
});

mongoose.model('User', User);
mongoose.model('Group', Group);
mongoose.model('Source', Source);
mongoose.model('SourcePost', SourcePost);
mongoose.model('Post', Post);
mongoose.model('PostImage', PostImage);
mongoose.connect('mongodb://localhost/express-poster');