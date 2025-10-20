const db = require('../config/database');

async function addPromotionColumns() {
  try {
    console.log('📊 Adding promotion columns to services table...');
    
    // Add promotion_type and promotion_location columns
    await db.query(`
      ALTER TABLE services 
      ADD COLUMN IF NOT EXISTS promotion_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS promotion_location VARCHAR(50)
    `);
    
    console.log('✅ Columns added to services table successfully!');
    
    // Check if service_promotions table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'service_promotions'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('📊 Creating service_promotions table...');
      await db.query(`
        CREATE TABLE service_promotions (
          id SERIAL PRIMARY KEY,
          service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
          promotion_type VARCHAR(50) NOT NULL,
          promotion_location VARCHAR(50),
          duration_days INTEGER NOT NULL,
          cost NUMERIC(10, 2) NOT NULL,
          payment_method VARCHAR(50),
          payment_reference VARCHAR(100),
          started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ service_promotions table created!');
    } else {
      console.log('✅ service_promotions table already exists');
      
      // Add missing columns if they don't exist
      await db.query(`
        ALTER TABLE service_promotions 
        ADD COLUMN IF NOT EXISTS promotion_type VARCHAR(50),
        ADD COLUMN IF NOT EXISTS promotion_location VARCHAR(50)
      `);
      console.log('✅ Updated service_promotions table with new columns');
    }
    
    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

addPromotionColumns();
