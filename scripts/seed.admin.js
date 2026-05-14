/**
 * Seed script — creates the initial admin account.
 * Run once: node scripts/seed.admin.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User.model');

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const existing = await User.findOne({ role: 'admin' });
    if (existing) {
      console.log('Admin already exists:', existing.email);
      process.exit(0);
    }

    const admin = await User.create({
      fullName: 'Regina Mundi',
      email: 'admin@regina.com',
      password: 'Admin@regina',
      role: 'admin',
      isApproved: true,
      isActive: true
    });

    console.log('✅ Admin created successfully');
    console.log('   Email:    ', admin.email);
    console.log('   Password:  Admin@1234');
    console.log('   ⚠️  Please change the password after first login!');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err.message);
    process.exit(1);
  }
};

seedAdmin();
