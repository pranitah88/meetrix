/**
 * Meetrix — Migration: 001_initial_indexes
 * Run: node database/migrations/001_initial_indexes.js
 *
 * Creates all required indexes on the meetrix database.
 * Safe to re-run (MongoDB createIndex is idempotent).
 */

const path = require('path');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../backend/.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';

async function migrate() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db('meetrix');

  console.log('Running migration: 001_initial_indexes');

  // users indexes
  await db.collection('users').createIndex({ email: 1 }, { unique: true, name: 'unique_email' });
  console.log('✓  users.email (unique)');

  // meetings indexes
  await db.collection('meetings').createIndex({ date: -1 }, { name: 'meetings_date_desc' });
  await db.collection('meetings').createIndex({ attendees: 1 }, { name: 'meetings_attendees' });
  await db.collection('meetings').createIndex({ createdBy: 1, date: -1 }, { name: 'meetings_createdBy_date' });
  await db.collection('meetings').createIndex(
    { 'tasks.assignee': 1, 'tasks.status': 1 },
    { name: 'meetings_tasks_assignee_status' }
  );
  console.log('✓  meetings indexes (date, attendees, createdBy, tasks)');

  console.log('\nMigration 001 complete.');
  await client.close();
}

migrate().catch((err) => { console.error(err); process.exit(1); });
