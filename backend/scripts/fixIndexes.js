const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/temple_crowd_management';

async function run() {
  const conn = await mongoose.connect(MONGODB_URI);
  const db = conn.connection.db;
  const collection = db.collection('temples');
  const idx = await collection.indexes();
  console.log('Current indexes on temples:', idx);

  // Try to drop problematic 2dsphere index if it exists
  const targetName = 'location.coordinates_2dsphere';
  const hasTarget = idx.some(i => i.name === targetName);
  if (hasTarget) {
    console.log(`Dropping index: ${targetName}`);
    try {
      await collection.dropIndex(targetName);
      console.log('Dropped index:', targetName);
    } catch (e) {
      console.warn('Failed to drop index by name, trying to drop all indexes...', e.message);
    }
  }

  // Also drop any 2dsphere style indexes that reference location.coordinates
  const geoIdx = idx.filter(i => i.key && Object.keys(i.key).some(k => k.startsWith('location.coordinates')));
  for (const i of geoIdx) {
    if (i.name !== targetName) {
      try {
        console.log('Dropping index:', i.name);
        await collection.dropIndex(i.name);
      } catch (e) {
        console.warn(`Failed to drop index ${i.name}:`, e.message);
      }
    }
  }

  const after = await collection.indexes();
  console.log('Indexes after cleanup:', after);
}

run()
  .catch(err => { console.error('fixIndexes error:', err); process.exitCode = 1; })
  .finally(async () => { await mongoose.connection.close(); console.log('Closed MongoDB connection'); });
