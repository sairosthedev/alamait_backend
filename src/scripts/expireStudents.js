const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');
const Application = require('../models/Application');
const Payment = require('../models/Payment');
const Lease = require('../models/Lease');
const ExpiredStudent = require('../models/ExpiredStudent');

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    // Find all students with a lease end date in the past
    const now = new Date();
    // Find all users with role student and a lease that has ended
    const expiredLeases = await Lease.find({ endDate: { $lte: now } });
    const expiredStudentIds = expiredLeases.map(l => l.studentId.toString());
    if (expiredStudentIds.length === 0) {
      console.log('No expired students found.');
      await mongoose.disconnect();
      return;
    }
    const expiredStudents = await User.find({ _id: { $in: expiredStudentIds }, role: 'student' });
    console.log(`Found ${expiredStudents.length} students with expired leases.`);

    for (const student of expiredStudents) {
      // Get all applications for this student
      const applications = await Application.find({ $or: [ { student: student._id }, { email: student.email } ] });
      // Get all payments for this student
      const payments = await Payment.find({ student: student._id });
      // Get all leases for this student
      const leases = await Lease.find({ studentId: student._id });

      // Archive the student
      const expiredDoc = new ExpiredStudent({
        student: student.toObject(),
        application: applications.length > 0 ? applications[0].toObject() : null,
        previousApplicationCode: student.applicationCode || (applications[0] && applications[0].applicationCode),
        reason: 'Lease expired',
        paymentHistory: payments.map(p => p.toObject()),
        leases: leases.map(l => l.toObject()),
      });
      await expiredDoc.save();
      console.log(`Archived student ${student.firstName} ${student.lastName} (${student.email})`);

      // Delete the student from the User collection
      await User.deleteOne({ _id: student._id });
      console.log(`Deleted student ${student.email} from User collection.`);
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB. Expiry process complete.');
  } catch (error) {
    console.error('Error expiring students:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
} 