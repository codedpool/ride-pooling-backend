const axios = require('axios');
const { Client } = require('pg');
require('dotenv').config();

const API_BASE = 'http://localhost:3000/api';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

async function testConcurrency() {
  console.log(`${colors.blue}🧪 CONCURRENCY TEST - Simulating Race Conditions${colors.reset}\n`);

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('neon.tech')
      ? { rejectUnauthorized: false }
      : false
  });

  try {
    // Connect to database
    await client.connect();
    console.log('✅ Connected to database\n');

    // Step 1: Get a user ID
    console.log('📋 Step 1: Setting up test environment...');
    
    const userResult = await client.query('SELECT id FROM users LIMIT 1');
    if (userResult.rows.length === 0) {
      throw new Error('No users found in database. Run: npm run seed');
    }
    const userId = userResult.rows[0].id;
    
    // Register a test cab
    const cabResponse = await axios.post(`${API_BASE}/cabs/register`, {
      driverName: 'Concurrency Test Driver',
      vehicleNumber: `TEST-${Date.now()}`,
      lat: 28.5562,
      lon: 77.1000
    });
    const cabId = cabResponse.data.data.id;
    console.log(`${colors.green}✅ Test cab created: ${cabId}${colors.reset}`);
    console.log(`${colors.green}✅ Using test user: ${userId}${colors.reset}\n`);

    // Step 2: Send 10 concurrent booking requests for the SAME cab
    console.log(`📋 Step 2: Sending 10 concurrent booking requests...`);
    console.log(`${colors.yellow}⚠️  All requests target the same location (simulating race condition)${colors.reset}\n`);

    const bookingRequests = [];
    for (let i = 0; i < 10; i++) {
      const request = axios.post(`${API_BASE}/rides/book`, {
        userId: userId,
        pickupLat: 28.5562,
        pickupLon: 77.1000,
        dropoffLat: 28.6562,
        dropoffLon: 77.2000,
        luggageCount: 1
      }, {
        timeout: 30000 // 30 second timeout
      }).then(response => ({
        success: true,
        bookingId: response.data.data.booking.id,
        rideId: response.data.data.ride.id,
        availableSeats: response.data.data.ride.availableSeats
      })).catch(error => ({
        success: false,
        error: error.response?.data?.error || error.message
      }));
      
      bookingRequests.push(request);
    }

    // Wait for all requests to complete
    console.log('⏳ Waiting for all requests to complete...\n');
    const results = await Promise.all(bookingRequests);

    // Analyze results
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`${colors.blue}📊 TEST RESULTS:${colors.reset}`);
    console.log(`${colors.green}✅ Successful bookings: ${successful.length}${colors.reset}`);
    console.log(`${colors.red}❌ Failed bookings: ${failed.length}${colors.reset}\n`);

    if (successful.length > 0) {
      console.log(`${colors.green}✅ Sample successful booking:${colors.reset}`);
      console.log(`   Booking ID: ${successful[0].bookingId}`);
      console.log(`   Ride ID: ${successful[0].rideId}`);
      if (successful.length > 1) {
        console.log(`   Last booking - Available seats: ${successful[successful.length - 1].availableSeats}\n`);
      } else {
        console.log();
      }
    }

    if (failed.length > 0) {
      console.log(`${colors.yellow}⚠️  Failed booking reasons:${colors.reset}`);
      const errorCounts = {};
      failed.forEach(f => {
        errorCounts[f.error] = (errorCounts[f.error] || 0) + 1;
      });
      Object.entries(errorCounts).forEach(([error, count]) => {
        console.log(`   - "${error}": ${count} times`);
      });
      console.log();
    }

    // Validation
    console.log(`${colors.blue}🔍 VALIDATION:${colors.reset}`);
    
    // Check if we respected seat limit (max 4 seats per cab)
    if (successful.length <= 4) {
      console.log(`${colors.green}✅ PASS: Max ${successful.length} bookings succeeded (cab has 4 seats)${colors.reset}`);
    } else {
      console.log(`${colors.red}❌ FAIL: ${successful.length} bookings succeeded (more than 4 seats - race condition detected!)${colors.reset}`);
    }

    // Check if excess bookings were properly rejected
    if (failed.length >= 6) {
      console.log(`${colors.green}✅ PASS: Proper rejection of ${failed.length} excess bookings${colors.reset}`);
    } else if (failed.length > 0) {
      console.log(`${colors.yellow}⚠️  PARTIAL: ${failed.length} bookings rejected${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠️  WARNING: No rejections - all requests may have created separate rides${colors.reset}`);
    }

    // Final verdict
    const passedConcurrency = successful.length <= 4;
    console.log(`\n${colors.blue}🎯 CONCURRENCY HANDLING: ${passedConcurrency ? colors.green + 'WORKING ✅' : colors.red + 'NEEDS FIX ❌'}${colors.reset}\n`);

    // Cleanup: Get all bookings for this test and show stats
    if (successful.length > 0) {
      const rideId = successful[0].rideId;
      const rideCheck = await axios.get(`${API_BASE}/rides`);
      const testRide = rideCheck.data.data.find(r => r.id === rideId);
      
      if (testRide) {
        console.log(`${colors.blue}📈 FINAL RIDE STATE:${colors.reset}`);
        console.log(`   Ride ID: ${testRide.id}`);
        console.log(`   Available Seats: ${testRide.available_seats}/4`);
        console.log(`   Available Luggage: ${testRide.available_luggage}/6`);
        console.log(`   Version (lock count): ${testRide.version}`);
        console.log();
      }
    }

  } catch (error) {
    console.error(`${colors.red}❌ Test failed:`, error.message, colors.reset);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run test
console.log('\n' + '='.repeat(60));
testConcurrency().then(() => {
  console.log('='.repeat(60) + '\n');
  process.exit(0);
});
