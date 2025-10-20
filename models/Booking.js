const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  traveler_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  service_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  provider_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceProvider',
    required: true
  },
  booking_date: {
    type: Date,
    required: true
  },
  start_time: {
    type: String
  },
  end_time: {
    type: String
  },
  participants: {
    type: Number,
    default: 1
  },
  total_amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending'
  },
  payment_status: {
    type: String,
    enum: ['pending', 'paid', 'refunded'],
    default: 'pending'
  },
  special_requests: {
    type: String
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes
bookingSchema.index({ traveler_id: 1 });
bookingSchema.index({ service_id: 1 });
bookingSchema.index({ provider_id: 1 });
bookingSchema.index({ status: 1, created_at: -1 });
bookingSchema.index({ booking_date: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
