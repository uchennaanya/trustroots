'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  crypto = require('crypto');

/**
 * A Validation function for local strategy properties
 */
var validateLocalStrategyProperty = function(property) {
  return ((this.provider !== 'local' && !this.updated) || property.length);
};

/**
 * A Validation function for local strategy password
 */
var validateLocalStrategyPassword = function(password) {
  return (this.provider !== 'local' || (password && password.length >= 8));
};

/**
 * A Validation function for username
 * - at least 3 characters
 * - maximum 32 characters
 * - only a-z0-9_-.
 * - not in list of illegal usernames
 * - no consecutive dots: "." ok, ".." nope
 */
var validateUsername = function(username) {
  var usernameRegex = /^[a-z0-9.\-_]{3,32}$/,
      dotsRegex = /^([^.]+\.?)$/,
      illegalUsernames = ['trustroots', 'trust', 'roots', 're', 're:', 'fwd', 'fwd:', 'reply', 'admin', 'administrator', 'user', 'password', 'username', 'unknown', 'anonymous', 'home', 'signup', 'signin', 'edit', 'settings', 'password', 'username', 'user', ' demo', 'test'];
  return (this.provider !== 'local' || ( username &&
                                         usernameRegex.test(username) &&
                                       illegalUsernames.indexOf(username) < 0) &&
                                       dotsRegex.test(username) //strpos(username, '..') === false
                                     );
};

/**
 * User Schema
 */
var UserSchema = new Schema({
  firstName: {
    type: String,
    trim: true,
    default: '',
    validate: [validateLocalStrategyProperty, 'Please fill in your first name']
  },
  lastName: {
    type: String,
    trim: true,
    default: '',
    validate: [validateLocalStrategyProperty, 'Please fill in your last name']
  },
  displayName: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    unique: 'Email already exists',
    lowercase: true,
    default: '',
    validate: [validateLocalStrategyProperty, 'Please fill in your email'],
    match: [/.+\@.+\..+/, 'Please fill a valid email address']
    /* This comment only fixes syntax highlight :P */
  },
  tagline: {
    type: String,
    default: '',
    trim: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  birthdate: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['','male','female','other'],
    default: ''
  },
  languages: {
    type: [{
      type: String,
    }],
    default: []
  },
  locationLiving: {
    type: String
  },
  locationFrom: {
    type: String
  },
  username: {
    type: String,
    unique: 'Username already exists',
    required: 'Please fill in a username',
    validate: [validateUsername, 'Please fill in valid username: 3-32 characters long non banned word, characters "_-.", no consecutive dots, lowercase letters a-z and numbers 0-9.'],
    lowercase: true, // Stops users creating case sensitive duplicate usernames with "username" and "USERname", via @link https://github.com/meanjs/mean/issues/147
    trim: true
  },
  password: {
    type: String,
    default: '',
    validate: [validateLocalStrategyPassword, 'Password should be more than 8 characters long.']
  },
  emailHash: {
    type: String,
  },
  salt: {
    type: String
  },
  provider: {
    type: String,
    required: 'Provider is required'
  },
  providerData: {},
  additionalProvidersData: {},
  roles: {
    type: [{
      type: String,
      enum: ['user', 'admin']
    }],
    default: ['user']
  },
  seen: {
    type: Date
  },
  updated: {
    type: Date
  },
  created: {
    type: Date,
    default: Date.now
  },
  avatarSource: {
    type: String,
    enum: ['none','gravatar','facebook','local'],
    default: 'gravatar'
  },
  newsletter: {
    type: Boolean,
    default: false
  },
  /* For reset password */
  resetPasswordToken: {
    type: String
  },
  resetPasswordExpires: {
    type: Date
  }
});

/**
 * Hook a pre save method to hash the password
 */
UserSchema.pre('save', function(next) {
  if (this.password && this.password.length > 6) {
    this.salt = new Buffer(crypto.randomBytes(16).toString('base64'), 'base64');
    this.password = this.hashPassword(this.password);
  }

  // Pre-cached email hash to use with Gravatar
  this.emailHash = crypto.createHash('md5').update( this.email.trim().toLowerCase() ).digest('hex');

  next();
});

/**
 * Create instance method for hashing a password
 */
UserSchema.methods.hashPassword = function(password) {
  if (this.salt && password) {
    return crypto.pbkdf2Sync(password, this.salt, 10000, 64).toString('base64');
  } else {
    return password;
  }
};

/**
 * Create instance method for authenticating user
 */
UserSchema.methods.authenticate = function(password) {
  return this.password === this.hashPassword(password);
};

/**
 * Find possible not used username
 */
UserSchema.statics.findUniqueUsername = function(username, suffix, callback) {
  var _this = this;
  var possibleUsername = username + (suffix || '');

  _this.findOne({
    username: possibleUsername
  }, function(err, user) {
    if (!err) {
      if (!user) {
        callback(possibleUsername);
      } else {
        return _this.findUniqueUsername(username, (suffix || 0) + 1, callback);
      }
    } else {
      callback(null);
    }
  });
};

mongoose.model('User', UserSchema);
