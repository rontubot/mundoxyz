const jwt = require('jsonwebtoken');
const config = require('../config/config');
const logger = require('../utils/logger');
const { query } = require('../db');

// Verify JWT token
async function verifyToken(req, res, next) {
  try {
    // Get token from various sources
    const token = 
      req.headers.authorization?.replace('Bearer ', '') ||
      req.cookies?.token ||
      req.headers['x-session-id'];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify token
    const decoded = jwt.verify(token, config.security.jwtSecret);

    // Get user from database
    const result = await query(
      'SELECT u.*, array_agg(r.name) as roles FROM users u ' +
      'LEFT JOIN user_roles ur ON u.id = ur.user_id ' +
      'LEFT JOIN roles r ON ur.role_id = r.id ' +
      'WHERE u.id = $1 ' +
      'GROUP BY u.id',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Attach user to request
    req.user = {
      ...result.rows[0],
      roles: result.rows[0].roles?.filter(Boolean) || []
    };

    // Update last seen
    query(
      'UPDATE users SET last_seen_at = NOW() WHERE id = $1',
      [decoded.userId]
    ).catch(err => logger.error('Error updating last_seen_at:', err));

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    logger.error('Token verification error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
}

// Optional authentication - doesn't fail if no token
async function optionalAuth(req, res, next) {
  try {
    // Get token from various sources
    const token = 
      req.headers.authorization?.replace('Bearer ', '') ||
      req.cookies?.token ||
      req.headers['x-session-id'];

    if (!token) {
      req.user = null;
      return next();
    }

    // Verify token
    const decoded = jwt.verify(token, config.security.jwtSecret);

    // Get user from database
    const result = await query(
      'SELECT u.*, array_agg(r.name) as roles FROM users u ' +
      'LEFT JOIN user_roles ur ON u.id = ur.user_id ' +
      'LEFT JOIN roles r ON ur.role_id = r.id ' +
      'WHERE u.id = $1 ' +
      'GROUP BY u.id',
      [decoded.userId]
    );

    if (result.rows.length > 0) {
      req.user = {
        ...result.rows[0],
        roles: result.rows[0].roles?.filter(Boolean) || []
      };
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    req.user = null;
    next();
  }
}

// Check if user has specific role
function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      // First verify authentication
      if (!req.user) {
        await verifyToken(req, res, () => {});
        if (!req.user) {
          return res.status(401).json({ error: 'Authentication required' });
        }
      }

      // Check roles
      const userRoles = req.user.roles || [];
      const hasRole = roles.some(role => userRoles.includes(role));

      if (!hasRole) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: roles,
          userRoles
        });
      }

      next();
    } catch (error) {
      logger.error('Role check error:', error);
      return res.status(500).json({ error: 'Authorization error' });
    }
  };
}

// Check if user is Tote
function requireTote(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const isTote = 
    req.user.roles?.includes('tote') ||
    req.user.tg_id?.toString() === config.telegram.toteId;

  if (!isTote) {
    return res.status(403).json({ error: 'Tote access required' });
  }

  next();
}

// Check if user is admin
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const isAdmin = 
    req.user.roles?.includes('admin') ||
    req.user.roles?.includes('tote');

  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

// Admin authentication via headers
function adminAuth(req, res, next) {
  const username = req.headers['x-admin-username'];
  const code = req.headers['x-admin-code'];

  // Check test runner bypass
  if (config.server.allowTestRunner && req.headers['x-test-runner'] === 'testsprite') {
    req.isAdmin = true;
    return next();
  }

  // Check admin credentials
  if (username === config.admin.username && code === config.admin.code) {
    req.isAdmin = true;
    return next();
  }

  // Try to populate req.user from JWT if missing
  if (!req.user && (req.headers.authorization || req.headers['x-session-id'] || req.cookies?.token)) {
    try {
      return verifyToken(req, res, () => {
        if (req.user && (req.user.roles?.includes('admin') || req.user.roles?.includes('tote'))) {
          req.isAdmin = true;
          return next();
        }
        return res.status(403).json({ error: 'Admin authentication required' });
      });
    } catch (e) {
      return res.status(403).json({ error: 'Admin authentication required' });
    }
  }

  // Check if authenticated user has admin role
  if (req.user && (req.user.roles?.includes('admin') || req.user.roles?.includes('tote'))) {
    req.isAdmin = true;
    return next();
  }

  return res.status(403).json({ error: 'Admin authentication required' });
}

// Rate limiting per user
const userRateLimits = new Map();

function userRateLimit(maxRequests = 300, windowMs = 60000) {
  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user.id;
    const now = Date.now();
    
    if (!userRateLimits.has(userId)) {
      userRateLimits.set(userId, []);
    }

    const userRequests = userRateLimits.get(userId);
    
    // Remove old requests outside the window
    const recentRequests = userRequests.filter(time => now - time < windowMs);
    
    if (recentRequests.length >= maxRequests) {
      logger.warn(`Rate limit exceeded for user ${userId}: ${recentRequests.length} requests in window`);
      return res.status(429).json({ 
        error: 'Too many requests',
        retryAfter: Math.ceil((recentRequests[0] + windowMs - now) / 1000)
      });
    }

    recentRequests.push(now);
    userRateLimits.set(userId, recentRequests);
    
    next();
  };
}

// Clean up rate limit data periodically
setInterval(() => {
  const now = Date.now();
  for (const [userId, requests] of userRateLimits.entries()) {
    const recentRequests = requests.filter(time => now - time < 300000); // Keep 5 minutes
    if (recentRequests.length === 0) {
      userRateLimits.delete(userId);
    } else {
      userRateLimits.set(userId, recentRequests);
    }
  }
}, 60000); // Clean every minute

// Generate JWT token
function generateToken(userId, expiresIn = config.security.jwtExpiresIn) {
  return jwt.sign(
    { userId, timestamp: Date.now() },
    config.security.jwtSecret,
    { expiresIn }
  );
}

// Generate refresh token
function generateRefreshToken(userId) {
  return jwt.sign(
    { userId, type: 'refresh', timestamp: Date.now() },
    config.security.jwtSecret,
    { expiresIn: '30d' }
  );
}

module.exports = {
  verifyToken,
  optionalAuth,
  requireRole,
  requireTote,
  requireAdmin,
  adminAuth,
  userRateLimit,
  generateToken,
  generateRefreshToken
};
