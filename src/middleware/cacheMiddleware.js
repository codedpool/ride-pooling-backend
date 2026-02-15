// Multi-layer cache
const activeRidesCache = {
  data: null,
  timestamp: 0,
  TTL: 5000 // 5 seconds - more aggressive
};

const matchResultsCache = new Map(); // Cache match results by location

function getCachedRides() {
  const now = Date.now();
  if (activeRidesCache.data && (now - activeRidesCache.timestamp) < activeRidesCache.TTL) {
    return activeRidesCache.data;
  }
  return null;
}

function setCachedRides(rides) {
  activeRidesCache.data = rides;
  activeRidesCache.timestamp = Date.now();
}

function clearRidesCache() {
  activeRidesCache.data = null;
  activeRidesCache.timestamp = 0;
  matchResultsCache.clear();
}

// Cache match results by pickup location (rounded to 2 decimals)
function getCachedMatch(pickupLat, pickupLon) {
  const key = `${pickupLat.toFixed(2)},${pickupLon.toFixed(2)}`;
  const cached = matchResultsCache.get(key);
  
  if (cached && (Date.now() - cached.timestamp) < 3000) { // 3s TTL
    return cached.data;
  }
  return null;
}

function setCachedMatch(pickupLat, pickupLon, matchData) {
  const key = `${pickupLat.toFixed(2)},${pickupLon.toFixed(2)}`;
  matchResultsCache.set(key, {
    data: matchData,
    timestamp: Date.now()
  });
  
  // Limit cache size
  if (matchResultsCache.size > 1000) {
    const firstKey = matchResultsCache.keys().next().value;
    matchResultsCache.delete(firstKey);
  }
}

module.exports = { 
  getCachedRides, 
  setCachedRides, 
  clearRidesCache,
  getCachedMatch,
  setCachedMatch
};
