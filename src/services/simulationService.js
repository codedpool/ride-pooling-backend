const db = require('../config/database');
const { calculateDistance, calculateDetour } = require('../utils/geoUtils');
const { clearRidesCache } = require('../middleware/cacheMiddleware');
const MatchingService = require('./matchingService');
const ConcurrencyService = require('./concurrencyService');
const PricingService = require('./pricingService');

// Delhi (IGI Airport T3 area) reference points
const AIRPORT = { lat: 28.5562, lon: 77.1000 };
const CITY = { lat: 28.6562, lon: 77.2000 };

const DEMO_USER_ID = '452ef1bf-8064-4882-8071-c85cc4d3cb63';

const MAX_DETOUR_PERCENT = parseFloat(process.env.MAX_DETOUR_PERCENT) || 30;
const MAX_SEARCH_RADIUS = parseFloat(process.env.MAX_SEARCH_RADIUS) || 10;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

/** Guarantee a stable demo rider exists so the UI can book without auth. */
async function ensureDemoUser() {
  await db.query(
    `INSERT INTO users (id, name, email, phone)
     VALUES ($1, 'Demo Rider', 'demo-rider@dispatch.local', '+910000000000')
     ON CONFLICT (id) DO NOTHING`,
    [DEMO_USER_ID]
  );
  return DEMO_USER_ID;
}

/** Preset locations the UI offers in its dropdowns. */
const PRESET_LOCATIONS = [
  { name: 'IGI Terminal 3', lat: 28.5562, lon: 77.1000 },
  { name: 'IGI Terminal 1', lat: 28.5085, lon: 77.0855 },
  { name: 'Aerocity Hotels', lat: 28.5490, lon: 77.1180 },
  { name: 'Connaught Place', lat: 28.6315, lon: 77.2167 },
  { name: 'Saket', lat: 28.5245, lon: 77.2066 },
  { name: 'Gurgaon Cyber Hub', lat: 28.4949, lon: 77.0880 },
  { name: 'Noida Sec 18', lat: 28.5708, lon: 77.3260 },
  { name: 'Dwarka Sec 21', lat: 28.5523, lon: 77.0586 }
];

async function getContext() {
  const userId = await ensureDemoUser();
  return {
    userId,
    locations: PRESET_LOCATIONS,
    config: {
      maxDetourPercent: MAX_DETOUR_PERCENT,
      maxSearchRadiusKm: MAX_SEARCH_RADIUS,
      baseFare: parseFloat(process.env.BASE_FARE) || 50,
      perKmRate: parseFloat(process.env.PER_KM_RATE) || 10
    },
    // Centred on IGI Airport so the fleet sits under the scope origin.
    bbox: { latMin: 28.41, latMax: 28.70, lonMin: 76.95, lonMax: 77.25 }
  };
}

/** Live snapshot used by the status pill + map refresh. */
async function getStatus() {
  const t0 = process.hrtime.bigint();
  await db.query('SELECT 1');
  const dbLatencyMs = Number(process.hrtime.bigint() - t0) / 1e6;

  const [rides, cabs, bookings] = await Promise.all([
    db.query(`SELECT COUNT(*)::int AS n FROM rides WHERE status = 'active' AND available_seats > 0`),
    db.query('SELECT COUNT(*)::int AS n FROM cabs'),
    db.query(`SELECT COUNT(*)::int AS n FROM bookings WHERE status = 'confirmed'`)
  ]);

  return {
    ok: true,
    dbLatencyMs: parseFloat(dbLatencyMs.toFixed(2)),
    activeRides: rides.rows[0].n,
    cabs: cabs.rows[0].n,
    confirmedBookings: bookings.rows[0].n
  };
}

