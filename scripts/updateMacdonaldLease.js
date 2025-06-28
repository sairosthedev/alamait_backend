const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Lease = require('../src/models/Lease');

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

// Update Macdonald's lease record
const updateMacdonaldLease = async () => {
  try {
    await connectDB();
    
    console.log('🔧 Updating Macdonald Shoto lease record...');
    
    // Find Macdonald's lease record
    const lease = await Lease.findById('685d813fd4c3b8462e39c57b');
    
    if (!lease) {
      console.log('❌ Lease record not found');
      return;
    }
    
    console.log(`Current path: ${lease.path}`);
    console.log(`Filename: ${lease.filename}`);
    console.log(`Student: ${lease.studentName}`);
    
    // Update with the correct S3 URL based on the S3 console path
    const s3Url = 'https://alamait-uploads.s3.eu-north-1.amazonaws.com/leases/ST%20Kilda%20Boarding%20Agreement1.docx';
    
    lease.path = s3Url;
    await lease.save();
    
    console.log('✅ Macdonald lease record updated successfully!');
    console.log(`New S3 URL: ${s3Url}`);
    
  } catch (error) {
    console.error('Error updating Macdonald lease record:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
};

// Run the script
if (require.main === module) {
  updateMacdonaldLease();
}

module.exports = { updateMacdonaldLease }; 