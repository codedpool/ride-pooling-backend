-- Speed up ride queries
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_available_seats ON rides(available_seats) WHERE status = 'active';

-- Speed up booking queries
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_ride_id ON bookings(ride_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- Speed up spatial queries (PostGIS)
CREATE INDEX IF NOT EXISTS idx_rides_pickup_location ON rides USING GIST(pickup_location);
CREATE INDEX IF NOT EXISTS idx_rides_dropoff_location ON rides USING GIST(dropoff_location);

-- Composite index for active ride lookups
CREATE INDEX IF NOT EXISTS idx_rides_active_lookup 
ON rides(status, available_seats, available_luggage) 
WHERE status = 'active' AND available_seats > 0;

ANALYZE rides;
ANALYZE bookings;
