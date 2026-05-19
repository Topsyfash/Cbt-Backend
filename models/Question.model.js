const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: [true, 'Exam reference is required']
  },
  questionText: {
    type: String,
    required: [true, 'Question text is required'],
    trim: true
  },
  // ─── MCQ fields ────────────────────────────────────────────────────────────
  options: {
    type: [
      {
        label: { type: String },
        text:  { type: String }
      }
    ],
    default: []
  },
  correctAnswer: {
    type: String,
    default: null   // null for open-ended
  },
  // ─── Question type ─────────────────────────────────────────────────────────
  questionType: {
    type: String,
    enum: ['mcq', 'open_ended'],
    default: 'mcq'
  },
  // ─── Open-ended fields ──────────────────────────────────────────────────────
  wordLimit: {
    type: Number,
    default: null   // optional max word limit shown to student
  },
  sampleAnswer: {
    type: String,
    default: null   // shown to teacher during grading
  },
  // ─── Common fields ─────────────────────────────────────────────────────────
  marks: {
    type: Number,
    default: 1,
    min: [0.5, 'Marks must be at least 0.5']
  },
  explanation: {
    type: String,
    trim: true,
    default: null
  },
  image: {
    type: String,
    default: null
  },
  order: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model('Question', questionSchema);