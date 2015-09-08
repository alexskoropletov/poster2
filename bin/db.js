var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

var User = new Schema({
  login: String,
  password: String,
  email: String,
  vk_group_id: String,
  vk_user_id: String,
  vk_token: String,
  role: {type: String, enum: ['admin','user']},
  updated_at: Date
});


var Source = new Schema({
  user: {type: ObjectId, ref: 'User'},
  url: String,
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
  approved: {type: Boolean, default: false},
  posted: {type: Boolean, default: false}
});
var PostImage = new Schema({
  image_url: String,
  image_preview_url: String,
  type: {type: String, enum: ['image','document']},
  post: {type: ObjectId, ref: 'Post'}
});

mongoose.model('User', User);
mongoose.model('Source', Source);
mongoose.model('SourcePost', SourcePost);
mongoose.model('Post', Post);
mongoose.model('PostImage', PostImage);
mongoose.connect('mongodb://localhost/express-poster');