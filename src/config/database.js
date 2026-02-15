const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,                      // Max connections
  min: 2,                        // Keep 2 connections warm
  idleTimeoutMillis: 30000,      // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Timeout if can't get connection
  statement_timeout: 10000       // Query timeout
});

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

console.log('✅ Database pool configured (max: 20 connections)');

module.exports = { query, getClient };
