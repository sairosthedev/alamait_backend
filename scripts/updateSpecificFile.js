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

// Update specific lease record
const updateSpecificLease = async () => {
  try {
    await connectDB();
    
    console.log('🔧 Updating specific lease record...');
    
    // Find the specific lease record
    const lease = await Lease.findById('685e8dc2a79798715afd1f08');
    
    if (!lease) {
      console.log('❌ Lease record not found');
      return;
    }
    
    console.log(`Current path: ${lease.path}`);
    console.log(`Filename: ${lease.filename}`);
    
    // Update with the S3 URL for the manually uploaded file
    const s3Url = 'https://alamait-uploads.s3.amazonaws.com/1751027137588-124355220-1750976070365-485903764-ST%20Kilda%20Boarding%20Agreement%20Kudzai%5B1%5D.pdf';
    
    lease.path = s3Url;
    await lease.save();
    
    console.log('✅ Lease record updated successfully!');
    console.log(`New S3 URL: ${s3Url}`);
    
  } catch (error) {
    console.error('Error updating lease record:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
};

// Run the script
if (require.main === module) {
  updateSpecificLease();
}

module.exports = { updateSpecificLease }; 