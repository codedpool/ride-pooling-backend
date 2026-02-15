const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const indexes = `
-- Speed up ride queries
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_available_seats ON rides(available_seats) WHERE status = 'active';

-- Speed up booking queries
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_ride_id ON bookings(ride_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- Composite index for active ride lookups
CREATE INDEX IF NOT EXISTS idx_rides_active_lookup 
ON rides(status, available_seats, available_luggage) 
WHERE status = 'active' AND available_seats > 0;

-- Index on coordinates for faster filtering
CREATE INDEX IF NOT EXISTS idx_rides_pickup_coords ON rides(pickup_lat, pickup_lon);
CREATE INDEX IF NOT EXISTS idx_rides_dropoff_coords ON rides(dropoff_lat, dropoff_lon);

ANALYZE rides;
ANALYZE bookings;
`;

async function run() {
  try {
    console.log('🔧 Adding database indexes...');
    await pool.query(indexes);
    console.log('✅ Indexes added successfully!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

run();
