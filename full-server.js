const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const session = require('express-session');
const passport = require('./config/passport');
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
  .then(() => console.log('✅ Connected to ISAFARI database'))
  .catch(err => {
    console.error('❌ Database connection error:', err);
    // Continue anyway - some routes don't need database
  });

// CORS Configuration
const corsOptions = {
  origin: ['http://localhost:4028', 'http://localhost:3000', 'http://127.0.0.1:4028'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Manual CORS headers as backup
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (corsOptions.origin.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  }
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Increase body size limit for base64 images (50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'isafari_session_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({ 
      status: 'OK', 
      message: 'iSafari Global Backend is running',
      database: 'Connected',
      timestamp: result.rows[0].now
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// Google OAuth endpoints
app.get('/api/auth/google', (req, res) => {
  // For development, provide a demo response instead of real OAuth
  res.json({
    message: 'Google OAuth endpoint - Demo mode',
    action: 'In production, this would redirect to Google OAuth',
    demo_login_url: '/api/auth/demo-login',
    note: 'Configure GOOGLE_CLIENT_ID in .env for real OAuth'
  });
});

// Demo login for development
app.get('/api/auth/demo-login', (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4028';
  res.redirect(`${frontendUrl}/auth/oauth-callback?token=demo_token&userType=new`);
});

app.get('/api/auth/google/callback', (req, res) => {
  const { code } = req.query;
  if (code) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4028';
    res.redirect(`${frontendUrl}/auth/oauth-callback?token=demo_token&userType=new`);
  } else {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4028';
    res.redirect(`${frontendUrl}/login?error=oauth_failed`);
  }
});

// Database tables check and creation
app.get('/api/database/check', async (req, res) => {
  try {
    const tables = ['users', 'services', 'bookings', 'reviews', 'payments', 'notifications', 'featured_services'];
    const tableStatus = {};
    
    for (const table of tables) {
      try {
        const result = await db.query(`SELECT COUNT(*) FROM ${table}`);
        tableStatus[table] = { exists: true, count: parseInt(result.rows[0].count) };
      } catch (error) {
        tableStatus[table] = { exists: false, error: error.message };
      }
    }
    
    res.json({
      database: 'i_SAFARI_DATABASE',
      tables: tableStatus,
      message: 'Database table status'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Database check failed',
      message: error.message
    });
  }
});

// Create tables endpoint
app.post('/api/database/setup', async (req, res) => {
  try {
    // Users table
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        phone VARCHAR(20),
        user_type VARCHAR(20) CHECK (user_type IN ('traveler', 'service_provider')) NOT NULL,
        google_id VARCHAR(255),
        profile_image VARCHAR(500),
        is_premium BOOLEAN DEFAULT FALSE,
        premium_expires_at TIMESTAMP,
        country VARCHAR(100),
        region VARCHAR(100),
        district VARCHAR(100),
        area VARCHAR(100),
        business_name VARCHAR(255),
        business_type VARCHAR(100),
        business_description TEXT,
        license_number VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Services table
    await db.query(`
      CREATE TABLE IF NOT EXISTS services (
        id SERIAL PRIMARY KEY,
        provider_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(100) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        duration INTEGER,
        max_participants INTEGER,
        location VARCHAR(255) NOT NULL,
        country VARCHAR(100),
        region VARCHAR(100),
        district VARCHAR(100),
        area VARCHAR(100),
        images TEXT[],
        amenities TEXT[],
        is_active BOOLEAN DEFAULT TRUE,
        average_rating DECIMAL(3,2) DEFAULT 0,
        total_bookings INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Bookings table
    await db.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
        traveler_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        booking_date DATE NOT NULL,
        start_time TIME,
        end_time TIME,
        participants INTEGER NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        status VARCHAR(20) CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')) DEFAULT 'pending',
        payment_status VARCHAR(20) CHECK (payment_status IN ('pending', 'paid', 'refunded')) DEFAULT 'pending',
        special_requests TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Reviews table
    await db.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
        service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
        traveler_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Payments table
    await db.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
        payment_type VARCHAR(50) CHECK (payment_type IN ('booking', 'premium_membership', 'featured_service')) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        payment_method VARCHAR(20) CHECK (payment_method IN ('stripe', 'mpesa')) NOT NULL,
        payment_status VARCHAR(20) CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')) DEFAULT 'pending',
        stripe_payment_intent_id VARCHAR(255),
        mpesa_transaction_id VARCHAR(255),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Notifications table
    await db.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        data JSONB,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Featured services table
    await db.query(`
      CREATE TABLE IF NOT EXISTS featured_services (
        id SERIAL PRIMARY KEY,
        service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
        payment_id INTEGER REFERENCES payments(id) ON DELETE CASCADE,
        start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_date TIMESTAMP NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    res.json({
      message: 'Database tables created successfully',
      tables: ['users', 'services', 'bookings', 'reviews', 'payments', 'notifications', 'featured_services']
    });
  } catch (error) {
    res.status(500).json({
      error: 'Database setup failed',
      message: error.message
    });
  }
});

// API endpoints
app.get('/api/auth/me', (req, res) => {
  res.json({ user: null, authenticated: false });
});

// Registration endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, userType } = req.body;
    
    // Validate required fields
    if (!email || !password || !firstName || !lastName || !phone || !userType) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }
    
    // Check if user already exists
    const existingUser = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }
    
    // Insert new user (in production, hash the password with bcrypt)
    const result = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, user_type, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, email, first_name, last_name, phone, user_type, created_at`,
      [email, password, firstName, lastName, phone, userType]
    );
    
    const user = result.rows[0];
    
    // Generate a simple token (in production, use JWT)
    const token = `token_${user.id}_${Date.now()}`;
    
    res.json({
      success: true,
      message: 'Registration successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        userType: user.user_type
      },
      token: token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
    
    // Find user
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    const user = result.rows[0];
    
    // Check password (in production, use bcrypt.compare)
    if (user.password_hash !== password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Generate token
    const token = `token_${user.id}_${Date.now()}`;
    
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        userType: user.user_type
      },
      token: token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

app.get('/api/services', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM services WHERE is_active = true ORDER BY created_at DESC LIMIT 10');
    res.json({ 
      services: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    res.json({ 
      services: [],
      message: 'Services table not ready, using fallback'
    });
  }
});

app.get('/api/bookings', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM bookings ORDER BY created_at DESC LIMIT 10');
    res.json({ 
      bookings: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    res.json({ 
      bookings: [],
      message: 'Bookings table not ready, using fallback'
    });
  }
});

app.get('/api/users/profile', (req, res) => {
  res.json({ 
    profile: null,
    message: 'Profile endpoint working'
  });
});

// Get all users (for development/debugging)
app.get('/api/users/all', async (req, res) => {
  try {
    const result = await db.query('SELECT id, email, first_name, last_name, phone, user_type, created_at FROM users ORDER BY created_at DESC');
    res.json({
      success: true,
      users: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

// Delete user by email (for development/debugging)
app.delete('/api/users/email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const result = await db.query('DELETE FROM users WHERE email = $1 RETURNING *', [email]);
    
    if (result.rows.length > 0) {
      res.json({
        success: true,
        message: `User with email ${email} deleted successfully`,
        user: result.rows[0]
      });
    } else {
      res.status(404).json({
        success: false,
        message: `User with email ${email} not found`
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
});

// Reset password (for development/debugging)
app.put('/api/users/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    
    if (!email || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email and new password are required'
      });
    }
    
    const result = await db.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id, email, first_name, last_name',
      [newPassword, email]
    );
    
    if (result.rows.length > 0) {
      res.json({
        success: true,
        message: `Password updated successfully for ${email}`,
        user: result.rows[0]
      });
    } else {
      res.status(404).json({
        success: false,
        message: `User with email ${email} not found`
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: error.message
    });
  }
});

// API placeholder endpoints
app.get('/api/placeholder/:width/:height', (req, res) => {
  const { width, height } = req.params;
  res.json({
    url: `https://via.placeholder.com/${width}x${height}`,
    width: parseInt(width),
    height: parseInt(height)
  });
});

