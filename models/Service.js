const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  provider_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceProvider',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String
  },
  category: {
    type: String,
    trim: true
  },
  subcategory: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'TZS',
    trim: true
  },
  duration: {
    type: Number // in hours
  },
  max_participants: {
    type: Number
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
  images: {
    type: [String],
    default: []
  },
  amenities: {
    type: [String],
    default: []
  },
  is_active: {
    type: Boolean,
    default: true
  },
  is_featured: {
    type: Boolean,
    default: false
  },
  featured_until: {
    type: Date
  },
  featured_priority: {
    type: Number,
    default: 0
  },
  promotion_type: {
    type: String,
    enum: ['featured', 'trending', 'search_boost', null],
    default: null
  },
  promotion_location: {
    type: String
  },
  views_count: {
    type: Number,
    default: 0
  },
  bookings_count: {
    type: Number,
    default: 0
  },
  average_rating: {
    type: Number,
    default: 0.00,
    min: 0,
    max: 5
  },
  total_bookings: {
    type: Number,
    default: 0
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes
serviceSchema.index({ provider_id: 1 });
serviceSchema.index({ category: 1, is_active: 1 });
serviceSchema.index({ is_featured: 1, featured_until: 1 });
serviceSchema.index({ promotion_type: 1, promotion_location: 1 });
serviceSchema.index({ location: 1 });
serviceSchema.index({ country: 1, region: 1, district: 1 });
serviceSchema.index({ price: 1 });
serviceSchema.index({ average_rating: -1 });

module.exports = mongoose.model('Service', serviceSchema);
