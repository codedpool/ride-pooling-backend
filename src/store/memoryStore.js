/**
 * In-memory data store — used automatically when no DATABASE_URL is set
 * (e.g. the free single-service Render deploy). State is held in process
 * memory and starts fresh on every boot. The booking path uses a per-ride
 * async mutex so the concurrency guarantee (no double-booking) still holds
 * and the race-condition test stays meaningful — mirroring the PostgreSQL
 * SELECT ... FOR UPDATE pessimistic lock.
 */
const crypto = require('crypto');

const users = new Map();
const cabs = new Map();
const rides = new Map();
const bookings = new Map();
const lockChains = new Map();

let seq = 0;
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${seq++}`);
const now = () => new Date().toISOString();
const byNewest = (a, b) => (a.created_at < b.created_at ? 1 : -1);

/** Serialise work per key (one ride row) — the in-memory equivalent of a row lock. */
function withLock(key, fn) {
  const prev = lockChains.get(key) || Promise.resolve();
  const run = prev.then(fn, fn);
  lockChains.set(key, run.then(() => {}, () => {}));
  return run;
}

/* ---------------- users ---------------- */
function ensureUser(id, { name, email, phone }) {
  if (!users.has(id)) users.set(id, { id, name, email, phone, created_at: now() });
  return users.get(id);
}
function createUser(name, phone) {
  const u = { id: uid(), name, phone, created_at: now() };
  users.set(u.id, u);
  return u;
}
const findUserById = (id) => users.get(id) || null;

/* ---------------- cabs ---------------- */
function createCab({ driverName, vehicleNumber, lat, lon, seats = 4, luggage = 4, status = 'available' }) {
  const c = {
    id: uid(), driver_name: driverName, vehicle_number: vehicleNumber,
    total_seats: seats, total_luggage_capacity: luggage,
    lat: Number(lat), lon: Number(lon), status, created_at: now()
  };
  cabs.set(c.id, c);
  return c;
}
const findAllCabs = () => [...cabs.values()].sort(byNewest).map(c => ({
  id: c.id, driver_name: c.driver_name, vehicle_number: c.vehicle_number,
  total_seats: c.total_seats, total_luggage_capacity: c.total_luggage_capacity,
  lat: c.lat, lon: c.lon, created_at: c.created_at
}));
const findCabById = (id) => cabs.get(id) || null;

function deleteCab(id) {
  for (const [rid, r] of rides) {
    if (r.cab_id === id) {
      for (const [bid, b] of bookings) if (b.ride_id === rid) bookings.delete(bid);
      rides.delete(rid);
    }
  }
  return cabs.delete(id);
}
function deleteSimCabs() {
  let n = 0;
  for (const [id, c] of cabs) {
    if (/^SIM-/.test(c.vehicle_number) || /^TEST-/.test(c.vehicle_number)) { deleteCab(id); n++; }
  }
  return n;
}

/* ---------------- rides ---------------- */
function createRide({ cabId, seats, luggage, pickupLat, pickupLon, dropoffLat, dropoffLon, totalDistance = 15, currentFare = 200 }) {
  const r = {
    id: uid(), cab_id: cabId, status: 'active',
    available_seats: seats, available_luggage: luggage,
    pickup_lat: Number(pickupLat), pickup_lon: Number(pickupLon),
    dropoff_lat: Number(dropoffLat), dropoff_lon: Number(dropoffLon),
    total_distance: totalDistance, current_fare: currentFare,
    version: 0, created_at: now()
  };
  rides.set(r.id, r);
  return r;
}
function joinRide(r) {
  const c = cabs.get(r.cab_id);
  return {
    ...r,
    driver_name: c ? c.driver_name : null,
    vehicle_number: c ? c.vehicle_number : null,
    cab_lat: c ? c.lat : null,
    cab_lon: c ? c.lon : null
  };
}
const findActiveRides = () => [...rides.values()]
  .filter(r => r.status === 'active' && r.available_seats > 0 &&
    r.pickup_lat != null && r.pickup_lon != null && r.dropoff_lat != null && r.dropoff_lon != null)
  .sort(byNewest)
  .map(joinRide);
const findRideById = (id) => { const r = rides.get(id); return r ? joinRide(r) : null; };
const rideState = (id) => { const r = rides.get(id); return r ? { available_seats: r.available_seats, version: r.version } : null; };

/* ---------------- bookings (locked) ---------------- */
function bookWithLock(userId, rideId, pickupLat, pickupLon, dropoffLat, dropoffLon, luggageCount, fare, detourDistance) {
  return withLock(rideId, () => {
    const r = rides.get(rideId);
    if (!r) throw new Error('Ride not found');
    if (r.available_seats < 1) throw new Error('Not enough seats available');
    if (r.available_luggage < luggageCount) throw new Error('Not enough luggage capacity');
    r.available_seats -= 1;
    r.available_luggage -= luggageCount;
    r.version += 1;
    r.updated_at = now();
    const booking = {
      id: uid(), user_id: userId, ride_id: rideId,
      pickup_lat: Number(pickupLat), pickup_lon: Number(pickupLon),
      dropoff_lat: Number(dropoffLat), dropoff_lon: Number(dropoffLon),
      luggage_count: luggageCount, fare, detour_distance: detourDistance,
      status: 'confirmed', created_at: now()
    };
    bookings.set(booking.id, booking);
    return { booking, ride: { ...r } };
  });
}
const findBookingById = (id) => bookings.get(id) || null;
function cancelBooking(id) {
  const b = bookings.get(id);
  if (!b) throw new Error('Booking not found');
  if (b.status === 'cancelled') throw new Error('Booking already cancelled');
  const r = rides.get(b.ride_id);
  if (r) { r.available_seats += 1; r.available_luggage += b.luggage_count; r.version += 1; }
  b.status = 'cancelled';
  b.updated_at = now();
  return { ...b };
}

/* ---------------- bulk / counts ---------------- */
function deleteAllRidesAndBookings() { bookings.clear(); rides.clear(); }
function counts() {
  let activeRides = 0;
  for (const r of rides.values()) if (r.status === 'active' && r.available_seats > 0) activeRides++;
  let confirmedBookings = 0;
  for (const b of bookings.values()) if (b.status === 'confirmed') confirmedBookings++;
  return { activeRides, cabs: cabs.size, confirmedBookings };
}

// Pre-seed the demo rider so the booking path works even before the UI calls
// /api/simulate/context. Must match DEMO_USER_ID in simulationService.js.
ensureUser('452ef1bf-8064-4882-8071-c85cc4d3cb63', {
  name: 'Demo Rider', email: 'demo-rider@dispatch.local', phone: '+910000000000'
});

module.exports = {
  ensureUser, createUser, findUserById,
  createCab, findAllCabs, findCabById, deleteCab, deleteSimCabs,
  createRide, findActiveRides, findRideById, rideState,
  bookWithLock, findBookingById, cancelBooking,
  deleteAllRidesAndBookings, counts
};
