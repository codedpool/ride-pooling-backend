const Cab = require('../models/Cab');
const logger = require('../utils/logger');

class CabController {
  /**
   * POST /api/cabs/register
   * Register a new cab
   */
  static async registerCab(req, res, next) {
    try {
      const { driverName, vehicleNumber, lat, lon } = req.body;

      const cab = await Cab.create(driverName, vehicleNumber, lat, lon);

      logger.info('Cab registered', { cabId: cab.id, vehicleNumber });

      res.status(201).json({
        success: true,
        data: cab,
        message: 'Cab registered successfully'
      });

    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(400).json({
          success: false,
          error: 'Vehicle number already registered'
        });
      }
      next(error);
    }
  }

  /**
   * GET /api/cabs/:id
   * Get cab details
   */
  static async getCab(req, res, next) {
    try {
      const { id } = req.params;

      const cab = await Cab.findById(id);
      if (!cab) {
        return res.status(404).json({
          success: false,
          error: 'Cab not found'
        });
      }

      res.json({
        success: true,
        data: cab
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/cabs/:id/location
   * Update cab location
   */
  static async updateLocation(req, res, next) {
    try {
      const { id } = req.params;
      const { lat, lon } = req.body;

      const cab = await Cab.updateLocation(id, lat, lon);
      if (!cab) {
        return res.status(404).json({
          success: false,
          error: 'Cab not found'
        });
      }

      res.json({
        success: true,
        data: cab,
        message: 'Location updated'
      });

    } catch (error) {
      next(error);
    }
  }
}

module.exports = CabController;
