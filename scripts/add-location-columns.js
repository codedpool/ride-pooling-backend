const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const migration = `
-- Add location columns to rides table
ALTER TABLE rides 
ADD COLUMN IF NOT EXISTS pickup_lat DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS pickup_lon DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS dropoff_lat DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS dropoff_lon DECIMAL(11, 8);

-- Update existing rides with sample data (Delhi Airport area)
UPDATE rides 
SET 
  pickup_lat = 28.5562 + (RANDOM() * 0.1 - 0.05),
  pickup_lon = 77.1000 + (RANDOM() * 0.1 - 0.05),
  dropoff_lat = 28.6562 + (RANDOM() * 0.1 - 0.05),
  dropoff_lon = 77.2000 + (RANDOM() * 0.1 - 0.05)
WHERE pickup_lat IS NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_rides_pickup_coords ON rides(pickup_lat, pickup_lon);
CREATE INDEX IF NOT EXISTS idx_rides_dropoff_coords ON rides(dropoff_lat, dropoff_lon);

ANALYZE rides;
`;

async function run() {
  try {
    console.log('🔧 Adding location columns to rides table...');
    await pool.query(migration);
    console.log('✅ Columns added and indexed successfully!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

run();
