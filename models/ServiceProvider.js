const mongoose = require('mongoose');

const serviceProviderSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  business_name: {
    type: String,
    trim: true
  },
  business_type: {
    type: String,
    trim: true
  },
  description: {
    type: String
  },
  location: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    trim: true
  },
  region: {
    type: String,
    trim: true
  },
  district: {
    type: String,
    trim: true
  },
  area: {
    type: String,
    trim: true
  },
  license_number: {
    type: String,
    trim: true
  },
  rating: {
    type: Number,
    default: 0.00,
    min: 0,
    max: 5
  },
  total_bookings: {
    type: Number,
    default: 0
  },
  is_verified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes
serviceProviderSchema.index({ user_id: 1 });
serviceProviderSchema.index({ rating: -1, total_bookings: -1 });
serviceProviderSchema.index({ country: 1, region: 1 });

module.exports = mongoose.model('ServiceProvider', serviceProviderSchema);
