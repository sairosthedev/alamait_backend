const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const User = require('../src/models/User');

async function fixUserSignedLease() {
  try {
    console.log('=== Fixing User Signed Lease Record ===\n');
    
    // The user ID from your S3 path
    const userId = '6861b5906e4adda437638081';
    
    // The S3 URL from your message
    const s3Url = 'https://alamait-uploads.s3.amazonaws.com/signed_leases/6861b5906e4adda437638081_1751243741706_ST%20Kilda%20Boarding%20Agreement%20Kudzai%5B1%5D.pdf';
    
    console.log('Updating user:', userId);
    console.log('With S3 URL:', s3Url);
    
    // Update the user record
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        signedLeasePath: s3Url,
        signedLeaseUploadDate: new Date()
      },
      { new: true }
    );
    
    if (!updatedUser) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('✅ User updated successfully');
    console.log('Updated user:', {
      id: updatedUser._id,
      name: `${updatedUser.firstName} ${updatedUser.lastName}`,
      email: updatedUser.email,
      signedLeasePath: updatedUser.signedLeasePath,
      signedLeaseUploadDate: updatedUser.signedLeaseUploadDate
    });
    
    // Verify the update
    console.log('\n=== Verifying Update ===');
    const verifyUser = await User.findById(userId);
    console.log('Verification - signedLeasePath:', verifyUser.signedLeasePath);
    console.log('Verification - signedLeaseUploadDate:', verifyUser.signedLeaseUploadDate);
    
    // Test the API endpoints
    console.log('\n=== Testing API Endpoints ===');
    try {
      const axios = require('axios');
      
      // You'll need to get a valid token for testing
      console.log('To test the API endpoints, you need to:');
      console.log('1. Get a valid student token for this user');
      console.log('2. Call GET /api/student/signed-leases');
      console.log('3. Call GET /api/admin/students/all-signed-leases (with admin token)');
      
    } catch (error) {
      console.log('❌ Error testing API:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error fixing user signed lease:', error);
  } finally {
    mongoose.connection.close();
  }
}

fixUserSignedLease(); 