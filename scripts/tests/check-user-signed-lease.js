const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const User = require('./src/models/User');

async function checkUserSignedLease() {
  try {
    console.log('=== Checking User Signed Lease Records ===\n');
    
    // Find the specific user by ID (replace with the actual user ID)
    const userId = '6861b5906e4adda437638081'; // This should be the user ID from your S3 path
    
    console.log('Looking for user with ID:', userId);
    
    const user = await User.findById(userId);
    
    if (!user) {
      console.log('❌ User not found with ID:', userId);
      return;
    }
    
    console.log('✅ User found:', {
      id: user._id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      role: user.role
    });
    
    console.log('\n=== Signed Lease Information ===');
    console.log('signedLeasePath:', user.signedLeasePath);
    console.log('signedLeaseUploadDate:', user.signedLeaseUploadDate);
    
    if (user.signedLeasePath) {
      console.log('✅ User has a signed lease path');
      
      // Check if the S3 URL is accessible
      console.log('\n=== Testing S3 URL Accessibility ===');
      try {
        const axios = require('axios');
        const response = await axios.get(user.signedLeasePath, {
          timeout: 10000,
          validateStatus: function (status) {
            return status < 500;
          }
        });
        console.log('✅ S3 URL is accessible');
        console.log('   Status:', response.status);
        console.log('   Content-Type:', response.headers['content-type']);
        console.log('   Content-Length:', response.headers['content-length']);
      } catch (error) {
        console.log('❌ S3 URL not accessible:', error.message);
        if (error.response) {
          console.log('   Status:', error.response.status);
        }
      }
    } else {
      console.log('❌ User does not have a signed lease path');
    }
    
    console.log('\n=== All Users with Signed Leases ===');
    const usersWithSignedLeases = await User.find({
      signedLeasePath: { $exists: true, $ne: null }
    }).select('_id firstName lastName email signedLeasePath signedLeaseUploadDate');
    
    console.log(`Found ${usersWithSignedLeases.length} users with signed leases:`);
    usersWithSignedLeases.forEach((user, index) => {
      console.log(`${index + 1}. ${user.firstName} ${user.lastName} (${user.email})`);
      console.log(`   Path: ${user.signedLeasePath}`);
      console.log(`   Upload Date: ${user.signedLeaseUploadDate}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking user signed lease:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkUserSignedLease(); 