const express = require('express');
const passport = require('passport');
const { Notification } = require('../models');
const { serializeDocument, isValidObjectId, toObjectId } = require('../utils/mongodb-helpers');

const router = express.Router();
const authenticateJWT = passport.authenticate('jwt', { session: false });

// Get user's notifications
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const { unread_only, page = 1, limit = 20 } = req.query;

    const query = { user_id: toObjectId(userId) };
    if (unread_only === 'true') {
      query.is_read = false;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await Notification.find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ user_id: toObjectId(userId), is_read: false });

    res.json({
      success: true,
      notifications: notifications.map(n => serializeDocument(n)),
      total,
      unreadCount,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('❌ GET NOTIFICATIONS Error:', error);
    res.status(500).json({ success: false, message: 'Error fetching notifications' });
  }
});

// Mark notification as read
router.patch('/:id/read', authenticateJWT, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid notification ID' });
    }

    const notification = await Notification.findOne({
      _id: toObjectId(req.params.id),
      user_id: toObjectId(req.user.id)
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    notification.is_read = true;
    await notification.save();

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('❌ MARK READ Error:', error);
    res.status(500).json({ success: false, message: 'Error updating notification' });
  }
});

// Mark all notifications as read
router.post('/mark-all-read', authenticateJWT, async (req, res) => {
  try {
    await Notification.updateMany(
      { user_id: toObjectId(req.user.id), is_read: false },
      { is_read: true }
    );

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('❌ MARK ALL READ Error:', error);
    res.status(500).json({ success: false, message: 'Error updating notifications' });
  }
});

// Create notification (internal use)
router.post('/', async (req, res) => {
  try {
    const { user_id, type, title, message, data } = req.body;

    if (!isValidObjectId(user_id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    const notification = new Notification({
      user_id: toObjectId(user_id),
      type,
      title,
      message,
      data: data || {}
    });

    await notification.save();

    res.status(201).json({ success: true, notification: serializeDocument(notification) });
  } catch (error) {
    console.error('❌ CREATE NOTIFICATION Error:', error);
    res.status(500).json({ success: false, message: 'Error creating notification' });
  }
});

module.exports = router;
