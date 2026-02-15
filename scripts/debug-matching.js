const { Pool } = require('pg');
const { calculateDistance, calculateDetour } = require('../src/utils/geoUtils');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const pickupLat = 28.5565;
const pickupLon = 77.1005;
const dropoffLat = 28.6565;
const dropoffLon = 77.2005;

async function debug() {
  try {
    const result = await pool.query(`
      SELECT id, pickup_lat, pickup_lon, dropoff_lat, dropoff_lon,
             available_seats, available_luggage
      FROM rides
      WHERE status = 'active' AND available_seats > 0
    `);

    console.log(`\n📍 User Request: Pickup (${pickupLat}, ${pickupLon}) → Dropoff (${dropoffLat}, ${dropoffLon})\n`);
    console.log(`Found ${result.rows.length} active rides:\n`);

    result.rows.forEach((ride, idx) => {
      console.log(`--- Ride ${idx + 1} (${ride.id}) ---`);
      console.log(`Ride Route: (${ride.pickup_lat}, ${ride.pickup_lon}) → (${ride.dropoff_lat}, ${ride.dropoff_lon})`);
      console.log(`Capacity: ${ride.available_seats} seats, ${ride.available_luggage} luggage`);

      const pickupDist = calculateDistance(pickupLat, pickupLon, ride.pickup_lat, ride.pickup_lon);
      console.log(`Pickup Distance: ${pickupDist.toFixed(2)} km (max allowed: 5 km)`);

      const detour = calculateDetour(
        ride.pickup_lat, ride.pickup_lon,
        ride.dropoff_lat, ride.dropoff_lon,
        pickupLat, pickupLon,
        dropoffLat, dropoffLon
      );

      console.log(`Detour: ${detour.detourDistance.toFixed(2)} km (${detour.detourPercent.toFixed(2)}% - max allowed: 20%)`);
      
      const passedPickupDist = pickupDist <= 5;
      const passedDetour = detour.detourPercent <= 20;
      
      console.log(`✅ Passed Pickup Distance: ${passedPickupDist}`);
      console.log(`✅ Passed Detour Constraint: ${passedDetour}`);
      console.log(`🎯 MATCH: ${passedPickupDist && passedDetour ? 'YES' : 'NO'}\n`);
    });

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
  }
}

debug();
