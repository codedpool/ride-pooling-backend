const db = require('../config/database');

class Booking {
  static async create(userId, rideId, pickupLat, pickupLon, dropoffLat, dropoffLon, luggageCount, fare, detourDistance) {
    const query = `
      INSERT INTO bookings (user_id, ride_id, pickup_location, dropoff_location, luggage_count, fare, detour_distance, status)
      VALUES ($1, $2, 
              ST_SetSRID(ST_MakePoint($4, $3), 4326),
              ST_SetSRID(ST_MakePoint($6, $5), 4326),
              $7, $8, $9, 'confirmed')
      RETURNING id, user_id, ride_id, luggage_count, fare, detour_distance, status,
                ST_X(pickup_location::geometry) as pickup_lon,
                ST_Y(pickup_location::geometry) as pickup_lat,
                ST_X(dropoff_location::geometry) as dropoff_lon,
                ST_Y(dropoff_location::geometry) as dropoff_lat,
                created_at
    `;
    const result = await db.query(query, [
      userId, rideId, pickupLat, pickupLon, dropoffLat, dropoffLon, 
      luggageCount, fare, detourDistance
    ]);
    return result.rows[0];
  }

  /**
   * Find booking by ID
   */
  static async findById(id) {
    const query = `
      SELECT * FROM bookings
      WHERE id = $1
    `;
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Find booking by ID with ride details
   */
  static async findByIdWithDetails(id) {
    const query = `
      SELECT 
        b.id,
        b.user_id,
        b.ride_id,
        b.luggage_count,
        b.fare,
        b.detour_distance,
        b.status,
        b.created_at,
        r.id as ride_id,
        r.cab_id,
        c.driver_name,
        c.vehicle_number
      FROM bookings b
      JOIN rides r ON b.ride_id = r.id
      JOIN cabs c ON r.cab_id = c.id
      WHERE b.id = $1
    `;
    const result = await db.query(query, [id]);
    if (result.rows.length === 0) {
      return null;
    }
    const row = result.rows[0];
    return {
      id: row.id,
      user_id: row.user_id,
      ride_id: row.ride_id,
      luggage_count: row.luggage_count,
      fare: row.fare,
      detour_distance: row.detour_distance,
      status: row.status,
      created_at: row.created_at,
      ride: {
        id: row.ride_id,
        cab_id: row.cab_id,
        driver_name: row.driver_name,
        vehicle_number: row.vehicle_number
      }
    };
  }

  static async findByRideId(rideId) {
    const query = `
      SELECT id, user_id, ride_id, luggage_count, fare, detour_distance, status,
             ST_X(pickup_location::geometry) as pickup_lon,
             ST_Y(pickup_location::geometry) as pickup_lat,
             ST_X(dropoff_location::geometry) as dropoff_lon,
             ST_Y(dropoff_location::geometry) as dropoff_lat,
             created_at
      FROM bookings 
      WHERE ride_id = $1 AND status = 'confirmed'
      ORDER BY created_at
    `;
    const result = await db.query(query, [rideId]);
    return result.rows;
  }

  /**
   * Cancel a booking
   */
  static async cancel(id) {
    const query = `
      UPDATE bookings
      SET status = 'cancelled',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const result = await db.query(query, [id]);
    return result.rows[0];
  }
}

module.exports = Booking;