// Get destinations
app.get('/api/destinations', async (req, res) => {
  try {
    const { category, region } = req.query;
    
    let query = `
      SELECT * FROM destinations
      WHERE is_active = true
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (category && category !== 'all') {
      query += ` AND category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }
    
    if (region) {
      query += ` AND region = $${paramCount}`;
      params.push(region);
      paramCount++;
    }
    
    query += ' ORDER BY rating DESC, name ASC';
    
    const result = await db.query(query, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      destinations: result.rows
    });
  } catch (error) {
    console.error('Error fetching destinations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch destinations',
      error: error.message
    });
  }
});

// Get services by provider ID
app.get('/api/services/provider/:providerId', async (req, res) => {
  try {
    const { providerId } = req.params;
    
    const result = await db.query(`
      SELECT * FROM services 
      WHERE provider_id = $1 
      ORDER BY created_at DESC
    `, [providerId]);
    
    res.json({
      success: true,
      count: result.rows.length,
      services: result.rows
    });
  } catch (error) {
    console.error('Error fetching provider services:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch services',
      error: error.message
    });
  }
});

// Get services by location and category
app.get('/api/services/search', async (req, res) => {
  try {
    const { region, district, category } = req.query;
    
    let query = `
      SELECT 
        s.*,
        u.first_name,
        u.last_name,
        u.business_name,
        u.phone,
        u.email,
        u.region,
        u.district,
        u.area
      FROM services s
      JOIN users u ON s.provider_id = u.id
      WHERE u.user_type = 'service_provider' AND s.is_active = true
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (region) {
      query += ` AND (u.region = $${paramCount} OR s.location ILIKE $${paramCount + 1})`;
      params.push(region);
      params.push(`%${region}%`);
      paramCount += 2;
    }
    
    if (district) {
      query += ` AND (u.district = $${paramCount} OR s.location ILIKE $${paramCount + 1})`;
      params.push(district);
      params.push(`%${district}%`);
      paramCount += 2;
    }
    
    if (category) {
      query += ` AND s.category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }
    
    query += ' ORDER BY s.created_at DESC';
    
    const result = await db.query(query, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      services: result.rows
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch services',
      error: error.message
    });
  }
});

