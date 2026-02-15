const { Pool } = require('pg');
require('dotenv').config();

const isNeon = process.env.DATABASE_URL?.includes('neon.tech');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isNeon ? { rejectUnauthorized: false } : false  // No SSL for local
});

// Airport area coordinates (Delhi)
const basePickup = { lat: 28.5562, lon: 77.1000 };
const baseDropoff = { lat: 28.6562, lon: 77.2000 };

function randomOffset(base, range = 0.05) {
  return base + (Math.random() * range * 2 - range);
}

async function createLoadTestData() {
  const client = await pool.connect();
  
  try {
    console.log('🚗 Creating test data for load testing...\n');

    // Create 20 cabs
    console.log('Creating 20 cabs...');
    for (let i = 0; i < 20; i++) {
      await client.query(`
        INSERT INTO cabs (driver_name, vehicle_number, total_seats, total_luggage_capacity, current_location, status)
        VALUES ($1, $2, 4, 4, ST_SetSRID(ST_MakePoint($3, $4), 4326), 'available')
        ON CONFLICT (vehicle_number) DO NOTHING
      `, [
        `Driver ${i + 1}`,
        `DL01XX${String(i + 1).padStart(4, '0')}`,
        randomOffset(basePickup.lon),
        randomOffset(basePickup.lat)
      ]);
    }
    console.log('✅ Created 20 cabs\n');

    // Get all cabs
    const cabsResult = await client.query('SELECT id FROM cabs');
    const cabs = cabsResult.rows;

    if (cabs.length === 0) {
      console.log('❌ No cabs found! Something went wrong.');
      return;
    }

    // Delete old test rides
    await client.query("DELETE FROM bookings");
    await client.query("DELETE FROM rides");
    console.log('🗑️  Cleared old data\n');

    // Create 50 rides
    console.log('Creating 200 rides...');
    let created = 0;
    for (let i = 0; i < 200; i++) {
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
        if (created % 10 === 0) {
          console.log(`  ✅ Created ${created} rides...`);
        }
      } catch (err) {
        console.log(`  ⚠️  Skipped ride ${i + 1}: ${err.message}`);
      }
    }

    console.log(`\n✅ Successfully created ${created} test rides!`);
    console.log(`📊 Total booking capacity: ~${created * 3} bookings\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

createLoadTestData();
