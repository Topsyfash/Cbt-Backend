const ExamAttempt = require('../models/ExamAttempt.model');
const ViolationLog = require('../models/ViolationLog.model');
const Exam = require('../models/Exam.model');
const Question = require('../models/Question.model');
const { sendSuccess, sendError } = require('../utils/response.utils');

// ─── Shuffle array (Fisher-Yates) ─────────────────────────────────────────────
const shuffleArray = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ─── Grade attempt helper ─────────────────────────────────────────────────────
const gradeAttempt = async (attempt, exam) => {
  const questions = await Question.find({ exam: exam._id });
  const qMap = {};
  questions.forEach(q => { qMap[q._id.toString()] = q; });

  let score = 0;
  const gradedAnswers = attempt.answers.map(ans => {
    const q = qMap[ans.question.toString()];
    if (!q) return ans;
    const isCorrect = ans.selected && ans.selected === q.correctAnswer;
    const marksObtained = isCorrect ? q.marks : 0;
    score += marksObtained;
    return { ...ans.toObject(), isCorrect, marksObtained };
  });

  const percentage = exam.totalMarks > 0 ? Math.round((score / exam.totalMarks) * 100 * 10) / 10 : 0;
  const isPassed = percentage >= (exam.passMark || 50);

  return { gradedAnswers, score, percentage, isPassed };
};

