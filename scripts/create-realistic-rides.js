const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Create rides that will match the test booking
const realisticRides = [
  {
    // Perfect match: Same route, minor detour
    pickup_lat: 28.5565,
    pickup_lon: 77.1005,
    dropoff_lat: 28.6565,
    dropoff_lon: 77.2005,
    seats: 3,
    luggage: 3
  },
  {
    // Good match: Slightly different route with 10% detour
    pickup_lat: 28.5600,
    pickup_lon: 77.1050,
    dropoff_lat: 28.6500,
    dropoff_lon: 77.1950,
    seats: 2,
    luggage: 2
  },
  {
    // Acceptable match: 15% detour
    pickup_lat: 28.5400,
    pickup_lon: 77.0900,
    dropoff_lat: 28.6700,
    dropoff_lon: 77.2100,
    seats: 4,
    luggage: 4
  }
];

async function createRides() {
  try {
    console.log('🚗 Creating realistic test rides...\n');

    // Get available cabs
    const cabsResult = await pool.query('SELECT id FROM cabs LIMIT 3');
    const cabs = cabsResult.rows;

    if (cabs.length === 0) {
      console.log('❌ No cabs found. Create cabs first!');
      await pool.end();
      return;
    }

    for (let i = 0; i < realisticRides.length && i < cabs.length; i++) {
      const ride = realisticRides[i];
      const cabId = cabs[i].id;

      const result = await pool.query(`
        INSERT INTO rides (
          cab_id, status, available_seats, available_luggage,
          pickup_lat, pickup_lon, dropoff_lat, dropoff_lon,
          total_distance, current_fare
        ) VALUES ($1, 'active', $2, $3, $4, $5, $6, $7, 15.0, 200.0)
        ON CONFLICT DO NOTHING
        RETURNING id
      `, [
        cabId, ride.seats, ride.luggage,
        ride.pickup_lat, ride.pickup_lon,
        ride.dropoff_lat, ride.dropoff_lon
      ]);

      if (result.rows.length > 0) {
        console.log(`✅ Created ride ${i + 1}: ${result.rows[0].id}`);
        console.log(`   Route: (${ride.pickup_lat}, ${ride.pickup_lon}) → (${ride.dropoff_lat}, ${ride.dropoff_lon})`);
      }
    }

    console.log('\n✅ Realistic rides created!');
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
  }
}

createRides();
