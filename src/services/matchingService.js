const Cab = require('../models/Cab');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const { calculateDistance, calculateDetourPercent } = require('../utils/geoUtils');
const logger = require('../utils/logger');

const MAX_DETOUR_PERCENT = parseFloat(process.env.MAX_DETOUR_PERCENT) || 20;
const SEARCH_RADIUS_KM = 5;

class MatchingService {
  /**
   * Find best matching ride for a booking request
   * Algorithm: Greedy approach with geospatial filtering
   * Time Complexity: O(N * M) where N = nearby cabs, M = bookings per ride (typically small)
   * 
   * @param {Object} request - Booking request
   * @returns {Promise<Object|null>} Best matching ride or null
   */
  static async findBestMatch(request) {
    const { pickupLat, pickupLon, dropoffLat, dropoffLon, luggageCount } = request;

    logger.debug('Starting ride matching', { pickupLat, pickupLon, luggageCount });

    console.log('🔍 Fetching active rides...');

    // Step 1: Get all active rides with available capacity
    const activeRides = await Ride.findActiveRides();
    logger.debug(`Found ${activeRides.length} active rides`);

    // Step 2: Filter rides based on capacity and location
    const compatibleRides = [];

    for (const ride of activeRides) {
      // Check seat and luggage capacity
      if (ride.available_seats < 1 || ride.available_luggage < luggageCount) {
        continue;
      }

      // Calculate distance from cab's current location to pickup
      const pickupDistance = calculateDistance(
        ride.cab_lat,
        ride.cab_lon,
        pickupLat,
        pickupLon
      );

      // Skip if cab is too far (> SEARCH_RADIUS_KM)
      if (pickupDistance > SEARCH_RADIUS_KM) {
        continue;
      }

      // Calculate detour for this booking
      const detour = await this.calculateDetourForBooking(
        ride,
        pickupLat,
        pickupLon,
        dropoffLat,
        dropoffLon
      );

      // Check if detour is acceptable
      if (detour.detourPercent <= MAX_DETOUR_PERCENT) {
        compatibleRides.push({
          ride,
          pickupDistance,
          detour: detour.detourDistance,
          detourPercent: detour.detourPercent,
          score: this.calculateMatchScore(pickupDistance, detour.detourPercent, ride.available_seats)
        });
      }
    }

    // Step 3: If no compatible rides, find nearby empty cab
    if (compatibleRides.length === 0) {
      logger.debug('No compatible rides found, searching for empty cabs');
      return await this.findEmptyCab(pickupLat, pickupLon, luggageCount);
    }

    // Step 4: Sort by score (lower is better) and return best match
    compatibleRides.sort((a, b) => a.score - b.score);
    
    logger.info('Found best match', {
      rideId: compatibleRides[0].ride.id,
      score: compatibleRides[0].score,
      detourPercent: compatibleRides[0].detourPercent
    });

    return {
      ride: compatibleRides[0].ride,
      detourDistance: compatibleRides[0].detour,
      detourPercent: compatibleRides[0].detourPercent
    };
  }

  /**
   * Calculate detour caused by adding a new booking to existing ride
   */
  static async calculateDetourForBooking(ride, pickupLat, pickupLon, dropoffLat, dropoffLon) {
    // Get existing bookings for this ride
    const existingBookings = await Booking.findByRideId(ride.id);

    // Direct distance for new passenger
    const directDistance = calculateDistance(pickupLat, pickupLon, dropoffLat, dropoffLon);

    // If ride is empty, detour = 0
    if (existingBookings.length === 0) {
      return {
        detourDistance: 0,
        detourPercent: 0,
        directDistance
      };
    }

    // Simplified detour calculation:
    // Distance from cab → pickup + pickup → dropoff
    const cabToPickup = calculateDistance(ride.cab_lat, ride.cab_lon, pickupLat, pickupLon);
    const pickupToDropoff = directDistance;
    const actualDistance = cabToPickup + pickupToDropoff;

    const detourDistance = actualDistance - directDistance;
    const detourPercent = calculateDetourPercent(directDistance, actualDistance);

    return {
      detourDistance,
      detourPercent,
      directDistance
    };
  }

  /**
   * Find an empty cab nearby
   */
 static async findEmptyCab(pickupLat, pickupLon, luggageCount) {
    console.log('🔍 Finding empty cab...');
    const nearbyCabs = await Cab.findNearby(pickupLat, pickupLon, SEARCH_RADIUS_KM);
    console.log('🔍 Found nearby cabs:', nearbyCabs.length);

    for (const cab of nearbyCabs) {
      // Check if cab has capacity
      if (cab.total_luggage_capacity >= luggageCount) {
        // Create new ride for this cab
        const newRide = await Ride.create(cab.id);
        
        logger.info('Created new ride with empty cab', {
          rideId: newRide.id,
          cabId: cab.id
        });

        return {
          ride: {
            ...newRide,
            cab_lat: cab.lat,
            cab_lon: cab.lon,
            driver_name: cab.driver_name,
            vehicle_number: cab.vehicle_number
          },
          detourDistance: 0,
          detourPercent: 0
        };
      }
    }

    return null; // No cabs available
  }

  /**
   * Calculate match score (lower is better)
   * Factors: pickup distance, detour percent, available seats (prefer filling rides)
   */
  static calculateMatchScore(pickupDistance, detourPercent, availableSeats) {
    // Weight factors
    const distanceWeight = 0.5;
    const detourWeight = 0.3;
    const capacityWeight = 0.2;

    // Normalize values
    const normalizedDistance = pickupDistance / SEARCH_RADIUS_KM;
    const normalizedDetour = detourPercent / MAX_DETOUR_PERCENT;
    const normalizedCapacity = availableSeats / 4; // Max 4 seats

    const score = 
      (normalizedDistance * distanceWeight) +
      (normalizedDetour * detourWeight) +
      (normalizedCapacity * capacityWeight); // Higher capacity = higher score (prefer filling)

    return score;
  }
}

module.exports = MatchingService;
