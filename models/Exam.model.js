const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Exam title is required'],
    trim: true
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: [true, 'Subject is required']
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: [true, 'Class is required']
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  duration: {
    type: Number,           // in minutes
    required: [true, 'Duration is required'],
    min: [1, 'Duration must be at least 1 minute']
  },
  instructions: {
    type: String,
    trim: true,
    default: 'Answer all questions carefully.'
  },
  startTime: {
    type: Date,
    default: null           // null = available anytime when published
  },
  endTime: {
    type: Date,
    default: null
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  randomizeQuestions: {
    type: Boolean,
    default: true
  },
  showResultsImmediately: {
    type: Boolean,
    default: true
  },
  allowRetake: {
    type: Boolean,
    default: false
  },
  totalMarks: {
    type: Number,
    default: 0             // auto-computed from questions
  },
  passMark: {
    type: Number,
    default: 50            // percentage
  }
}, { timestamps: true });

module.exports = mongoose.model('Exam', examSchema);
