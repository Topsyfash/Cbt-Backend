const express = require('express');
const router = express.Router();
const {
  getMyResults, getExamResults, getClassResults,
  getViolationLogs, getExamRankings
} = require('../controllers/resultController');
const { protect, authorize, requireApproval } = require('../middleware/authMiddleware');

router.use(protect);

// Student
router.get('/me',              requireApproval, authorize('student'), getMyResults);

// Teacher / Admin
router.get('/exam/:examId',          authorize('teacher', 'admin'), getExamResults);
router.get('/class/:classId',        authorize('teacher', 'admin'), getClassResults);
router.get('/exam/:examId/violations', authorize('teacher', 'admin'), getViolationLogs);
router.get('/exam/:examId/rankings',   authorize('teacher', 'admin', 'student'), getExamRankings);

module.exports = router;
