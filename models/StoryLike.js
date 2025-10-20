const mongoose = require('mongoose');

const storyLikeSchema = new mongoose.Schema({
  story_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TravelerStory',
    required: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false }
});

// Ensure unique likes
storyLikeSchema.index({ story_id: 1, user_id: 1 }, { unique: true });
storyLikeSchema.index({ story_id: 1 });

module.exports = mongoose.model('StoryLike', storyLikeSchema);
