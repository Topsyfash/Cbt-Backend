const ExamAttempt = require('../models/ExamAttempt.model');
const ViolationLog = require('../models/ViolationLog.model');
const Exam = require('../models/Exam.model');
const Question = require('../models/Question.model');
const { sendSuccess, sendError } = require('../utils/response.utils');

const shuffleArray = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Grade MCQ answers only — open-ended are graded by teacher separately
const gradeAttempt = async (attempt, exam) => {
  const questions = await Question.find({ exam: exam._id });
  const qMap = {};
  questions.forEach(q => { qMap[q._id.toString()] = q; });

  let mcqScore = 0;
  let mcqTotal = 0;
  let openTotal = 0;
  let hasOpenEnded = false;

  const gradedAnswers = attempt.answers.map(ans => {
    const q = qMap[ans.question.toString()];
    if (!q) return ans;

    if (q.questionType === 'open_ended') {
      hasOpenEnded = true;
      openTotal += q.marks;
      // Open-ended: keep existing teacherScore if already graded
      return {
        ...ans.toObject(),
        marksObtained: ans.teacherScore ?? 0,
        isGraded: ans.isGraded ?? false
      };
    }

    // MCQ: auto-grade
    mcqTotal += q.marks;
    const isCorrect = !!ans.selected && ans.selected === q.correctAnswer;
    const marksObtained = isCorrect ? q.marks : 0;
    mcqScore += marksObtained;
    return { ...ans.toObject(), isCorrect, marksObtained };
  });

  const openScore = gradedAnswers
    .filter(a => {
      const q = qMap[a.question?.toString()];
      return q?.questionType === 'open_ended';
    })
    .reduce((s, a) => s + (a.teacherScore ?? 0), 0);

  const totalScore = mcqScore + openScore;
  const percentage = exam.totalMarks > 0
    ? Math.round((totalScore / exam.totalMarks) * 100 * 10) / 10
    : 0;
  const isPassed = !hasOpenEnded
    ? percentage >= (exam.passMark || 50)
    : false; // can't determine pass/fail until open-ended graded

  return { gradedAnswers, mcqScore, openScore, totalScore, percentage, isPassed, hasOpenEnded };
};

