require('dotenv').config();
require('../src/config/database')();
const Application = require('../src/models/Application');
const User = require('../src/models/User');

async function fixApplications() {
  const applications = await Application.find({ $or: [{ student: { $exists: false } }, { student: null }] });
  for (const app of applications) {
    // Try to find the student by email
    const student = await User.findOne({ email: app.email, role: 'student' });
    if (student) {
      app.student = student._id;
      await app.save();
      console.log(`Linked application ${app.applicationCode} to student ${student.email}`);
    } else {
      console.log(`No student found for application ${app.applicationCode} (${app.email})`);
    }
  }
  process.exit();
}

fixApplications(); 