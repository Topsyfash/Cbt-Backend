const express = require('express');
const router = express.Router();
const {
  createSubject, getAllSubjects, getSubjectById, updateSubject, deleteSubject
} = require('../controllers/subjectController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/',       getAllSubjects);
router.get('/:id',    getSubjectById);
router.post('/',      authorize('admin'), createSubject);
router.put('/:id',    authorize('admin'), updateSubject);
router.delete('/:id', authorize('admin'), deleteSubject);

module.exports = router;
