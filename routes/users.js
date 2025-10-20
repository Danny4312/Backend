const express = require('express');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const { body, validationResult } = require('express-validator');
const { User, ServiceProvider } = require('../models');
const { serializeDocument, isValidObjectId, toObjectId } = require('../utils/mongodb-helpers');

const router = express.Router();
const authenticateJWT = passport.authenticate('jwt', { session: false });

// Get user profile
router.get('/profile', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('👤 [GET PROFILE] User:', userId);

    const user = await User.findById(userId).select('-password').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // If service provider, get provider profile
    let providerProfile = null;
    if (user.user_type === 'service_provider') {
      providerProfile = await ServiceProvider.findOne({ user_id: user._id }).lean();
    }

    res.json({
      success: true,
      user: {
        ...serializeDocument(user),
        providerProfile: providerProfile ? serializeDocument(providerProfile) : null
      }
    });
  } catch (error) {
    console.error('❌ GET PROFILE Error:', error);
    res.status(500).json({ success: false, message: 'Error fetching profile' });
  }
});

// Update user profile
router.put('/profile', [authenticateJWT, body('email').optional().isEmail()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const userId = req.user.id;
    const { first_name, last_name, phone, avatar_url } = req.body;

    console.log('✏️ [UPDATE PROFILE] User:', userId);

    const updateData = {};
    if (first_name) updateData.first_name = first_name;
    if (last_name) updateData.last_name = last_name;
    if (phone) updateData.phone = phone;
    if (avatar_url) updateData.avatar_url = avatar_url;

    const user = await User.findByIdAndUpdate(userId, updateData, { new: true }).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log('✅ Profile updated');

    res.json({ success: true, message: 'Profile updated successfully', user: serializeDocument(user) });
  } catch (error) {
    console.error('❌ UPDATE PROFILE Error:', error);
    res.status(500).json({ success: false, message: 'Error updating profile' });
  }
});

// Change password
router.post('/change-password', [
  authenticateJWT,
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    console.log('🔒 [CHANGE PASSWORD] User:', userId);

    const user = await User.findById(userId);
    if (!user || !user.password) {
      return res.status(400).json({ success: false, message: 'Cannot change password for this account' });
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    console.log('✅ Password changed');

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('❌ CHANGE PASSWORD Error:', error);
    res.status(500).json({ success: false, message: 'Error changing password' });
  }
});

// Get all users (admin only - simplified)
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const { page = 1, limit = 20, user_type } = req.query;
    
    const query = {};
    if (user_type) query.user_type = user_type;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(query)
      .select('-password')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      users: users.map(u => serializeDocument(u)),
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('❌ GET USERS Error:', error);
    res.status(500).json({ success: false, message: 'Error fetching users' });
  }
});

module.exports = router;
