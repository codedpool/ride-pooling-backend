const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';
const USER_ID = '452ef1bf-8064-4882-8071-c85cc4d3cb63';

async function testSurgePricing() {
  console.log('🧪 Testing Dynamic Pricing with Redis Surge\n');

  const location = {
    pickupLat: 28.5562,
    pickupLon: 77.1000,
    dropoffLat: 28.6562,
    dropoffLon: 77.2000
  };

  console.log('📊 Sending 5 sequential requests to same location...\n');

  for (let i = 1; i <= 5; i++) {
    try {
      const response = await axios.post(`${API_BASE}/rides/book`, {
        userId: USER_ID,
        ...location,
        luggageCount: 1
      });

      const pricing = response.data.data.pricing;
      console.log(`Request ${i}:`);
      console.log(`  Base Fare: ₹${pricing.baseFare}`);
      console.log(`  Surge Multiplier: ${pricing.surgeMultiplier}x`);
      console.log(`  Final Fare: ₹${pricing.fare}`);
      console.log();

      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Request ${i} failed:`, error.response?.data?.error || error.message);
    }
  }

  console.log('✅ Surge pricing test complete\n');
}

testSurgePricing();
