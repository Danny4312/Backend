/**
 * Script to fix MongoDB indexes
 * Run this once to drop old google_id index and recreate with sparse option
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

async function fixIndexes() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    console.log('\n📋 Current indexes:');
    const indexes = await usersCollection.indexes();
    indexes.forEach(index => {
      console.log('  -', JSON.stringify(index));
    });

    // Drop old google_id index if it exists
    console.log('\n🗑️  Dropping old google_id_1 index...');
    try {
      await usersCollection.dropIndex('google_id_1');
      console.log('✅ Old index dropped');
    } catch (error) {
      if (error.code === 27) {
        console.log('ℹ️  Index google_id_1 does not exist (already dropped)');
      } else {
        console.error('❌ Error dropping index:', error.message);
      }
    }

    // Create new sparse unique index for google_id
    console.log('\n🔨 Creating new sparse unique index for google_id...');
    try {
      await usersCollection.createIndex(
        { google_id: 1 },
        { 
          unique: true, 
          sparse: true,
          partialFilterExpression: { 
            google_id: { $exists: true, $ne: null, $ne: '' } 
          },
          name: 'google_id_1_sparse'
        }
      );
      console.log('✅ New sparse unique index created');
    } catch (error) {
      console.error('❌ Error creating index:', error.message);
    }

    console.log('\n📋 Updated indexes:');
    const newIndexes = await usersCollection.indexes();
    newIndexes.forEach(index => {
      console.log('  -', JSON.stringify(index));
    });

    console.log('\n✅ Index fix complete!');
    console.log('✅ Users can now register with google_id: null');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

fixIndexes();
