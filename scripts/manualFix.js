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

// Manual fix for specific lease
const manualFix = async () => {
  try {
    await connectDB();
    
    console.log('🔧 Manual fix for specific lease record...');
    
    // Find and update the specific lease record
    const lease = await Lease.findById('685e8dc2a79798715afd1f08');
    
    if (!lease) {
      console.log('❌ Lease record not found');
      return;
    }
    
    console.log(`Current path: ${lease.path}`);
    
    // Set path to null since the file doesn't exist
    lease.path = null;
    await lease.save();
    
    console.log('✅ Lease record updated - path set to null');
    console.log('The student will need to re-upload this file.');
    
  } catch (error) {
    console.error('Error in manual fix:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
};

// Run the script
if (require.main === module) {
  manualFix();
}

module.exports = { manualFix }; 