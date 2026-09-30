const { verifyToken } = require('../utils/jwt');
// const authService = require('../services/authService');

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token is missing or malformed',
        error: 'AUTH_UNAUTHORIZED',
        details: {},
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token is missing',
        error: 'AUTH_UNAUTHORIZED',
        details: {},
      });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Authentication token has expired',
          error: 'AUTH_UNAUTHORIZED',
          details: {},
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token',
        error: 'AUTH_UNAUTHORIZED',
        details: {},
      });
    }

    const user = await authService.getUserById(decoded.sub);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authenticated user not found or account removed',
        error: 'AUTH_UNAUTHORIZED',
        details: {},
      });
    }

    // Attach authenticated user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware unexpected error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server authentication error',
      error: 'INTERNAL_SERVER_ERROR',
      details: {},
    });
  }
}

module.exports = authMiddleware;
