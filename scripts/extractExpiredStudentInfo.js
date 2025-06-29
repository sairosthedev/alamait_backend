const mongoose = require('mongoose');
const ExpiredStudent = require('../src/models/ExpiredStudent');

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

// Extract name and email from expired students
const extractExpiredStudentInfo = async () => {
  try {
    await connectDB();
    
    console.log('🔍 Extracting name and email from expired students...');
    
    // Find all expired students
    const expiredStudents = await ExpiredStudent.find({}).lean();
    
    console.log(`Found ${expiredStudents.length} expired student records`);
    
    const extractedInfo = expiredStudents.map(expired => {
      const info = {
        expiredStudentId: expired._id,
        reason: expired.reason,
        archivedAt: expired.archivedAt
      };
      
      // Extract from application data if available
      if (expired.application) {
        info.name = `${expired.application.firstName || ''} ${expired.application.lastName || ''}`.trim();
        info.email = expired.application.email;
        info.phone = expired.application.phone;
        info.applicationCode = expired.application.applicationCode;
        info.preferredRoom = expired.application.preferredRoom;
        info.allocatedRoom = expired.application.allocatedRoom;
        info.status = expired.application.status;
        info.paymentStatus = expired.application.paymentStatus;
        info.startDate = expired.application.startDate;
        info.endDate = expired.application.endDate;
      }
      
      // Extract from student data if available
      if (expired.student) {
        info.studentName = `${expired.student.firstName || ''} ${expired.student.lastName || ''}`.trim();
        info.studentEmail = expired.student.email;
        info.studentPhone = expired.student.phone;
      }
      
      return info;
    });
    
    // Display the extracted information
    console.log('\n📋 Extracted Information:');
    console.log('='.repeat(80));
    
    extractedInfo.forEach((info, index) => {
      console.log(`\n${index + 1}. Expired Student Record:`);
      console.log(`   ID: ${info.expiredStudentId}`);
      console.log(`   Reason: ${info.reason}`);
      console.log(`   Archived: ${info.archivedAt}`);
      
      if (info.name) {
        console.log(`   Name: ${info.name}`);
        console.log(`   Email: ${info.email}`);
        console.log(`   Phone: ${info.phone}`);
        console.log(`   Application Code: ${info.applicationCode}`);
        console.log(`   Preferred Room: ${info.preferredRoom}`);
        console.log(`   Allocated Room: ${info.allocatedRoom}`);
        console.log(`   Status: ${info.status}`);
        console.log(`   Payment Status: ${info.paymentStatus}`);
        console.log(`   Start Date: ${info.startDate}`);
        console.log(`   End Date: ${info.endDate}`);
      }
      
      if (info.studentName) {
        console.log(`   Student Name: ${info.studentName}`);
        console.log(`   Student Email: ${info.studentEmail}`);
        console.log(`   Student Phone: ${info.studentPhone}`);
      }
    });
    
    // Save to JSON file for easy access
    const fs = require('fs');
    const outputPath = './expired_students_info.json';
    fs.writeFileSync(outputPath, JSON.stringify(extractedInfo, null, 2));
    console.log(`\n💾 Data saved to: ${outputPath}`);
    
    // Summary statistics
    const withApplication = extractedInfo.filter(info => info.name).length;
    const withStudent = extractedInfo.filter(info => info.studentName).length;
    
    console.log('\n📊 Summary:');
    console.log(`Total expired records: ${expiredStudents.length}`);
    console.log(`Records with application data: ${withApplication}`);
    console.log(`Records with student data: ${withStudent}`);
    
  } catch (error) {
    console.error('Error extracting expired student info:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
};

// Run the script
extractExpiredStudentInfo(); 