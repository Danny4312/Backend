const db = require('./config/database');

async function cleanupDatabase() {
  try {
    console.log('🧹 STARTING DATABASE CLEANUP...\n');

    // 1. Delete all bookings
    console.log('1️⃣ Deleting all bookings...');
    const bookingsResult = await db.query('DELETE FROM bookings RETURNING id');
    console.log(`   ✅ Deleted ${bookingsResult.rows.length} bookings`);

    // 2. Delete all services
    console.log('\n2️⃣ Deleting all services...');
    const servicesResult = await db.query('DELETE FROM services RETURNING id');
    console.log(`   ✅ Deleted ${servicesResult.rows.length} services`);

    // 3. Delete all service providers
    console.log('\n3️⃣ Deleting all service providers...');
    const providersResult = await db.query('DELETE FROM service_providers RETURNING id');
    console.log(`   ✅ Deleted ${providersResult.rows.length} service providers`);

    // 4. Delete all traveler users
    console.log('\n4️⃣ Deleting all traveler users...');
    const travelersResult = await db.query("DELETE FROM users WHERE user_type = 'traveler' RETURNING id, email");
    console.log(`   ✅ Deleted ${travelersResult.rows.length} travelers`);
    
    // 5. Delete all service_provider users
    console.log('\n5️⃣ Deleting all service provider users...');
    const providerUsersResult = await db.query("DELETE FROM users WHERE user_type = 'service_provider' RETURNING id, email");
    console.log(`   ✅ Deleted ${providerUsersResult.rows.length} service provider users`);

    // 6. Show remaining users (should only be admins)
    console.log('\n6️⃣ Checking remaining users...');
    const remainingUsers = await db.query("SELECT id, email, user_type FROM users");
    console.log(`   ℹ️  Remaining users: ${remainingUsers.rows.length}`);
    remainingUsers.rows.forEach(u => {
      console.log(`      - ${u.email} (${u.user_type})`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ DATABASE CLEANUP COMPLETED!');
    console.log('='.repeat(60));
    console.log('\n📊 SUMMARY:');
    console.log(`   Bookings deleted:        ${bookingsResult.rows.length}`);
    console.log(`   Services deleted:        ${servicesResult.rows.length}`);
    console.log(`   Provider profiles:       ${providersResult.rows.length}`);
    console.log(`   Traveler users:          ${travelersResult.rows.length}`);
    console.log(`   Service provider users:  ${providerUsersResult.rows.length}`);
    console.log(`   Remaining users:         ${remainingUsers.rows.length}\n`);
    console.log('🎯 System ready for fresh registration!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run cleanup
cleanupDatabase();
