/*
 * Check room occupancy and blockers.
 * Usage (PowerShell):
 *   $env:MONGO_URI="<your-uri>"; node scripts/check-room-occupancy.js 67d723cf20f89c4ae69804f3 M7
 */
const mongoose = require('mongoose');

const Room = require('../src/models/Room');
const Application = require('../src/models/Application');
const User = require('../src/models/User');

async function main() {
  const [residenceId, roomNumber] = process.argv.slice(2);
  if (!residenceId || !roomNumber) {
    console.error('Provide residenceId and roomNumber');
    process.exit(1);
  }

  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI not set');
    process.exit(1);
  }

  // Robust connect with retry once
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      console.log(`Connecting to MongoDB (attempt ${attempt})...`);
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
      break;
    } catch (err) {
      console.error('Mongo connect error:', err.message);
      if (attempt === 2) process.exit(1);
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  try {
    const room = await Room.findOne({ residence: residenceId, roomNumber });
    console.log('\nROOM');
    if (!room) {
      console.log('Not found');
    } else {
      const { status, capacity, currentOccupancy } = room;
      console.log({ _id: room._id, roomNumber: room.roomNumber, status, capacity, currentOccupancy });
    }

    // Active applications still holding the room
    const activeStatuses = ['approved', 'pending', 'allocated', 'reserved'];
    const apps = await Application.find({
      residence: residenceId,
      allocatedRoom: roomNumber,
      status: { $in: activeStatuses }
    }).select('student firstName lastName email status allocatedRoom');
    console.log('\nACTIVE APPLICATIONS HOLDING ROOM');
    console.log(apps.map(a => ({ id: a._id, name: `${a.firstName} ${a.lastName}`.trim(), status: a.status })));

    // Users whose currentRoom is this room
    const users = await User.find({ currentRoom: room ? room._id : null }).select('firstName lastName email currentRoom');
    console.log('\nUSERS CURRENTLY IN ROOM');
    console.log(users.map(u => ({ id: u._id, name: `${u.firstName} ${u.lastName}`.trim(), email: u.email })));

  } finally {
    await mongoose.disconnect();
  }
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});







