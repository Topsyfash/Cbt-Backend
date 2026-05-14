const User = require('../models/User.model');
const { generateToken } = require('../utils/jwt.utils');
const { sendSuccess, sendError } = require('../utils/response.utils');

// ─── Register ────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { fullName, email, password, role, admissionNumber } = req.body;

    // Only student self-registration is public; teachers/admins are created by admin
    const allowedRoles = ['student'];
    const userRole = allowedRoles.includes(role) ? role : 'student';

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return sendError(res, 400, 'Email already registered');
    }

    const user = await User.create({
      fullName,
      email,
      password,
      role: userRole,
      admissionNumber: admissionNumber || null
    });

    const token = generateToken(user._id, user.role);

    return sendSuccess(res, 201, 'Registration successful. Awaiting admin approval.', {
      token,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved
      }
    });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── Login ───────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 400, 'Email and password are required');
    }

    const user = await User.findOne({ email }).select('+password')
      .populate('class', 'name level arm')
      .populate('subjects', 'name code');

    if (!user) {
      return sendError(res, 401, 'Invalid credentials');
    }

    if (!user.isActive) {
      return sendError(res, 403, 'Your account has been suspended. Contact admin.');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return sendError(res, 401, 'Invalid credentials');
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id, user.role);

    return sendSuccess(res, 200, 'Login successful', {
      token,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved,
        isActive: user.isActive,
        class: user.class,
        subjects: user.subjects,
        lastLogin: user.lastLogin
      }
    });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── Get Current User (me) ───────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('class', 'name level arm')
      .populate('subjects', 'name code');

    return sendSuccess(res, 200, 'User fetched', { user });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── Change Password ─────────────────────────────────────────────────────────
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return sendError(res, 400, 'Both current and new password are required');
    }

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return sendError(res, 400, 'Current password is incorrect');
    }

    user.password = newPassword;
    await user.save();

    return sendSuccess(res, 200, 'Password changed successfully');
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};
