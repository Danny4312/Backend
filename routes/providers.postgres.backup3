const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get service providers by location and category
router.get('/search', async (req, res) => {
  try {
    const { region, district, ward, category, categories } = req.query;

    let query = `
      SELECT 
        sp.id,
        sp.business_name,
        sp.business_type,
        sp.location,
        sp.service_categories,
        sp.location_data,
        sp.description,
        sp.rating,
        sp.total_bookings,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        COUNT(s.id) as services_count
      FROM service_providers sp
      JOIN users u ON sp.user_id = u.id
      LEFT JOIN services s ON sp.id = s.provider_id AND s.is_active = true
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Filter by location (case-insensitive)
    if (region) {
      query += ` AND UPPER(sp.location_data->>'region') = UPPER($${paramIndex})`;
      params.push(region);
      paramIndex++;
    }

    if (district) {
      query += ` AND UPPER(sp.location_data->>'district') = UPPER($${paramIndex})`;
      params.push(district);
      paramIndex++;
    }

    if (ward) {
      query += ` AND UPPER(sp.location_data->>'ward') = UPPER($${paramIndex})`;
      params.push(ward);
      paramIndex++;
    }

    // Filter by categories (multiple)
    const categoryList = categories ? (Array.isArray(categories) ? categories : [categories]) : (category ? [category] : []);
    
    if (categoryList.length > 0) {
      // Match providers that have ANY of the selected categories
      const categoryConditions = categoryList.map((cat, index) => {
        params.push(JSON.stringify([cat]));
        return `sp.service_categories @> $${paramIndex + index}::jsonb`;
      });
      query += ` AND (${categoryConditions.join(' OR ')})`;
      paramIndex += categoryList.length;
    }

    query += `
      GROUP BY sp.id, u.id
      ORDER BY sp.rating DESC, sp.total_bookings DESC
    `;

    const result = await db.query(query, params);

    res.json({
      success: true,
      providers: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching providers:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching service providers'
    });
  }
});

// Get provider profile with services
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get provider details
    const providerQuery = `
      SELECT 
        sp.*,
        u.first_name,
        u.last_name,
        u.email,
        u.phone
      FROM service_providers sp
      JOIN users u ON sp.user_id = u.id
      WHERE sp.id = $1
    `;

    const providerResult = await db.query(providerQuery, [id]);

    if (providerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    const provider = providerResult.rows[0];

    // Get provider's services
    const servicesQuery = `
      SELECT *
      FROM services
      WHERE provider_id = $1 AND is_active = true
      ORDER BY created_at DESC
    `;

    const servicesResult = await db.query(servicesQuery, [id]);

    res.json({
      success: true,
      provider: {
        ...provider,
        services: servicesResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching provider:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching provider details'
    });
  }
});

module.exports = router;