// Create payment
app.post('/api/payments', async (req, res) => {
  try {
    const {
      user_id,
      journey_data,
      payment_method,
      amount,
      payment_details,
      status
    } = req.body;

    if (!user_id || !payment_method || !amount) {
      return res.status(400).json({
        success: false,
        message: 'User ID, payment method, and amount are required'
      });
    }

    const result = await db.query(`
      INSERT INTO payments (
        user_id, journey_data, payment_method, amount, 
        payment_details, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `, [
      user_id,
      JSON.stringify(journey_data),
      payment_method,
      amount,
      JSON.stringify(payment_details),
      status || 'pending'
    ]);

    res.status(201).json({
      success: true,
      message: 'Payment initiated successfully',
      payment: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment',
      error: error.message
    });
  }
});

// Delete service
app.delete('/api/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'DELETE FROM services WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Service deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete service',
      error: error.message
    });
  }
});

// Create new service
app.post('/api/services', async (req, res) => {
  try {
    const {
      provider_id,
      title,
      description,
      category,
      subcategory,
      price,
      price_unit,
      duration,
      capacity,
      includes,
      excludes,
      requirements,
      images,
      main_image
    } = req.body;

    if (!provider_id || !title || !category) {
      return res.status(400).json({
        success: false,
        message: 'Provider ID, title, and category are required'
      });
    }

    // Build location string from request body
    const location = `${req.body.district || ''}, ${req.body.region || ''}, ${req.body.country || 'Tanzania'}`.trim();
    
    // Get first image if available
    const mainImage = images && images.length > 0 ? images[0] : null;
    
    const result = await db.query(`
      INSERT INTO services (
        provider_id, title, description, category, price, 
        location, image, is_active, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
      RETURNING *
    `, [
      provider_id, 
      title, 
      description, 
      category,
      price,
      location,
      mainImage
    ]);

    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      service: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create service',
      error: error.message
    });
  }
});

// Get service by ID
app.get('/api/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT 
        s.*,
        u.first_name,
        u.last_name,
        u.business_name,
        u.phone,
        u.email,
        u.region,
        u.district,
        u.area
      FROM services s
      JOIN users u ON s.provider_id = u.id
      WHERE s.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }
    
    res.json({
      success: true,
      service: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service',
      error: error.message
    });
  }
});

// Import authentication routes
const authRoutes = require('./routes/auth');
const serviceRoutes = require('./routes/services');
const userRoutes = require('./routes/users');
const bookingRoutes = require('./routes/bookings');
const paymentRoutes = require('./routes/payments');
const notificationRoutes = require('./routes/notifications');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);

// Catch all API routes
app.use('/api/*', (req, res) => {
  res.json({ 
    message: 'API endpoint working',
    endpoint: req.originalUrl,
    method: req.method,
    status: 'implemented'
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.originalUrl 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 iSafari Global Full Backend running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 Database check: http://localhost:${PORT}/api/database/check`);
  console.log(`⚙️ Setup tables: POST http://localhost:${PORT}/api/database/setup`);
});

module.exports = app;
