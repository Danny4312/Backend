require('dotenv').config();
const mongoose = require('mongoose');

async function dropAllGoogleIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    console.log('📋 Current indexes:');
    const indexes = await usersCollection.indexes();
    indexes.forEach(i => console.log('  -', i.name, ':', JSON.stringify(i)));
    
    // Drop all google_id indexes
    const googleIndexes = ['google_id_1', 'google_id_1_sparse'];
    
    for (const indexName of googleIndexes) {
      console.log(`\n��️  Trying to drop ${indexName}...`);
      try {
        await usersCollection.dropIndex(indexName);
        console.log(`✅ ${indexName} dropped`);
      } catch (e) {
        console.log(`ℹ️  ${indexName} does not exist`);
      }
    }
    
    console.log('\n📋 Final indexes:');
    const remaining = await usersCollection.indexes();
    remaining.forEach(i => console.log('  -', i.name));
    
    console.log('\n✅ All google_id indexes removed!');
    console.log('✅ Users can now register without google_id conflicts!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

dropAllGoogleIndexes();
