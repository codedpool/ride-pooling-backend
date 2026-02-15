const MatchingService = require('../services/matchingService');
const PricingService = require('../services/pricingService');
const ConcurrencyService = require('../services/concurrencyService');
const Booking = require('../models/Booking');
const Ride = require('../models/Ride');
const User = require('../models/User');
const { calculateDistance } = require('../utils/geoUtils');
const logger = require('../utils/logger');

class RideController {
  static async bookRide(req, res, next) {
    const startTime = Date.now();

    try {
      const { userId, pickupLat, pickupLon, dropoffLat, dropoffLon, luggageCount } = req.body;

      // ADD THIS VALIDATION:
      if (pickupLat === dropoffLat && pickupLon === dropoffLon) {
        return res.status(400).json({
          success: false,
          error: 'Pickup and dropoff locations cannot be the same'
        });
      }

      // Parallel operations: user validation + distance calculation + matching
      const [user, distance, match] = await Promise.all([
        User.findById(userId),
        Promise.resolve(calculateDistance(pickupLat, pickupLon, dropoffLat, dropoffLon)),
        MatchingService.findBestMatch({ pickupLat, pickupLon, dropoffLat, dropoffLon, luggageCount })
      ]);

      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      if (!match) {
        return res.status(404).json({ success: false, error: 'No available cabs found' });
      }

      // Calculate pricing (fast, no I/O)
      const pricing = await PricingService.calculateFare(distance, pickupLat, pickupLon);

      // Book with lock
      const result = await ConcurrencyService.bookRideWithLock(
        userId, match.ride.id, pickupLat, pickupLon, dropoffLat, dropoffLon,
        luggageCount, pricing.fare, match.detourDistance
      );

      const responseTime = Date.now() - startTime;

      res.status(201).json({
        success: true,
        data: {
          booking: result.booking,
          ride: {
            id: result.ride.id,
            cabId: result.ride.cab_id,
            availableSeats: result.ride.available_seats,
            availableLuggage: result.ride.available_luggage
          },
          pricing: { ...pricing, distance: parseFloat(distance.toFixed(2)) },
          detour: {
            distance: parseFloat(match.detourDistance.toFixed(2)),
            percent: parseFloat(match.detourPercent.toFixed(2))
          }
        },
        meta: { responseTime: `${responseTime}ms` }
      });
    } catch (error) {
      logger.error('Booking error', error);
      next(error);
    }
  }

  static async getBookingStatus(req, res, next) {
    try {
      const { id } = req.params;
      const booking = await Booking.findById(id);
      if (!booking) {
        return res.status(404).json({ success: false, error: 'Booking not found' });
      }
      const ride = await Ride.findById(booking.ride_id);
      res.json({ success: true, data: { booking, ride } });
    } catch (error) {
      next(error);
    }
  }

  static async cancelBooking(req, res, next) {
    try {
      const { id } = req.params;
      const cancelled = await ConcurrencyService.cancelBooking(id);
      res.json({ success: true, data: cancelled, message: 'Booking cancelled successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async getAllRides(req, res, next) {
    try {
      const rides = await Ride.findActiveRides();
      res.json({ success: true, count: rides.length, data: rides });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = RideController;
