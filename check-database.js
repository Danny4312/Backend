const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

async function checkDatabase() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    console.log('🔍 Checking i_SAFARI_DATABASE...\n');

    // Test connection
    const connectionTest = await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');
    console.log(`📅 Server time: ${connectionTest.rows[0].now}\n`);

    // Check if tables exist
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    const tablesResult = await pool.query(tablesQuery);
    console.log('📋 Tables in i_SAFARI_DATABASE:');
    
    if (tablesResult.rows.length === 0) {
      console.log('❌ No tables found! Database needs to be initialized.');
      
      // Create all tables
      console.log('\n🔧 Creating database tables...');
      await createTables(pool);
      
      // Check again
      const newTablesResult = await pool.query(tablesQuery);
      console.log('\n✅ Tables created successfully:');
      newTablesResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. ${row.table_name}`);
      });
    } else {
      tablesResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. ${row.table_name}`);
      });
    }

    // Check table structures and data
    console.log('\n🔍 Checking table structures:');
    
    const expectedTables = [
      'users', 'service_providers', 'services', 'bookings', 
      'reviews', 'payments', 'notifications'
    ];

    for (const tableName of expectedTables) {
      try {
        const countQuery = `SELECT COUNT(*) FROM ${tableName}`;
        const countResult = await pool.query(countQuery);
        
        const columnsQuery = `
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = $1 
          ORDER BY ordinal_position;
        `;
        const columnsResult = await pool.query(columnsQuery, [tableName]);
        
        console.log(`\n📊 Table: ${tableName}`);
        console.log(`   Records: ${countResult.rows[0].count}`);
        console.log(`   Columns: ${columnsResult.rows.length}`);
        
        if (columnsResult.rows.length > 0) {
          console.log('   Structure:');
          columnsResult.rows.forEach(col => {
            console.log(`     - ${col.column_name}: ${col.data_type}`);
          });
        }
      } catch (error) {
        console.log(`❌ Table ${tableName} not found or error: ${error.message}`);
      }
    }

    console.log('\n✅ Database check completed!');

  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await pool.end();
  }
}

async function createTables(pool) {
  const createTablesSQL = `
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255),
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(20),
      location VARCHAR(255),
      user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('traveler', 'service_provider')),
      google_id VARCHAR(255),
      avatar_url TEXT,
      is_verified BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Service providers table
    CREATE TABLE IF NOT EXISTS service_providers (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      business_name VARCHAR(255) NOT NULL,
      description TEXT,
      business_license VARCHAR(255),
      contact_email VARCHAR(255),
      contact_phone VARCHAR(20),
      website_url TEXT,
      business_address TEXT,
      is_premium BOOLEAN DEFAULT false,
      premium_until TIMESTAMP,
      featured_priority INTEGER DEFAULT 0,
      rating DECIMAL(3,2) DEFAULT 0,
      total_reviews INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Services table
    CREATE TABLE IF NOT EXISTS services (
      id SERIAL PRIMARY KEY,
      provider_id INTEGER REFERENCES service_providers(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      category VARCHAR(100) NOT NULL,
      location VARCHAR(255) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      duration_days INTEGER,
      max_participants INTEGER,
      included_services TEXT[],
      requirements TEXT[],
      images TEXT[],
      is_active BOOLEAN DEFAULT true,
      is_featured BOOLEAN DEFAULT false,
      featured_until TIMESTAMP,
      featured_priority INTEGER DEFAULT 0,
      view_count INTEGER DEFAULT 0,
      booking_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Bookings table
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
      provider_id INTEGER REFERENCES service_providers(id) ON DELETE CASCADE,
      booking_date DATE NOT NULL,
      participants INTEGER NOT NULL,
      total_amount DECIMAL(10,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
      payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
      special_requests TEXT,
      contact_phone VARCHAR(20),
      contact_email VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Reviews table
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
      provider_id INTEGER REFERENCES service_providers(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT,
      images TEXT[],
      is_verified BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Payments table
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
      service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
      provider_id INTEGER REFERENCES service_providers(id) ON DELETE SET NULL,
      payment_type VARCHAR(50) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      currency VARCHAR(3) DEFAULT 'USD',
      payment_method VARCHAR(50) NOT NULL,
      transaction_id VARCHAR(255),
      payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
      description TEXT,
      valid_until TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Notifications table
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      data JSONB,
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Create indexes for better performance
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
    CREATE INDEX IF NOT EXISTS idx_service_providers_user_id ON service_providers(user_id);
    CREATE INDEX IF NOT EXISTS idx_service_providers_premium ON service_providers(is_premium, premium_until);
    CREATE INDEX IF NOT EXISTS idx_services_provider_id ON services(provider_id);
    CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
    CREATE INDEX IF NOT EXISTS idx_services_featured ON services(is_featured, featured_until);
    CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_service_id ON bookings(service_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
    CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
  `;

  await pool.query(createTablesSQL);
}

// Run the check
checkDatabase();
