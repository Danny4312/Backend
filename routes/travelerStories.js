const express = require('express');
const passport = require('passport');
const { TravelerStory, StoryLike, StoryComment, User } = require('../models');
const { serializeDocument, isValidObjectId, toObjectId } = require('../utils/mongodb-helpers');

const router = express.Router();
const authenticateJWT = passport.authenticate('jwt', { session: false });

// Get all approved stories (public)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const stories = await TravelerStory.find({ is_approved: true, is_active: true })
      .populate('user_id', 'first_name last_name avatar_url')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await TravelerStory.countDocuments({ is_approved: true, is_active: true });

    res.json({
      success: true,
      stories: stories.map(s => serializeDocument(s)),
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('❌ GET STORIES Error:', error);
    res.status(500).json({ success: false, message: 'Error fetching stories' });
  }
});

// Get story by ID
router.get('/:id', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid story ID' });
    }

    const story = await TravelerStory.findById(req.params.id)
      .populate('user_id', 'first_name last_name avatar_url')
      .lean();

    if (!story) {
      return res.status(404).json({ success: false, message: 'Story not found' });
    }

    const comments = await StoryComment.find({ story_id: story._id })
      .populate('user_id', 'first_name last_name avatar_url')
      .sort({ created_at: -1 })
      .limit(20)
      .lean();

    res.json({
      success: true,
      story: {
        ...serializeDocument(story),
        comments: comments.map(c => serializeDocument(c))
      }
    });
  } catch (error) {
    console.error('❌ GET STORY Error:', error);
    res.status(500).json({ success: false, message: 'Error fetching story' });
  }
});

// Create new story
router.post('/', authenticateJWT, async (req, res) => {
  try {
    const { title, story, location, duration, highlights, media } = req.body;

    const newStory = new TravelerStory({
      user_id: toObjectId(req.user.id),
      title,
      story,
      location,
      duration,
      highlights: highlights || [],
      media: media || [],
      is_approved: false
    });

    await newStory.save();

    res.status(201).json({
      success: true,
      message: 'Story submitted for approval',
      story: serializeDocument(newStory)
    });
  } catch (error) {
    console.error('❌ CREATE STORY Error:', error);
    res.status(500).json({ success: false, message: 'Error creating story' });
  }
});

// Like story
router.post('/:id/like', authenticateJWT, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid story ID' });
    }

    const existingLike = await StoryLike.findOne({
      story_id: toObjectId(req.params.id),
      user_id: toObjectId(req.user.id)
    });

    if (existingLike) {
      return res.status(400).json({ success: false, message: 'Already liked' });
    }

    const like = new StoryLike({
      story_id: toObjectId(req.params.id),
      user_id: toObjectId(req.user.id)
    });

    await like.save();
    await TravelerStory.findByIdAndUpdate(req.params.id, { $inc: { likes_count: 1 } });

    res.json({ success: true, message: 'Story liked' });
  } catch (error) {
    console.error('❌ LIKE STORY Error:', error);
    res.status(500).json({ success: false, message: 'Error liking story' });
  }
});

// Add comment
router.post('/:id/comment', authenticateJWT, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid story ID' });
    }

    const { comment } = req.body;
    if (!comment || !comment.trim()) {
      return res.status(400).json({ success: false, message: 'Comment is required' });
    }

    const newComment = new StoryComment({
      story_id: toObjectId(req.params.id),
      user_id: toObjectId(req.user.id),
      comment: comment.trim()
    });

    await newComment.save();
    await TravelerStory.findByIdAndUpdate(req.params.id, { $inc: { comments_count: 1 } });

    res.status(201).json({ success: true, message: 'Comment added', comment: serializeDocument(newComment) });
  } catch (error) {
    console.error('❌ ADD COMMENT Error:', error);
    res.status(500).json({ success: false, message: 'Error adding comment' });
  }
});

module.exports = router;
