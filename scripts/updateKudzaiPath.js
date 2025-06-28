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

// Update Kudzai's lease path
const updateKudzaiPath = async () => {
  try {
    await connectDB();
    
    console.log('🔧 Updating Kudzai lease path...');
    
    // Find Kudzai's lease record
    const lease = await Lease.findById('685e8dc2a79798715afd1f08');
    
    if (!lease) {
      console.log('❌ Lease record not found');
      return;
    }
    
    console.log(`Current path: ${lease.path}`);
    console.log(`Student: ${lease.studentName}`);
    
    // Update with the correct S3 URL including region
    const s3Url = 'https://alamait-uploads.s3.eu-north-1.amazonaws.com/leases/ST%20Kilda%20Boarding%20Agreement%20Kudzai%5B1%5D.pdf';
    
    lease.path = s3Url;
    await lease.save();
    
    console.log('✅ Kudzai lease path updated successfully!');
    console.log(`New S3 URL: ${s3Url}`);
    
  } catch (error) {
    console.error('Error updating Kudzai lease path:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
};

// Run the script
if (require.main === module) {
  updateKudzaiPath();
}

module.exports = { updateKudzaiPath }; 