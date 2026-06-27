const { Pool } = require('pg');
require('dotenv').config();

const isNeon = process.env.DATABASE_URL?.includes('neon.tech');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isNeon ? { rejectUnauthorized: false } : false
});

// Airport area coordinates (Delhi)
const basePickup = { lat: 28.5562, lon: 77.1000 };
const baseDropoff = { lat: 28.6562, lon: 77.2000 };

function randomOffset(base, range = 0.05) {
  return base + (Math.random() * range * 2 - range);
}

async function addMoreRides() {
  const client = await pool.connect();
  
  try {
    console.log('🚗 Adding 20 more rides to the database...\n');

    // Get all available cabs
    const cabsResult = await client.query('SELECT id FROM cabs');
    const cabs = cabsResult.rows;

    if (cabs.length === 0) {
      console.log('❌ No cabs found! Please seed cabs first.');
      return;
    }

    console.log(`Found ${cabs.length} cabs in database`);

    // Create 20 new rides
    let created = 0;
    for (let i = 0; i < 20; i++) {
      const cabId = cabs[i % cabs.length].id;
      
      const pickupLat = randomOffset(basePickup.lat, 0.05);
      const pickupLon = randomOffset(basePickup.lon, 0.05);
      const dropoffLat = randomOffset(baseDropoff.lat, 0.05);
      const dropoffLon = randomOffset(baseDropoff.lon, 0.05);
      
      const seats = Math.floor(Math.random() * 3) + 2; // 2-4 seats
      const luggage = Math.floor(Math.random() * 3) + 2; // 2-4 luggage

      try {
        await client.query(`
          INSERT INTO rides (
            cab_id, status, available_seats, available_luggage,
            pickup_lat, pickup_lon, dropoff_lat, dropoff_lon,
            total_distance, current_fare
          ) VALUES ($1, 'active', $2, $3, $4, $5, $6, $7, 15.0, 200.0)
        `, [cabId, seats, luggage, pickupLat, pickupLon, dropoffLat, dropoffLon]);

        created++;
        console.log(`  ✅ Created ride ${created}/20`);
      } catch (err) {
        console.log(`  ⚠️  Failed to create ride ${i + 1}: ${err.message}`);
      }
    }

    console.log(`\n✅ Successfully added ${created} rides!`);

    // Show current total
    const totalResult = await client.query('SELECT COUNT(*) as count FROM rides');
    console.log(`📊 Total rides in database: ${totalResult.rows[0].count}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

addMoreRides();
