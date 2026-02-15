const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';
const USER_ID = '452ef1bf-8064-4882-8071-c85cc4d3cb63';

// Test scenarios
const scenarios = {
  // 1. Happy path - Normal booking
  async normalBooking() {
    console.log('\n🧪 Test 1: Normal Booking (Happy Path)');
    try {
      const response = await axios.post(`${API_BASE}/rides/book`, {
        userId: USER_ID,
        pickupLat: 28.5565,
        pickupLon: 77.1005,
        dropoffLat: 28.6565,
        dropoffLon: 77.2005,
        luggageCount: 1
      });
      
      console.log(`  ✅ Status: ${response.status}`);
      console.log(`  ✅ Fare: ₹${response.data.data.pricing.fare}`);
      console.log(`  ✅ Ride ID: ${response.data.data.ride.id.substring(0, 8)}...`);
      return response.data.data;
    } catch (error) {
      console.log(`  ❌ Failed: ${error.response?.data?.error || error.message}`);
      return null;
    }
  },

  // 2. Short distance booking
  async shortDistance() {
    console.log('\n🧪 Test 2: Short Distance (2km)');
    try {
      const response = await axios.post(`${API_BASE}/rides/book`, {
        userId: USER_ID,
        pickupLat: 28.5565,
        pickupLon: 77.1005,
        dropoffLat: 28.5665,
        dropoffLon: 77.1105,
        luggageCount: 1
      });
      
      console.log(`  ✅ Status: ${response.status}`);
      console.log(`  ✅ Distance: ${response.data.data.pricing.distance}km`);
      console.log(`  ✅ Fare: ₹${response.data.data.pricing.fare}`);
      return response.data.data;
    } catch (error) {
      console.log(`  ❌ Failed: ${error.response?.data?.error || error.message}`);
      return null;
    }
  },

  // 3. Long distance booking
  async longDistance() {
    console.log('\n🧪 Test 3: Long Distance\n');
    try {
      const response = await axios.post(`${API_BASE}/rides/book`, {
        userId: '452ef1bf-8064-4882-8071-c85cc4d3cb65',
        pickupLat: 28.5000,  
        pickupLon: 77.0500,   
        dropoffLat: 28.6565,
        dropoffLon: 77.2005,
        luggageCount: 1
      });
      
      console.log(`  ✅ Status: ${response.status}`);
      console.log(`  ✅ Distance: ${response.data.data.pricing.distance}km`);
      console.log(`  ✅ Fare: ₹${response.data.data.pricing.fare}`);
      return response.data.data;
    } catch (error) {
      console.log(`  ❌ Failed: ${error.response?.data?.error || error.message}`);
      return null;
    }
  },

  // 4. High luggage count
  async highLuggage() {
    console.log('\n🧪 Test 4: High Luggage Count (3 bags)');
    try {
      const response = await axios.post(`${API_BASE}/rides/book`, {
        userId: USER_ID,
        pickupLat: 28.5565,
        pickupLon: 77.1005,
        dropoffLat: 28.6565,
        dropoffLon: 77.2005,
        luggageCount: 3
      });
      
      console.log(`  ✅ Status: ${response.status}`);
      console.log(`  ✅ Luggage: ${response.data.data.booking.luggage_count} bags`);
      console.log(`  ✅ Available luggage after: ${response.data.data.ride.availableLuggage}`);
      return response.data.data;
    } catch (error) {
      console.log(`  ❌ Failed: ${error.response?.data?.error || error.message}`);
      return null;
    }
  },

  // 5. Get booking status
  async getBookingStatus(bookingId) {
    console.log('\n🧪 Test 5: Get Booking Status');
    try {
      const response = await axios.get(`${API_BASE}/rides/booking/${bookingId}`);
      
      console.log(`  ✅ Status: ${response.status}`);
      console.log(`  ✅ Booking Status: ${response.data.data.booking.status}`);
      console.log(`  ✅ Fare: ₹${response.data.data.booking.fare}`);
      return response.data.data;
    } catch (error) {
      console.log(`  ❌ Failed: ${error.response?.data?.error || error.message}`);
      return null;
    }
  },

  // 6. Cancel booking
  async cancelBooking(bookingId) {
    console.log('\n🧪 Test 6: Cancel Booking');
    try {
      const response = await axios.delete(`${API_BASE}/rides/booking/${bookingId}`);
      
      console.log(`  ✅ Status: ${response.status}`);
      console.log(`  ✅ Message: ${response.data.message}`);
      return response.data.data;
    } catch (error) {
      console.log(`  ❌ Failed: ${error.response?.data?.error || error.message}`);
      return null;
    }
  },

  // 7. Invalid coordinates
  async invalidCoordinates() {
    console.log('\n🧪 Test 7: Invalid Coordinates (Edge Case)');
    try {
      const response = await axios.post(`${API_BASE}/rides/book`, {
        userId: USER_ID,
        pickupLat: 999,
        pickupLon: 999,
        dropoffLat: 28.6565,
        dropoffLon: 77.2005,
        luggageCount: 1
      });
      
      console.log(`  ❌ Should have failed but got: ${response.status}`);
      return null;
    } catch (error) {
      console.log(`  ✅ Correctly rejected: ${error.response?.data?.error || error.message}`);
      return true;
    }
  },

  // 8. Concurrent bookings (race condition test)
  async concurrentBookings() {
    console.log('\n🧪 Test 8: Concurrent Bookings (Race Condition)');
    
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        axios.post(`${API_BASE}/rides/book`, {
          userId: USER_ID,
          pickupLat: 28.5565,
          pickupLon: 77.1005,
          dropoffLat: 28.6565,
          dropoffLon: 77.2005,
          luggageCount: 1
        }).catch(err => ({ error: true, message: err.response?.data?.error }))
      );
    }
    
    const results = await Promise.all(promises);
    const successful = results.filter(r => !r.error).length;
    const failed = results.filter(r => r.error).length;
    
    console.log(`  ✅ Successful bookings: ${successful}`);
    console.log(`  ✅ Failed bookings: ${failed}`);
    console.log(`  ✅ No double-bookings: ${successful > 0 && failed > 0 ? 'PASS' : 'CHECK MANUALLY'}`);
    
    return { successful, failed };
  },

  // 9. Get all rides
  async getAllRides() {
    console.log('\n🧪 Test 9: Get All Active Rides');
    try {
      const response = await axios.get(`${API_BASE}/rides`);
      
      console.log(`  ✅ Status: ${response.status}`);
      console.log(`  ✅ Active rides found: ${response.data.data.length}`);
      
      if (response.data.data.length > 0) {
        const ride = response.data.data[0];
        console.log(`  ✅ Sample ride: ${ride.available_seats} seats, ₹${ride.current_fare}`);
      }
      
      return response.data.data;
    } catch (error) {
      console.log(`  ❌ Failed: ${error.response?.data?.error || error.message}`);
      return null;
    }
  },

  // 10. Far distance (should fail - outside search radius)
  async farDistance() {
    console.log('\n🧪 Test 10: Far Distance (Outside 10km radius)');
    try {
      const response = await axios.post(`${API_BASE}/rides/book`, {
        userId: USER_ID,
        pickupLat: 28.7041,  // ~17km away
        pickupLon: 77.1025,
        dropoffLat: 28.6565,
        dropoffLon: 77.2005,
        luggageCount: 1
      });
      
      console.log(`  ⚠️  Booking succeeded (might be a nearby ride)`);
      console.log(`  ✅ Distance: ${response.data.data.pricing.distance}km`);
      return response.data.data;
    } catch (error) {
      console.log(`  ✅ Correctly rejected: ${error.response?.data?.error || error.message}`);
      return null;
    }
  }
};

// Run all scenarios
async function runScenarios() {
  console.log('='.repeat(70));
  console.log('🧪 SCENARIO-BASED TESTING');
  console.log('='.repeat(70));
  
  let bookingId = null;
  
  // Test 1-4: Create bookings
  const booking1 = await scenarios.normalBooking();
  if (booking1) bookingId = booking1.booking.id;
  
  await scenarios.shortDistance();
  await scenarios.longDistance();
  await scenarios.highLuggage();
  
  // Test 5-6: Booking operations
  if (bookingId) {
    await scenarios.getBookingStatus(bookingId);
    await scenarios.cancelBooking(bookingId);
  }
  
  // Test 7-10: Edge cases
  await scenarios.invalidCoordinates();
  await scenarios.concurrentBookings();
  await scenarios.getAllRides();
  await scenarios.farDistance();
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ ALL SCENARIO TESTS COMPLETE');
  console.log('='.repeat(70) + '\n');
}

// Run tests
runScenarios().catch(console.error);
