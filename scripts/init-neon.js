const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config();

async function init() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Neon');

    const sql = fs.readFileSync('scripts/init.sql', 'utf8');
    await client.query(sql);
    
    console.log('✅ Schema created successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

init();
