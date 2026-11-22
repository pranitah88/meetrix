const mongoose = require('mongoose');
const { seedDatabase } = require('./seedHelper');

let mongod = null;

const connectDB = async () => {
  try {
    let uri = process.env.MONGO_URI;

    if (!uri || uri.trim() === '') {
      console.log('No MONGO_URI specified — initializing in-memory MongoDB...');
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongod = await MongoMemoryServer.create({
        instance: { dbName: 'meetrix' },
      });
      uri = mongod.getUri();
      console.log(`In-memory MongoDB started at: ${uri}`);
    }

    const conn = await mongoose.connect(uri, {
      dbName: 'meetrix',
    });
    console.log(`MongoDB connected: ${conn.connection.host}`);

    // Auto-seed initial demo data if empty
    await seedDatabase(mongoose.connection);

    return conn;
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

const stopDB = async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
};

module.exports = connectDB;
module.exports.stopDB = stopDB;
