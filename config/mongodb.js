const { MongoClient, ServerApiVersion } = require('mongodb');
const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB Atlas connection string from environment variable
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://d34911651_db_user:jeda@123@cluster0.c8dw3ca.mongodb.net/isafari_global?retryWrites=true&w=majority&appName=Cluster0";

// Validate MongoDB URI
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in .env file');
  process.exit(1);
}

// Create a MongoClient with MongoClientOptions
const client = new MongoClient(MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Mongoose connection
let isConnected = false;

const connectMongoDB = async () => {
  if (isConnected) {
    console.log('✅ MongoDB already connected');
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    console.log('✅ Connected to MongoDB Atlas successfully');
    console.log(`📊 Database: ${process.env.MONGODB_DB_NAME || 'isafari_global'}`);
    
    // Test connection
    await mongoose.connection.db.admin().ping();
    console.log('🏓 MongoDB ping successful!');
    
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
};

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('🔗 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('🔌 Mongoose disconnected from MongoDB');
  isConnected = false;
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('👋 MongoDB connection closed through app termination');
  process.exit(0);
});

module.exports = {
  connectMongoDB,
  mongoose,
  client,
  db: () => mongoose.connection.db
};
