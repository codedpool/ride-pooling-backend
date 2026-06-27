const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const rideRoutes = require('./routes/rideRoutes');
const cabRoutes = require('./routes/cabRoutes');
const simulateRoutes = require('./routes/simulateRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Serve the interactive dispatch console (public/index.html) at the root URL.
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Airport Ride Pooling API'
  });
});


if (process.env.NODE_ENV !== 'production') {
  const testRoutes = require('./routes/testRoutes');
  app.use('/api/test', testRoutes);
}

app.use('/api/rides', rideRoutes);
app.use('/api/cabs', cabRoutes);
app.use('/api/simulate', simulateRoutes);

// Anything else falls back to the console UI.
app.get('/', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;
