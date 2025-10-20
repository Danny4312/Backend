const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

async function setupDatabase() {
  // First connect to postgres database to create our database
  const adminPool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: 'postgres', // Connect to default postgres database
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    console.log('🔧 Setting up i_SAFARI_DATABASE...\n');

    // Check if database exists
    const checkDbQuery = `SELECT 1 FROM pg_database WHERE datname = 'i_SAFARI_DATABASE'`;
    const dbExists = await adminPool.query(checkDbQuery);

    if (dbExists.rows.length === 0) {
      console.log('📦 Creating i_SAFARI_DATABASE...');
      await adminPool.query('CREATE DATABASE "i_SAFARI_DATABASE"');
      console.log('✅ Database created successfully!\n');
    } else {
      console.log('✅ Database i_SAFARI_DATABASE already exists\n');
    }

    await adminPool.end();

    // Now connect to our database and create tables
    const appPool = new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

    console.log('🔧 Creating tables and indexes...');
    
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

    await appPool.query(createTablesSQL);
    console.log('✅ All tables and indexes created successfully!\n');

    // Insert sample data for testing
    console.log('📝 Inserting sample data...');
    
    const sampleDataSQL = `
      -- Sample users
      INSERT INTO users (email, password_hash, name, user_type, phone, location) VALUES
      ('traveler@test.com', '$2b$10$example', 'John Traveler', 'traveler', '+254712345678', 'Nairobi, Kenya'),
      ('provider@test.com', '$2b$10$example', 'Safari Provider', 'service_provider', '+254787654321', 'Maasai Mara, Kenya')
      ON CONFLICT (email) DO NOTHING;

      -- Sample service provider
      INSERT INTO service_providers (user_id, business_name, description, contact_email, contact_phone, business_address)
      SELECT id, 'Mara Safari Adventures', 'Premium safari experiences in Maasai Mara', 'provider@test.com', '+254787654321', 'Maasai Mara National Reserve'
      FROM users WHERE email = 'provider@test.com'
      ON CONFLICT DO NOTHING;

      -- Sample service
      INSERT INTO services (provider_id, title, description, category, location, price, duration_days, max_participants, included_services)
      SELECT sp.id, 'Big Five Safari Experience', 'Experience the magnificent Big Five animals in their natural habitat', 'Safari', 'Maasai Mara', 299.99, 3, 8, ARRAY['Game drives', 'Accommodation', 'Meals', 'Transport']
      FROM service_providers sp
      JOIN users u ON sp.user_id = u.id
      WHERE u.email = 'provider@test.com';
    `;

    await appPool.query(sampleDataSQL);
    console.log('✅ Sample data inserted!\n');

    // Verify tables
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    const tablesResult = await appPool.query(tablesQuery);
    console.log('📋 Created tables:');
    tablesResult.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.table_name}`);
    });

    // Check data counts
    console.log('\n📊 Data verification:');
    const tables = ['users', 'service_providers', 'services', 'bookings', 'reviews', 'payments', 'notifications'];
    
    for (const table of tables) {
      const countResult = await appPool.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`   ${table}: ${countResult.rows[0].count} records`);
    }

    console.log('\n🎉 Database setup completed successfully!');
    console.log('📝 You can now access pgAdmin and see all tables in i_SAFARI_DATABASE');

    await appPool.end();

  } catch (error) {
    console.error('❌ Setup error:', error.message);
  }
}

// Run the setup
setupDatabase();
