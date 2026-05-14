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
  options: {
    type: [
      {
        label: { type: String, required: true },  // "A", "B", "C", "D"
        text:  { type: String, required: true }
      }
    ],
    validate: {
      validator: (v) => v.length >= 2 && v.length <= 6,
      message: 'A question must have between 2 and 6 options'
    }
  },
  correctAnswer: {
    type: String,   // matches option label e.g. "A"
    required: [true, 'Correct answer is required']
  },
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
    type: String,   // image URL/path
    default: null
  },
  order: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model('Question', questionSchema);
