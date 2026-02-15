const Ride = require('../models/Ride');
const { calculateDistance, calculateDetour } = require('../utils/geoUtils');
const { getCachedMatch, setCachedMatch } = require('../middleware/cacheMiddleware');
const logger = require('../utils/logger');

const MAX_DETOUR_PERCENT = parseFloat(process.env.MAX_DETOUR_PERCENT) || 30;
const MAX_SEARCH_RADIUS = parseFloat(process.env.MAX_SEARCH_RADIUS) || 10;

class MatchingService {
  static async findBestMatch({ pickupLat, pickupLon, dropoffLat, dropoffLon, luggageCount }) {
    const startTime = Date.now();

    // Check cache first
    const cachedMatch = getCachedMatch(pickupLat, pickupLon);
    if (cachedMatch) {
      logger.info('Using cached match result');
      return cachedMatch;
    }

    logger.debug('Starting ride matching', { pickupLat, pickupLon, luggageCount });

    const activeRides = await Ride.findActiveRides();
    logger.debug('Found active rides', { count: activeRides.length });

    if (activeRides.length === 0) return null;

    let bestMatch = null;
    let bestScore = Infinity;

    // Optimized single-pass algorithm
    for (const ride of activeRides) {
      // Quick reject: Check capacity first (fastest)
      if (ride.available_seats < 1 || ride.available_luggage < luggageCount) {
        continue;
      }

      // Quick reject: Validate coordinates
      if (!ride.pickup_lat || !ride.pickup_lon || !ride.dropoff_lat || !ride.dropoff_lon) {
        continue;
      }

      // Quick reject: Check pickup proximity (fast calculation)
      const pickupDistance = calculateDistance(
        pickupLat, pickupLon,
        ride.pickup_lat, ride.pickup_lon
      );
      
      if (!isFinite(pickupDistance) || pickupDistance > MAX_SEARCH_RADIUS) {
        continue;
      }

      // Calculate detour (expensive - only for candidates that passed quick filters)
      const detour = calculateDetour(
        ride.pickup_lat, ride.pickup_lon,
        ride.dropoff_lat, ride.dropoff_lon,
        pickupLat, pickupLon,
        dropoffLat, dropoffLon
      );

      // Validate detour
      if (!isFinite(detour.detourPercent) || detour.detourPercent > MAX_DETOUR_PERCENT) {
        continue;
      }

      // Calculate composite score (lower is better)
      const normalizedDetour = Math.min(detour.detourPercent / 100, 1);
      const normalizedPickup = Math.min(pickupDistance / MAX_SEARCH_RADIUS, 1);
      const seatUtilization = (4 - ride.available_seats) / 4;

      const score = (
        normalizedDetour * 0.5 +
        normalizedPickup * 0.3 +
        (1 - seatUtilization) * 0.2
      );

      // Keep track of best match (avoid array allocation)
      if (score < bestScore) {
        bestScore = score;
        bestMatch = {
          ride,
          score,
          detourDistance: detour.detourDistance,
          detourPercent: detour.detourPercent,
          pickupDistance
        };
      }
    }

    if (!bestMatch) {
      logger.info('No suitable matches found');
      return null;
    }

    const elapsedTime = Date.now() - startTime;
    logger.info('Found best match', {
      rideId: bestMatch.ride.id,
      score: bestMatch.score.toFixed(4),
      detourPercent: bestMatch.detourPercent.toFixed(2),
      matchingTime: `${elapsedTime}ms`
    });

    // Cache the result
    setCachedMatch(pickupLat, pickupLon, bestMatch);

    return bestMatch;
  }
}

module.exports = MatchingService;
