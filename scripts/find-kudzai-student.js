const mongoose = require('mongoose');
const User = require('../src/models/User');
const Application = require('../src/models/Application');

async function findKudzaiStudent() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait', { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    
    console.log('🔍 Finding Kudzai Vella student...');
    
    // Search by name
    const usersByName = await User.find({
      $or: [
        { firstName: { $regex: 'Kudzai', $options: 'i' } },
        { lastName: { $regex: 'Vella', $options: 'i' } }
      ]
    });
    
    console.log('👤 Users found by name:');
    usersByName.forEach((user, index) => {
      console.log('\n' + (index + 1) + '. ' + user._id);
      console.log('   Name: ' + user.firstName + ' ' + user.lastName);
      console.log('   Email: ' + user.email);
      console.log('   Status: ' + user.status);
      console.log('   Created: ' + user.createdAt);
    });
    
    // Search by email
    const usersByEmail = await User.find({
      email: { $regex: 'kudzai', $options: 'i' }
    });
    
    console.log('\n📧 Users found by email:');
    usersByEmail.forEach((user, index) => {
      console.log('\n' + (index + 1) + '. ' + user._id);
      console.log('   Name: ' + user.firstName + ' ' + user.lastName);
      console.log('   Email: ' + user.email);
      console.log('   Status: ' + user.status);
      console.log('   Created: ' + user.createdAt);
    });
    
    // Check applications
    const applications = await Application.find({
      $or: [
        { studentName: { $regex: 'Kudzai', $options: 'i' } },
        { studentName: { $regex: 'Vella', $options: 'i' } }
      ]
    });
    
    console.log('\n📋 Applications found:');
    applications.forEach((app, index) => {
      console.log('\n' + (index + 1) + '. ' + app._id);
      console.log('   Student: ' + app.student);
      console.log('   Student Name: ' + app.studentName);
      console.log('   Status: ' + app.status);
      console.log('   Lease Start: ' + app.leaseStart);
      console.log('   Lease End: ' + app.leaseEnd);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

findKudzaiStudent();


