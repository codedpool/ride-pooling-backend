const { Pool } = require('pg');
require('dotenv').config();

// With no DATABASE_URL the app runs entirely on the in-memory store
// (single-service deploy, fresh on every boot — no external database needed).
const usingMemory = !process.env.DATABASE_URL;

const isProduction = process.env.NODE_ENV === 'production';
const isNeon = process.env.DATABASE_URL?.includes('neon.tech');

let pool = null;

async function warmupPool() {
  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(pool.query('SELECT 1'));
  }
  await Promise.all(promises);
  console.log('🔥 Connection pool warmed up (10 connections ready)');
}

if (usingMemory) {
  console.log('🧠 No DATABASE_URL set — using the in-memory data store (state resets on restart)');
} else {
  pool = new Pool({
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

  pool.on('connect', () => {
    console.log('🔗 New database connection established');
  });

  pool.on('error', (err) => {
    console.error('❌ Unexpected database error:', err);
  });

  warmupPool().catch(console.error);
  console.log('✅ Database pool configured (max: 50 connections)');
}

async function query(text, params) {
  if (!pool) throw new Error('No database configured (running in in-memory mode)');
  return pool.query(text, params);
}

async function getClient() {
  if (!pool) throw new Error('No database configured (running in in-memory mode)');
  return pool.connect();
}

module.exports = { query, getClient, pool, usingMemory };
