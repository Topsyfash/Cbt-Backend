const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Class name is required'],
    trim: true
  },
  level: {
    type: String,
    required: [true, 'Class level is required'],
    trim: true
  },
  arm: {
    type: String,
    trim: true,
    default: null  // e.g. "A", "B", "Gold"
  },
  classTeacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Virtual: full class display name
classSchema.virtual('displayName').get(function () {
  return this.arm ? `${this.name} ${this.arm}` : this.name;
});

module.exports = mongoose.model('Class', classSchema);
