const Class = require('../models/Class.model');
const { sendSuccess, sendError } = require('../utils/response.utils');

exports.createClass = async (req, res) => {
  try {
    const classObj = await Class.create(req.body);
    return sendSuccess(res, 201, 'Class created', { class: classObj });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

exports.getAllClasses = async (req, res) => {
  try {
    const classes = await Class.find({ isActive: true })
      .populate('classTeacher', 'fullName email')
      .sort({ level: 1, name: 1 });
    return sendSuccess(res, 200, 'Classes fetched', { classes });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

exports.getClassById = async (req, res) => {
  try {
    const classObj = await Class.findById(req.params.id).populate('classTeacher', 'fullName email');
    if (!classObj) return sendError(res, 404, 'Class not found');
    return sendSuccess(res, 200, 'Class fetched', { class: classObj });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

exports.updateClass = async (req, res) => {
  try {
    const classObj = await Class.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!classObj) return sendError(res, 404, 'Class not found');
    return sendSuccess(res, 200, 'Class updated', { class: classObj });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

exports.deleteClass = async (req, res) => {
  try {
    const classObj = await Class.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!classObj) return sendError(res, 404, 'Class not found');
    return sendSuccess(res, 200, 'Class deleted');
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

exports.assignClassTeacher = async (req, res) => {
  try {
    const { teacherId } = req.body;
    const classObj = await Class.findByIdAndUpdate(
      req.params.id,
      { classTeacher: teacherId },
      { new: true }
    ).populate('classTeacher', 'fullName email');

    if (!classObj) return sendError(res, 404, 'Class not found');
    return sendSuccess(res, 200, 'Class teacher assigned', { class: classObj });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};
