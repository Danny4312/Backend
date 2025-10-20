const express = require('express');
const passport = require('passport');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const router = express.Router();

// Middleware to authenticate JWT
const authenticateJWT = passport.authenticate('jwt', { session: false });

// Get notifications for user
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    
    let query = `
      SELECT * FROM notifications 
      WHERE user_id = $1
    `;
    const queryParams = [userId];
    
    if (unreadOnly === 'true') {
      query += ` AND is_read = false`;
    }
    
    query += ` ORDER BY created_at DESC`;
    
    // Add pagination
    const offset = (page - 1) * limit;
    query += ` LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(parseInt(limit), offset);

    const result = await db.query(query, queryParams);

    // Get unread count
    const unreadResult = await db.query(
      'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );

    res.json({
      success: true,
      notifications: result.rows.map(notification => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        isRead: notification.is_read,
        createdAt: notification.created_at
      })),
      unreadCount: parseInt(unreadResult.rows[0].unread_count),
      pagination: {
        currentPage: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notifications'
    });
  }
});

// Mark notification as read
router.put('/:id/read', authenticateJWT, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user.id;

    const result = await db.query(`
      UPDATE notifications 
      SET is_read = true 
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [notificationId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating notification'
    });
  }
});

// Mark all notifications as read
router.put('/read-all', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;

    await db.query(`
      UPDATE notifications 
      SET is_read = true 
      WHERE user_id = $1 AND is_read = false
    `, [userId]);

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating notifications'
    });
  }
});

// Create notification (internal use)
const createNotification = async (userId, type, title, message, data = null) => {
  try {
    await db.query(`
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES ($1, $2, $3, $4, $5)
    `, [userId, type, title, message, data ? JSON.stringify(data) : null]);
  } catch (error) {
    console.error('Create notification error:', error);
  }
};

// Notification types and templates
const notificationTemplates = {
  booking_received: (data) => ({
    title: 'New Booking Request',
    message: `You have received a new booking request for "${data.serviceTitle}" from ${data.travelerName}.`
  }),
  booking_confirmed: (data) => ({
    title: 'Booking Confirmed',
    message: `Your booking for "${data.serviceTitle}" has been confirmed by ${data.providerName}.`
  }),
  booking_cancelled: (data) => ({
    title: 'Booking Cancelled',
    message: `The booking for "${data.serviceTitle}" has been cancelled.`
  }),
  payment_received: (data) => ({
    title: 'Payment Received',
    message: `You have received a payment of $${data.amount} for "${data.serviceTitle}".`
  }),
  review_received: (data) => ({
    title: 'New Review',
    message: `You received a ${data.rating}-star review for "${data.serviceTitle}".`
  }),
  premium_activated: (data) => ({
    title: 'Premium Membership Activated',
    message: `Your premium membership is now active and will expire on ${data.validUntil}.`
  }),
  service_featured: (data) => ({
    title: 'Service Featured',
    message: `Your service "${data.serviceTitle}" is now featured and will appear at the top of search results.`
  }),
  welcome: (data) => ({
    title: 'Welcome to iSafari Global!',
    message: `Welcome ${data.firstName}! Your ${data.userType} account has been created successfully.`
  })
};

// Send notification helper function
const sendNotification = async (userId, type, data = {}) => {
  try {
    const template = notificationTemplates[type];
    if (!template) {
      console.error(`Unknown notification type: ${type}`);
      return;
    }

    const { title, message } = template(data);
    await createNotification(userId, type, title, message, data);
  } catch (error) {
    console.error('Send notification error:', error);
  }
};

module.exports = router;
module.exports.sendNotification = sendNotification;
