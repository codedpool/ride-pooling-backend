const express = require('express');
const router = express.Router();
const CabController = require('../controllers/cabController');
const { cabValidation, uuidValidation } = require('../middleware/validator');

//Get all cabs
router.get('/', CabController.getAllCabs);

// Register a new cab
router.post('/register', cabValidation, CabController.registerCab);

// Get cab details
router.get('/:id', uuidValidation, CabController.getCab);

// Update cab location
router.put('/:id/location', CabController.updateLocation);

module.exports = router;
