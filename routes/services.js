const express = require('express');
const { body, validationResult } = require('express-validator');
const passport = require('passport');
const { Service, ServiceProvider, User, ServicePromotion } = require('../models');
const { 
  getPagination, 
  buildServiceFilter, 
  buildSort,
  serializeDocument,
  serializeDocuments,
  isValidObjectId,
  toObjectId,
  paginationResponse 
} = require('../utils/mongodb-helpers');

const router = express.Router();
const authenticateJWT = passport.authenticate('jwt', { session: false });

// Get all services (public endpoint) - with featured/premium prioritization
router.get('/', async (req, res) => {
  try {
    const { category, location, minPrice, maxPrice, page = 1, limit = 10, search, sortBy } = req.query;
    
    console.log('📊 [GET SERVICES] Fetching services with filters:', { category, location, page, limit });

    const filter = buildServiceFilter(req.query);
    const { skip, limit: pageLimit } = getPagination(page, limit);
    const sort = buildSort(sortBy);

    // Get services with pagination
    const services = await Service.find(filter)
      .populate('provider_id', 'business_name rating')
      .sort(sort)
      .skip(skip)
      .limit(pageLimit)
      .lean();

    // Get total count
    const total = await Service.countDocuments(filter);

    // Enrich services with provider info
    const enrichedServices = services.map(service => {
      const provider = service.provider_id;
      return {
        ...serializeDocument(service),
        business_name: provider?.business_name,
        provider_rating: provider?.rating
      };
    });

    console.log(`✅ [GET SERVICES] Found ${services.length} services`);

    res.json({
      success: true,
      services: enrichedServices,
      total,
      page: parseInt(page),
      limit: parseInt(pageLimit),
      totalPages: Math.ceil(total / pageLimit)
    });
  } catch (error) {
    console.error('❌ [GET SERVICES] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching services'
    });
  }
});

// Get service by ID
router.get('/:id', async (req, res) => {
  try {
    const serviceId = req.params.id;

    if (!isValidObjectId(serviceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid service ID'
      });
    }

    console.log('🔍 [GET SERVICE] Fetching service:', serviceId);

    const service = await Service.findById(serviceId)
      .populate({
        path: 'provider_id',
        populate: { path: 'user_id', select: 'first_name last_name email phone' }
      })
      .lean();

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Increment views count
    await Service.findByIdAndUpdate(serviceId, { $inc: { views_count: 1 } });

    // Enrich response
    const provider = service.provider_id;
    const enrichedService = {
      ...serializeDocument(service),
      business_name: provider?.business_name,
      provider_rating: provider?.rating,
      provider_location: provider?.location,
      provider_first_name: provider?.user_id?.first_name,
      provider_last_name: provider?.user_id?.last_name,
      provider_email: provider?.user_id?.email,
      provider_phone: provider?.user_id?.phone
    };

    console.log('✅ [GET SERVICE] Service found');

    res.json({
      success: true,
      service: enrichedService
    });
  } catch (error) {
    console.error('❌ [GET SERVICE] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching service'
    });
  }
});

// Get services by provider (requires authentication)
router.get('/provider/my-services', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log('👤 [MY SERVICES] Fetching services for user:', userId);

    // Find provider by user_id
    const provider = await ServiceProvider.findOne({ user_id: toObjectId(userId) });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Service provider profile not found'
      });
    }

    // Get all services for this provider
    const services = await Service.find({ provider_id: provider._id })
      .sort({ created_at: -1 })
      .lean();

    console.log(`✅ [MY SERVICES] Found ${services.length} services`);

    res.json({
      success: true,
      services: serializeDocuments(services)
    });
  } catch (error) {
    console.error('❌ [MY SERVICES] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching services'
    });
  }
});

