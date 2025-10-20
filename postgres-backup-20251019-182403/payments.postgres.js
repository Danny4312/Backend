const express = require('express');
const passport = require('passport');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { processPayment, paymentMethods, verifyStripePayment } = require('../config/payment');
const router = express.Router();

// Middleware to authenticate JWT
const authenticateJWT = passport.authenticate('jwt', { session: false });

// Get payment history for user
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await db.query(`
      SELECT p.*, sp.business_name, s.title as service_title
      FROM payments p
      LEFT JOIN service_providers sp ON p.provider_id = sp.id
      LEFT JOIN services s ON p.service_id = s.id
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC
    `, [userId]);

    res.json({
      success: true,
      payments: result.rows.map(payment => ({
        id: payment.id,
        paymentType: payment.payment_type,
        amount: parseFloat(payment.amount),
        currency: payment.currency,
        paymentMethod: payment.payment_method,
        paymentStatus: payment.payment_status,
        transactionId: payment.transaction_id,
        description: payment.description,
        validFrom: payment.valid_from,
        validUntil: payment.valid_until,
        businessName: payment.business_name,
        serviceTitle: payment.service_title,
        createdAt: payment.created_at
      }))
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payments'
    });
  }
});

// Purchase premium membership (service providers only)
router.post('/premium-membership', [
  authenticateJWT,
  body('duration').isIn(['monthly', 'quarterly', 'yearly']),
  body('paymentMethod').isIn(['stripe', 'mpesa']),
  body('phoneNumber').optional().isMobilePhone(),
  body('currency').optional().isIn(['USD', 'KES'])
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
    const { duration, paymentMethod, phoneNumber, currency = 'USD' } = req.body;

    if (req.user.user_type !== 'service_provider') {
      return res.status(403).json({
        success: false,
        message: 'Only service providers can purchase premium membership'
      });
    }

    // Get provider ID
    const providerResult = await db.query('SELECT id FROM service_providers WHERE user_id = $1', [userId]);
    if (providerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service provider profile not found'
      });
    }

    const providerId = providerResult.rows[0].id;

    // Calculate pricing and validity
    const pricing = {
      monthly: { amount: 29.99, months: 1 },
      quarterly: { amount: 79.99, months: 3 },
      yearly: { amount: 299.99, months: 12 }
    };

    const plan = pricing[duration];
    const validUntil = new Date();
    validUntil.setMonth(validUntil.getMonth() + plan.months);

    // Validate payment method requirements
    if (paymentMethod === 'mpesa' && !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required for M-Pesa payments'
      });
    }

    // Process payment
    const paymentData = {
      method: paymentMethod,
      amount: plan.amount,
      currency: currency,
      phoneNumber: phoneNumber,
      metadata: {
        userId: userId,
        providerId: providerId,
        paymentType: 'premium_membership',
        duration: duration,
        accountReference: `Premium-${userId}`,
        transactionDesc: `Premium membership - ${duration}`
      }
    };

    const paymentResponse = await processPayment(paymentData);

    // Create payment record
    const paymentResult = await db.query(`
      INSERT INTO payments (user_id, provider_id, payment_type, amount, currency, payment_method, description, valid_until, payment_status, transaction_id)
      VALUES ($1, $2, 'premium_membership', $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [userId, providerId, plan.amount, currency, paymentMethod, `Premium membership - ${duration}`, validUntil, 'pending', paymentResponse.CheckoutRequestID || paymentResponse.id]);

    // Update provider premium status
    await db.query(`
      UPDATE service_providers 
      SET premium_until = $1, featured_priority = featured_priority + 100, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [validUntil, providerId]);

    // Create notification
    await db.query(`
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES ($1, 'premium_activated', 'Premium Membership Activated', $2, $3)
    `, [userId, `Your ${duration} premium membership is now active until ${validUntil.toDateString()}`, JSON.stringify({ duration, validUntil })]);

    res.status(201).json({
      success: true,
      message: 'Premium membership payment initiated successfully',
      payment: {
        id: paymentResult.rows[0].id,
        amount: plan.amount,
        currency: currency,
        validUntil: validUntil,
        duration: duration,
        paymentMethod: paymentMethod,
        transactionId: paymentResponse.CheckoutRequestID || paymentResponse.id,
        ...(paymentMethod === 'stripe' && { clientSecret: paymentResponse.client_secret }),
        ...(paymentMethod === 'mpesa' && { checkoutRequestId: paymentResponse.CheckoutRequestID })
      }
    });
  } catch (error) {
    console.error('Premium membership purchase error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing premium membership'
    });
  }
});

