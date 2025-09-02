const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Application = require('../src/models/Application');

async function debugDateCalculation() {
  try {
    console.log('🔍 Debugging date calculation...\n');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');
    
    // Get the application with dates
    const application = await Application.findOne({
      applicationCode: 'APP1755644723526ND7D7'
    });
    
    if (!application) {
      console.log('❌ Application not found');
      return;
    }
    
    console.log('📋 Application Details:');
    console.log(`   Code: ${application.applicationCode}`);
    console.log(`   Name: ${application.firstName} ${application.lastName}`);
    console.log(`   Start Date: ${application.startDate}`);
    console.log(`   End Date: ${application.endDate}`);
    console.log(`   Start Date Type: ${typeof application.startDate}`);
    console.log(`   End Date Type: ${typeof application.endDate}`);
    
    if (application.startDate && application.endDate) {
      const startDate = new Date(application.startDate);
      const endDate = new Date(application.endDate);
      
      console.log('\n📅 Parsed Dates:');
      console.log(`   Start Date: ${startDate.toISOString()}`);
      console.log(`   End Date: ${endDate.toISOString()}`);
      console.log(`   Start Date Object: ${startDate}`);
      console.log(`   End Date Object: ${endDate}`);
      
      // Calculate months difference
      const yearDiff = endDate.getFullYear() - startDate.getFullYear();
      const monthDiff = endDate.getMonth() - startDate.getMonth();
      const totalMonths = (yearDiff * 12) + monthDiff;
      
      console.log('\n🧮 Month Calculation:');
      console.log(`   Year Difference: ${yearDiff}`);
      console.log(`   Month Difference: ${monthDiff}`);
      console.log(`   Total Months: ${totalMonths}`);
      
      // Alternative calculation
      const timeDiff = endDate.getTime() - startDate.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
      const monthsDiff = Math.ceil(daysDiff / 30.44);
      
      console.log('\n📊 Alternative Calculations:');
      console.log(`   Time Difference (ms): ${timeDiff}`);
      console.log(`   Days Difference: ${daysDiff}`);
      console.log(`   Months Difference (30.44 days): ${monthsDiff}`);
      
      // Check if dates are valid
      console.log('\n✅ Date Validation:');
      console.log(`   Start Date Valid: ${!isNaN(startDate.getTime())}`);
      console.log(`   End Date Valid: ${!isNaN(endDate.getTime())}`);
      console.log(`   Start Date > End Date: ${startDate > endDate}`);
    } else {
      console.log('❌ Missing start or end dates');
    }
    
  } catch (error) {
    console.error('❌ Error debugging date calculation:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the script
debugDateCalculation();











