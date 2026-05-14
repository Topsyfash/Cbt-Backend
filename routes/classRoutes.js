const express = require('express');
const router = express.Router();
const {
  createClass, getAllClasses, getClassById,
  updateClass, deleteClass, assignClassTeacher
} = require('../controllers/classController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/',             getAllClasses);                         // all roles
router.get('/:id',          getAllClasses);
router.post('/',            authorize('admin'), createClass);
router.put('/:id',          authorize('admin'), updateClass);
router.delete('/:id',       authorize('admin'), deleteClass);
router.patch('/:id/assign-teacher', authorize('admin'), assignClassTeacher);

module.exports = router;
