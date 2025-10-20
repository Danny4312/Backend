const passport = require('passport');
const jwt = require('jsonwebtoken');

// Middleware to authenticate JWT token
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Access token is required'
    });
  }

  const token = authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token is required'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

// Middleware to check if user is a service provider
const requireServiceProvider = (req, res, next) => {
  if (req.user.userType !== 'service_provider') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Service provider role required.'
    });
  }
  next();
};

// Middleware to check if user is a traveler
const requireTraveler = (req, res, next) => {
  if (req.user.userType !== 'traveler') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Traveler role required.'
    });
  }
  next();
};

// Middleware to check if user is verified
const requireVerified = (req, res, next) => {
  if (!req.user.isVerified) {
    return res.status(403).json({
      success: false,
      message: 'Account verification required'
    });
  }
  next();
};

module.exports = {
  authenticateJWT,
  requireServiceProvider,
  requireTraveler,
  requireVerified
};
