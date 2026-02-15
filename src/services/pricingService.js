const BASE_FARE = parseFloat(process.env.BASE_FARE) || 50;
const PER_KM_RATE = parseFloat(process.env.PER_KM_RATE) || 10;
const MAX_SURGE = parseFloat(process.env.SURGE_MULTIPLIER_MAX) || 2.0;

class PricingService {
  static async calculateFare(distance, pickupLat, pickupLon) {
    const baseFare = BASE_FARE + (distance * PER_KM_RATE);
    
    // TODO: Redis-based surge pricing (currently disabled)
    const surgeMultiplier = 1.0;
    const finalFare = baseFare * surgeMultiplier;

    return {
      fare: parseFloat(finalFare.toFixed(2)),
      surgeMultiplier: parseFloat(surgeMultiplier.toFixed(2)),
      baseFare: parseFloat(baseFare.toFixed(2))
    };
  }

  static async incrementDemand(lat, lon) {
    // Redis disabled - no-op
    return;
  }
}

module.exports = PricingService;