// Create new service (service providers only)
router.post('/', [
  authenticateJWT,
  body('title').trim().isLength({ min: 1, max: 255 }),
  body('description').trim().isLength({ min: 1 }),
  body('category').trim().notEmpty(),
  body('price').isNumeric()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const {
      title, description, category, subcategory, price, currency,
      duration, maxParticipants, location, country, region, district, area,
      images, amenities
    } = req.body;

    console.log('➕ [CREATE SERVICE] Creating service for user:', userId);

    // Find provider
    const provider = await ServiceProvider.findOne({ user_id: toObjectId(userId) });

    if (!provider) {
      return res.status(403).json({
        success: false,
        message: 'Only service providers can create services'
      });
    }

    // Create service
    const newService = new Service({
      provider_id: provider._id,
      title,
      description,
      category,
      subcategory,
      price,
      currency: currency || 'TZS',
      duration,
      max_participants: maxParticipants,
      location,
      country,
      region,
      district,
      area,
      images: images || [],
      amenities: amenities || []
    });

    await newService.save();

    console.log('✅ [CREATE SERVICE] Service created:', newService._id);

    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      service: serializeDocument(newService)
    });
  } catch (error) {
    console.error('❌ [CREATE SERVICE] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating service'
    });
  }
});

// Update service (service providers only)
router.put('/:id', [
  authenticateJWT,
  body('title').optional().trim().isLength({ min: 1, max: 255 }),
  body('description').optional().trim().isLength({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const serviceId = req.params.id;
    const userId = req.user.id;

    if (!isValidObjectId(serviceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid service ID'
      });
    }

    console.log('✏️ [UPDATE SERVICE] Updating service:', serviceId);

    // Find provider
    const provider = await ServiceProvider.findOne({ user_id: toObjectId(userId) });

    if (!provider) {
      return res.status(403).json({
        success: false,
        message: 'Service provider profile not found'
      });
    }

    // Find service and verify ownership
    const service = await Service.findOne({ _id: toObjectId(serviceId), provider_id: provider._id });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found or you do not have permission to update it'
      });
    }

    // Update service
    const updateData = {};
    const allowedFields = [
      'title', 'description', 'category', 'subcategory', 'price', 'currency',
      'duration', 'maxParticipants', 'location', 'country', 'region', 'district', 'area',
      'images', 'amenities'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        // Convert camelCase to snake_case
        const dbField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
        updateData[dbField] = req.body[field];
      }
    });

    Object.assign(service, updateData);
    await service.save();

    console.log('✅ [UPDATE SERVICE] Service updated');

    res.json({
      success: true,
      message: 'Service updated successfully',
      service: serializeDocument(service)
    });
  } catch (error) {
    console.error('❌ [UPDATE SERVICE] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating service'
    });
  }
});

// Delete service (service providers only)
router.delete('/:id', authenticateJWT, async (req, res) => {
  try {
    const serviceId = req.params.id;
    const userId = req.user.id;

    if (!isValidObjectId(serviceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid service ID'
      });
    }

    console.log('🗑️ [DELETE SERVICE] Deleting service:', serviceId);

    // Find provider
    const provider = await ServiceProvider.findOne({ user_id: toObjectId(userId) });

    if (!provider) {
      return res.status(403).json({
        success: false,
        message: 'Service provider profile not found'
      });
    }

    // Find and delete service
    const service = await Service.findOneAndDelete({
      _id: toObjectId(serviceId),
      provider_id: provider._id
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found or you do not have permission to delete it'
      });
    }

    console.log('✅ [DELETE SERVICE] Service deleted');

    res.json({
      success: true,
      message: 'Service deleted successfully'
    });
  } catch (error) {
    console.error('❌ [DELETE SERVICE] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting service'
    });
  }
});

// Promote service (make it featured) - requires payment
router.post('/:id/promote', authenticateJWT, async (req, res) => {
  try {
    const serviceId = req.params.id;
    const { 
      promotion_type,
      duration_days = 30,
      location,
      payment_method = 'demo',
      payment_reference,
      amount
    } = req.body;

    if (!isValidObjectId(serviceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid service ID'
      });
    }

    console.log('⭐ [PROMOTE SERVICE] Promoting service:', { serviceId, promotion_type, location });

    // Calculate cost
    let totalCost = amount || 50000;
    if (promotion_type === 'featured') {
      totalCost = location === 'both' ? 80000 : 50000;
    } else if (promotion_type === 'trending') {
      totalCost = 30000;
    } else if (promotion_type === 'search_boost') {
      totalCost = 20000;
    }

    // Find provider and service
    const provider = await ServiceProvider.findOne({ user_id: toObjectId(req.user.id) });
    const service = await Service.findOne({ _id: toObjectId(serviceId), provider_id: provider._id });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Update service with promotion details
    const featuredUntil = new Date();
    featuredUntil.setDate(featuredUntil.getDate() + duration_days);

    service.is_featured = true;
    service.featured_until = featuredUntil;
    service.featured_priority = (service.featured_priority || 0) + 1;
    service.promotion_type = promotion_type;
    service.promotion_location = location;

    await service.save();

    // Create promotion record
    const promotion = new ServicePromotion({
      service_id: service._id,
      promotion_type,
      promotion_location: location,
      duration_days,
      cost: totalCost,
      payment_method,
      payment_reference: payment_reference || `DEMO-${Date.now()}`,
      expires_at: featuredUntil
    });

    await promotion.save();

    console.log('✅ [PROMOTE SERVICE] Service promoted successfully');

    res.json({
      success: true,
      message: 'Service promoted successfully',
      promotion: {
        service_id: serviceId,
        promotion_type,
        location,
        duration_days,
        cost: totalCost,
        expires_at: featuredUntil
      }
    });
  } catch (error) {
    console.error('❌ [PROMOTE SERVICE] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error promoting service'
    });
  }
});

