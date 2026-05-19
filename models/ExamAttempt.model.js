const mongoose = require('mongoose');

const examAttemptSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  answers: [
    {
      question:      { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
      // MCQ
      selected:      { type: String,  default: null },
      isCorrect:     { type: Boolean, default: false },
      // Open-ended
      openAnswer:    { type: String,  default: null },   // student's written answer
      teacherScore:  { type: Number,  default: null },   // marks awarded by teacher
      teacherFeedback: { type: String, default: null },  // optional teacher comment
      isGraded:      { type: Boolean, default: false },  // teacher has scored this answer
      // Common
      marksObtained: { type: Number,  default: 0 }
    }
  ],
  questionOrder: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
  score:      { type: Number,  default: 0 },
  mcqScore:   { type: Number,  default: 0 },  // auto-graded portion
  openScore:  { type: Number,  default: 0 },  // teacher-graded portion
  percentage: { type: Number,  default: 0 },
  startedAt:  { type: Date,    default: Date.now },
  submittedAt:{ type: Date,    default: null },
  status: {
    type: String,
    enum: ['in_progress', 'submitted', 'auto_submitted', 'abandoned', 'pending_review'],
    default: 'in_progress'
  },
  // Grading status for open-ended
  gradingStatus: {
    type: String,
    enum: ['not_required', 'pending', 'graded'],
    default: 'not_required'
  },
  violations: { type: Number, default: 0 },
  isPassed:   { type: Boolean, default: false },
  timeTaken:  { type: Number,  default: null }
}, { timestamps: true });

examAttemptSchema.index({ student: 1, exam: 1 });

module.exports = mongoose.model('ExamAttempt', examAttemptSchema);