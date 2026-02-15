const { Pool } = require('pg');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const isNeon = process.env.DATABASE_URL?.includes('neon.tech');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: (isNeon || isProduction) ? { rejectUnauthorized: false } : false, // No SSL for local
  max: 50,
  min: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
  statement_timeout: 5000,
  query_timeout: 5000,
  application_name: 'ride-pooling-api'
});

// Warm up the pool on startup
async function warmupPool() {
  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(pool.query('SELECT 1'));
  }
  await Promise.all(promises);
  console.log('🔥 Connection pool warmed up (10 connections ready)');
}

pool.on('connect', () => {
  console.log('🔗 New database connection established');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
});

async function query(text, params) {
  return pool.query(text, params);
}

async function getClient() {
  return pool.connect();
}

// Initialize warmup
warmupPool().catch(console.error);

console.log('✅ Database pool configured (max: 50 connections)');

module.exports = { query, getClient, pool };
