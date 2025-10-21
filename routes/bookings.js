const express = require('express');
const { body, validationResult } = require('express-validator');
const passport = require('passport');
const { Booking, Service, ServiceProvider, User } = require('../models');
const { 
  serializeDocument,
  serializeDocuments,
  isValidObjectId,
  toObjectId,
  getPagination
} = require('../utils/mongodb-helpers');

const router = express.Router();
const authenticateJWT = passport.authenticate('jwt', { session: false });

// Get all bookings for authenticated user
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.userType;
    const { status, page = 1, limit = 10 } = req.query;

    console.log('📋 [GET BOOKINGS] User:', userId, 'Type:', userType);

    const { skip, limit: pageLimit } = getPagination(page, limit);
    let query = {};

    if (userType === 'traveler') {
      query.traveler_id = toObjectId(userId);
    } else if (userType === 'service_provider') {
      const provider = await ServiceProvider.findOne({ user_id: toObjectId(userId) });
      if (!provider) {
        return res.status(404).json({ success: false, message: 'Provider profile not found' });
      }
      query.provider_id = provider._id;
    }

    if (status) query.status = status;

    const bookings = await Booking.find(query)
      .populate('service_id', 'title category price location images')
      .populate('provider_id', 'business_name location')
      .populate('traveler_id', 'first_name last_name email phone')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(pageLimit)
      .lean();

    const total = await Booking.countDocuments(query);

    const enrichedBookings = bookings.map(b => ({
      ...serializeDocument(b),
      service_title: b.service_id?.title,
      business_name: b.provider_id?.business_name,
      traveler_name: `${b.traveler_id?.first_name} ${b.traveler_id?.last_name}`
    }));

    res.json({ success: true, bookings: enrichedBookings, total, page: parseInt(page), totalPages: Math.ceil(total / pageLimit) });
  } catch (error) {
    console.error('❌ GET BOOKINGS Error:', error);
    res.status(500).json({ success: false, message: 'Error fetching bookings' });
  }
});

// Get booking by ID
router.get('/:id', authenticateJWT, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID' });
    }

    const booking = await Booking.findById(req.params.id)
      .populate('service_id')
      .populate('provider_id')
      .populate('traveler_id')
      .lean();

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    res.json({ success: true, booking: serializeDocument(booking) });
  } catch (error) {
    console.error('❌ GET BOOKING Error:', error);
    res.status(500).json({ success: false, message: 'Error fetching booking' });
  }
});

// Create new booking
router.post('/', [authenticateJWT, body('serviceId').notEmpty(), body('bookingDate').isISO8601()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { serviceId, bookingDate, startTime, endTime, participants = 1, specialRequests } = req.body;

    if (!isValidObjectId(serviceId)) {
      return res.status(400).json({ success: false, message: 'Invalid service ID' });
    }

    const service = await Service.findById(serviceId).populate('provider_id');
    if (!service || !service.is_active) {
      return res.status(404).json({ success: false, message: 'Service not available' });
    }

    const totalAmount = service.price * participants;

    const newBooking = new Booking({
      traveler_id: toObjectId(req.user.id),
      service_id: service._id,
      provider_id: service.provider_id._id,
      booking_date: new Date(bookingDate),
      start_time: startTime,
      end_time: endTime,
      participants,
      total_amount: totalAmount,
      special_requests: specialRequests,
      status: 'pending',
      payment_status: 'pending'
    });

    await newBooking.save();

    // Increment bookings count
    await Service.findByIdAndUpdate(serviceId, { $inc: { bookings_count: 1 } });

    console.log('✅ Booking created:', newBooking._id);

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      booking: serializeDocument(newBooking)
    });
  } catch (error) {
    console.error('❌ CREATE BOOKING Error:', error);
    res.status(500).json({ success: false, message: 'Error creating booking' });
  }
});

// Update booking status (provider only)
router.patch('/:id/status', authenticateJWT, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID' });
    }

    const provider = await ServiceProvider.findOne({ user_id: toObjectId(req.user.id) });
    if (!provider) {
      return res.status(403).json({ success: false, message: 'Only providers can update booking status' });
    }

    const booking = await Booking.findOne({ _id: toObjectId(req.params.id), provider_id: provider._id });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    booking.status = status;
    await booking.save();

    console.log('✅ Booking status updated:', booking._id, '→', status);

    res.json({ success: true, message: 'Booking status updated', booking: serializeDocument(booking) });
  } catch (error) {
    console.error('❌ UPDATE BOOKING STATUS Error:', error);
    res.status(500).json({ success: false, message: 'Error updating booking status' });
  }
});

// Cancel booking (traveler only)
router.delete('/:id', authenticateJWT, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID' });
    }

    const booking = await Booking.findOne({ _id: toObjectId(req.params.id), traveler_id: toObjectId(req.user.id) });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Cannot cancel completed booking' });
    }

    booking.status = 'cancelled';
    await booking.save();

    console.log('✅ Booking cancelled:', booking._id);

    res.json({ success: true, message: 'Booking cancelled successfully' });
  } catch (error) {
    console.error('❌ CANCEL BOOKING Error:', error);
    res.status(500).json({ success: false, message: 'Error cancelling booking' });
  }
});

