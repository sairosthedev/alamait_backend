/**
 * Script to approve a waitlisted application
 * 
 * This script updates an application status from "waitlisted" to "approved"
 * Run with: node src/scripts/approveApplication.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Application = require('../models/Application');

// Application code to approve
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

async function approveApplication() {
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
      applicationDate: application.applicationDate
    });
    
    if (application.status === 'approved') {
      ('Application is already approved');
      return;
    }
    
    // Update the application status to approved
    const updates = {
      status: 'approved',
      applicationDate: new Date() // Also fix the date while we're at it
    };
    
    // If there's a waitlistedRoom but no allocatedRoom, assign the waitlistedRoom
    if (application.waitlistedRoom && !application.allocatedRoom) {
      updates.allocatedRoom = application.waitlistedRoom;
    }
    
    const result = await Application.updateOne(
      { applicationCode: APPLICATION_CODE },
      { $set: updates }
    );
    
    if (result.modifiedCount === 1) {
      ('Successfully approved application');
      
      // Verify the update
      const updatedApplication = await Application.findOne({ applicationCode: APPLICATION_CODE });
      ('Updated application:', {
        status: updatedApplication.status,
        applicationDate: updatedApplication.applicationDate,
        allocatedRoom: updatedApplication.allocatedRoom
      });
    } else {
      ('No changes made to the application');
    }
  } catch (error) {
    console.error('Error approving application:', error);
  }
}

async function main() {
  await connectToDatabase();
  
  try {
    await approveApplication();
    ('Script completed successfully');
  } catch (error) {
    console.error('Script failed:', error);
  } finally {
    mongoose.connection.close();
    ('MongoDB connection closed');
  }
}

main(); 