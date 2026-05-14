const User = require('../models/User.model');
const Exam = require('../models/Exam.model');
const ExamAttempt = require('../models/ExamAttempt.model');
const ViolationLog = require('../models/ViolationLog.model');
const { sendSuccess, sendError } = require('../utils/response.utils');

// ─── Admin: global analytics ──────────────────────────────────────────────────
exports.getAdminAnalytics = async (req, res) => {
  try {
    const [
      totalStudents, pendingStudents, totalTeachers, totalAdmins,
      totalExams, publishedExams, totalAttempts, completedAttempts,
      recentAttempts
    ] = await Promise.all([
      User.countDocuments({ role: 'student', isActive: true }),
      User.countDocuments({ role: 'student', isApproved: false }),
      User.countDocuments({ role: 'teacher', isActive: true }),
      User.countDocuments({ role: 'admin' }),
      Exam.countDocuments(),
      Exam.countDocuments({ isPublished: true }),
      ExamAttempt.countDocuments(),
      ExamAttempt.countDocuments({ status: { $in: ['submitted', 'auto_submitted'] } }),
      ExamAttempt.find({ status: { $in: ['submitted', 'auto_submitted'] } })
        .sort({ submittedAt: -1 })
        .limit(10)
        .populate('student', 'fullName')
        .populate({ path: 'exam', select: 'title', populate: { path: 'subject', select: 'name' } })
    ]);

    // Average score across all completed attempts
    const scoreAgg = await ExamAttempt.aggregate([
      { $match: { status: { $in: ['submitted', 'auto_submitted'] } } },
      { $group: { _id: null, avgPercentage: { $avg: '$percentage' }, passCount: { $sum: { $cond: ['$isPassed', 1, 0] } } } }
    ]);
    const avgPercentage = scoreAgg[0] ? Math.round(scoreAgg[0].avgPercentage * 10) / 10 : 0;
    const passCount = scoreAgg[0] ? scoreAgg[0].passCount : 0;

    return sendSuccess(res, 200, 'Analytics fetched', {
      users: { totalStudents, pendingStudents, totalTeachers, totalAdmins },
      exams: { totalExams, publishedExams, activeExams: publishedExams },
      attempts: { totalAttempts, completedAttempts, inProgressAttempts: totalAttempts - completedAttempts },
      performance: { avgPercentage, passCount, failCount: completedAttempts - passCount },
      recentAttempts
    });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── Teacher: analytics for their exams ──────────────────────────────────────
exports.getTeacherAnalytics = async (req, res) => {
  try {
    const teacherId = req.user._id;

    const exams = await Exam.find({ teacher: teacherId });
    const examIds = exams.map(e => e._id);

    const [totalAttempts, completedAttempts, scoreAgg] = await Promise.all([
      ExamAttempt.countDocuments({ exam: { $in: examIds } }),
      ExamAttempt.countDocuments({ exam: { $in: examIds }, status: { $in: ['submitted', 'auto_submitted'] } }),
      ExamAttempt.aggregate([
        { $match: { exam: { $in: examIds }, status: { $in: ['submitted', 'auto_submitted'] } } },
        { $group: { _id: '$exam', avgScore: { $avg: '$percentage' }, count: { $sum: 1 }, passCount: { $sum: { $cond: ['$isPassed', 1, 0] } } } }
      ])
    ]);

    // Merge exam info with score stats
    const examMap = {};
    exams.forEach(e => { examMap[e._id.toString()] = e; });

    const examStats = scoreAgg.map(s => ({
      exam: examMap[s._id.toString()],
      avgScore: Math.round(s.avgScore * 10) / 10,
      total: s.count,
      passed: s.passCount,
      failed: s.count - s.passCount
    }));

    return sendSuccess(res, 200, 'Teacher analytics fetched', {
      totalExams: exams.length,
      publishedExams: exams.filter(e => e.isPublished).length,
      totalAttempts,
      completedAttempts,
      examStats
    });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── Student: personal performance analytics ──────────────────────────────────
exports.getStudentAnalytics = async (req, res) => {
  try {
    const studentId = req.user._id;

    const attempts = await ExamAttempt.find({
      student: studentId,
      status: { $in: ['submitted', 'auto_submitted'] }
    }).populate({ path: 'exam', populate: { path: 'subject', select: 'name' } });

    const totalAttempts = attempts.length;
    const passed = attempts.filter(a => a.isPassed).length;
    const avgScore = totalAttempts ? (attempts.reduce((s, a) => s + a.percentage, 0) / totalAttempts).toFixed(1) : 0;
    const highest = totalAttempts ? Math.max(...attempts.map(a => a.percentage)) : 0;

    // Performance by subject
    const subjectMap = {};
    attempts.forEach(a => {
      if (!a.exam || !a.exam.subject) return;
      const key = a.exam.subject.name;
      if (!subjectMap[key]) subjectMap[key] = { total: 0, sum: 0 };
      subjectMap[key].total += 1;
      subjectMap[key].sum += a.percentage;
    });

    const subjectPerformance = Object.entries(subjectMap).map(([subject, data]) => ({
      subject,
      attempts: data.total,
      avgScore: Math.round((data.sum / data.total) * 10) / 10
    }));

    return sendSuccess(res, 200, 'Student analytics fetched', {
      totalAttempts,
      passed,
      failed: totalAttempts - passed,
      passRate: totalAttempts ? Math.round((passed / totalAttempts) * 100) : 0,
      avgScore,
      highest,
      subjectPerformance,
      recentAttempts: attempts.slice(0, 5)
    });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};
