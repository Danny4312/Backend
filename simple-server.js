const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(cors({
  origin: ['http://localhost:4028', 'http://localhost:3000', 'http://127.0.0.1:4028'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'iSafari Global Backend is running',
    timestamp: new Date().toISOString()
  });
});

// API placeholder endpoints to prevent proxy errors
app.get('/api/placeholder/:width/:height', (req, res) => {
  const { width, height } = req.params;
  res.json({
    url: `https://via.placeholder.com/${width}x${height}`,
    width: parseInt(width),
    height: parseInt(height)
  });
});

// Google OAuth endpoints
app.get('/api/auth/google', (req, res) => {
  // Redirect to Google OAuth
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${process.env.GOOGLE_REDIRECT_URI}&response_type=code&scope=email profile`;
  res.redirect(googleAuthUrl);
});

app.get('/api/auth/google/callback', (req, res) => {
  // Handle Google OAuth callback
  const { code } = req.query;
  if (code) {
    // In production, exchange code for tokens and create user
    res.redirect(`${process.env.FRONTEND_URL}/auth/oauth-callback?token=demo_token&userType=new`);
  } else {
    res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
  }
});

// Basic API endpoints
app.get('/api/auth/me', (req, res) => {
  res.json({ user: null, authenticated: false });
});

app.get('/api/services', (req, res) => {
  res.json({ 
    services: [],
    message: 'Services endpoint working'
  });
});

app.get('/api/bookings', (req, res) => {
  res.json({ 
    bookings: [],
    message: 'Bookings endpoint working'
  });
});

app.get('/api/users/profile', (req, res) => {
  res.json({ 
    profile: null,
    message: 'Profile endpoint working'
  });
});

// Catch all API routes
app.use('/api/*', (req, res) => {
  res.json({ 
    message: 'API endpoint exists but not fully implemented',
    endpoint: req.originalUrl,
    method: req.method
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.originalUrl 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 iSafari Global Simple Backend running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 CORS enabled for frontend on port 4028`);
});

module.exports = app;
