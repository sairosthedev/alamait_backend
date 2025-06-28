const mongoose = require('mongoose');
require('dotenv').config();
const Maintenance = require('../models/Maintenance');
const Residence = require('../models/Residence');
const User = require('../models/User');

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');
    
    const defaultResidence = await Residence.findOne();
    if (!defaultResidence) {
      console.error('No residences found in database.');
      process.exit(1);
    }
    console.log(`Using default residence: ${defaultResidence.name} (${defaultResidence._id})`);

    // Get total count
    const totalMaintenance = await Maintenance.countDocuments();
    console.log(`Total maintenance records: ${totalMaintenance}`);

    // Use native MongoDB operations to avoid Mongoose validation issues
    const db = mongoose.connection.db;
    const maintenanceCollection = db.collection('maintenance');

    // Find records that need residence fix (using native MongoDB query)
    const maintenanceWithoutResidence = await maintenanceCollection.find({
      $or: [
        { residence: { $exists: false } },
        { residence: null },
        { residence: "" }
      ]
    }).toArray();
    
    console.log(`Found ${maintenanceWithoutResidence.length} maintenance records without proper residence`);

    // Update residence for records that need it
    if (maintenanceWithoutResidence.length > 0) {
      const result = await maintenanceCollection.updateMany(
        {
          $or: [
            { residence: { $exists: false } },
            { residence: null },
            { residence: "" }
          ]
        },
        { $set: { residence: defaultResidence._id } }
      );
      console.log(`Updated ${result.modifiedCount} maintenance records with residence`);
    }

    // Handle student field
    const maintenanceWithoutStudent = await maintenanceCollection.find({
      $or: [
        { student: { $exists: false } },
        { student: null },
        { student: "" }
      ]
    }).toArray();
    
    console.log(`Found ${maintenanceWithoutStudent.length} maintenance records without student`);

    if (maintenanceWithoutStudent.length > 0) {
      const defaultStudent = await User.findOne({ role: 'student' });
      if (defaultStudent) {
        const result = await maintenanceCollection.updateMany(
          {
            $or: [
              { student: { $exists: false } },
              { student: null },
              { student: "" }
            ]
          },
          { $set: { student: defaultStudent._id } }
        );
        console.log(`Updated ${result.modifiedCount} maintenance records with student`);
      } else {
        console.log('No students found in database. Cannot set default student.');
      }
    }

    // Final statistics
    const finalCount = await maintenanceCollection.countDocuments();
    const withResidence = await maintenanceCollection.countDocuments({ 
      residence: { $exists: true, $ne: null, $ne: "" } 
    });
    const withStudent = await maintenanceCollection.countDocuments({ 
      student: { $exists: true, $ne: null, $ne: "" } 
    });
    
    console.log('\nFinal Statistics:');
    console.log(`Total maintenance records: ${finalCount}`);
    console.log(`Records with residence: ${withResidence}`);
    console.log(`Records with student: ${withStudent}`);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    console.log('Maintenance fix completed successfully!');
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
} 