// Get featured/promoted services for homepage slides
router.get('/featured/slides', async (req, res) => {
  try {
    const services = await Service.find({
      is_active: true,
      is_featured: true,
      featured_until: { $gt: new Date() },
      promotion_location: { $in: ['homepage', 'both', 'homepage_slides', 'top_carousel'] }
    })
    .populate({
      path: 'provider_id',
      populate: { path: 'user_id', select: 'first_name last_name' }
    })
    .sort({ featured_priority: -1, created_at: -1 })
    .limit(5)
    .lean();

    console.log(`🎠 Featured slides: Found ${services.length} promoted services for homepage`);

    // Enrich services
    const enrichedServices = services.map(service => {
      const provider = service.provider_id;
      return {
        ...serializeDocument(service),
        business_name: provider?.business_name,
        provider_rating: provider?.rating,
        first_name: provider?.user_id?.first_name,
        last_name: provider?.user_id?.last_name
      };
    });

    res.json({
      success: true,
      slides: enrichedServices
    });
  } catch (error) {
    console.error('Get featured slides error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching featured services'
    });
  }
});

// Get trending promoted services for homepage
router.get('/trending', async (req, res) => {
  try {
    const services = await Service.find({
      is_active: true,
      is_featured: true,
      featured_until: { $gt: new Date() },
      promotion_type: 'trending',
      promotion_location: { $in: ['trending_section', 'increased_visibility', 'search_priority'] }
    })
    .populate({
      path: 'provider_id',
      populate: { path: 'user_id', select: 'first_name last_name' }
    })
    .sort({ featured_priority: -1, views_count: -1, created_at: -1 })
    .limit(12)
    .lean();

    console.log(`📈 Trending services: Found ${services.length} promoted trending services`);

    // Enrich services
    const enrichedServices = services.map(service => {
      const provider = service.provider_id;
      return {
        ...serializeDocument(service),
        business_name: provider?.business_name,
        provider_rating: provider?.rating,
        first_name: provider?.user_id?.first_name,
        last_name: provider?.user_id?.last_name
      };
    });

    res.json({
      success: true,
      services: enrichedServices
    });
  } catch (error) {
    console.error('Get trending services error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching trending services'
    });
  }
});

// Toggle service status (activate/deactivate)
router.patch('/:id/status', authenticateJWT, async (req, res) => {
  try {
    const serviceId = req.params.id;
    const userId = req.user.id;

    if (!isValidObjectId(serviceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid service ID'
      });
    }

    console.log('🔄 [TOGGLE STATUS] Service:', serviceId);

    // Find provider
    const provider = await ServiceProvider.findOne({ user_id: toObjectId(userId) });

    if (!provider) {
      return res.status(403).json({
        success: false,
        message: 'Service provider profile not found'
      });
    }

    // Find service
    const service = await Service.findOne({
      _id: toObjectId(serviceId),
      provider_id: provider._id
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Toggle status
    service.is_active = !service.is_active;
    await service.save();

    console.log(`✅ [TOGGLE STATUS] Service ${service.is_active ? 'activated' : 'deactivated'}`);

    res.json({
      success: true,
      message: `Service ${service.is_active ? 'activated' : 'deactivated'} successfully`,
      is_active: service.is_active
    });
  } catch (error) {
    console.error('❌ [TOGGLE STATUS] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling service status'
    });
  }
});

module.exports = router;
