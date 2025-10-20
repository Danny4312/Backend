const express = require('express');
const passport = require('passport');
const { Payment, User, ServiceProvider } = require('../models');
const { serializeDocument, isValidObjectId, toObjectId } = require('../utils/mongodb-helpers');

const router = express.Router();
const authenticateJWT = passport.authenticate('jwt', { session: false });

// Get user's payments
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, payment_type } = req.query;

    const query = { user_id: toObjectId(userId) };
    if (payment_type) query.payment_type = payment_type;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const payments = await Payment.find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Payment.countDocuments(query);

    res.json({
      success: true,
      payments: payments.map(p => serializeDocument(p)),
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('❌ GET PAYMENTS Error:', error);
    res.status(500).json({ success: false, message: 'Error fetching payments' });
  }
});

// Create payment (simplified - demo mode)
router.post('/', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const { payment_type, amount, service_id, provider_id, description } = req.body;

    const newPayment = new Payment({
      user_id: toObjectId(userId),
      payment_type,
      amount,
      currency: 'TZS',
      payment_method: 'demo',
      payment_status: 'completed',
      transaction_id: `DEMO-${Date.now()}`,
      description,
      service_id: service_id ? toObjectId(service_id) : null,
      provider_id: provider_id ? toObjectId(provider_id) : null
    });

    await newPayment.save();

    console.log('✅ Payment created (demo mode):', newPayment._id);

    res.status(201).json({
      success: true,
      message: 'Payment processed successfully (demo mode)',
      payment: serializeDocument(newPayment)
    });
  } catch (error) {
    console.error('❌ CREATE PAYMENT Error:', error);
    res.status(500).json({ success: false, message: 'Error processing payment' });
  }
});

module.exports = router;
