const User = require('../models/User.model');
const { sendSuccess, sendError } = require('../utils/response.utils');

// ─── Get all users (admin) ───────────────────────────────────────────────────
exports.getAllUsers = async (req, res) => {
  try {
    const { role, isApproved, page = 1, limit = 20, search } = req.query;

    const filter = {};
    if (role) filter.role = role;
    if (isApproved !== undefined) filter.isApproved = isApproved === 'true';
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email:    { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      User.find(filter)
        .populate('class', 'name level arm')
        .populate('subjects', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(filter)
    ]);

    return sendSuccess(res, 200, 'Users fetched', {
      users,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── Get single user ─────────────────────────────────────────────────────────
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('class', 'name level arm')
      .populate('subjects', 'name code');

    if (!user) return sendError(res, 404, 'User not found');
    return sendSuccess(res, 200, 'User fetched', { user });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── Create teacher (admin only) ─────────────────────────────────────────────
exports.createTeacher = async (req, res) => {
  try {
    const { fullName, email, password, subjects } = req.body;

    const exists = await User.findOne({ email });
    if (exists) return sendError(res, 400, 'Email already registered');

    const teacher = await User.create({
      fullName,
      email,
      password,
      role: 'teacher',
      subjects: subjects || []
    });

    return sendSuccess(res, 201, 'Teacher created successfully', {
      user: { _id: teacher._id, fullName: teacher.fullName, email: teacher.email, role: teacher.role }
    });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── Approve / Reject student ────────────────────────────────────────────────
exports.approveStudent = async (req, res) => {
  try {
    const { approve } = req.body;  // boolean
    const user = await User.findById(req.params.id);

    if (!user) return sendError(res, 404, 'User not found');
    if (user.role !== 'student') return sendError(res, 400, 'Only students need approval');

    user.isApproved = !!approve;
    await user.save();

    const msg = approve ? 'Student approved successfully' : 'Student rejected/unapproved';
    return sendSuccess(res, 200, msg, { user });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── Suspend / Activate user ─────────────────────────────────────────────────
exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return sendError(res, 404, 'User not found');

    user.isActive = !user.isActive;
    await user.save();

    return sendSuccess(res, 200, `User ${user.isActive ? 'activated' : 'suspended'}`, { user });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── Assign class to student ─────────────────────────────────────────────────
exports.assignClass = async (req, res) => {
  try {
    const { classId } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) return sendError(res, 404, 'User not found');
    if (user.role !== 'student') return sendError(res, 400, 'Only students can be assigned to a class');

    user.class = classId;
    await user.save();
    await user.populate('class', 'name level arm');

    return sendSuccess(res, 200, 'Class assigned successfully', { user });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── Assign subjects to teacher ──────────────────────────────────────────────
exports.assignSubjectsToTeacher = async (req, res) => {
  try {
    const { subjectIds } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) return sendError(res, 404, 'User not found');
    if (user.role !== 'teacher') return sendError(res, 400, 'Only teachers can be assigned subjects');

    user.subjects = subjectIds;
    await user.save();
    await user.populate('subjects', 'name code');

    return sendSuccess(res, 200, 'Subjects assigned', { user });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── Update user profile ─────────────────────────────────────────────────────
exports.updateUser = async (req, res) => {
  try {
    const allowedFields = ['fullName', 'admissionNumber', 'profileImage'];
    const updates = {};
    allowedFields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!user) return sendError(res, 404, 'User not found');

    return sendSuccess(res, 200, 'User updated', { user });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── Delete user ─────────────────────────────────────────────────────────────
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return sendError(res, 404, 'User not found');
    return sendSuccess(res, 200, 'User deleted successfully');
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};
