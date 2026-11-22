/**
 * Meetrix — MongoDB Seed Script
 * Run: node database/seeds/seed.js
 */

const path     = require('path');
const mongoose = require('mongoose');
const dotenv   = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../backend/.env') });
const { seedDatabase } = require('../../backend/src/config/seedHelper');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/meetrix';

async function seed() {
  await mongoose.connect(MONGO_URI, { dbName: 'meetrix' });
  console.log('Connected to MongoDB');
  await mongoose.connection.db.dropDatabase();
  console.log('Cleared existing data');
  await seedDatabase(mongoose.connection);
  await mongoose.disconnect();
}

seed().catch((err) => { console.error(err); process.exit(1); });
