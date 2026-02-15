const express = require('express');
const router = express.Router();
const RideController = require('../controllers/rideController');
const { bookingValidation, uuidValidation } = require('../middleware/validator');

// Book a ride
router.post('/book', bookingValidation, RideController.bookRide);

// Get booking status
router.get('/status/:id', uuidValidation, RideController.getBookingStatus);

// Cancel booking
router.post('/cancel/:id', uuidValidation, RideController.cancelBooking);

// Get all active rides
router.get('/', RideController.getAllRides);

module.exports = router;
