const express = require('express');
const router = express.Router();
const {
  addQuestion, bulkAddQuestions, getExamQuestions,
  updateQuestion, deleteQuestion
} = require('../controllers/questionController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(protect);

// All question routes scoped to an exam
router.post('/exam/:examId',       authorize('teacher', 'admin'), upload.single('image'), addQuestion);
router.post('/exam/:examId/bulk',  authorize('teacher', 'admin'), bulkAddQuestions);
router.get('/exam/:examId',        authorize('teacher', 'admin'), getExamQuestions);

router.put('/:id',     authorize('teacher', 'admin'), upload.single('image'), updateQuestion);
router.delete('/:id',  authorize('teacher', 'admin'), deleteQuestion);

module.exports = router;
