const { body, param, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

const bookingValidation = [
  body('userId').isUUID().withMessage('Invalid user ID'),
  body('pickupLat').isFloat({ min: -90, max: 90 }).withMessage('Invalid pickup latitude'),
  body('pickupLon').isFloat({ min: -180, max: 180 }).withMessage('Invalid pickup longitude'),
  body('dropoffLat').isFloat({ min: -90, max: 90 }).withMessage('Invalid dropoff latitude'),
  body('dropoffLon').isFloat({ min: -180, max: 180 }).withMessage('Invalid dropoff longitude'),
  body('luggageCount').isInt({ min: 0, max: 6 }).withMessage('Luggage count must be 0-6'),
  validate
];

const cabValidation = [
  body('driverName').notEmpty().withMessage('Driver name is required'),
  body('vehicleNumber').notEmpty().withMessage('Vehicle number is required'),
  body('lat').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('lon').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  validate
];

const uuidValidation = [
  param('id').isUUID().withMessage('Invalid ID format'),
  validate
];

module.exports = {
  bookingValidation,
  cabValidation,
  uuidValidation
};