// ─── START EXAM ───────────────────────────────────────────────────────────────
exports.startExam = async (req, res) => {
  try {
    const { examId } = req.params;
    const student = req.user;

    const exam = await Exam.findById(examId)
      .populate('subject', 'name')
      .populate('class', 'name');
    if (!exam) return sendError(res, 404, 'Exam not found');
    if (!exam.isPublished) return sendError(res, 400, 'This exam is not available');

    if (!student.class || student.class.toString() !== exam.class._id.toString())
      return sendError(res, 403, 'This exam is not assigned to your class');

    const now = new Date();
    if (exam.startTime && now < exam.startTime) return sendError(res, 400, 'Exam has not started yet');
    if (exam.endTime   && now > exam.endTime)   return sendError(res, 400, 'Exam window has closed');

    // Check for existing attempt — resume if in_progress, retake if allowed, block otherwise
    const existingAttempt = await ExamAttempt.findOne(
      { student: student._id, exam: examId },
      null,
      { sort: { createdAt: -1 } }  // most recent first
    );

    if (existingAttempt) {
      if (existingAttempt.status === 'in_progress') {
        const elapsed   = Math.floor((now - existingAttempt.startedAt) / 1000);
        const remaining = exam.duration * 60 - elapsed;

        // Time expired while student was away — auto-submit now
        if (remaining <= 0) {
          const { gradedAnswers, mcqScore, openScore, totalScore, percentage, isPassed, hasOpenEnded } =
            await gradeAttempt(existingAttempt, exam);
          existingAttempt.answers       = gradedAnswers;
          existingAttempt.mcqScore      = mcqScore;
          existingAttempt.openScore     = openScore;
          existingAttempt.score         = totalScore;
          existingAttempt.percentage    = percentage;
          existingAttempt.isPassed      = isPassed;
          existingAttempt.submittedAt   = now;
          existingAttempt.timeTaken     = Math.floor((now - existingAttempt.startedAt) / 1000);
          existingAttempt.status        = 'auto_submitted';
          existingAttempt.gradingStatus = hasOpenEnded ? 'pending' : 'not_required';
          await existingAttempt.save();
          return sendError(res, 400,
            'Your exam time expired while you were away. Your answers have been submitted automatically.');
        }

        // Resume — send exact same questions in same order with all saved answers
        const questions = await Question.find({ _id: { $in: existingAttempt.questionOrder } })
          .select('-correctAnswer -explanation -sampleAnswer');
        const orderMap = {};
        existingAttempt.questionOrder.forEach((id, idx) => { orderMap[id.toString()] = idx; });
        questions.sort((a, b) => orderMap[a._id.toString()] - orderMap[b._id.toString()]);

        return sendSuccess(res, 200, 'Resuming existing attempt', {
          attempt: existingAttempt,
          questions,
          remaining: Math.max(0, remaining),
          exam: { title: exam.title, duration: exam.duration, instructions: exam.instructions, totalMarks: exam.totalMarks }
        });
      }

      // Attempt exists but is already submitted
      if (!exam.allowRetake) {
        return sendError(res, 400, 'You have already attempted this exam');
      }
      // allowRetake is true — fall through and create a fresh attempt
    }

    // Fetch all questions — MCQs randomized separately, open-ended always last
    let allQuestions = await Question.find({ exam: examId });
    if (allQuestions.length === 0) return sendError(res, 400, 'This exam has no questions');

    const mcqQuestions  = allQuestions.filter(q => q.questionType !== 'open_ended');
    const openQuestions = allQuestions.filter(q => q.questionType === 'open_ended');

    const orderedMcq  = exam.randomizeQuestions ? shuffleArray(mcqQuestions) : mcqQuestions;
    const orderedQuestions = [...orderedMcq, ...openQuestions]; // open-ended always at end

    const answers = orderedQuestions.map(q => ({
      question: q._id,
      selected: null,
      openAnswer: null,
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

    const safeQuestions = orderedQuestions.map(q => {
      const obj = q.toObject();
      delete obj.correctAnswer;
      delete obj.explanation;
      delete obj.sampleAnswer;
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

// ─── SAVE ANSWER (MCQ) ────────────────────────────────────────────────────────
exports.saveAnswer = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { questionId, selected } = req.body;

    const attempt = await ExamAttempt.findOne({ _id: attemptId, student: req.user._id });
    if (!attempt) return sendError(res, 404, 'Attempt not found');
    if (attempt.status !== 'in_progress') return sendError(res, 400, 'Exam already submitted');

    const exam = await Exam.findById(attempt.exam);
    const elapsed = Math.floor((Date.now() - attempt.startedAt) / 1000);
    if (elapsed > exam.duration * 60 + 30) {
      attempt.status = 'auto_submitted';
      await attempt.save();
      return sendError(res, 400, 'Exam time has expired');
    }

    const idx = attempt.answers.findIndex(a => a.question.toString() === questionId);
    if (idx === -1) return sendError(res, 400, 'Question not in this attempt');

    attempt.answers[idx].selected = selected;
    attempt.markModified('answers');
    await attempt.save();
    return sendSuccess(res, 200, 'Answer saved');
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── SAVE OPEN-ENDED ANSWER ───────────────────────────────────────────────────
exports.saveOpenAnswer = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { questionId, openAnswer } = req.body;

    const attempt = await ExamAttempt.findOne({ _id: attemptId, student: req.user._id });
    if (!attempt) return sendError(res, 404, 'Attempt not found');
    if (attempt.status !== 'in_progress') return sendError(res, 400, 'Exam already submitted');

    const idx = attempt.answers.findIndex(a => a.question.toString() === questionId);
    if (idx === -1) return sendError(res, 400, 'Question not in this attempt');

    attempt.answers[idx].openAnswer = openAnswer;
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
    const { gradedAnswers, mcqScore, openScore, totalScore, percentage, isPassed, hasOpenEnded } = await gradeAttempt(attempt, exam);

    const now = new Date();
    attempt.answers = gradedAnswers;
    attempt.mcqScore = mcqScore;
    attempt.openScore = openScore;
    attempt.score = totalScore;
    attempt.percentage = percentage;
    attempt.isPassed = isPassed;
    attempt.submittedAt = now;
    attempt.timeTaken = Math.floor((now - attempt.startedAt) / 1000);
    attempt.gradingStatus = hasOpenEnded ? 'pending' : 'not_required';
    attempt.status = isAutoSubmit ? 'auto_submitted' : (hasOpenEnded ? 'pending_review' : 'submitted');

    await attempt.save();

    const responseData = {
      attempt: {
        _id: attempt._id,
        score: attempt.score,
        mcqScore: attempt.mcqScore,
        openScore: attempt.openScore,
        percentage: attempt.percentage,
        isPassed: attempt.isPassed,
        status: attempt.status,
        gradingStatus: attempt.gradingStatus,
        timeTaken: attempt.timeTaken,
        violations: attempt.violations
      }
    };

    if (exam.showResultsImmediately) {
      await attempt.populate([
        { path: 'answers.question', select: 'questionText options correctAnswer explanation marks questionType wordLimit image sampleAnswer' }
      ]);
      responseData.detail = attempt.answers;
    }

    return sendSuccess(res, 200, 'Exam submitted successfully', responseData);
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── TEACHER GRADES AN OPEN-ENDED ANSWER ─────────────────────────────────────
exports.gradeOpenAnswer = async (req, res) => {
  try {
    const { attemptId, questionId } = req.params;
    const { teacherScore, teacherFeedback } = req.body;

    const attempt = await ExamAttempt.findById(attemptId)
      .populate('exam');
    if (!attempt) return sendError(res, 404, 'Attempt not found');

    // Verify teacher owns this exam
    if (req.user.role === 'teacher' &&
        attempt.exam.teacher.toString() !== req.user._id.toString())
      return sendError(res, 403, 'Not authorized to grade this attempt');

    const question = await Question.findById(questionId);
    if (!question) return sendError(res, 404, 'Question not found');
    if (teacherScore > question.marks)
      return sendError(res, 400, `Score cannot exceed ${question.marks} marks`);

    const idx = attempt.answers.findIndex(a => a.question.toString() === questionId);
    if (idx === -1) return sendError(res, 400, 'Question not in this attempt');

    attempt.answers[idx].teacherScore   = teacherScore;
    attempt.answers[idx].teacherFeedback = teacherFeedback || null;
    attempt.answers[idx].marksObtained  = teacherScore;
    attempt.answers[idx].isGraded       = true;
    attempt.markModified('answers');

    // Recalculate total score
    const allGraded = attempt.answers
      .filter(a => {
        const isOpen = !a.selected && a.openAnswer !== undefined;
        return isOpen;
      })
      .every(a => a.isGraded);

    // Only sum scores from answers that have been teacher-graded (open-ended)
    const openScore = attempt.answers
      .filter(a => a.isGraded === true)
      .reduce((s, a) => s + (a.teacherScore ?? 0), 0);

    attempt.openScore  = openScore;
    attempt.score      = attempt.mcqScore + openScore;
    attempt.percentage = attempt.exam.totalMarks > 0
      ? Math.round((attempt.score / attempt.exam.totalMarks) * 100 * 10) / 10
      : 0;

    // Check if ALL open-ended answers (identified by questionType) are now graded
    // We check by questionId — populate is not available here so use the isGraded flag approach:
    // An answer is open-ended if it has no 'selected' MCQ value but has an openAnswer or was left blank
    const openEndedAnswers = attempt.answers.filter(a => {
      // If selected is null/undefined and the answer slot exists, treat as open-ended candidate
      // More reliable: check if teacherScore field was ever set (undefined = MCQ, null/number = open)
      return a.selected === null || a.selected === undefined;
    });
    const allOpenGraded = openEndedAnswers.length > 0 && openEndedAnswers.every(a => a.isGraded);

    if (allOpenGraded) {
      attempt.gradingStatus = 'graded';
      attempt.isPassed = attempt.percentage >= (attempt.exam.passMark || 50);
      if (attempt.status === 'pending_review') attempt.status = 'submitted';
    }

    await attempt.save();
    return sendSuccess(res, 200, 'Answer graded', { attempt });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─── GET ATTEMPTS PENDING GRADING (teacher) ───────────────────────────────────
exports.getPendingGrading = async (req, res) => {
  try {
    const examIds = await Exam.find({ teacher: req.user._id }).select('_id');
    const attempts = await ExamAttempt.find({
      exam: { $in: examIds.map(e => e._id) },
      gradingStatus: 'pending'
    })
      .populate('student', 'fullName email')
      .populate({ path: 'exam', select: 'title totalMarks passMark subject', populate: { path: 'subject', select: 'name' } })
      // Populate answers.question so the grading modal can read questionType, marks, sampleAnswer etc.
      .populate('answers.question', 'questionText questionType marks sampleAnswer wordLimit')
      .sort({ submittedAt: 1 });

    return sendSuccess(res, 200, 'Pending attempts fetched', { attempts });
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

    await ViolationLog.create({ student: req.user._id, exam: attempt.exam, attempt: attempt._id, type, details });
    attempt.violations += 1;
    await attempt.save();

    const MAX_VIOLATIONS = 5;
    if (attempt.violations >= MAX_VIOLATIONS) {
      const exam = await Exam.findById(attempt.exam);
      const { gradedAnswers, mcqScore, openScore, totalScore, percentage, isPassed, hasOpenEnded } = await gradeAttempt(attempt, exam);
      attempt.answers = gradedAnswers;
      attempt.mcqScore = mcqScore; attempt.openScore = openScore;
      attempt.score = totalScore; attempt.percentage = percentage; attempt.isPassed = isPassed;
      attempt.submittedAt = new Date();
      attempt.status = 'auto_submitted';
      attempt.gradingStatus = hasOpenEnded ? 'pending' : 'not_required';
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
      .populate('answers.question', 'questionText options correctAnswer explanation marks questionType wordLimit image sampleAnswer');

    if (!attempt) return sendError(res, 404, 'Attempt not found');
    if (req.user.role === 'student' && attempt.student._id.toString() !== req.user._id.toString())
      return sendError(res, 403, 'Not authorized');

    return sendSuccess(res, 200, 'Attempt fetched', { attempt });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};