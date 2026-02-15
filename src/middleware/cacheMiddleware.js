const activeRidesCache = {
  data: null,
  timestamp: 0,
  TTL: 2000 // 2 seconds
};

function getCachedRides() {
  const now = Date.now();
  if (activeRidesCache.data && (now - activeRidesCache.timestamp) < activeRidesCache.TTL) {
    console.log('🎯 Using cached rides');
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
}

module.exports = { getCachedRides, setCachedRides, clearRidesCache };
