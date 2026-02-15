-- Enable extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Cabs table
CREATE TABLE IF NOT EXISTS cabs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_name VARCHAR(255) NOT NULL,
  vehicle_number VARCHAR(50) UNIQUE NOT NULL,
  total_seats INTEGER DEFAULT 4,
  total_luggage_capacity INTEGER DEFAULT 4,
  current_location GEOGRAPHY(POINT, 4326),
  status VARCHAR(50) DEFAULT 'available',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Rides table
CREATE TABLE IF NOT EXISTS rides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cab_id UUID REFERENCES cabs(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'active',
  available_seats INTEGER DEFAULT 4,
  available_luggage INTEGER DEFAULT 4,
  pickup_lat DECIMAL(10, 8),
  pickup_lon DECIMAL(11, 8),
  dropoff_lat DECIMAL(10, 8),
  dropoff_lon DECIMAL(11, 8),
  route_path TEXT,
  total_distance NUMERIC(10, 2),
  current_fare NUMERIC(10, 2),
  version INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ride_id UUID REFERENCES rides(id) ON DELETE CASCADE,
  pickup_location GEOGRAPHY(POINT, 4326),
  dropoff_location GEOGRAPHY(POINT, 4326),
  luggage_count INTEGER DEFAULT 1,
  fare NUMERIC(10, 2),
  detour_distance NUMERIC(10, 2),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_available_seats ON rides(available_seats) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_ride_id ON bookings(ride_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_rides_pickup_coords ON rides(pickup_lat, pickup_lon);
CREATE INDEX IF NOT EXISTS idx_rides_dropoff_coords ON rides(dropoff_lat, dropoff_lon);
CREATE INDEX IF NOT EXISTS idx_rides_active_lookup ON rides(status, available_seats, available_luggage) 
  WHERE status = 'active' AND available_seats > 0;
CREATE INDEX IF NOT EXISTS idx_cabs_location ON cabs USING GIST(current_location);

-- Optimize database
ANALYZE;

-- Insert sample user for testing
INSERT INTO users (id, name, email, phone) 
VALUES ('452ef1bf-8064-4882-8071-c85cc4d3cb63', 'Test User', 'test@example.com', '+919999999999')
ON CONFLICT (email) DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Database initialized successfully!';
END $$;
