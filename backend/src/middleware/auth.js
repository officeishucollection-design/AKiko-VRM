import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Protect routes
export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token (exclude password)
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({ error: 'Not authorized, user not found' });
      }

      next();
    } catch (error) {
      console.error('JWT Verification Error:', error.message);
      return res.status(401).json({ error: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authorized, no token provided' });
  }
};

// Grant access to specific roles
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authorized' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `User role '${req.user.role}' is not authorized to access this resource`
      });
    }
    next();
  };
};

// Enforce station-level access control for operators
export const authorizeStation = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authorized' });
  }

  // Admins always have access to all stations
  if (req.user.role === 'admin') {
    return next();
  }

  // Determine station type from request
  let stationType = null;

  // 1. Check body (for presigned-url and save metadata endpoints)
  if (req.body && req.body.type) {
    stationType = req.body.type; // 'order' or 'return'
  } 
  // 2. Check query/params (for mock-upload endpoints)
  else if (req.query && req.query.key) {
    const key = req.query.key;
    if (key.startsWith('order/')) {
      stationType = 'order';
    } else if (key.startsWith('return/')) {
      stationType = 'return';
    }
  }

  // If no station type is identified, allow it to pass or deny? Let's default to allow (or default 'order')
  if (!stationType) {
    return next();
  }

  // Check operator's permissions
  if (!req.user.allowedStations.includes(stationType)) {
    return res.status(403).json({
      error: `Access denied. You do not have permission to access the ${stationType === 'order' ? 'Order Scan' : 'Returns'} station.`
    });
  }

  next();
};
