const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  provider_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceProvider'
  },
  service_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  },
  payment_type: {
    type: String,
    required: true,
    enum: ['premium_membership', 'featured_service', 'booking_payment']
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'TZS'
  },
  payment_method: {
    type: String
  },
  payment_status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  transaction_id: {
    type: String
  },
  description: {
    type: String
  },
  valid_from: {
    type: Date,
    default: Date.now
  },
  valid_until: {
    type: Date
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes
paymentSchema.index({ user_id: 1 });
paymentSchema.index({ payment_type: 1, payment_status: 1 });
paymentSchema.index({ transaction_id: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