// ─── START EXAM ───────────────────────────────────────────────────────────────
exports.startExam = async (req, res) => {
  try {
    const { examId } = req.params;
    const student = req.user;

    const exam = await Exam.findById(examId).populate('subject', 'name').populate('class', 'name');
    if (!exam) return sendError(res, 404, 'Exam not found');
    if (!exam.isPublished) return sendError(res, 400, 'This exam is not available');

    // Class check
    if (!student.class || student.class.toString() !== exam.class._id.toString()) {
      return sendError(res, 403, 'This exam is not assigned to your class');
    }

    // Time window check
    const now = new Date();
    if (exam.startTime && now < exam.startTime) {
      return sendError(res, 400, 'Exam has not started yet');
    }
    if (exam.endTime && now > exam.endTime) {
      return sendError(res, 400, 'Exam window has closed');
    }

    // Existing attempt check
    const existingAttempt = await ExamAttempt.findOne({ student: student._id, exam: examId });
    if (existingAttempt) {
      if (existingAttempt.status === 'in_progress') {
        // Resume — return existing attempt and questions
        const questions = await Question.find({ _id: { $in: existingAttempt.questionOrder } })
          .select('-correctAnswer -explanation');

        // Sort by stored order
        const orderMap = {};
        existingAttempt.questionOrder.forEach((id, idx) => { orderMap[id.toString()] = idx; });
        questions.sort((a, b) => orderMap[a._id.toString()] - orderMap[b._id.toString()]);

        const elapsed = Math.floor((now - existingAttempt.startedAt) / 1000);
        const remaining = Math.max(0, exam.duration * 60 - elapsed);

        return sendSuccess(res, 200, 'Resuming existing attempt', {
          attempt: existingAttempt,
          questions,
          remaining,
          exam: { title: exam.title, duration: exam.duration, instructions: exam.instructions, totalMarks: exam.totalMarks }
        });
      }

      if (!exam.allowRetake) {
        return sendError(res, 400, 'You have already attempted this exam');
      }
    }

    // Fetch questions and optionally randomize
    let questions = await Question.find({ exam: examId });
    if (questions.length === 0) return sendError(res, 400, 'This exam has no questions');

    const orderedQuestions = exam.randomizeQuestions ? shuffleArray(questions) : questions;

    // Create answers skeleton
    const answers = orderedQuestions.map(q => ({
      question: q._id,
      selected: null,
      isCorrect: false,
      marksObtained: 0
    }));

    const attempt = await ExamAttempt.create({
      student: student._id,
      exam: examId,
      answers,
      questionOrder: orderedQuestions.map(q => q._id),
      startedAt: now,
      status: 'in_progress'
    });

    // Strip answers from questions sent to student
    const safeQuestions = orderedQuestions.map(q => {
      const obj = q.toObject();
      delete obj.correctAnswer;
      delete obj.explanation;
      return obj;
    });

    return sendSuccess(res, 200, 'Exam started', {
      attempt: { _id: attempt._id, startedAt: attempt.startedAt, answers: attempt.answers },
      questions: safeQuestions,
      remaining: exam.duration * 60,
      exam: { title: exam.title, duration: exam.duration, instructions: exam.instructions, totalMarks: exam.totalMarks }
    });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── SAVE ANSWER (auto-save) ──────────────────────────────────────────────────
exports.saveAnswer = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { questionId, selected } = req.body;

    const attempt = await ExamAttempt.findOne({ _id: attemptId, student: req.user._id });
    if (!attempt) return sendError(res, 404, 'Attempt not found');
    if (attempt.status !== 'in_progress') return sendError(res, 400, 'Exam already submitted');

    // Check time hasn't expired
    const exam = await Exam.findById(attempt.exam);
    const elapsed = Math.floor((Date.now() - attempt.startedAt) / 1000);
    if (elapsed > exam.duration * 60 + 30) { // 30s grace
      attempt.status = 'auto_submitted';
      await attempt.save();
      return sendError(res, 400, 'Exam time has expired');
    }

    // Update specific answer
    const answerIndex = attempt.answers.findIndex(a => a.question.toString() === questionId);
    if (answerIndex === -1) return sendError(res, 400, 'Question not in this attempt');

    attempt.answers[answerIndex].selected = selected;
    attempt.markModified('answers');
    await attempt.save();

    return sendSuccess(res, 200, 'Answer saved');
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── SUBMIT EXAM ──────────────────────────────────────────────────────────────
exports.submitExam = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const isAutoSubmit = req.body.autoSubmit === true;

    const attempt = await ExamAttempt.findOne({ _id: attemptId, student: req.user._id });
    if (!attempt) return sendError(res, 404, 'Attempt not found');
    if (attempt.status !== 'in_progress') return sendError(res, 400, 'Exam already submitted');

    const exam = await Exam.findById(attempt.exam);

    // Grade it
    const { gradedAnswers, score, percentage, isPassed } = await gradeAttempt(attempt, exam);

    const now = new Date();
    attempt.answers = gradedAnswers;
    attempt.score = score;
    attempt.percentage = percentage;
    attempt.isPassed = isPassed;
    attempt.submittedAt = now;
    attempt.status = isAutoSubmit ? 'auto_submitted' : 'submitted';
    attempt.timeTaken = Math.floor((now - attempt.startedAt) / 1000);

    await attempt.save();

    const responseData = {
      attempt: {
        _id: attempt._id,
        score: attempt.score,
        percentage: attempt.percentage,
        isPassed: attempt.isPassed,
        status: attempt.status,
        timeTaken: attempt.timeTaken,
        violations: attempt.violations
      }
    };

    // Include detailed result if configured
    if (exam.showResultsImmediately) {
      await attempt.populate([
        { path: 'answers.question', select: 'questionText options correctAnswer explanation marks' }
      ]);
      responseData.detail = attempt.answers;
    }

    return sendSuccess(res, 200, 'Exam submitted successfully', responseData);
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── LOG VIOLATION ────────────────────────────────────────────────────────────
exports.logViolation = async (req, res) => {
  try {
    const { attemptId, type, details } = req.body;

    const attempt = await ExamAttempt.findOne({ _id: attemptId, student: req.user._id });
    if (!attempt) return sendError(res, 404, 'Attempt not found');
    if (attempt.status !== 'in_progress') return res.status(200).json({ success: true });

    await ViolationLog.create({
      student: req.user._id,
      exam: attempt.exam,
      attempt: attempt._id,
      type,
      details
    });

    attempt.violations += 1;
    await attempt.save();

    // Auto-submit after 3 violations (configurable)
    const MAX_VIOLATIONS = 5;
    if (attempt.violations >= MAX_VIOLATIONS) {
      const exam = await Exam.findById(attempt.exam);
      const { gradedAnswers, score, percentage, isPassed } = await gradeAttempt(attempt, exam);

      attempt.answers = gradedAnswers;
      attempt.score = score;
      attempt.percentage = percentage;
      attempt.isPassed = isPassed;
      attempt.submittedAt = new Date();
      attempt.status = 'auto_submitted';
      attempt.timeTaken = Math.floor((Date.now() - attempt.startedAt) / 1000);
      await attempt.save();

      return sendSuccess(res, 200, 'Exam auto-submitted due to violations', { autoSubmitted: true });
    }

    return sendSuccess(res, 200, 'Violation logged', { violations: attempt.violations, remaining: MAX_VIOLATIONS - attempt.violations });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── GET MY ATTEMPTS ──────────────────────────────────────────────────────────
exports.getMyAttempts = async (req, res) => {
  try {
    const attempts = await ExamAttempt.find({ student: req.user._id })
      .populate({ path: 'exam', select: 'title duration totalMarks passMark', populate: { path: 'subject', select: 'name' } })
      .sort({ createdAt: -1 });

    return sendSuccess(res, 200, 'Attempts fetched', { attempts });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── GET SINGLE ATTEMPT DETAIL ────────────────────────────────────────────────
exports.getAttemptDetail = async (req, res) => {
  try {
    const attempt = await ExamAttempt.findById(req.params.id)
      .populate('student', 'fullName email admissionNumber')
      .populate({ path: 'exam', populate: [{ path: 'subject', select: 'name code' }, { path: 'class', select: 'name level' }] })
      .populate('answers.question', 'questionText options correctAnswer explanation marks');

    if (!attempt) return sendError(res, 404, 'Attempt not found');

    // Students can only view own attempts
    if (req.user.role === 'student' && attempt.student._id.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'Not authorized');
    }

    return sendSuccess(res, 200, 'Attempt fetched', { attempt });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};
