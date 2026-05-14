const Exam = require('../models/Exam.model');
const Question = require('../models/Question.model');
const ExamAttempt = require('../models/ExamAttempt.model');
const { sendSuccess, sendError } = require('../utils/response.utils');

// ─── Create Exam ─────────────────────────────────────────────────────────────
exports.createExam = async (req, res) => {
  try {
    const exam = await Exam.create({ ...req.body, teacher: req.user._id });
    return sendSuccess(res, 201, 'Exam created', { exam });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── Get all exams (teacher sees own; admin sees all) ─────────────────────────
exports.getAllExams = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'teacher') filter.teacher = req.user._id;

    const exams = await Exam.find(filter)
      .populate('subject', 'name code')
      .populate('class', 'name level arm')
      .populate('teacher', 'fullName email')
      .sort({ createdAt: -1 });

    return sendSuccess(res, 200, 'Exams fetched', { exams });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── Get exams available to a student ────────────────────────────────────────
exports.getStudentExams = async (req, res) => {
  try {
    const student = req.user;

    if (!student.class) {
      return sendError(res, 400, 'You have not been assigned to a class yet');
    }

    const now = new Date();
    const filter = {
      class: student.class,
      isPublished: true,
      $or: [
        { startTime: null },
        { startTime: { $lte: now }, endTime: { $gte: now } },
        { startTime: { $lte: now }, endTime: null }
      ]
    };

    const exams = await Exam.find(filter)
      .populate('subject', 'name code')
      .populate('teacher', 'fullName')
      .sort({ createdAt: -1 });

    // Attach attempt status for each exam
    const examIds = exams.map(e => e._id);
    const attempts = await ExamAttempt.find({ student: student._id, exam: { $in: examIds } })
      .select('exam status score percentage');

    const attemptMap = {};
    attempts.forEach(a => { attemptMap[a.exam.toString()] = a; });

    const examsWithStatus = exams.map(e => ({
      ...e.toObject(),
      attempt: attemptMap[e._id.toString()] || null
    }));

    return sendSuccess(res, 200, 'Exams fetched', { exams: examsWithStatus });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── Get single exam ─────────────────────────────────────────────────────────
exports.getExamById = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id)
      .populate('subject', 'name code')
      .populate('class', 'name level arm')
      .populate('teacher', 'fullName email');

    if (!exam) return sendError(res, 404, 'Exam not found');

    // Teachers can only access their own exams
    if (req.user.role === 'teacher' && exam.teacher._id.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'Not authorized to view this exam');
    }

    const questionCount = await Question.countDocuments({ exam: exam._id });

    return sendSuccess(res, 200, 'Exam fetched', { exam, questionCount });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── Update exam ─────────────────────────────────────────────────────────────
exports.updateExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return sendError(res, 404, 'Exam not found');

    if (req.user.role === 'teacher' && exam.teacher.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'Not authorized');
    }

    // Prevent editing a live exam that has attempts
    const attemptCount = await ExamAttempt.countDocuments({ exam: exam._id, status: 'in_progress' });
    if (attemptCount > 0) {
      return sendError(res, 400, 'Cannot edit an exam with active attempts');
    }

    const updated = await Exam.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    return sendSuccess(res, 200, 'Exam updated', { exam: updated });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── Toggle publish ───────────────────────────────────────────────────────────
exports.togglePublish = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return sendError(res, 404, 'Exam not found');

    if (req.user.role === 'teacher' && exam.teacher.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'Not authorized');
    }

    // Ensure questions exist before publishing
    if (!exam.isPublished) {
      const qCount = await Question.countDocuments({ exam: exam._id });
      if (qCount === 0) return sendError(res, 400, 'Add at least one question before publishing');
    }

    exam.isPublished = !exam.isPublished;
    await exam.save();

    return sendSuccess(res, 200, `Exam ${exam.isPublished ? 'published' : 'unpublished'}`, { exam });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── Delete exam ─────────────────────────────────────────────────────────────
exports.deleteExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return sendError(res, 404, 'Exam not found');

    if (req.user.role === 'teacher' && exam.teacher.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'Not authorized');
    }

    await Question.deleteMany({ exam: exam._id });
    await ExamAttempt.deleteMany({ exam: exam._id });
    await exam.deleteOne();

    return sendSuccess(res, 200, 'Exam and all related data deleted');
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};
