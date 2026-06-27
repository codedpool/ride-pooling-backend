const express = require('express');
const router = express.Router();
const sim = require('../services/simulationService');
const logger = require('../utils/logger');

function handle(fn) {
  return async (req, res) => {
    try {
      const data = await fn(req);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Simulation endpoint failed', { path: req.path, error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  };
}

// Preset locations + demo user + tuning constants for the UI.
router.get('/context', handle(() => sim.getContext()));

// Live snapshot for the status pill + map refresh.
router.get('/status', handle(() => sim.getStatus()));

// Populate the board with a demo fleet of cabs + active rides.
router.post('/seed', handle((req) => sim.seedFleet(req.body?.count)));

// Wipe rides/bookings and simulated cabs.
router.post('/reset', handle(() => sim.reset()));

// Fire N concurrent bookings at one cab and report the lock outcome.
router.post('/stress', handle((req) => sim.stressTest(req.body?.concurrency)));

// Run the full automated suite and return a structured report.
router.post('/run-all', handle(() => sim.runAllTests()));

module.exports = router;
