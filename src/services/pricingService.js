const redis = require('../config/redis');

const BASE_FARE = parseFloat(process.env.BASE_FARE) || 50;
const PER_KM_RATE = parseFloat(process.env.PER_KM_RATE) || 10;
const MAX_SURGE = parseFloat(process.env.SURGE_MULTIPLIER_MAX) || 2.0;

class PricingService {
  static async calculateFare(distance, pickupLat, pickupLon) {
    const baseFare = BASE_FARE + (distance * PER_KM_RATE);

    let activeRequests = 0;

    if (redis.isReady()) {
      try {
        const geohash = this.generateGeohash(pickupLat, pickupLon, 2);
        const demandKey = `demand:${geohash}`;

        const demand = await Promise.race([
          redis.getClient().get(demandKey),
          new Promise((_, reject) => setTimeout(() => reject(new Error('redis-timeout')), 500))
        ]);

        activeRequests = demand ? parseInt(demand) : 0;
      } catch (err) {
        console.log('⚠️ Redis read issue, ignoring for pricing:', err.message);
      }
    }

    const surgeMultiplier = Math.min(1 + (activeRequests * 0.1), MAX_SURGE);
    const finalFare = baseFare * surgeMultiplier;

    return {
      fare: parseFloat(finalFare.toFixed(2)),
      surgeMultiplier: parseFloat(surgeMultiplier.toFixed(2)),
      baseFare: parseFloat(baseFare.toFixed(2))
    };
  }

  static async incrementDemand(lat, lon) {
    if (!redis.isReady()) {
      console.log('⚠️ Redis not ready, skipping demand increment');
      return;
    }

    try {
      const geohash = this.generateGeohash(lat, lon, 2);
      const demandKey = `demand:${geohash}`;

      await Promise.race([
        (async () => {
          await redis.getClient().incr(demandKey);
          await redis.getClient().expire(demandKey, 300);
        })(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('redis-timeout')), 500))
      ]);
    } catch (err) {
      console.log('⚠️ Redis write issue, skipping:', err.message);
    }
  }

  static generateGeohash(lat, lon, precision = 2) {
    const chars = '0123456789bcdefghjkmnpqrstuvwxyz';
    let hash = '';
    let latMin = -90, latMax = 90;
    let lonMin = -180, lonMax = 180;
    let bit = 0;
    let ch = 0;

    while (hash.length < precision) {
      const midLon = (lonMin + lonMax) / 2;
      if (lon > midLon) {
        ch |= (1 << (4 - bit));
        lonMin = midLon;
      } else {
        lonMax = midLon;
      }
      bit++;

      const midLat = (latMin + latMax) / 2;
      if (lat > midLat) {
        ch |= (1 << (4 - bit));
        latMin = midLat;
      } else {
        latMax = midLat;
      }
      bit++;

      if (bit === 5) {
        hash += chars[ch];
        bit = 0;
        ch = 0;
      }
    }

    return hash;
  }
}

module.exports = PricingService;
