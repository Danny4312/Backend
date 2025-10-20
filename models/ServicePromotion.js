const mongoose = require('mongoose');

const servicePromotionSchema = new mongoose.Schema({
  service_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  promotion_type: {
    type: String,
    required: true,
    enum: ['featured', 'trending', 'search_boost']
  },
  promotion_location: {
    type: String
  },
  duration_days: {
    type: Number,
    required: true
  },
  cost: {
    type: Number,
    required: true
  },
  payment_method: {
    type: String
  },
  payment_reference: {
    type: String
  },
  started_at: {
    type: Date,
    default: Date.now
  },
  expires_at: {
    type: Date,
    required: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false }
});

// Indexes
servicePromotionSchema.index({ service_id: 1 });
servicePromotionSchema.index({ expires_at: 1 });
servicePromotionSchema.index({ promotion_type: 1 });

module.exports = mongoose.model('ServicePromotion', servicePromotionSchema);
