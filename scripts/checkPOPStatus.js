const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Payment = require('../src/models/Payment');
const User = require('../src/models/User');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Function to check POP status
const checkPOPStatus = async () => {
  console.log('\n=== Checking Proof of Payment Status ===');
  
  try {
    // Get all payments with POP files
    const payments = await Payment.find({
      'proofOfPayment.fileUrl': { $exists: true, $ne: null }
    }).populate('student', 'firstName lastName email');

    console.log(`Found ${payments.length} payments with POP files`);

    let localUrls = 0;
    let s3Urls = 0;
    let otherUrls = 0;

    console.log('\n=== POP URL Analysis ===');
    
    payments.forEach((payment, index) => {
      const fileUrl = payment.proofOfPayment.fileUrl;
      const fileName = payment.proofOfPayment.fileName;
      const studentName = payment.student ? `${payment.student.firstName} ${payment.student.lastName}` : 'Unknown';
      
      console.log(`\n${index + 1}. Payment ID: ${payment.paymentId}`);
      console.log(`   Student: ${studentName}`);
      console.log(`   File Name: ${fileName}`);
      console.log(`   File URL: ${fileUrl}`);
      
      if (fileUrl.startsWith('/uploads/')) {
        console.log(`   Status: 🔴 Local path`);
        localUrls++;
      } else if (fileUrl.includes('s3.amazonaws.com')) {
        console.log(`   Status: ✅ S3 URL`);
        s3Urls++;
      } else {
        console.log(`   Status: ⚠️  Other URL format`);
        otherUrls++;
      }
    });

    console.log(`\n📊 Summary:`);
    console.log(`🔴 Local URLs: ${localUrls}`);
    console.log(`✅ S3 URLs: ${s3Urls}`);
    console.log(`⚠️  Other URLs: ${otherUrls}`);
    console.log(`📁 Total POP files: ${payments.length}`);

    // Show details of local URLs
    if (localUrls > 0) {
      console.log(`\n=== Local URLs that need migration ===`);
      payments.forEach(payment => {
        if (payment.proofOfPayment.fileUrl.startsWith('/uploads/')) {
          console.log(`   - ${payment.paymentId}: ${payment.proofOfPayment.fileUrl}`);
        }
      });
    }

  } catch (error) {
    console.error('Error checking POP status:', error);
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await checkPOPStatus();
  } catch (error) {
    console.error('Error in main function:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nMongoDB disconnected');
  }
};

// Run the script
if (require.main === module) {
  main();
}

module.exports = { checkPOPStatus }; 