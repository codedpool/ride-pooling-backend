const { Client } = require('pg');
require('dotenv').config();

// Delhi Airport coordinates
const AIRPORT_LAT = 28.5562;
const AIRPORT_LON = 77.1000;

async function seed() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('neon.tech') 
      ? { rejectUnauthorized: false } 
      : false
  });


  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await client.query('TRUNCATE users, cabs, rides, bookings CASCADE');

    // Insert Users
    console.log('👥 Creating users...');
    const users = [];
    for (let i = 1; i <= 20; i++) {
      const result = await client.query(
        `INSERT INTO users (name, phone) VALUES ($1, $2) RETURNING *`,
        [`User ${i}`, `+91900000${String(i).padStart(4, '0')}`]
      );
      users.push(result.rows[0]);
    }
    console.log(`✅ Created ${users.length} users`);

    // Insert Cabs around Delhi Airport
    console.log('🚕 Creating cabs...');
    const cabs = [];
    const cabLocations = [
      { lat: 28.5562, lon: 77.1000, name: 'Rajesh Kumar', vehicle: 'DL-01-AB-1234' },
      { lat: 28.5580, lon: 77.0980, name: 'Amit Singh', vehicle: 'DL-01-AB-5678' },
      { lat: 28.5540, lon: 77.1020, name: 'Vikram Sharma', vehicle: 'DL-01-AB-9012' },
      { lat: 28.5600, lon: 77.0950, name: 'Suresh Patel', vehicle: 'DL-01-AB-3456' },
      { lat: 28.5520, lon: 77.1050, name: 'Rahul Verma', vehicle: 'DL-01-AB-7890' },
      { lat: 28.5590, lon: 77.1010, name: 'Manoj Kumar', vehicle: 'DL-01-AB-2468' },
      { lat: 28.5550, lon: 77.0990, name: 'Deepak Gupta', vehicle: 'DL-01-AB-1357' },
      { lat: 28.5570, lon: 77.1030, name: 'Ashok Yadav', vehicle: 'DL-01-AB-9753' },
      { lat: 28.5530, lon: 77.0970, name: 'Sandeep Joshi', vehicle: 'DL-01-AB-8642' },
      { lat: 28.5610, lon: 77.1040, name: 'Prakash Mehta', vehicle: 'DL-01-AB-7531' }
    ];

    for (const cab of cabLocations) {
      const result = await client.query(
        `INSERT INTO cabs (driver_name, vehicle_number, current_location, total_seats, total_luggage_capacity)
         VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), 4, 6)
         RETURNING id, driver_name, vehicle_number, 
                   ST_X(current_location::geometry) as lon,
                   ST_Y(current_location::geometry) as lat`,
        [cab.name, cab.vehicle, cab.lon, cab.lat]
      );
      cabs.push(result.rows[0]);
    }
    console.log(`✅ Created ${cabs.length} cabs`);

    // Create some active rides (simulating partially filled cabs)
    console.log('🚗 Creating active rides...');
    const rides = [];
    for (let i = 0; i < 5; i++) {
      const result = await client.query(
        `INSERT INTO rides (cab_id, status, available_seats, available_luggage)
         VALUES ($1, 'active', $2, $3)
         RETURNING *`,
        [cabs[i].id, 3, 4] // 1 seat taken, 2 luggage taken
      );
      rides.push(result.rows[0]);
    }
    console.log(`✅ Created ${rides.length} active rides`);

    // Create some existing bookings
    console.log('📝 Creating sample bookings...');
    for (let i = 0; i < 5; i++) {
      await client.query(
        `INSERT INTO bookings (user_id, ride_id, pickup_location, dropoff_location, luggage_count, fare, status)
         VALUES ($1, $2, 
                 ST_SetSRID(ST_MakePoint($3, $4), 4326),
                 ST_SetSRID(ST_MakePoint($5, $6), 4326),
                 2, 150.00, 'confirmed')`,
        [
          users[i].id,
          rides[i].id,
          77.1000 + (Math.random() * 0.01),
          28.5562 + (Math.random() * 0.01),
          77.2000 + (Math.random() * 0.01),
          28.6562 + (Math.random() * 0.01)
        ]
      );
    }
    console.log(`✅ Created sample bookings`);

    console.log('\n🎉 SEED DATA COMPLETE!');
    console.log('\n📊 Summary:');
    console.log(`   Users: ${users.length}`);
    console.log(`   Cabs: ${cabs.length}`);
    console.log(`   Active Rides: ${rides.length}`);
    console.log(`   Sample Bookings: 5`);
    console.log('\n🔑 Sample User ID:', users[0].id);
    console.log('🔑 Sample Cab ID:', cabs[0].id);

  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