// Purchase featured service promotion
router.post('/featured-service', [
  authenticateJWT,
  body('serviceId').isInt({ min: 1 }),
  body('duration').isIn(['weekly', 'monthly']),
  body('paymentMethod').isIn(['stripe', 'mpesa']),
  body('phoneNumber').optional().isMobilePhone(),
  body('currency').optional().isIn(['USD', 'KES'])
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
    const { serviceId, duration, paymentMethod, phoneNumber, currency = 'USD' } = req.body;

    if (req.user.user_type !== 'service_provider') {
      return res.status(403).json({
        success: false,
        message: 'Only service providers can purchase featured service promotion'
      });
    }

    // Verify service ownership
    const serviceResult = await db.query(`
      SELECT s.id, s.title, sp.id as provider_id
      FROM services s
      JOIN service_providers sp ON s.provider_id = sp.id
      WHERE s.id = $1 AND sp.user_id = $2
    `, [serviceId, userId]);

    if (serviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service not found or you do not have permission'
      });
    }

    const service = serviceResult.rows[0];

    // Calculate pricing and validity
    const pricing = {
      weekly: { amount: 19.99, days: 7 },
      monthly: { amount: 59.99, days: 30 }
    };

    const plan = pricing[duration];
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + plan.days);

    // Validate payment method requirements
    if (paymentMethod === 'mpesa' && !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required for M-Pesa payments'
      });
    }

    // Process payment
    const paymentData = {
      method: paymentMethod,
      amount: plan.amount,
      currency: currency,
      phoneNumber: phoneNumber,
      metadata: {
        userId: userId,
        serviceId: serviceId,
        paymentType: 'featured_service',
        duration: duration,
        accountReference: `Featured-${serviceId}`,
        transactionDesc: `Featured service promotion - ${duration}`
      }
    };

    const paymentResponse = await processPayment(paymentData);

    // Create payment record
    const paymentResult = await db.query(`
      INSERT INTO payments (user_id, service_id, payment_type, amount, currency, payment_method, description, valid_until, payment_status, transaction_id)
      VALUES ($1, $2, 'featured_service', $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [userId, serviceId, plan.amount, currency, paymentMethod, `Featured service promotion - ${duration}`, validUntil, 'pending', paymentResponse.CheckoutRequestID || paymentResponse.id]);

    // Update service featured status
    await db.query(`
      UPDATE services 
      SET is_featured = true, featured_until = $1, featured_priority = featured_priority + 50, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [validUntil, serviceId]);

    // Create notification
    await db.query(`
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES ($1, 'service_featured', 'Service Featured', $2, $3)
    `, [userId, `Your service "${service.title}" is now featured until ${validUntil.toDateString()}`, JSON.stringify({ serviceId, serviceTitle: service.title, validUntil })]);

    res.status(201).json({
      success: true,
      message: 'Featured service promotion payment initiated successfully',
      payment: {
        id: paymentResult.rows[0].id,
        amount: plan.amount,
        currency: currency,
        validUntil: validUntil,
        duration: duration,
        paymentMethod: paymentMethod,
        transactionId: paymentResponse.CheckoutRequestID || paymentResponse.id,
        ...(paymentMethod === 'stripe' && { clientSecret: paymentResponse.client_secret }),
        ...(paymentMethod === 'mpesa' && { checkoutRequestId: paymentResponse.CheckoutRequestID }),
        serviceTitle: service.title
      }
    });
  } catch (error) {
    console.error('Featured service purchase error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing featured service'
    });
  }
});

// M-Pesa callback endpoint
router.post('/mpesa/callback', async (req, res) => {
  try {
    const { Body } = req.body;
    const { stkCallback } = Body;
    
    if (stkCallback.ResultCode === 0) {
      // Payment successful
      const checkoutRequestId = stkCallback.CheckoutRequestID;
      const mpesaReceiptNumber = stkCallback.CallbackMetadata.Item.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
      
      // Update payment status
      await db.query(`
        UPDATE payments 
        SET payment_status = 'completed', transaction_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE transaction_id = $2
      `, [mpesaReceiptNumber, checkoutRequestId]);
      
      console.log('M-Pesa payment successful:', mpesaReceiptNumber);
    } else {
      // Payment failed
      const checkoutRequestId = stkCallback.CheckoutRequestID;
      await db.query(`
        UPDATE payments 
        SET payment_status = 'failed', updated_at = CURRENT_TIMESTAMP
        WHERE transaction_id = $1
      `, [checkoutRequestId]);
      
      console.log('M-Pesa payment failed:', stkCallback.ResultDesc);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('M-Pesa callback error:', error);
    res.status(500).json({ success: false });
  }
});

// Stripe webhook endpoint
router.post('/stripe/webhook', async (req, res) => {
  try {
    const { type, data } = req.body;
    
    if (type === 'payment_intent.succeeded') {
      const paymentIntent = data.object;
      
      // Update payment status
      await db.query(`
        UPDATE payments 
        SET payment_status = 'completed', updated_at = CURRENT_TIMESTAMP
        WHERE transaction_id = $1
      `, [paymentIntent.id]);
      
      console.log('Stripe payment successful:', paymentIntent.id);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    res.status(500).json({ success: false });
  }
});

// Get available payment methods
router.get('/methods', (req, res) => {
  res.json({
    success: true,
    paymentMethods
  });
});

// Get premium pricing information
router.get('/pricing', (req, res) => {
  const pricing = {
    premiumMembership: {
      monthly: {
        amount: 29.99,
        amountKES: 3900,
        currency: 'USD',
        duration: '1 month',
        features: [
          'Priority listing in search results',
          'Premium badge on profile',
          'Advanced analytics',
          'Priority customer support',
          'Unlimited service listings'
        ]
      },
      quarterly: {
        amount: 79.99,
        amountKES: 10400,
        currency: 'USD',
        duration: '3 months',
        savings: '11%',
        features: [
          'All monthly features',
          'Featured in provider spotlight',
          'Advanced booking management',
          'Custom business hours'
        ]
      },
      yearly: {
        amount: 299.99,
        amountKES: 39000,
        currency: 'USD',
        duration: '12 months',
        savings: '17%',
        features: [
          'All quarterly features',
          'Dedicated account manager',
          'Custom branding options',
          'API access for integrations'
        ]
      }
    },
    featuredService: {
      weekly: {
        amount: 19.99,
        amountKES: 2600,
        currency: 'USD',
        duration: '7 days',
        features: [
          'Top position in search results',
          'Featured badge on service',
          'Highlighted in category listings',
          'Priority in recommendations'
        ]
      },
      monthly: {
        amount: 59.99,
        amountKES: 7800,
        currency: 'USD',
        duration: '30 days',
        savings: '25%',
        features: [
          'All weekly features',
          'Featured in homepage carousel',
          'Social media promotion',
          'Email newsletter inclusion'
        ]
      }
    }
  };

  res.json({
    success: true,
    pricing
  });
});

module.exports = router;
