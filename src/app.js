const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const rideRoutes = require('./routes/rideRoutes');
const cabRoutes = require('./routes/cabRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health Check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Airport Ride Pooling API'
  });
});

// Routes
app.use('/api/rides', rideRoutes);
app.use('/api/cabs', cabRoutes);

// Error Handler (Must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;
