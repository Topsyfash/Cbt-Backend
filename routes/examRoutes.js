const express = require('express');
const router = express.Router();
const {
  createExam, getAllExams, getStudentExams, getExamById,
  updateExam, togglePublish, deleteExam
} = require('../controllers/examController');
const { protect, authorize, requireApproval } = require('../middleware/authMiddleware');

router.use(protect);

// Student: view available exams
router.get('/student',  requireApproval, authorize('student'), getStudentExams);

// Teacher / Admin
router.get('/',          authorize('teacher', 'admin'), getAllExams);
router.post('/',         authorize('teacher', 'admin'), createExam);
router.get('/:id',       getExamById);
router.put('/:id',       authorize('teacher', 'admin'), updateExam);
router.patch('/:id/publish', authorize('teacher', 'admin'), togglePublish);
router.delete('/:id',    authorize('teacher', 'admin'), deleteExam);

module.exports = router;
