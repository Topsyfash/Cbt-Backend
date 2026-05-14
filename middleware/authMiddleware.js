const { verifyToken } = require('../utils/jwt.utils');
const User = require('../models/User.model');

// ─── Protect: verify JWT and attach user ────────────────────────────────────
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    const decoded = verifyToken(token);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account has been suspended' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

// ─── Role-based access control ───────────────────────────────────────────────
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized to access this route`
      });
    }
    next();
  };
};

// ─── Student must be approved ─────────────────────────────────────────────────
const requireApproval = (req, res, next) => {
  if (req.user.role === 'student' && !req.user.isApproved) {
    return res.status(403).json({
      success: false,
      message: 'Your account is pending admin approval'
    });
  }
  next();
};

module.exports = { protect, authorize, requireApproval };
