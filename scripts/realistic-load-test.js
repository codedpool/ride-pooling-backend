const autocannon = require('autocannon');

// Delhi Airport area coordinates
const locations = [
  // Terminal 3 area
  { lat: 28.5562, lon: 77.1000, name: 'Terminal 3' },
  { lat: 28.5565, lon: 77.1005, name: 'Departure Gate' },
  { lat: 28.5560, lon: 77.0995, name: 'Arrival Gate' },
  
  // Nearby hotels
  { lat: 28.5450, lon: 77.0850, name: 'Hotel Zone 1' },
  { lat: 28.5480, lon: 77.0920, name: 'Hotel Zone 2' },
  
  // City destinations
  { lat: 28.6139, lon: 77.2090, name: 'Connaught Place' },
  { lat: 28.5355, lon: 77.3910, name: 'Noida' },
  { lat: 28.4595, lon: 77.0266, name: 'Gurgaon' },
  { lat: 28.7041, lon: 77.1025, name: 'North Delhi' },
  { lat: 28.5244, lon: 77.1855, name: 'South Delhi' }
];

// Generate random but realistic request
function generateRealisticRequest() {
  // Random pickup (usually airport area)
  const pickupIndex = Math.random() < 0.7 
    ? Math.floor(Math.random() * 3)  // 70% from terminals
    : Math.floor(Math.random() * locations.length);  // 30% from anywhere
  
  // Random dropoff (usually city destinations)
  const dropoffIndex = Math.floor(Math.random() * locations.length);
  
  // Ensure pickup != dropoff
  const pickup = locations[pickupIndex];
  let dropoff = locations[dropoffIndex];
  
  while (pickup === dropoff) {
    const newIndex = Math.floor(Math.random() * locations.length);
    dropoff = locations[newIndex];
  }
  
  // Random luggage (1-3, weighted towards 1-2)
  const luggage = Math.random() < 0.7 
    ? (Math.random() < 0.6 ? 1 : 2)  // 70% have 1-2 bags
    : 3;  // 30% have 3 bags
  
  // Add small random offset for variety
  const pickupLat = pickup.lat + (Math.random() - 0.5) * 0.01;
  const pickupLon = pickup.lon + (Math.random() - 0.5) * 0.01;
  const dropoffLat = dropoff.lat + (Math.random() - 0.5) * 0.01;
  const dropoffLon = dropoff.lon + (Math.random() - 0.5) * 0.01;
  
  return {
    userId: '452ef1bf-8064-4882-8071-c85cc4d3cb63',
    pickupLat,
    pickupLon,
    dropoffLat,
    dropoffLon,
    luggageCount: luggage
  };
}

// Main configuration
const instance = autocannon({
  url: 'http://localhost:3000/api/rides/book',
  connections: 50,
  duration: 30,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  setupClient: (client) => {
    // Generate unique request per client
    client.on('response', () => {
      // Generate new request for next call
      client.setBody(JSON.stringify(generateRealisticRequest()));
    });
  },
  // Initial request
  body: JSON.stringify(generateRealisticRequest())
}, (err, result) => {
  if (err) {
    console.error('❌ Error:', err);
    return;
  }

  console.log('\n' + '='.repeat(70));
  console.log('🎯 REALISTIC LOAD TEST RESULTS');
  console.log('='.repeat(70));
  
  console.log('\n📊 THROUGHPUT:');
  console.log(`  Total Requests:       ${result.requests.total}`);
  console.log(`  Duration:             ${result.duration}s`);
  console.log(`  Average:              ${result.requests.average.toFixed(2)} req/s`);
  console.log(`  Peak:                 ${result.requests.max} req/s`);
  
  console.log('\n⏱️  LATENCY:');
  console.log(`  Mean:                 ${result.latency.mean.toFixed(2)}ms`);
  console.log(`  Median (P50):         ${result.latency.p50}ms`);
  console.log(`  P95:                  ${result.latency.p95 || 'N/A'}ms`);
  console.log(`  P99:                  ${result.latency.p99}ms`);
  console.log(`  Max:                  ${result.latency.max}ms`);
  
  console.log('\n✅ SUCCESS RATE:');
  const total2xx = Object.values(result['2xx'] || {}).reduce((a, b) => a + b, 0);
  const total4xx = Object.values(result['4xx'] || {}).reduce((a, b) => a + b, 0);
  const total5xx = Object.values(result['5xx'] || {}).reduce((a, b) => a + b, 0);
  const totalResponses = total2xx + total4xx + total5xx;
  
  console.log(`  2xx (Success):        ${total2xx}`);
  console.log(`  4xx (Client Errors):  ${total4xx}`);
  console.log(`  5xx (Server Errors):  ${total5xx}`);
  console.log(`  Errors:               ${result.errors}`);
  console.log(`  Timeouts:             ${result.timeouts}`);
  
  if (totalResponses > 0) {
    const successRate = ((total2xx / totalResponses) * 100).toFixed(2);
    console.log(`  Success Rate:         ${successRate}%`);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('📈 ANALYSIS:');
  console.log('  Scenario: Realistic mixed pickup/dropoff locations');
  console.log('  Users: 50 concurrent with varied destinations');
  console.log('  Luggage: 1-3 bags (weighted distribution)');
  console.log('='.repeat(70) + '\n');
});

console.log('🚀 Starting realistic load test...\n');
console.log('Scenario: 50 users booking from various locations');
console.log('Duration: 30 seconds');
console.log('Behavior: Random pickups/dropoffs, varied luggage\n');
