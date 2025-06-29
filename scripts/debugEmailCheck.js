const mongoose = require('mongoose');
const User = require('../src/models/User');
const Application = require('../src/models/Application');
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

// Debug email check
const debugEmailCheck = async () => {
  try {
    await connectDB();
    
    // Test emails from the user's issue
    const testEmails = ['kudzaipemhiwa@gmail.com', 'kudzaicindyrellapemhiwa@gmail.com'];
    
    for (const email of testEmails) {
      console.log(`\n🔍 Checking email: ${email}`);
      
      // Check Users collection
      const user = await User.findOne({ email: email.toLowerCase() });
      console.log('User found:', user ? 'YES' : 'NO');
      if (user) {
        console.log('User details:', {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        });
      }
      
      // Check Applications collection
      const applications = await Application.find({ email: email.toLowerCase() });
      console.log('Applications found:', applications.length);
      applications.forEach((app, index) => {
        console.log(`Application ${index + 1}:`, {
          _id: app._id,
          status: app.status,
          firstName: app.firstName,
          lastName: app.lastName,
          applicationDate: app.applicationDate,
          paymentStatus: app.paymentStatus
        });
      });
      
      // Check active applications (the ones that cause "used: true")
      const activeApps = await Application.find({ 
        email: email.toLowerCase(), 
        status: { $in: ['pending', 'approved', 'waitlisted'] } 
      });
      console.log('Active applications (pending/approved/waitlisted):', activeApps.length);
      activeApps.forEach((app, index) => {
        console.log(`Active App ${index + 1}:`, {
          _id: app._id,
          status: app.status,
          firstName: app.firstName,
          lastName: app.lastName
        });
      });
      
      // Check ExpiredStudent collection
      const expired = await ExpiredStudent.findOne({ 'student.email': email.toLowerCase() });
      console.log('Expired student found:', expired ? 'YES' : 'NO');
      if (expired) {
        console.log('Expired student details:', {
          _id: expired._id,
          reason: expired.reason,
          studentEmail: expired.student?.email,
          applicationStatus: expired.application?.status
        });
      }
      
      console.log('---');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

debugEmailCheck(); 