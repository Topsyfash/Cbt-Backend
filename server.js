const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(o => o.trim())
  : [];

const corsOptions = {
  origin: (origin, callback) => {

    if (!origin) {
      return callback(null, true);
    }

    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith(".vercel.app")
    ) {
      return callback(null, true);
    }

    callback(new Error("Not allowed by CORS"));
  },

  credentials: true
};

app.use(cors(corsOptions));

// ─── Security Middleware ────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(mongoSanitize());

// ─── Rate Limiters — AFTER cors so blocked responses still have CORS headers ─
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300, // raised from 100 — exam auto-saves fire frequently
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // raised from 20 to accommodate page refreshes
  message: { success: false, message: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/', authLimiter);

// ─── General Middleware ──────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static folder for uploaded images — cross-origin allowed for img tags
app.use("/uploads", (req,res,next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static(path.join(__dirname, 'uploads')));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/authRoutes'));
app.use('/api/users',     require('./routes/userRoutes'));
app.use('/api/classes',   require('./routes/classRoutes'));
app.use('/api/subjects',  require('./routes/subjectRoutes'));
app.use('/api/exams',     require('./routes/examRoutes'));
app.use('/api/questions', require('./routes/questionRoutes'));
app.use('/api/attempts',  require('./routes/attemptRoutes'));
app.use('/api/results',   require('./routes/resultRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'CBT API is running', timestamp: new Date() });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Global error:', err);

  // CORS error
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ success: false, message: 'CORS: origin not allowed' });
  }
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ success: false, message: errors.join(', ') });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({ success: false, message: `${field} already exists` });
  }
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token expired' });
  }
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// ─── Database & Server Start ─────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

module.exports = app;