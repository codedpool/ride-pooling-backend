const MatchingService = require('../services/matchingService');
const PricingService = require('../services/pricingService');
const ConcurrencyService = require('../services/concurrencyService');
const Booking = require('../models/Booking');
const Ride = require('../models/Ride');
const User = require('../models/User');
const { calculateDistance } = require('../utils/geoUtils');
const logger = require('../utils/logger');

class RideController {
  /**
   * POST /api/rides/book
   * Book a ride with matching algorithm
   */
  static async bookRide(req, res, next) {
    const startTime = Date.now();

    try {
      const { userId, pickupLat, pickupLon, dropoffLat, dropoffLon, luggageCount } = req.body;

      logger.info('Booking request received', { userId, pickupLat, pickupLon });

      // DEBUG
      console.log('🔍 Step 1: Verifying user...');
      
      // Verify user exists
      const user = await User.findById(userId);
      
      console.log('🔍 User found:', user ? 'YES' : 'NO');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      console.log('🔍 Step 2: Incrementing demand...');
      
      // Increment demand for pricing
      await PricingService.incrementDemand(pickupLat, pickupLon);

      console.log('🔍 Step 3: Finding best match...');

      // Find best matching ride
      const match = await MatchingService.findBestMatch({
        pickupLat,
        pickupLon,
        dropoffLat,
        dropoffLon,
        luggageCount
      });

      if (!match) {
        return res.status(404).json({
          success: false,
          error: 'No available cabs found in your area'
        });
      }

      // Calculate fare
      const distance = calculateDistance(pickupLat, pickupLon, dropoffLat, dropoffLon);
      const pricing = await PricingService.calculateFare(distance, pickupLat, pickupLon);

      // Book with concurrency control
      const result = await ConcurrencyService.bookRideWithLock(
        userId,
        match.ride.id,
        pickupLat,
        pickupLon,
        dropoffLat,
        dropoffLon,
        luggageCount,
        pricing.fare,
        match.detourDistance
      );

      const responseTime = Date.now() - startTime;
      logger.info(`Booking completed in ${responseTime}ms`, {
        bookingId: result.booking.id,
        responseTime
      });

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
          pricing: {
            ...pricing,
            distance: parseFloat(distance.toFixed(2))
          },
          detour: {
            distance: parseFloat(match.detourDistance.toFixed(2)),
            percent: parseFloat(match.detourPercent.toFixed(2))
          }
        },
        meta: {
          responseTime: `${responseTime}ms`
        }
      });

    } catch (error) {
      logger.error('Booking error', error);
      next(error);
    }
  }

  /**
   * GET /api/rides/status/:id
   * Get booking status
   */
  static async getBookingStatus(req, res, next) {
    try {
      const { id } = req.params;

      const booking = await Booking.findById(id);
      if (!booking) {
        return res.status(404).json({
          success: false,
          error: 'Booking not found'
        });
      }

      const ride = await Ride.findById(booking.ride_id);

      res.json({
        success: true,
        data: {
          booking,
          ride
        }
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/rides/cancel/:id
   * Cancel a booking
   */
  static async cancelBooking(req, res, next) {
    try {
      const { id } = req.params;

      const cancelled = await ConcurrencyService.cancelBooking(id);

      res.json({
        success: true,
        data: cancelled,
        message: 'Booking cancelled successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/rides
   * Get all active rides
   */
  static async getAllRides(req, res, next) {
    try {
      const rides = await Ride.findActiveRides();

      res.json({
        success: true,
        count: rides.length,
        data: rides
      });

    } catch (error) {
      next(error);
    }
  }
}

module.exports = RideController;
