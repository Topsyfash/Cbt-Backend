const express = require('express');
const router = express.Router();
const {
  startExam, saveAnswer, saveOpenAnswer, submitExam,
  logViolation, getMyAttempts, getAttemptDetail,
  gradeOpenAnswer, getPendingGrading
} = require('../controllers/attemptController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

// Student routes
router.post('/start/:examId',            authorize('student'), startExam);
router.patch('/:attemptId/answer',       authorize('student'), saveAnswer);
router.patch('/:attemptId/open-answer',  authorize('student'), saveOpenAnswer);
router.post('/:attemptId/submit',        authorize('student'), submitExam);
router.post('/violation',                authorize('student'), logViolation);
router.get('/my',                        authorize('student'), getMyAttempts);

// Teacher routes
router.get('/pending-grading',           authorize('teacher', 'admin'), getPendingGrading);
router.patch('/:attemptId/grade/:questionId', authorize('teacher', 'admin'), gradeOpenAnswer);

// Shared
router.get('/:id', getAttemptDetail);

module.exports = router; 