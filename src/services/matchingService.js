const Ride = require('../models/Ride');
const { calculateDistance, calculateDetour } = require('../utils/geoUtils');
const logger = require('../utils/logger');

const MAX_DETOUR_PERCENT = parseFloat(process.env.MAX_DETOUR_PERCENT) || 20;
const MAX_SEARCH_RADIUS = parseFloat(process.env.MAX_SEARCH_RADIUS) || 5;

class MatchingService {
  static async findBestMatch({ pickupLat, pickupLon, dropoffLat, dropoffLon, luggageCount }) {
    const startTime = Date.now();
    logger.debug('Starting ride matching', { pickupLat, pickupLon, luggageCount });

    const activeRides = await Ride.findActiveRides();
    logger.debug('Found active rides', { count: activeRides.length });

    if (activeRides.length === 0) return null;

    const candidates = [];

    for (const ride of activeRides) {
      // Validate ride has required coordinates
      if (!ride.pickup_lat || !ride.pickup_lon || !ride.dropoff_lat || !ride.dropoff_lon) {
        logger.warn('Skipping ride with missing coordinates', { rideId: ride.id });
        continue;
      }

      // Filter: Check capacity first (fastest)
      if (ride.available_seats < 1 || ride.available_luggage < luggageCount) {
        continue;
      }

      // Filter: Check pickup proximity (fast)
      const pickupDistance = calculateDistance(
        pickupLat, pickupLon,
        ride.pickup_lat, ride.pickup_lon
      );
      
      if (!isFinite(pickupDistance) || pickupDistance > MAX_SEARCH_RADIUS) {
        continue;
      }

      // Calculate detour (slower calculation)
      const detour = calculateDetour(
        ride.pickup_lat, ride.pickup_lon,
        ride.dropoff_lat, ride.dropoff_lon,
        pickupLat, pickupLon,
        dropoffLat, dropoffLon
      );

      // Validate detour calculation
      if (!isFinite(detour.detourPercent) || !isFinite(detour.detourDistance)) {
        logger.warn('Invalid detour calculation', { rideId: ride.id, detour });
        continue;
      }

      // Filter: Check detour constraint
      if (detour.detourPercent > MAX_DETOUR_PERCENT) {
        continue;
      }

      // Calculate composite score
      const normalizedDetour = Math.min(detour.detourPercent / 100, 1);
      const normalizedPickup = Math.min(pickupDistance / MAX_SEARCH_RADIUS, 1);
      const seatUtilization = (4 - ride.available_seats) / 4; // Prefer fuller rides

      const score = (
        normalizedDetour * 0.5 +
        normalizedPickup * 0.3 +
        (1 - seatUtilization) * 0.2
      );

      candidates.push({
        ride,
        score,
        detourDistance: detour.detourDistance,
        detourPercent: detour.detourPercent,
        pickupDistance
      });
    }

    if (candidates.length === 0) {
      logger.info('No suitable matches found');
      return null;
    }

    // Sort and pick best
    candidates.sort((a, b) => a.score - b.score);
    const bestMatch = candidates[0];

    const elapsedTime = Date.now() - startTime;
    logger.info('Found best match', {
      rideId: bestMatch.ride.id,
      score: bestMatch.score.toFixed(4),
      detourPercent: bestMatch.detourPercent.toFixed(2),
      matchingTime: `${elapsedTime}ms`
    });

    return bestMatch;
  }
}

module.exports = MatchingService;