/** Create `count` cabs, each broadcasting one active ride toward the city. */
async function seedFleet(count = 14) {
  count = Math.max(1, Math.min(parseInt(count) || 14, 60));
  const client = await db.getClient();
  const tag = Date.now().toString(36);
  try {
    await client.query('BEGIN');
    let created = 0;
    for (let i = 0; i < count; i++) {
      const cabLat = AIRPORT.lat + rand(-0.045, 0.045);
      const cabLon = AIRPORT.lon + rand(-0.045, 0.045);
      const vnum = `SIM-${tag}-${i}`;

      const cab = await client.query(
        `INSERT INTO cabs (driver_name, vehicle_number, total_seats, total_luggage_capacity, current_location, status)
         VALUES ($1, $2, 4, 4, ST_SetSRID(ST_MakePoint($3, $4), 4326), 'available')
         RETURNING id`,
        [`Driver ${tag}-${i}`, vnum, cabLon, cabLat]
      );
      const cabId = cab.rows[0].id;

      const pickupLat = cabLat + rand(-0.008, 0.008);
      const pickupLon = cabLon + rand(-0.008, 0.008);
      const dropoffLat = CITY.lat + rand(-0.05, 0.05);
      const dropoffLon = CITY.lon + rand(-0.05, 0.05);
      const seats = 2 + Math.floor(Math.random() * 3);   // 2..4
      const luggage = 2 + Math.floor(Math.random() * 3); // 2..4

      await client.query(
        `INSERT INTO rides
           (cab_id, status, available_seats, available_luggage,
            pickup_lat, pickup_lon, dropoff_lat, dropoff_lon, total_distance, current_fare)
         VALUES ($1, 'active', $2, $3, $4, $5, $6, $7, 15.0, 200.0)`,
        [cabId, seats, luggage, pickupLat, pickupLon, dropoffLat, dropoffLon]
      );
      created++;
    }
    await client.query('COMMIT');
    clearRidesCache();
    return { created };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Clear the board: all bookings + rides, and any simulated cabs. */
async function reset() {
  await db.query('DELETE FROM bookings');
  await db.query('DELETE FROM rides');
  const del = await db.query(`DELETE FROM cabs WHERE vehicle_number LIKE 'SIM-%' OR vehicle_number LIKE 'TEST-%'`);
  clearRidesCache();
  return { clearedCabs: del.rowCount };
}

/**
 * Interactive concurrency demo: spin up one fresh 4-seat cab, then fire
 * `concurrency` bookings at it simultaneously and report who won the lock.
 */
async function stressTest(concurrency = 10) {
  concurrency = Math.max(2, Math.min(parseInt(concurrency) || 10, 40));
  const userId = await ensureDemoUser();
  const tag = Date.now().toString(36);

  const cab = await db.query(
    `INSERT INTO cabs (driver_name, vehicle_number, total_seats, total_luggage_capacity, current_location, status)
     VALUES ('Race Test Driver', $1, 4, 4, ST_SetSRID(ST_MakePoint($2, $3), 4326), 'available')
     RETURNING id`,
    [`TEST-RACE-${tag}`, AIRPORT.lon, AIRPORT.lat]
  );
  const cabId = cab.rows[0].id;

  const ride = await db.query(
    `INSERT INTO rides
       (cab_id, status, available_seats, available_luggage,
        pickup_lat, pickup_lon, dropoff_lat, dropoff_lon, total_distance, current_fare)
     VALUES ($1, 'active', 4, 4, $2, $3, $4, $5, 15.0, 200.0)
     RETURNING id`,
    [cabId, AIRPORT.lat, AIRPORT.lon, CITY.lat, CITY.lon]
  );
  const rideId = ride.rows[0].id;

  try {
    const attempts = Array.from({ length: concurrency }, () =>
      ConcurrencyService.bookRideWithLock(
        userId, rideId, AIRPORT.lat, AIRPORT.lon, CITY.lat, CITY.lon, 1, 200, 1
      )
    );
    const results = await Promise.allSettled(attempts);
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const rejected = concurrency - succeeded;

    const finalRide = await db.query('SELECT available_seats, version FROM rides WHERE id = $1', [rideId]);
    const finalSeats = finalRide.rows[0].available_seats;
    const version = finalRide.rows[0].version;

    const doubleBookings = Math.max(0, succeeded - 4);
    const passed = doubleBookings === 0 && finalSeats === 4 - succeeded && finalSeats >= 0;

    return {
      attempts: concurrency,
      seats: 4,
      succeeded,
      rejected,
      finalSeats,
      version,
      doubleBookings,
      passed
    };
  } finally {
    // Cascade removes the test ride + its bookings.
    await db.query('DELETE FROM cabs WHERE id = $1', [cabId]);
    clearRidesCache();
  }
}

// ---------------------------------------------------------------------------
// Full automated test suite (server-side, exercises the real code paths)
// ---------------------------------------------------------------------------

async function ensureRidesExist(min = 6) {
  const r = await db.query(`SELECT COUNT(*)::int AS n FROM rides WHERE status = 'active' AND available_seats > 0`);
  if (r.rows[0].n < min) {
    await seedFleet(Math.max(min, 12));
    return true;
  }
  return false;
}

async function testDatabase() {
  const logs = [];
  const t0 = process.hrtime.bigint();
  await db.query('SELECT 1');
  const latencyMs = parseFloat((Number(process.hrtime.bigint() - t0) / 1e6).toFixed(2));
  const ext = await db.query(`SELECT extname FROM pg_extension WHERE extname IN ('postgis','uuid-ossp')`);
  const extensions = ext.rows.map(x => x.extname);
  logs.push(`Ping round-trip: ${latencyMs}ms`);
  logs.push(`Extensions present: ${extensions.join(', ') || 'none detected'}`);
  const status = latencyMs < 2000 ? 'pass' : 'fail';
  return {
    id: 'database', name: 'Database connectivity & PostGIS', status,
    metrics: { latencyMs, extensions: extensions.join(', ') }, logs
  };
}

async function testGeospatial() {
  const logs = [];
  // T3 -> Connaught Place, straight-line ~12.4km
  const distance = calculateDistance(AIRPORT.lat, AIRPORT.lon, 28.6315, 77.2167);
  const detour = calculateDetour(
    AIRPORT.lat, AIRPORT.lon, CITY.lat, CITY.lon, // ride
    28.5600, 77.1050, 28.6500, 77.1950           // new rider
  );
  logs.push(`Haversine T3 -> Connaught Place: ${distance.toFixed(2)}km (expected ~12.4km)`);
  logs.push(`Detour for sample shared route: ${detour.detourPercent.toFixed(2)}%`);
  const distanceOk = distance > 9 && distance < 16;
  const detourOk = isFinite(detour.detourPercent) && detour.detourPercent >= 0;
  return {
    id: 'geospatial', name: 'Geospatial distance & detour math',
    status: distanceOk && detourOk ? 'pass' : 'fail',
    metrics: { distanceKm: parseFloat(distance.toFixed(2)), detourPercent: detour.detourPercent },
    logs
  };
}

async function testPricing() {
  const logs = [];
  const BASE = parseFloat(process.env.BASE_FARE) || 50;
  const RATE = parseFloat(process.env.PER_KM_RATE) || 10;
  const distance = 15;
  const p = await PricingService.calculateFare(distance, AIRPORT.lat, AIRPORT.lon);
  const expectedBase = BASE + distance * RATE;
  logs.push(`Fare(15km) = ₹${BASE} base + 15 x ₹${RATE} = ₹${expectedBase} x ${p.surgeMultiplier} surge = ₹${p.fare}`);
  const ok = Math.abs(p.baseFare - expectedBase) < 0.01 && p.fare > 0;
  return {
    id: 'pricing', name: 'Fare & surge calculation',
    status: ok ? 'pass' : 'fail',
    metrics: { distanceKm: distance, baseFare: p.baseFare, surge: p.surgeMultiplier, fare: p.fare },
    logs
  };
}

async function testMatching() {
  const logs = [];
  await ensureRidesExist(6);
  clearRidesCache();
  const match = await MatchingService.findBestMatch({
    pickupLat: AIRPORT.lat, pickupLon: AIRPORT.lon,
    dropoffLat: CITY.lat, dropoffLon: CITY.lon, luggageCount: 1
  });

  if (!match) {
    logs.push('No match returned for central airport pickup.');
    return { id: 'matching', name: 'Ride matching & scoring', status: 'fail', metrics: {}, logs };
  }

  logs.push(`Best cab score: ${match.score.toFixed(4)} (lower is better)`);
  logs.push(`Pickup distance: ${match.pickupDistance.toFixed(2)}km, detour: ${match.detourPercent.toFixed(2)}%`);
  const ok =
    match.score >= 0 && match.score <= 1 &&
    match.pickupDistance <= MAX_SEARCH_RADIUS &&
    match.detourPercent <= MAX_DETOUR_PERCENT;
  return {
    id: 'matching', name: 'Ride matching & scoring',
    status: ok ? 'pass' : 'fail',
    metrics: {
      score: parseFloat(match.score.toFixed(4)),
      pickupDistanceKm: parseFloat(match.pickupDistance.toFixed(2)),
      detourPercent: match.detourPercent
    },
    logs
  };
}

async function testConcurrency() {
  const logs = [];
  const attempts = 10;
  logs.push(`Firing ${attempts} simultaneous bookings at one 4-seat cab...`);
  const result = await stressTest(attempts);
  logs.push(`Succeeded: ${result.succeeded} / Rejected: ${result.rejected}`);
  logs.push(`Final seats: ${result.finalSeats} (lock version: ${result.version})`);
  logs.push(result.doubleBookings === 0 ? 'Zero double-bookings — lock held.' : `DANGER: ${result.doubleBookings} double-bookings!`);
  return {
    id: 'concurrency', name: 'Concurrency — race condition guard',
    status: result.passed ? 'pass' : 'fail',
    metrics: {
      attempts: result.attempts, succeeded: result.succeeded,
      rejected: result.rejected, doubleBookings: result.doubleBookings
    },
    logs
  };
}

async function testThroughput() {
  const logs = [];
  await ensureRidesExist(6);

  // Cold read: one uncached active-rides fetch through PostgreSQL.
  clearRidesCache();
  const c0 = process.hrtime.bigint();
  await MatchingService.findBestMatch({
    pickupLat: AIRPORT.lat, pickupLon: AIRPORT.lon,
    dropoffLat: CITY.lat, dropoffLon: CITY.lon, luggageCount: 1
  });
  const coldReadMs = parseFloat((Number(process.hrtime.bigint() - c0) / 1e6).toFixed(2));

  // Warm throughput: time-boxed matching pipeline on cached ride data,
  // varying pickup each call so the match cache misses (real pipeline work).
  const latencies = [];
  let ops = 0;
  const start = process.hrtime.bigint();
  const limitNs = 600n * 1_000_000n; // 600ms window
  while (process.hrtime.bigint() - start < limitNs) {
    const k = ops % 40;
    const s = process.hrtime.bigint();
    await MatchingService.findBestMatch({
      pickupLat: AIRPORT.lat + k * 0.01,
      pickupLon: AIRPORT.lon + (k % 7) * 0.01,
      dropoffLat: CITY.lat, dropoffLon: CITY.lon, luggageCount: 1
    });
    latencies.push(Number(process.hrtime.bigint() - s) / 1e6);
    ops++;
  }
  const elapsedSec = Number(process.hrtime.bigint() - start) / 1e9;
  const opsPerSec = Math.round(ops / elapsedSec);
  latencies.sort((a, b) => a - b);
  const p50 = parseFloat(latencies[Math.floor(latencies.length * 0.5)].toFixed(3));
  const avg = parseFloat((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(3));

  logs.push(`Cold DB-backed match: ${coldReadMs}ms`);
  logs.push(`Warm matching pipeline: ${opsPerSec.toLocaleString()} matches/sec (${ops} in ${elapsedSec.toFixed(2)}s)`);
  logs.push(`Pipeline latency p50: ${p50}ms, avg: ${avg}ms`);

  return {
    id: 'throughput', name: 'Matching throughput benchmark',
    status: opsPerSec > 200 ? 'pass' : 'fail',
    metrics: { opsPerSec, coldReadMs, p50Ms: p50, avgMs: avg, samples: ops },
    logs
  };
}

async function runAllTests() {
  const startedAt = new Date().toISOString();
  const wall = process.hrtime.bigint();

  const order = [testDatabase, testGeospatial, testPricing, testMatching, testConcurrency, testThroughput];
  const tests = [];
  for (const fn of order) {
    const t0 = process.hrtime.bigint();
    try {
      const res = await fn();
      res.durationMs = parseFloat((Number(process.hrtime.bigint() - t0) / 1e6).toFixed(1));
      tests.push(res);
    } catch (err) {
      tests.push({
        id: fn.name, name: fn.name, status: 'fail',
        durationMs: parseFloat((Number(process.hrtime.bigint() - t0) / 1e6).toFixed(1)),
        metrics: {}, logs: [`Error: ${err.message}`]
      });
    }
  }

  const passed = tests.filter(t => t.status === 'pass').length;
  const failed = tests.length - passed;
  const durationMs = parseFloat((Number(process.hrtime.bigint() - wall) / 1e6).toFixed(0));

  const conc = tests.find(t => t.id === 'concurrency');
  const thru = tests.find(t => t.id === 'throughput');

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs,
    summary: { total: tests.length, passed, failed },
    headline: {
      throughputOpsPerSec: thru?.metrics?.opsPerSec ?? null,
      p50Ms: thru?.metrics?.p50Ms ?? null,
      doubleBookings: conc?.metrics?.doubleBookings ?? null,
      concurrencyVerdict: conc?.status === 'pass' ? 'ZERO DOUBLE-BOOKINGS' : 'CHECK FAILED'
    },
    tests
  };
}

module.exports = {
  getContext,
  getStatus,
  seedFleet,
  reset,
  stressTest,
  runAllTests
};