// Get recent activity for homepage (public endpoint)
router.get('/recent-activity', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Get recent bookings
    const recentBookings = await Booking.find({ 
      status: { $in: ['confirmed', 'completed'] } 
    })
      .populate('service_id', 'title category location')
      .populate('traveler_id', 'first_name last_name')
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .lean();

    // Format activities
    const activities = recentBookings.map(booking => {
      const firstName = booking.traveler_id?.first_name || 'Anonymous';
      const lastName = booking.traveler_id?.last_name?.[0] || '';
      
      return {
        id: booking._id,
        type: 'booking',
        user: `${firstName} ${lastName}.`,
        action: `booked ${booking.service_id?.title || 'a service'}`,
        location: booking.service_id?.location || 'Unknown location',
        timestamp: booking.created_at,
        category: booking.service_id?.category || 'general'
      };
    });

    // Get stats
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [weeklyBookings, totalBookings, activeServices] = await Promise.all([
      Booking.countDocuments({ 
        created_at: { $gte: weekAgo },
        status: { $in: ['confirmed', 'completed'] }
      }),
      Booking.countDocuments({ status: { $in: ['confirmed', 'completed'] } }),
      Service.countDocuments({ is_active: true })
    ]);

    // Get active travelers (users who booked in last 30 days)
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const activeTravelers = await Booking.distinct('traveler_id', {
      created_at: { $gte: monthAgo }
    });

    // Get unique destinations
    const destinations = await Service.distinct('location', { is_active: true });

    res.json({
      success: true,
      activities,
      stats: {
        weeklyBookings,
        activeTravelers: activeTravelers.length,
        destinations: destinations.length,
        totalServices: activeServices
      }
    });
  } catch (error) {
    console.error('❌ Error fetching recent activity:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recent activity'
    });
  }
});

// Get provider analytics
router.get('/provider-analytics', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const { timeRange = '30days' } = req.query;

    // Get provider
    const provider = await ServiceProvider.findOne({ user_id: toObjectId(userId) });
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider profile not found' });
    }

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (timeRange) {
      case '7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '90days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get bookings
    const bookings = await Booking.find({
      provider_id: provider._id,
      created_at: { $gte: startDate }
    })
      .populate('service_id', 'title category price')
      .populate('traveler_id', 'first_name last_name country')
      .lean();

    // Calculate metrics
    const confirmedBookings = bookings.filter(b => ['confirmed', 'completed'].includes(b.status));
    const totalRevenue = confirmedBookings.reduce((sum, b) => sum + (b.total_price || 0), 0);
    const totalBookings = confirmedBookings.length;
    const uniqueCustomers = [...new Set(bookings.map(b => b.traveler_id?._id?.toString()).filter(Boolean))].length;

    // Calculate average rating
    const reviewedBookings = bookings.filter(b => b.rating);
    const averageRating = reviewedBookings.length > 0
      ? (reviewedBookings.reduce((sum, b) => sum + b.rating, 0) / reviewedBookings.length).toFixed(1)
      : 0;

    // Calculate growth
    const previousStartDate = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()));
    const previousBookings = await Booking.find({
      provider_id: provider._id,
      created_at: { $gte: previousStartDate, $lt: startDate },
      status: { $in: ['confirmed', 'completed'] }
    }).lean();

    const previousRevenue = previousBookings.reduce((sum, b) => sum + (b.total_price || 0), 0);
    const revenueGrowth = previousRevenue > 0 ? (((totalRevenue - previousRevenue) / previousRevenue) * 100).toFixed(1) : 0;
    const bookingsGrowth = previousBookings.length > 0 ? (((totalBookings - previousBookings.length) / previousBookings.length) * 100).toFixed(1) : 0;

    // Top services
    const serviceStats = {};
    confirmedBookings.forEach(booking => {
      if (!booking.service_id) return;
      const sid = booking.service_id._id.toString();
      if (!serviceStats[sid]) {
        serviceStats[sid] = {
          name: booking.service_id.title,
          bookings: 0,
          revenue: 0,
          ratings: []
        };
      }
      serviceStats[sid].bookings++;
      serviceStats[sid].revenue += booking.total_price || 0;
      if (booking.rating) serviceStats[sid].ratings.push(booking.rating);
    });

    const topServices = Object.values(serviceStats)
      .map(s => ({
        name: s.name,
        bookings: s.bookings,
        revenue: s.revenue,
        rating: s.ratings.length > 0 ? (s.ratings.reduce((a, b) => a + b) / s.ratings.length).toFixed(1) : 0
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Customer insights
    const countryStats = {};
    bookings.forEach(b => {
      const country = b.traveler_id?.country || 'Unknown';
      countryStats[country] = (countryStats[country] || 0) + 1;
    });

    const topCountries = Object.entries(countryStats)
      .map(([country, bookings]) => ({
        country,
        bookings,
        percentage: totalBookings > 0 ? Math.round((bookings / totalBookings) * 100) : 0
      }))
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 5);

    // Monthly data (last 6 months)
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthBookings = bookings.filter(b => {
        const date = new Date(b.created_at);
        return date >= monthStart && date <= monthEnd && ['confirmed', 'completed'].includes(b.status);
      });

      monthlyData.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short' }),
        revenue: monthBookings.reduce((sum, b) => sum + (b.total_price || 0), 0),
        bookings: monthBookings.length
      });
    }

    res.json({
      success: true,
      analytics: {
        revenue: {
          total: totalRevenue,
          growth: parseFloat(revenueGrowth),
          trend: revenueGrowth >= 0 ? 'up' : 'down'
        },
        bookings: {
          total: totalBookings,
          growth: parseFloat(bookingsGrowth),
          trend: bookingsGrowth >= 0 ? 'up' : 'down'
        },
        customers: {
          total: uniqueCustomers,
          growth: 0,
          trend: 'neutral'
        },
        rating: {
          average: parseFloat(averageRating),
          total: reviewedBookings.length,
          growth: 0,
          trend: 'neutral'
        }
      },
      topServices,
      monthlyData,
      topCountries
    });
  } catch (error) {
    console.error('❌ Error fetching provider analytics:', error);
    res.status(500).json({ success: false, message: 'Error fetching analytics' });
  }
});

module.exports = router;
