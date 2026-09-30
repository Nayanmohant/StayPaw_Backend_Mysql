/**
 * Role-based access control middleware for StayPaw.
 * Checks req.user.role against allowed roles.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'AUTH_UNAUTHORIZED',
        details: {},
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden: Insufficient permissions for this resource',
        error: 'AUTH_FORBIDDEN',
        details: {
          requiredRoles: allowedRoles,
          currentRole: req.user.role,
        },
      });
    }

    next();
  };
}

module.exports = {
  requireRole,
};
