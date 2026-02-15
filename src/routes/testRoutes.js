const express = require('express');
const router = express.Router();
const db = require('../config/database');
const logger = require('../utils/logger');

// Only available in development/test
if (process.env.NODE_ENV !== 'production') {
  
  /**
   * POST /api/test/reset-rides
   * Clear all rides and bookings, ensure cabs exist
   */
  router.post('/reset-rides', async (req, res) => {
    try {
      // Clear test data
      await db.query('DELETE FROM bookings');
      await db.query('DELETE FROM rides');
      
      // Check if cabs exist
      const cabCount = await db.query('SELECT COUNT(*) FROM cabs');
      const count = parseInt(cabCount.rows[0].count);
      
      if (count === 0) {
        // Create 20 test cabs if none exist
        logger.info('No cabs found, creating test cabs...');
        
        for (let i = 1; i <= 20; i++) {
          await db.query(`
            INSERT INTO cabs (driver_name, vehicle_number, current_location)
            VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326))
            ON CONFLICT (vehicle_number) DO NOTHING
          `, [
            `Driver ${i}`,
            `DL01XX${String(i).padStart(4, '0')}`,
            77.1005 + (Math.random() * 0.1 - 0.05), // lon
            28.5565 + (Math.random() * 0.1 - 0.05)  // lat
          ]);
        }
      }
      
      logger.info('Test database reset - rides and bookings cleared, cabs ready');
      
      res.json({
        success: true,
        message: 'Database reset complete',
        cabs: count === 0 ? 20 : count
      });
      
    } catch (error) {
      logger.error('Test database reset failed', { error: error.message });
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  });
  
}

module.exports = router;
