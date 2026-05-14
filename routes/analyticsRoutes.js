const express = require('express');
const router = express.Router();
const {
  getAdminAnalytics, getTeacherAnalytics, getStudentAnalytics
} = require('../controllers/analyticsController');
const { protect, authorize, requireApproval } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/admin',   authorize('admin'), getAdminAnalytics);
router.get('/teacher', authorize('teacher'), getTeacherAnalytics);
router.get('/student', requireApproval, authorize('student'), getStudentAnalytics);

module.exports = router;
