require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Application = require('../src/models/Application');
const Residence = require('../src/models/Residence');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  // Find all applications with a student reference that no longer exists
  const applications = await Application.find({}).lean();
  let fixed = 0;

  for (const app of applications) {
    if (app.student) {
      const user = await User.findById(app.student);
      if (!user) {
        // Update application status
        await Application.updateOne(
          { _id: app._id },
          { $set: { status: 'expired', rejectionReason: 'User deleted' } }
        );

        // Update room in residence
        if (app.residence && app.allocatedRoom) {
          const residence = await Residence.findById(app.residence);
          if (residence) {
            const room = residence.rooms.find(r => r.roomNumber === app.allocatedRoom);
            if (room) {
              room.currentOccupancy = Math.max(0, (room.currentOccupancy || 1) - 1);
              if (room.currentOccupancy === 0) {
                room.status = 'available';
              } else if (room.currentOccupancy < room.capacity) {
                room.status = 'reserved';
              } else {
                room.status = 'occupied';
              }
              await residence.save();
              fixed++;
              console.log(`Fixed room ${room.roomNumber} in residence ${residence.name}`);
            }
          }
        }
      }
    }
  }

  console.log(`Done! Fixed ${fixed} rooms/applications.`);
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
}); 