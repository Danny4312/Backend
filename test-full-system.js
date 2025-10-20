const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Pool } = require('pg');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4028',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test routes for system verification
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'iSafari Global Backend is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      success: true,
      message: 'Database connection successful',
      timestamp: result.rows[0].now
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// Test user registration
app.post('/api/test/register', async (req, res) => {
  try {
    const { email, name, user_type } = req.body;
    
    const result = await pool.query(`
      INSERT INTO users (email, name, user_type, password_hash)
      VALUES ($1, $2, $3, 'test_hash')
      RETURNING id, email, name, user_type, created_at
    `, [email, name, user_type]);

    res.json({
      success: true,
      message: 'User registered successfully',
      user: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
});

// Test service creation
app.post('/api/test/service', async (req, res) => {
  try {
    const { provider_email, title, description, category, location, price } = req.body;
    
    // Get provider ID
    const providerResult = await pool.query(`
      SELECT sp.id FROM service_providers sp
      JOIN users u ON sp.user_id = u.id
      WHERE u.email = $1
    `, [provider_email]);

    if (providerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service provider not found'
      });
    }

    const providerId = providerResult.rows[0].id;

    const result = await pool.query(`
      INSERT INTO services (provider_id, title, description, category, location, price)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [providerId, title, description, category, location, price]);

    res.json({
      success: true,
      message: 'Service created successfully',
      service: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Service creation failed',
      error: error.message
    });
  }
});

// Test booking creation
app.post('/api/test/booking', async (req, res) => {
  try {
    const { user_email, service_id, booking_date, participants, total_amount } = req.body;
    
    // Get user ID
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [user_email]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get service and provider info
    const serviceResult = await pool.query('SELECT provider_id FROM services WHERE id = $1', [service_id]);
    if (serviceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    const userId = userResult.rows[0].id;
    const providerId = serviceResult.rows[0].provider_id;

    const result = await pool.query(`
      INSERT INTO bookings (user_id, service_id, provider_id, booking_date, participants, total_amount)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [userId, service_id, providerId, booking_date, participants, total_amount]);

    res.json({
      success: true,
      message: 'Booking created successfully',
      booking: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Booking creation failed',
      error: error.message
    });
  }
});

// Get all data summary
app.get('/api/test/summary', async (req, res) => {
  try {
    const tables = ['users', 'service_providers', 'services', 'bookings', 'reviews', 'payments', 'notifications'];
    const summary = {};

    for (const table of tables) {
      const countResult = await pool.query(`SELECT COUNT(*) FROM ${table}`);
      summary[table] = parseInt(countResult.rows[0].count);
    }

    // Get sample data
    const usersResult = await pool.query('SELECT id, email, name, user_type, created_at FROM users ORDER BY created_at DESC LIMIT 5');
    const servicesResult = await pool.query('SELECT id, title, category, location, price FROM services ORDER BY created_at DESC LIMIT 5');
    const bookingsResult = await pool.query('SELECT id, booking_date, participants, total_amount, status FROM bookings ORDER BY created_at DESC LIMIT 5');

    res.json({
      success: true,
      message: 'System summary retrieved',
      summary,
      sampleData: {
        users: usersResult.rows,
        services: servicesResult.rows,
        bookings: bookingsResult.rows
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get summary',
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 iSafari Global Test Server running on port ${PORT}`);
  console.log(`\n📋 Test Endpoints:`);
  console.log(`   Health: GET http://localhost:${PORT}/api/health`);
  console.log(`   Database: GET http://localhost:${PORT}/api/test-db`);
  console.log(`   Register: POST http://localhost:${PORT}/api/test/register`);
  console.log(`   Service: POST http://localhost:${PORT}/api/test/service`);
  console.log(`   Booking: POST http://localhost:${PORT}/api/test/booking`);
  console.log(`   Summary: GET http://localhost:${PORT}/api/test/summary`);
  console.log(`\n🔗 Frontend should connect to: http://localhost:${PORT}`);
});
