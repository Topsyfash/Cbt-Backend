const Subject = require('../models/Subject.model');
const { sendSuccess, sendError } = require('../utils/response.utils');

exports.createSubject = async (req, res) => {
  try {
    const subject = await Subject.create(req.body);
    return sendSuccess(res, 201, 'Subject created', { subject });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

exports.getAllSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find({ isActive: true }).sort({ name: 1 });
    return sendSuccess(res, 200, 'Subjects fetched', { subjects });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

exports.getSubjectById = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return sendError(res, 404, 'Subject not found');
    return sendSuccess(res, 200, 'Subject fetched', { subject });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

exports.updateSubject = async (req, res) => {
  try {
    const subject = await Subject.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!subject) return sendError(res, 404, 'Subject not found');
    return sendSuccess(res, 200, 'Subject updated', { subject });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

exports.deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!subject) return sendError(res, 404, 'Subject not found');
    return sendSuccess(res, 200, 'Subject deleted');
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};
