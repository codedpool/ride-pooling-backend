const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
  try {
    console.log('📋 Checking rides table schema...\n');
    
    const result = await pool.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'rides'
      ORDER BY ordinal_position;
    `);
    
    console.table(result.rows);
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
  }
}

checkSchema();
