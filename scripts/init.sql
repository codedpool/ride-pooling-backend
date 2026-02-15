-- Enable PostGIS Extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Cabs Table
CREATE TABLE cabs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_name VARCHAR(100) NOT NULL,
    vehicle_number VARCHAR(20) UNIQUE NOT NULL,
    total_seats INTEGER DEFAULT 4,
    total_luggage_capacity INTEGER DEFAULT 6,
    current_location GEOGRAPHY(POINT, 4326) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Rides Table
CREATE TABLE rides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cab_id UUID REFERENCES cabs(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'active',
    available_seats INTEGER DEFAULT 4,
    available_luggage INTEGER DEFAULT 6,
    route_path TEXT,
    total_distance DECIMAL(10, 2) DEFAULT 0,
    current_fare DECIMAL(10, 2) DEFAULT 0,
    version INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Bookings Table
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ride_id UUID REFERENCES rides(id) ON DELETE CASCADE,
    pickup_location GEOGRAPHY(POINT, 4326) NOT NULL,
    dropoff_location GEOGRAPHY(POINT, 4326) NOT NULL,
    luggage_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    fare DECIMAL(10, 2),
    detour_distance DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX idx_cabs_location ON cabs USING GIST(current_location);
CREATE INDEX idx_rides_status ON rides(status);
CREATE INDEX idx_rides_cab_id ON rides(cab_id);
CREATE INDEX idx_bookings_ride_id ON bookings(ride_id);
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_status ON bookings(status);
