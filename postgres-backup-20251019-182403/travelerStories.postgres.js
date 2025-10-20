const express = require('express');
const passport = require('passport');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const multer = require('multer');
const path = require('path');
const router = express.Router();

// Middleware to authenticate JWT
const authenticateJWT = passport.authenticate('jwt', { session: false });

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/stories/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'story-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images and videos are allowed!'));
    }
  }
});

// Get all approved traveler stories (public)
router.get('/', async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    const query = `
      SELECT ts.*, u.first_name, u.last_name, u.email, u.profile_image,
             (SELECT COUNT(*) FROM story_likes WHERE story_id = ts.id) as likes_count,
             (SELECT COUNT(*) FROM story_comments WHERE story_id = ts.id) as comments_count
      FROM traveler_stories ts
      JOIN users u ON ts.user_id = u.id
      WHERE ts.is_approved = true AND ts.is_active = true
      ORDER BY ts.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await db.query(query, [limit, offset]);

    // Get total count
    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM traveler_stories WHERE is_approved = true AND is_active = true'
    );

    res.json({
      success: true,
      stories: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Get stories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching stories'
    });
  }
});

// Get featured stories for homepage (top 3 most liked)
router.get('/featured', async (req, res) => {
  try {
    const query = `
      SELECT ts.*, u.first_name, u.last_name, u.profile_image,
             (SELECT COUNT(*) FROM story_likes WHERE story_id = ts.id) as likes_count,
             (SELECT COUNT(*) FROM story_comments WHERE story_id = ts.id) as comments_count
      FROM traveler_stories ts
      JOIN users u ON ts.user_id = u.id
      WHERE ts.is_approved = true AND ts.is_active = true
      ORDER BY likes_count DESC, ts.created_at DESC
      LIMIT 3
    `;

    const result = await db.query(query);

    res.json({
      success: true,
      stories: result.rows
    });
  } catch (error) {
    console.error('Get featured stories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching featured stories'
    });
  }
});

// Get my stories (traveler only)
router.get('/my-stories', authenticateJWT, async (req, res) => {
  try {
    const query = `
      SELECT ts.*, u.profile_image,
             (SELECT COUNT(*) FROM story_likes WHERE story_id = ts.id) as likes_count,
             (SELECT COUNT(*) FROM story_comments WHERE story_id = ts.id) as comments_count
      FROM traveler_stories ts
      JOIN users u ON ts.user_id = u.id
      WHERE ts.user_id = $1
      ORDER BY ts.created_at DESC
    `;

    const result = await db.query(query, [req.user.id]);

    res.json({
      success: true,
      stories: result.rows
    });
  } catch (error) {
    console.error('Get my stories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching your stories'
    });
  }
});

// Create new story
router.post(
  '/',
  authenticateJWT,
  upload.array('media', 5), // Allow up to 5 files
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('story').trim().notEmpty().withMessage('Story content is required'),
    body('location').trim().notEmpty().withMessage('Location is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { title, story, location, duration, highlights } = req.body;

      // Process uploaded files
      const mediaFiles = req.files ? req.files.map(file => ({
        url: `/uploads/stories/${file.filename}`,
        type: file.mimetype.startsWith('video') ? 'video' : 'image',
        filename: file.filename
      })) : [];

      const query = `
        INSERT INTO traveler_stories 
        (user_id, title, story, location, duration, highlights, media, is_approved, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true, true)
        RETURNING *
      `;

      // Parse highlights safely
      let parsedHighlights = [];
      if (highlights) {
        try {
          parsedHighlights = typeof highlights === 'string' ? JSON.parse(highlights) : highlights;
        } catch (e) {
          console.error('Error parsing highlights:', e);
          parsedHighlights = [];
        }
      }

      const result = await db.query(query, [
        req.user.id,
        title,
        story,
        location,
        duration || null,
        parsedHighlights,
        JSON.stringify(mediaFiles)
      ]);

      res.status(201).json({
        success: true,
        message: 'Story published successfully! It is now visible to everyone.',
        story: result.rows[0]
      });
    } catch (error) {
      console.error('Create story error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while creating story'
      });
    }
  }
);

// Update story
router.put('/:id', authenticateJWT, async (req, res) => {
  try {
    const storyId = req.params.id;
    const { title, story, location, duration, highlights } = req.body;

    // Verify story belongs to user
    const checkResult = await db.query(
      'SELECT * FROM traveler_stories WHERE id = $1 AND user_id = $2',
      [storyId, req.user.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Story not found or you do not have permission to edit it'
      });
    }

    const query = `
      UPDATE traveler_stories 
      SET title = $1, story = $2, location = $3, duration = $4, 
          highlights = $5, is_approved = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND user_id = $7
      RETURNING *
    `;

    const result = await db.query(query, [
      title,
      story,
      location,
      duration,
      highlights,
      storyId,
      req.user.id
    ]);

    res.json({
      success: true,
      message: 'Story updated successfully! It will be reviewed again.',
      story: result.rows[0]
    });
  } catch (error) {
    console.error('Update story error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating story'
    });
  }
});

// Delete story
router.delete('/:id', authenticateJWT, async (req, res) => {
  try {
    const storyId = req.params.id;

    // Verify story belongs to user
    const checkResult = await db.query(
      'SELECT * FROM traveler_stories WHERE id = $1 AND user_id = $2',
      [storyId, req.user.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Story not found or you do not have permission to delete it'
      });
    }

    await db.query(
      'UPDATE traveler_stories SET is_active = false WHERE id = $1',
      [storyId]
    );

    res.json({
      success: true,
      message: 'Story deleted successfully'
    });
  } catch (error) {
    console.error('Delete story error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting story'
    });
  }
});

// Like a story
router.post('/:id/like', authenticateJWT, async (req, res) => {
  try {
    const storyId = req.params.id;

    // Check if already liked
    const checkLike = await db.query(
      'SELECT * FROM story_likes WHERE story_id = $1 AND user_id = $2',
      [storyId, req.user.id]
    );

    if (checkLike.rows.length > 0) {
      // Unlike
      await db.query(
        'DELETE FROM story_likes WHERE story_id = $1 AND user_id = $2',
        [storyId, req.user.id]
      );
      
      res.json({
        success: true,
        message: 'Story unliked',
        liked: false
      });
    } else {
      // Like
      await db.query(
        'INSERT INTO story_likes (story_id, user_id) VALUES ($1, $2)',
        [storyId, req.user.id]
      );
      
      res.json({
        success: true,
        message: 'Story liked',
        liked: true
      });
    }
  } catch (error) {
    console.error('Like story error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while liking story'
    });
  }
});

// Get comments for a story
router.get('/:id/comments', async (req, res) => {
  try {
    const storyId = req.params.id;

    const query = `
      SELECT sc.*, u.first_name, u.last_name
      FROM story_comments sc
      JOIN users u ON sc.user_id = u.id
      WHERE sc.story_id = $1
      ORDER BY sc.created_at DESC
    `;

    const result = await db.query(query, [storyId]);

    res.json({
      success: true,
      comments: result.rows
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching comments'
    });
  }
});

// Add comment to story
router.post('/:id/comments', authenticateJWT, async (req, res) => {
  try {
    const storyId = req.params.id;
    const { comment } = req.body;

    if (!comment || comment.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Comment cannot be empty'
      });
    }

    const query = `
      INSERT INTO story_comments (story_id, user_id, comment)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const result = await db.query(query, [storyId, req.user.id, comment]);

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      comment: result.rows[0]
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding comment'
    });
  }
});

module.exports = router;
