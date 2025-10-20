const express = require('express');
const passport = require('passport');
const { ServiceProvider, User, Service } = require('../models');
const { serializeDocument, isValidObjectId, toObjectId } = require('../utils/mongodb-helpers');

const router = express.Router();
const authenticateJWT = passport.authenticate('jwt', { session: false });

// Get all service providers (public)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, country, region } = req.query;

    const query = { is_verified: true };
    if (country) query.country = country;
    if (region) query.region = region;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const providers = await ServiceProvider.find(query)
      .populate('user_id', 'first_name last_name email')
      .sort({ rating: -1, total_bookings: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await ServiceProvider.countDocuments(query);

    res.json({
      success: true,
      providers: providers.map(p => serializeDocument(p)),
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('❌ GET PROVIDERS Error:', error);
    res.status(500).json({ success: false, message: 'Error fetching providers' });
  }
});

// Get provider by ID
router.get('/:id', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid provider ID' });
    }

    const provider = await ServiceProvider.findById(req.params.id)
      .populate('user_id', 'first_name last_name email phone avatar_url')
      .lean();

    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }

    // Get provider's services
    const services = await Service.find({ provider_id: provider._id, is_active: true })
      .select('title category price location images average_rating')
      .limit(10)
      .lean();

    res.json({
      success: true,
      provider: {
        ...serializeDocument(provider),
        services: services.map(s => serializeDocument(s))
      }
    });
  } catch (error) {
    console.error('❌ GET PROVIDER Error:', error);
    res.status(500).json({ success: false, message: 'Error fetching provider' });
  }
});

// Update provider profile
router.put('/profile', authenticateJWT, async (req, res) => {
  try {
    if (req.user.userType !== 'service_provider') {
      return res.status(403).json({ success: false, message: 'Only service providers can update provider profile' });
    }

    const { business_name, business_type, description, location, country, region, district, area, license_number } = req.body;

    const provider = await ServiceProvider.findOne({ user_id: toObjectId(req.user.id) });
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider profile not found' });
    }

    const updateData = {};
    if (business_name) updateData.business_name = business_name;
    if (business_type) updateData.business_type = business_type;
    if (description) updateData.description = description;
    if (location) updateData.location = location;
    if (country) updateData.country = country;
    if (region) updateData.region = region;
    if (district) updateData.district = district;
    if (area) updateData.area = area;
    if (license_number) updateData.license_number = license_number;

    Object.assign(provider, updateData);
    await provider.save();

    console.log('✅ Provider profile updated');

    res.json({ success: true, message: 'Provider profile updated successfully', provider: serializeDocument(provider) });
  } catch (error) {
    console.error('❌ UPDATE PROVIDER Error:', error);
    res.status(500).json({ success: false, message: 'Error updating provider profile' });
  }
});

module.exports = router;
