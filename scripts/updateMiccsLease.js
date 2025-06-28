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

// Update Miccs's lease record
const updateMiccsLease = async () => {
  try {
    await connectDB();
    
    console.log('🔧 Updating Miccs lease record...');
    
    // Find Miccs's lease record
    const lease = await Lease.findById('685d914536237048a58fac53');
    
    if (!lease) {
      console.log('❌ Lease record not found');
      return;
    }
    
    console.log(`Current path: ${lease.path}`);
    console.log(`Filename: ${lease.filename}`);
    console.log(`Student: ${lease.studentName}`);
    
    // Update with the correct S3 URL
    const s3Url = 'https://alamait-uploads.s3.amazonaws.com/leases/ST%20Kilda%20Boarding%20Agreement%20signed%20miccs.pdf';
    
    lease.path = s3Url;
    await lease.save();
    
    console.log('✅ Miccs lease record updated successfully!');
    console.log(`New S3 URL: ${s3Url}`);
    
  } catch (error) {
    console.error('Error updating Miccs lease record:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
};

// Run the script
if (require.main === module) {
  updateMiccsLease();
}

module.exports = { updateMiccsLease }; 