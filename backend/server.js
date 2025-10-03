const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4173', // Vite preview default
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
];
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin like mobile apps or curl
    if (!origin) return callback(null, true);
    // Allow explicit allowlist
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    // In development, allow any localhost/127.0.0.1 port
    const dev = (process.env.NODE_ENV || 'development') === 'development';
    const localhostRegex = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;
    if (dev && localhostRegex.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Database connection (skippable in NO_DB mode)
const NO_DB = (process.env.MONGODB_URI === 'disabled') || (process.env.NO_DB === '1');
if (NO_DB) {
  console.log('⚠️  NO_DB mode enabled: skipping MongoDB connection. Data will be in-memory/mocked.');
} else {
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/temple_crowd_management', {
    useUnifiedTopology: true,
  })
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch(err => console.error('❌ MongoDB connection error:', err));
}

  // Routes
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/temples', require('./routes/temples'));
  app.use('/api/slots', require('./routes/slots'));
  app.use('/api/bookings', require('./routes/bookings'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/simulation', require('./routes/simulation'));
  app.use('/api/analytics', require('./routes/analytics'));
  // AI Assistant route
  app.use('/api/assistant', require('./routes/assistant'));
  // Calendar route
  app.use('/api/calendar', require('./routes/calendar'));
  // Community route
  app.use('/api/community', require('./routes/community'));
  // Contact route
  app.use('/api/contact', require('./routes/contact'));
  // Waiting times route
  app.use('/api/waiting-times', require('./routes/waitingTimes'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!', 
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'API endpoint not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
