const express = require('express');
const router = express.Router();
const {
  startExam, saveAnswer, submitExam, logViolation,
  getMyAttempts, getAttemptDetail
} = require('../controllers/attemptController');
const { protect, authorize, requireApproval } = require('../middleware/authMiddleware');

router.use(protect, requireApproval);

// Student routes
router.post('/start/:examId',            authorize('student'), startExam);
router.patch('/:attemptId/answer',       authorize('student'), saveAnswer);
router.post('/:attemptId/submit',        authorize('student'), submitExam);
router.post('/violation',                authorize('student'), logViolation);
router.get('/my',                        authorize('student'), getMyAttempts);

// Shared (student views own; teacher/admin views any)
router.get('/:id',  getAttemptDetail);

module.exports = router;
