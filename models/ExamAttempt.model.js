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
      question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
      selected:  { type: String, default: null },  // option label chosen
      isCorrect: { type: Boolean, default: false },
      marksObtained: { type: Number, default: 0 }
    }
  ],
  questionOrder: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }], // randomized order
  score: {
    type: Number,
    default: 0
  },
  percentage: {
    type: Number,
    default: 0
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  submittedAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['in_progress', 'submitted', 'auto_submitted', 'abandoned'],
    default: 'in_progress'
  },
  violations: {
    type: Number,
    default: 0
  },
  isPassed: {
    type: Boolean,
    default: false
  },
  timeTaken: {
    type: Number,   // seconds
    default: null
  }
}, { timestamps: true });

// One active attempt per student per exam (unless retake allowed)
examAttemptSchema.index({ student: 1, exam: 1 });

module.exports = mongoose.model('ExamAttempt', examAttemptSchema);
