const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';
const USER_ID = '452ef1bf-8064-4882-8071-c85cc4d3cb63';

const edgeCases = [
  {
    name: 'Same pickup and dropoff',
    data: {
      userId: USER_ID,
      pickupLat: 28.5565,
      pickupLon: 77.1005,
      dropoffLat: 28.5565,
      dropoffLon: 77.1005,
      luggageCount: 1
    },
    expectFail: true
  },
  {
    name: 'Zero luggage',
    data: {
      userId: USER_ID,
      pickupLat: 28.5565,
      pickupLon: 77.1005,
      dropoffLat: 28.6565,
      dropoffLon: 77.2005,
      luggageCount: 0
    },
    expectFail: false
  },
  {
    name: 'Negative luggage',
    data: {
      userId: USER_ID,
      pickupLat: 28.5565,
      pickupLon: 77.1005,
      dropoffLat: 28.6565,
      dropoffLon: 77.2005,
      luggageCount: -1
    },
    expectFail: true
  },
  {
    name: 'Excessive luggage (10 bags)',
    data: {
      userId: USER_ID,
      pickupLat: 28.5565,
      pickupLon: 77.1005,
      dropoffLat: 28.6565,
      dropoffLon: 77.2005,
      luggageCount: 10
    },
    expectFail: true
  },
  {
    name: 'Missing userId',
    data: {
      pickupLat: 28.5565,
      pickupLon: 77.1005,
      dropoffLat: 28.6565,
      dropoffLon: 77.2005,
      luggageCount: 1
    },
    expectFail: true
  },
  {
    name: 'Invalid userId format',
    data: {
      userId: 'invalid-uuid',
      pickupLat: 28.5565,
      pickupLon: 77.1005,
      dropoffLat: 28.6565,
      dropoffLon: 77.2005,
      luggageCount: 1
    },
    expectFail: true  // Should fail due to invalid UUID format
  },
  {
    name: 'Very long distance (100km)',
    data: {
      userId: USER_ID,
      pickupLat: 28.5565,
      pickupLon: 77.1005,
      dropoffLat: 29.5565,
      dropoffLon: 78.1005,
      luggageCount: 1
    },
    expectFail: true  // Should fail - no rides that far
  }
];

async function runEdgeCases() {
  console.log('='.repeat(70));
  console.log('🔬 EDGE CASE TESTING');
  console.log('='.repeat(70) + '\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of edgeCases) {
    console.log(`\n📝 Test: ${testCase.name}`);
    console.log(`   Expected: ${testCase.expectFail ? 'FAIL' : 'PASS'}`);
    
    try {
      const response = await axios.post(`${API_BASE}/rides/book`, testCase.data);
      
      if (testCase.expectFail) {
        console.log(`   ❌ FAILED: Should have been rejected but got ${response.status}`);
        failed++;
      } else {
        console.log(`   ✅ PASSED: ${response.status}`);
        passed++;
      }
    } catch (error) {
      if (testCase.expectFail) {
        console.log(`   ✅ PASSED: Correctly rejected`);
        console.log(`   📄 Error: ${error.response?.data?.error || error.message}`);
        passed++;
      } else {
        console.log(`   ❌ FAILED: Should have succeeded`);
        console.log(`   📄 Error: ${error.response?.data?.error || error.message}`);
        failed++;
      }
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n' + '='.repeat(70));
  console.log(`📊 EDGE CASE RESULTS: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(70) + '\n');
}

runEdgeCases().catch(console.error);
