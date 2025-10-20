const express = require('express');
const passport = require('passport');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const db = require('../config/database');
const router = express.Router();

// Middleware to authenticate JWT
const authenticateJWT = passport.authenticate('jwt', { session: false });

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/avatars/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Get user profile
router.get('/profile', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user data
    const userResult = await db.query(`
      SELECT u.*, sp.id as provider_id, sp.business_name, sp.location, sp.service_categories,
             sp.location_data, sp.rating, sp.total_bookings
      FROM users u
      LEFT JOIN service_providers sp ON u.id = sp.user_id
      WHERE u.id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        userType: user.user_type,
        avatarUrl: user.avatar_url,
        isVerified: user.is_verified,
        isActive: user.is_active,
        createdAt: user.created_at,
        // Service provider specific data
        ...(user.user_type === 'service_provider' && user.provider_id && {
          provider: {
            id: user.provider_id,
            business_name: user.business_name,
            location: user.location,
            service_categories: user.service_categories || [],
            location_data: user.location_data || {},
            rating: parseFloat(user.rating) || 0,
            total_bookings: user.total_bookings || 0
          }
        })
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching profile'
    });
  }
});

// Update user profile
router.put('/profile', [
  authenticateJWT,
  body('firstName').optional().trim().isLength({ min: 1 }),
  body('lastName').optional().trim().isLength({ min: 1 }),
  body('phone').optional().isMobilePhone()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const { firstName, lastName, phone } = req.body;

    // Update user profile
    const updateResult = await db.query(`
      UPDATE users 
      SET first_name = COALESCE($1, first_name),
          last_name = COALESCE($2, last_name),
          phone = COALESCE($3, phone),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [firstName, lastName, phone, userId]);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = updateResult.rows[0];

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        userType: user.user_type,
        avatarUrl: user.avatar_url,
        isVerified: user.is_verified
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating profile'
    });
  }
});

// Update service provider business profile
router.put('/business-profile', [
  authenticateJWT,
  body('businessName').optional().trim().isLength({ min: 1 }),
  body('businessType').optional().trim().isLength({ min: 1 }),
  body('description').optional().trim(),
  body('location').optional().trim(),
  body('country').optional().trim(),
  body('region').optional().trim(),
  body('district').optional().trim(),
  body('area').optional().trim(),
  body('licenseNumber').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    
    // Check if user is a service provider
    if (req.user.user_type !== 'service_provider') {
      return res.status(403).json({
        success: false,
        message: 'Only service providers can update business profile'
      });
    }

    const { businessName, businessType, description, location, country, region, district, area, licenseNumber } = req.body;

    // Update service provider profile
    const updateResult = await db.query(`
      UPDATE service_providers 
      SET business_name = COALESCE($1, business_name),
          business_type = COALESCE($2, business_type),
          description = COALESCE($3, description),
          location = COALESCE($4, location),
          country = COALESCE($5, country),
          region = COALESCE($6, region),
          district = COALESCE($7, district),
          area = COALESCE($8, area),
          license_number = COALESCE($9, license_number),
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $10
      RETURNING *
    `, [businessName, businessType, description, location, country, region, district, area, licenseNumber, userId]);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service provider profile not found'
      });
    }

    const businessProfile = updateResult.rows[0];

    res.json({
      success: true,
      message: 'Business profile updated successfully',
      businessProfile: {
        businessName: businessProfile.business_name,
        businessType: businessProfile.business_type,
        description: businessProfile.description,
        location: businessProfile.location,
        country: businessProfile.country,
        region: businessProfile.region,
        district: businessProfile.district,
        area: businessProfile.area,
        licenseNumber: businessProfile.license_number,
        rating: parseFloat(businessProfile.rating) || 0,
        totalBookings: businessProfile.total_bookings || 0,
        isVerified: businessProfile.is_verified || false
      }
    });
  } catch (error) {
    console.error('Update business profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating business profile'
    });
  }
});

// Get user dashboard stats
router.get('/dashboard-stats', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.user_type;

    if (userType === 'traveler') {
      // Get traveler stats
      const bookingsResult = await db.query(`
        SELECT 
          COUNT(*) as total_bookings,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_trips,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_bookings,
          COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_bookings
        FROM bookings 
        WHERE traveler_id = $1
      `, [userId]);

      const stats = bookingsResult.rows[0];

      res.json({
        success: true,
        stats: {
          totalBookings: parseInt(stats.total_bookings) || 0,
          completedTrips: parseInt(stats.completed_trips) || 0,
          pendingBookings: parseInt(stats.pending_bookings) || 0,
          confirmedBookings: parseInt(stats.confirmed_bookings) || 0
        }
      });
    } else if (userType === 'service_provider') {
      // Get service provider stats
      const providerResult = await db.query(`
        SELECT sp.id FROM service_providers sp WHERE sp.user_id = $1
      `, [userId]);

      if (providerResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Service provider profile not found'
        });
      }

      const providerId = providerResult.rows[0].id;

      const [servicesResult, bookingsResult, revenueResult] = await Promise.all([
        db.query('SELECT COUNT(*) as total_services FROM services WHERE provider_id = $1 AND is_active = true', [providerId]),
        db.query(`
          SELECT 
            COUNT(*) as total_bookings,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_bookings,
            COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_bookings,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_bookings
          FROM bookings 
          WHERE provider_id = $1
        `, [providerId]),
        db.query(`
          SELECT 
            COALESCE(SUM(total_amount), 0) as total_revenue,
            COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0) as completed_revenue
          FROM bookings 
          WHERE provider_id = $1 AND payment_status = 'paid'
        `, [providerId])
      ]);

      const services = servicesResult.rows[0];
      const bookings = bookingsResult.rows[0];
      const revenue = revenueResult.rows[0];

      res.json({
        success: true,
        stats: {
          totalServices: parseInt(services.total_services) || 0,
          totalBookings: parseInt(bookings.total_bookings) || 0,
          pendingBookings: parseInt(bookings.pending_bookings) || 0,
          confirmedBookings: parseInt(bookings.confirmed_bookings) || 0,
          completedBookings: parseInt(bookings.completed_bookings) || 0,
          totalRevenue: parseFloat(revenue.total_revenue) || 0,
          completedRevenue: parseFloat(revenue.completed_revenue) || 0
        }
      });
    }
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard stats'
    });
  }
});

// Upload avatar
router.post('/upload-avatar', authenticateJWT, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const userId = req.user.id;

    // Update user's profile_image in database
    await db.query(
      'UPDATE users SET profile_image = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [avatarUrl, userId]
    );

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      avatarUrl: avatarUrl
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading avatar'
    });
  }
});

module.exports = router;
