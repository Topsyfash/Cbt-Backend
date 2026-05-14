const Question = require('../models/Question.model');
const Exam = require('../models/Exam.model');
const { sendSuccess, sendError } = require('../utils/response.utils');

// ─── Helper: update exam totalMarks ─────────────────────────────────────────
const recalcTotalMarks = async (examId) => {
  const questions = await Question.find({ exam: examId });
  const total = questions.reduce((sum, q) => sum + q.marks, 0);
  await Exam.findByIdAndUpdate(examId, { totalMarks: total });
};

// ─── Add single question ─────────────────────────────────────────────────────
exports.addQuestion = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) return sendError(res, 404, 'Exam not found');

    if (req.user.role === 'teacher' && exam.teacher.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'Not authorized');
    }

    const imageUrl = req.file ? `/uploads/questions/${req.file.filename}` : null;

    const question = await Question.create({
      ...req.body,
      exam: exam._id,
      image: imageUrl,
      options: typeof req.body.options === 'string' ? JSON.parse(req.body.options) : req.body.options
    });

    await recalcTotalMarks(exam._id);

    return sendSuccess(res, 201, 'Question added', { question });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── Bulk add questions ──────────────────────────────────────────────────────
exports.bulkAddQuestions = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) return sendError(res, 404, 'Exam not found');

    if (req.user.role === 'teacher' && exam.teacher.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'Not authorized');
    }

    const { questions } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return sendError(res, 400, 'questions array is required');
    }

    const prepared = questions.map((q, i) => ({ ...q, exam: exam._id, order: i }));
    const created = await Question.insertMany(prepared);

    await recalcTotalMarks(exam._id);

    return sendSuccess(res, 201, `${created.length} questions added`, { count: created.length });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── Get questions for an exam (teacher/admin only, includes answers) ─────────
exports.getExamQuestions = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) return sendError(res, 404, 'Exam not found');

    if (req.user.role === 'teacher' && exam.teacher.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'Not authorized');
    }

    const questions = await Question.find({ exam: exam._id }).sort({ order: 1, createdAt: 1 });
    return sendSuccess(res, 200, 'Questions fetched', { questions, totalMarks: exam.totalMarks });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── Update question ─────────────────────────────────────────────────────────
exports.updateQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id).populate('exam');
    if (!question) return sendError(res, 404, 'Question not found');

    if (req.user.role === 'teacher' && question.exam.teacher.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'Not authorized');
    }

    if (req.body.options && typeof req.body.options === 'string') {
      req.body.options = JSON.parse(req.body.options);
    }
    if (req.file) {
      req.body.image = `/uploads/questions/${req.file.filename}`;
    }

    const updated = await Question.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    await recalcTotalMarks(question.exam._id);

    return sendSuccess(res, 200, 'Question updated', { question: updated });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── Delete question ─────────────────────────────────────────────────────────
exports.deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id).populate('exam');
    if (!question) return sendError(res, 404, 'Question not found');

    if (req.user.role === 'teacher' && question.exam.teacher.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'Not authorized');
    }

    const examId = question.exam._id;
    await question.deleteOne();
    await recalcTotalMarks(examId);

    return sendSuccess(res, 200, 'Question deleted');
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};
