const fs = require('fs');
const path = require('path');
const db = require('./config/database');

async function runMigrations() {
  try {
    console.log('🔄 Running database migrations...');

    // Read the SQL file
    const sqlPath = path.join(__dirname, 'migrations', 'create_traveler_stories_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the SQL
    await db.query(sql);

    console.log('✅ Migrations completed successfully!');
    console.log('\n📋 Created tables:');
    console.log('   - traveler_stories');
    console.log('   - story_likes');
    console.log('   - story_comments');
    console.log('   - service_promotions');
    console.log('\n📁 Remember to create uploads directory:');
    console.log('   mkdir -p uploads/stories');
    console.log('   chmod 755 uploads/stories');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
