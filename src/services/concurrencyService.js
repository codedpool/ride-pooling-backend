const db = require('../config/database');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const logger = require('../utils/logger');

class ConcurrencyService {
  /**
   * Book a ride with proper locking to prevent race conditions
   * Uses PostgreSQL row-level locking (SELECT ... FOR UPDATE)
   */
  static async bookRideWithLock(userId, rideId, pickupLat, pickupLon, dropoffLat, dropoffLon, luggageCount, fare, detourDistance) {
    const client = await db.getClient();

    try {
      // Start transaction
      await client.query('BEGIN');

      // Lock and update ride (this prevents concurrent bookings)
      const updatedRide = await Ride.lockAndUpdate(rideId, 1, luggageCount, client);

      // Create booking
      const bookingQuery = `
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

      const bookingResult = await client.query(bookingQuery, [
        userId, rideId, pickupLat, pickupLon, dropoffLat, dropoffLon,
        luggageCount, fare, detourDistance
      ]);

      // Commit transaction
      await client.query('COMMIT');

      logger.info('Booking successful with lock', {
        bookingId: bookingResult.rows[0].id,
        rideId,
        userId
      });

      return {
        booking: bookingResult.rows[0],
        ride: updatedRide
      };

    } catch (error) {
      // Rollback on error
      await client.query('ROLLBACK');
      logger.error('Booking failed, transaction rolled back', error);
      throw error;
    } finally {
      // Release client back to pool
      client.release();
    }
  }

  /**
   * Cancel a booking and restore ride capacity
   */
  static async cancelBooking(bookingId) {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Get booking details
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.status === 'cancelled') {
        throw new Error('Booking already cancelled');
      }

      // Lock ride and restore capacity
      const restoreQuery = `
        UPDATE rides
        SET available_seats = available_seats + 1,
            available_luggage = available_luggage + $2,
            version = version + 1
        WHERE id = $1
        RETURNING *
      `;
      await client.query(restoreQuery, [booking.ride_id, booking.luggage_count]);

      // Cancel booking
      const cancelQuery = `
        UPDATE bookings
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      const result = await client.query(cancelQuery, [bookingId]);

      await client.query('COMMIT');

      logger.info('Booking cancelled', { bookingId, rideId: booking.ride_id });

      return result.rows[0];

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Cancellation failed', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = ConcurrencyService;
