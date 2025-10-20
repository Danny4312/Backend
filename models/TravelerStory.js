const mongoose = require('mongoose');

const travelerStorySchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  story: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  duration: {
    type: String,
    trim: true
  },
  highlights: {
    type: [String],
    default: []
  },
  media: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },
  is_approved: {
    type: Boolean,
    default: false
  },
  is_active: {
    type: Boolean,
    default: true
  },
  likes_count: {
    type: Number,
    default: 0
  },
  comments_count: {
    type: Number,
    default: 0
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes
travelerStorySchema.index({ user_id: 1 });
travelerStorySchema.index({ is_approved: 1, is_active: 1 });
travelerStorySchema.index({ created_at: -1 });

module.exports = mongoose.model('TravelerStory', travelerStorySchema);
