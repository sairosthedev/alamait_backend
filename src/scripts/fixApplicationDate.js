/**
 * Script to fix application date for a specific application code
 * 
 * This script updates an application with a future date (2025) to the current date
 * Run with: node src/scripts/fixApplicationDate.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Application = require('../models/Application');

// Application code to fix
const APPLICATION_CODE = 'APP254813';

async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    ('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

async function fixApplicationDate() {
  try {
    // Find the application with the specified code
    const application = await Application.findOne({ applicationCode: APPLICATION_CODE });
    
    if (!application) {
      console.error(`Application with code ${APPLICATION_CODE} not found`);
      return;
    }
    
    ('Found application:', {
      id: application._id,
      email: application.email,
      status: application.status,
      currentDate: application.applicationDate
    });
    
    // Update the application date to current date
    const result = await Application.updateOne(
      { applicationCode: APPLICATION_CODE },
      { $set: { applicationDate: new Date() } }
    );
    
    if (result.modifiedCount === 1) {
      ('Successfully updated application date');
      
      // Verify the update
      const updatedApplication = await Application.findOne({ applicationCode: APPLICATION_CODE });
      ('Updated application date:', updatedApplication.applicationDate);
    } else {
      ('No changes made to the application');
    }
  } catch (error) {
    console.error('Error fixing application date:', error);
  }
}

async function main() {
  await connectToDatabase();
  
  try {
    await fixApplicationDate();
    ('Script completed successfully');
  } catch (error) {
    console.error('Script failed:', error);
  } finally {
    mongoose.connection.close();
    ('MongoDB connection closed');
  }
}

main(); 