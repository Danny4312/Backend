const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: function() {
      return !this.google_id; // Password not required for Google OAuth users
    }
  },
  first_name: {
    type: String,
    trim: true
  },
  last_name: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  user_type: {
    type: String,
    required: true,
    enum: ['traveler', 'service_provider']
  },
  google_id: {
    type: String,
    sparse: true
  },
  avatar_url: {
    type: String
  },
  is_verified: {
    type: Boolean,
    default: false
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes
userSchema.index({ email: 1 });
// Sparse unique index for google_id - allows multiple null values
userSchema.index({ google_id: 1 }, { unique: true, sparse: true, partialFilterExpression: { google_id: { $exists: true, $ne: null } } });
userSchema.index({ user_type: 1 });

module.exports = mongoose.model('User', userSchema);
