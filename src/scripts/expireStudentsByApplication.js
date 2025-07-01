const mongoose = require('mongoose');
require('dotenv').config();
const { handleExpiredApplications } = require('../utils/applicationUtils');

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');
    await handleExpiredApplications();
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB. Application expiry process complete.');
  } catch (error) {
    console.error('Error expiring students by application:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
} 