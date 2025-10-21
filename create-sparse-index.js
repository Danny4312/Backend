require('dotenv').config();
const mongoose = require('mongoose');

async function createIndex() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    console.log('🔨 Creating sparse unique index for google_id...');
    await usersCollection.createIndex(
      { google_id: 1 },
      { unique: true, sparse: true, name: 'google_id_1_sparse' }
    );
    console.log('✅ Sparse unique index created successfully!');
    
    const indexes = await usersCollection.indexes();
    console.log('\n📋 All indexes:');
    indexes.forEach(i => console.log('  -', i.name, ':', JSON.stringify(i.key)));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createIndex();
