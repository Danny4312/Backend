const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Database connection
const db = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'ISAFARI',
  password: process.env.DB_PASSWORD || 'dany@123',
  port: process.env.DB_PORT || 5433,
});

// Test database connection
db.connect()
  .then(() => console.log('✅ Connected to database'))
  .catch(err => console.error('❌ Database error:', err.message));

// CORS - Allow all origins in development
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Increase body size limit for images (100MB)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server running' });
});

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, userType: user.user_type },
    process.env.JWT_SECRET || 'isafari_secret_key',
    { expiresIn: '7d' }
  );
};

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, userType, phone } = req.body;

    // Check existing user
    const existing = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const result = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, user_type)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [email, hashedPassword, firstName, lastName, phone, userType]
    );

    const user = result.rows[0];

    // Create service provider profile if needed
    if (userType === 'service_provider') {
      await db.query(
        `INSERT INTO service_providers (user_id, business_name) VALUES ($1, $2)`,
        [user.id, `${firstName} ${lastName}'s Business`]
      );
    }

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        userType: user.user_type,
        isVerified: true
      },
      token
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check password
    if (!user.password_hash) {
      return res.status(400).json({ success: false, message: 'Please use Google login' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        userType: user.user_type,
        isVerified: true
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'isafari_secret_key');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Get all active services (public - for travelers)
app.get('/api/services', async (req, res) => {
  try {
    const { category, location, minPrice, maxPrice, search } = req.query;
    
    let query = 'SELECT s.*, u.first_name, u.last_name FROM services s JOIN users u ON s.provider_id = u.id WHERE s.is_active = true';
    const params = [];
    let paramCount = 1;

    if (category) {
      query += ` AND s.category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    if (location) {
      query += ` AND s.location ILIKE $${paramCount}`;
      params.push(`%${location}%`);
      paramCount++;
    }

    if (minPrice) {
      query += ` AND s.price >= $${paramCount}`;
      params.push(parseFloat(minPrice));
      paramCount++;
    }

    if (maxPrice) {
      query += ` AND s.price <= $${paramCount}`;
      params.push(parseFloat(maxPrice));
      paramCount++;
    }

    if (search) {
      query += ` AND (s.title ILIKE $${paramCount} OR s.description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ' ORDER BY s.created_at DESC';

    const result = await db.query(query, params);

    res.json({ 
      success: true, 
      services: result.rows.map(service => ({
        ...service,
        provider_name: `${service.first_name} ${service.last_name}`
      }))
    });
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch services' });
  }
});

// Get my services
app.get('/api/services/provider/my-services', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'service_provider') {
      return res.status(403).json({ success: false, message: 'Not a service provider' });
    }

    // Use user_id directly since provider_id references users table
    const result = await db.query('SELECT * FROM services WHERE provider_id = $1 ORDER BY created_at DESC', [req.user.id]);

    res.json({ success: true, services: result.rows });
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch services' });
  }
});

// Create service
app.post('/api/services', verifyToken, async (req, res) => {
  try {
    console.log('Create service request received');
    console.log('User:', req.user);
    console.log('Body:', req.body);

    if (req.user.userType !== 'service_provider') {
      return res.status(403).json({ success: false, message: 'Only service providers can create services' });
    }

    // Use user_id directly since provider_id references users table
    const providerId = req.user.id;
    const { title, description, category, price, duration, maxParticipants, location, images, amenities } = req.body;

    // Validate required fields
    if (!title || !description || !category || !price || !location) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields',
        required: ['title', 'description', 'category', 'price', 'location']
      });
    }

    // Convert arrays to PostgreSQL format
    const imagesArray = Array.isArray(images) ? images : [];
    const amenitiesArray = Array.isArray(amenities) ? amenities : [];

    const result = await db.query(
      `INSERT INTO services (provider_id, title, description, category, price, duration, max_participants, location, images, amenities, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [providerId, title, description, category, price, duration || null, maxParticipants || null, location, imagesArray, amenitiesArray, true]
    );

    const service = result.rows[0];
    res.status(201).json({ 
      success: true, 
      message: 'Service created successfully', 
      service: {
        id: service.id,
        title: service.title,
        description: service.description,
        category: service.category,
        price: service.price,
        location: service.location,
        images: service.images || [],
        amenities: service.amenities || []
      }
    });
  } catch (error) {
    console.error('Create service error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ success: false, message: 'Failed to create service', error: error.message });
  }
});

// Update service
app.put('/api/services/:id', verifyToken, async (req, res) => {
  try {
    console.log('Update service request received');
    console.log('Service ID:', req.params.id);
    console.log('User:', req.user);
    console.log('Body:', req.body);

    if (req.user.userType !== 'service_provider') {
      return res.status(403).json({ success: false, message: 'Only service providers can update services' });
    }

    const serviceId = req.params.id;
    const { title, description, category, price, duration, maxParticipants, location, images, amenities } = req.body;

    // Validate required fields
    if (!title || !description || !category || !price || !location) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields',
        required: ['title', 'description', 'category', 'price', 'location']
      });
    }

    // Convert arrays to PostgreSQL format
    const imagesArray = Array.isArray(images) ? images : [];
    const amenitiesArray = Array.isArray(amenities) ? amenities : [];

    const result = await db.query(
      `UPDATE services 
       SET title = $1, description = $2, category = $3, price = $4, duration = $5, 
           max_participants = $6, location = $7, images = $8, amenities = $9, updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 AND provider_id = $11
       RETURNING *`,
      [title, description, category, price, duration || null, maxParticipants || null, location, imagesArray, amenitiesArray, serviceId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Service not found or unauthorized' });
    }

    const service = result.rows[0];
    res.json({ 
      success: true, 
      message: 'Service updated successfully', 
      service: {
        id: service.id,
        title: service.title,
        description: service.description,
        category: service.category,
        price: service.price,
        location: service.location,
        images: service.images || [],
        amenities: service.amenities || []
      }
    });
  } catch (error) {
    console.error('Update service error:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update service', error: error.message });
  }
});

// Toggle service status
app.patch('/api/services/:id/status', verifyToken, async (req, res) => {
  try {
    console.log('Toggle service status request received');
    console.log('Service ID:', req.params.id);
    console.log('User:', req.user);
    console.log('Body:', req.body);

    if (req.user.userType !== 'service_provider') {
      return res.status(403).json({ success: false, message: 'Only service providers can update service status' });
    }

    const serviceId = req.params.id;
    const { is_active } = req.body;

    const result = await db.query(
      'UPDATE services SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND provider_id = $3 RETURNING *',
      [is_active, serviceId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Service not found or unauthorized' });
    }

    res.json({ 
      success: true, 
      message: `Service ${is_active ? 'activated' : 'paused'} successfully`,
      service: result.rows[0]
    });
  } catch (error) {
    console.error('Toggle status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update service status', error: error.message });
  }
});

// Delete service
app.delete('/api/services/:id', verifyToken, async (req, res) => {
  try {
    console.log('Delete service request received');
    console.log('Service ID:', req.params.id);
    console.log('User:', req.user);

    if (req.user.userType !== 'service_provider') {
      return res.status(403).json({ success: false, message: 'Only service providers can delete services' });
    }

    const serviceId = req.params.id;
    const result = await db.query(
      'DELETE FROM services WHERE id = $1 AND provider_id = $2 RETURNING id',
      [serviceId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Service not found or unauthorized' });
    }

    res.json({ success: true, message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Delete service error:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ success: false, message: 'Failed to delete service', error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 iSafari Backend running on port ${PORT}`);
  console.log(`📡 Health: http://localhost:${PORT}/api/health`);
});
