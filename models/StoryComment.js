const mongoose = require('mongoose');

const storyCommentSchema = new mongoose.Schema({
  story_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TravelerStory',
    required: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  comment: {
    type: String,
    required: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes
storyCommentSchema.index({ story_id: 1 });
storyCommentSchema.index({ user_id: 1 });

module.exports = mongoose.model('StoryComment', storyCommentSchema);
