const ExamAttempt = require('../models/ExamAttempt.model');
const ViolationLog = require('../models/ViolationLog.model');
const Exam = require('../models/Exam.model');
const { sendSuccess, sendError } = require('../utils/response.utils');

// ─── Student: get own results ─────────────────────────────────────────────────
exports.getMyResults = async (req, res) => {
  try {
    const attempts = await ExamAttempt.find({
      student: req.user._id,
      status: { $in: ['submitted', 'auto_submitted'] }
    })
      .populate({
        path: 'exam',
        select: 'title duration totalMarks passMark showResultsImmediately',
        populate: { path: 'subject', select: 'name code' }
      })
      .sort({ submittedAt: -1 });

    return sendSuccess(res, 200, 'Results fetched', { attempts });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── Teacher: get results for a specific exam ─────────────────────────────────
exports.getExamResults = async (req, res) => {
  try {
    const { examId } = req.params;
    const { page = 1, limit = 30 } = req.query;

    const exam = await Exam.findById(examId);
    if (!exam) return sendError(res, 404, 'Exam not found');

    if (req.user.role === 'teacher' && exam.teacher.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'Not authorized');
    }

    const skip = (page - 1) * limit;
    const [attempts, total] = await Promise.all([
      ExamAttempt.find({ exam: examId, status: { $in: ['submitted', 'auto_submitted'] } })
        .populate('student', 'fullName email admissionNumber class')
        .sort({ score: -1 })
        .skip(skip)
        .limit(Number(limit)),
      ExamAttempt.countDocuments({ exam: examId, status: { $in: ['submitted', 'auto_submitted'] } })
    ]);

    // Compute stats
    const all = await ExamAttempt.find({ exam: examId, status: { $in: ['submitted', 'auto_submitted'] } });
    const scores = all.map(a => a.percentage);
    const avg = scores.length ? (scores.reduce((s, x) => s + x, 0) / scores.length).toFixed(1) : 0;
    const highest = scores.length ? Math.max(...scores) : 0;
    const lowest = scores.length ? Math.min(...scores) : 0;
    const passed = all.filter(a => a.isPassed).length;

    return sendSuccess(res, 200, 'Exam results fetched', {
      exam: { title: exam.title, totalMarks: exam.totalMarks, passMark: exam.passMark },
      stats: { total, avg, highest, lowest, passed, failed: total - passed },
      attempts,
      pagination: { total, page: Number(page), limit: Number(limit) }
    });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── Teacher: get results for a class ────────────────────────────────────────
exports.getClassResults = async (req, res) => {
  try {
    const { classId } = req.params;

    const exams = await Exam.find({ class: classId, teacher: req.user._id });
    const examIds = exams.map(e => e._id);

    const attempts = await ExamAttempt.find({ exam: { $in: examIds }, status: { $in: ['submitted', 'auto_submitted'] } })
      .populate('student', 'fullName email admissionNumber')
      .populate({ path: 'exam', select: 'title totalMarks' });

    return sendSuccess(res, 200, 'Class results fetched', { attempts });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── Get violation logs for an exam ──────────────────────────────────────────
exports.getViolationLogs = async (req, res) => {
  try {
    const { examId } = req.params;
    const exam = await Exam.findById(examId);
    if (!exam) return sendError(res, 404, 'Exam not found');

    if (req.user.role === 'teacher' && exam.teacher.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'Not authorized');
    }

    const logs = await ViolationLog.find({ exam: examId })
      .populate('student', 'fullName email admissionNumber')
      .sort({ timestamp: -1 });

    return sendSuccess(res, 200, 'Violation logs fetched', { logs });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── Rankings for an exam ─────────────────────────────────────────────────────
exports.getExamRankings = async (req, res) => {
  try {
    const { examId } = req.params;

    const attempts = await ExamAttempt.find({
      exam: examId,
      status: { $in: ['submitted', 'auto_submitted'] }
    })
      .populate('student', 'fullName admissionNumber')
      .sort({ score: -1, timeTaken: 1 });

    const rankings = attempts.map((a, i) => ({
      rank: i + 1,
      student: a.student,
      score: a.score,
      percentage: a.percentage,
      isPassed: a.isPassed,
      timeTaken: a.timeTaken
    }));

    return sendSuccess(res, 200, 'Rankings fetched', { rankings });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};
