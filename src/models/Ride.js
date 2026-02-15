const db = require('../config/database');
const { getCachedRides, setCachedRides } = require('../middleware/cacheMiddleware');

class Ride {
    /**
     * Return capacity to ride when booking is cancelled
     */
    static async returnCapacity(rideId, seats, luggage) {
      const query = `
        UPDATE rides
        SET available_seats = available_seats + $2,
            available_luggage = available_luggage + $3
        WHERE id = $1
        RETURNING *
      `;
      const result = await db.query(query, [rideId, seats, luggage]);
      return result.rows[0];
    }
  static async create(cabId) {
    const query = `
      INSERT INTO rides (cab_id, status, available_seats, available_luggage)
      SELECT id, 'active', total_seats, total_luggage_capacity
      FROM cabs WHERE id = $1
      RETURNING *
    `;
    const result = await db.query(query, [cabId]);
    return result.rows[0];
  }

  static async findById(id) {
    const query = 'SELECT * FROM rides WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  static async findActiveRides() {
    // Check cache first
    const cached = getCachedRides();
    if (cached) {
      console.log(`🎯 Using cached rides (${cached.length} rides)`);
      return cached;
    }

    const query = `
      SELECT 
        r.id,
        r.cab_id,
        r.status,
        r.available_seats,
        r.available_luggage,
        r.pickup_lat,
        r.pickup_lon,
        r.dropoff_lat,
        r.dropoff_lon,
        r.total_distance,
        r.current_fare,
        r.version,
        r.created_at,
        c.driver_name, 
        c.vehicle_number,
        ST_X(c.current_location::geometry) as cab_lon,
        ST_Y(c.current_location::geometry) as cab_lat
      FROM rides r
      JOIN cabs c ON r.cab_id = c.id
      WHERE r.status = 'active' 
        AND r.available_seats > 0
        AND r.pickup_lat IS NOT NULL
        AND r.pickup_lon IS NOT NULL
        AND r.dropoff_lat IS NOT NULL
        AND r.dropoff_lon IS NOT NULL
      ORDER BY r.created_at DESC
    `;
    
    try {
      const result = await db.query(query);
      console.log(`✅ Found ${result.rows.length} active rides (from DB)`);
      
      // Cache the results for 2 seconds
      setCachedRides(result.rows);
      
      return result.rows;
    } catch (error) {
      console.error('❌ Error fetching rides:', error.message);
      throw error;
    }
  }

  static async lockAndUpdate(rideId, seatsToBook, luggageToBook, client) {
    // Lock the row for update (prevents race conditions)
    const lockQuery = `
      SELECT * FROM rides 
      WHERE id = $1 
      FOR UPDATE
    `;
    const locked = await client.query(lockQuery, [rideId]);
    
    if (locked.rows.length === 0) {
      throw new Error('Ride not found');
    }

    const ride = locked.rows[0];

    // Check capacity
    if (ride.available_seats < seatsToBook) {
      throw new Error('Not enough seats available');
    }
    if (ride.available_luggage < luggageToBook) {
      throw new Error('Not enough luggage capacity');
    }

    // Update capacity
    const updateQuery = `
      UPDATE rides
      SET available_seats = available_seats - $2,
          available_luggage = available_luggage - $3,
          version = version + 1,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await client.query(updateQuery, [rideId, seatsToBook, luggageToBook]);
    
    // Clear cache after update
    const { clearRidesCache } = require('../middleware/cacheMiddleware');
    clearRidesCache();
    
    return result.rows[0];
  }
}

module.exports = Ride;
