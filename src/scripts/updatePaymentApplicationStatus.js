const mongoose = require('mongoose');
require('dotenv').config();
const Payment = require('../models/Payment');
const Application = require('../models/Application');

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    const payments = await Payment.find({});
    let updated = 0;
    for (const payment of payments) {
      if (!payment.student) continue;
      // Find the latest application for this student
      const application = await Application.findOne({ student: payment.student }).sort({ updatedAt: -1 });
      let status = 'expired'; // Default to 'expired' if no application found
      if (application && application.status) {
        status = application.status;
      }
      if (payment.applicationStatus !== status) {
        payment.applicationStatus = status;
        await payment.save();
        updated++;
        console.log(`Updated payment ${payment._id} for student ${payment.student} to status ${status}`);
      }
    }
    console.log(`Updated ${updated} payments with application status.`);
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  } catch (error) {
    console.error('Error updating payment application statuses:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
} 