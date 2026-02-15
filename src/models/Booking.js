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

  static async findById(id) {
    const query = `
      SELECT id, user_id, ride_id, luggage_count, fare, detour_distance, status,
             ST_X(pickup_location::geometry) as pickup_lon,
             ST_Y(pickup_location::geometry) as pickup_lat,
             ST_X(dropoff_location::geometry) as dropoff_lon,
             ST_Y(dropoff_location::geometry) as dropoff_lat,
             created_at, updated_at
      FROM bookings WHERE id = $1
    `;
    const result = await db.query(query, [id]);
    return result.rows[0];
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

  static async cancel(id) {
    const query = `
      UPDATE bookings
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await db.query(query, [id]);
    return result.rows[0];
  }
}

module.exports = Booking;
