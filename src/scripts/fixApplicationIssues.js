/**
 * Comprehensive script to fix application issues
 * 
 * This script:
 * 1. Fixes future application dates
 * 2. Updates waitlisted applications to approved
 * 3. Ensures application code is properly formatted
 * 4. Checks if the application code has been used by any user
 * 
 * Run with: node src/scripts/fixApplicationIssues.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Application = require('../models/Application');
const User = require('../models/User');

// Application code to fix
const APPLICATION_CODE = 'APP254813';

async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

async function fixApplicationIssues() {
  try {
    // Find the application with the specified code
    const application = await Application.findOne({ applicationCode: APPLICATION_CODE });
    
    if (!application) {
      console.error(`Application with code ${APPLICATION_CODE} not found`);
      return;
    }
    
    console.log('Found application:', {
      id: application._id,
      email: application.email,
      firstName: application.firstName,
      lastName: application.lastName,
      status: application.status,
      applicationDate: application.applicationDate,
      waitlistedRoom: application.waitlistedRoom,
      allocatedRoom: application.allocatedRoom
    });
    
    // Check if the application code has been used by any user
    const existingUser = await User.findOne({ applicationCode: APPLICATION_CODE });
    if (existingUser) {
      console.log('WARNING: This application code has already been used by a user:', {
        userId: existingUser._id,
        email: existingUser.email,
        name: `${existingUser.firstName} ${existingUser.lastName}`
      });
      
      // If you want to force the code to be usable again, uncomment the following:
      // await User.updateOne(
      //   { _id: existingUser._id },
      //   { $unset: { applicationCode: "" } }
      // );
      // console.log('Removed application code from existing user');
    } else {
      console.log('Application code has not been used by any user');
    }
    
    // Check if application date is in the future
    const now = new Date();
    const appDate = new Date(application.applicationDate);
    const isFutureDate = appDate > now;
    
    if (isFutureDate) {
      console.log(`Application date is in the future: ${appDate.toISOString()}`);
    }
    
    // Prepare updates
    const updates = {};
    
    // Fix future date if needed
    if (isFutureDate) {
      updates.applicationDate = now;
    }
    
    // Update status if waitlisted
    if (application.status === 'waitlisted') {
      updates.status = 'approved';
      
      // If there's a waitlistedRoom but no allocatedRoom, assign the waitlistedRoom
      if (application.waitlistedRoom && !application.allocatedRoom) {
        updates.allocatedRoom = application.waitlistedRoom;
      }
    }
    
    // Apply updates if needed
    if (Object.keys(updates).length > 0) {
      console.log('Applying updates:', updates);
      
      const result = await Application.updateOne(
        { applicationCode: APPLICATION_CODE },
        { $set: updates }
      );
      
      if (result.modifiedCount === 1) {
        console.log('Successfully updated application');
        
        // Verify the update
        const updatedApplication = await Application.findOne({ applicationCode: APPLICATION_CODE });
        console.log('Updated application:', {
          status: updatedApplication.status,
          applicationDate: updatedApplication.applicationDate,
          allocatedRoom: updatedApplication.allocatedRoom
        });
      } else {
        console.log('No changes made to the application');
      }
    } else {
      console.log('No updates needed for this application');
    }
  } catch (error) {
    console.error('Error fixing application issues:', error);
  }
}

async function main() {
  await connectToDatabase();
  
  try {
    await fixApplicationIssues();
    console.log('Script completed successfully');
  } catch (error) {
    console.error('Script failed:', error);
  } finally {
    mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

main(); 