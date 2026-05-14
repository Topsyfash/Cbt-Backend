const express = require('express');
const router = express.Router();
const {
  getAllUsers, getUserById, createTeacher, approveStudent,
  toggleUserStatus, assignClass, assignSubjectsToTeacher,
  updateUser, deleteUser
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All user routes require auth
router.use(protect);

// Admin-only routes
router.get('/', authorize('admin'), getAllUsers);
router.post('/teacher', authorize('admin'), createTeacher);
router.patch('/:id/approve', authorize('admin'), approveStudent);
router.patch('/:id/toggle-status', authorize('admin'), toggleUserStatus);
router.patch('/:id/assign-class', authorize('admin'), assignClass);
router.patch('/:id/assign-subjects', authorize('admin'), assignSubjectsToTeacher);
router.delete('/:id', authorize('admin'), deleteUser);

// Admin or self
router.get('/:id', authorize('admin', 'teacher'), getUserById);
router.put('/:id', authorize('admin'), updateUser);

module.exports = router;
