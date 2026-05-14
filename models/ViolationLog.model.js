const mongoose = require('mongoose');

const violationLogSchema = new mongoose.Schema({
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
  attempt: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamAttempt',
    required: true
  },
  type: {
    type: String,
    enum: ['tab_switch', 'copy_attempt', 'fullscreen_exit', 'right_click', 'window_blur', 'auto_submitted'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  details: {
    type: String,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('ViolationLog', violationLogSchema);
