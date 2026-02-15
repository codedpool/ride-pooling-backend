function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateDetour(
  rideLat1, rideLon1, rideLat2, rideLon2,
  pickupLat, pickupLon, dropoffLat, dropoffLon
) {
  // Original ride distance
  const originalDistance = calculateDistance(rideLat1, rideLon1, rideLat2, rideLon2);

  // New route: Start -> Pickup -> Dropoff -> End
  const toPickup = calculateDistance(rideLat1, rideLon1, pickupLat, pickupLon);
  const pickupToDropoff = calculateDistance(pickupLat, pickupLon, dropoffLat, dropoffLon);
  const dropoffToEnd = calculateDistance(dropoffLat, dropoffLon, rideLat2, rideLon2);

  const newDistance = toPickup + pickupToDropoff + dropoffToEnd;
  const detourDistance = newDistance - originalDistance;
  const detourPercent = (detourDistance / originalDistance) * 100;

  return {
    originalDistance: parseFloat(originalDistance.toFixed(2)),
    newDistance: parseFloat(newDistance.toFixed(2)),
    detourDistance: parseFloat(detourDistance.toFixed(2)),
    detourPercent: parseFloat(detourPercent.toFixed(2))
  };
}

module.exports = {
  calculateDistance,
  calculateDetour
};
