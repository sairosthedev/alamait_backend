const mongoose = require('mongoose');
require('dotenv').config();
const Maintenance = require('../models/Maintenance');
const User = require('../models/User');

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    const maintenances = await Maintenance.find({});
    let updatedCount = 0;
    for (const maintenance of maintenances) {
      // Find the student in the same residence and room
      const student = await User.findOne({
        role: 'student',
        residence: maintenance.residence,
        currentRoom: maintenance.room
      });
      if (student && (!maintenance.student || maintenance.student.toString() !== student._id.toString())) {
        maintenance.student = student._id;
        await maintenance.save();
        updatedCount++;
        console.log(`Updated maintenance ${maintenance._id} with student ${student.firstName} ${student.lastName}`);
      }
    }
    console.log(`\nTotal maintenances updated with correct student: ${updatedCount}`);
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    console.log('Maintenance student fix completed successfully!');
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
} 