// fixBelvedereRooms.js
// Script to fix invalid room data in the Belvedere residence
const mongoose = require('mongoose');
const Residence = require('../models/Residence');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/alamait';

async function fixBelvedereRooms() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const belvedere = await Residence.findOne({ name: 'Belvedere Student House' });
  if (!belvedere) {
    console.log('Belvedere residence not found');
    await mongoose.disconnect();
    return;
  }
  let updated = false;
  if (Array.isArray(belvedere.rooms)) {
    belvedere.rooms.forEach((room, idx) => {
      // Fix type typo
      if (room.type === 'tripple') {
        room.type = 'triple';
        updated = true;
        console.log(`Fixed type for room ${idx}`);
      }
      // Ensure area is present and numeric
      if (room.area === undefined || room.area === null || isNaN(Number(room.area))) {
        room.area = 20;
        updated = true;
        console.log(`Set default area for room ${idx}`);
      } else {
        room.area = Number(room.area);
      }
      // Ensure floor is present and numeric
      if (room.floor === undefined || room.floor === null || isNaN(Number(room.floor))) {
        room.floor = 1;
        updated = true;
        console.log(`Set default floor for room ${idx}`);
      } else {
        room.floor = Number(room.floor);
      }
    });
  }
  if (updated) {
    await belvedere.save();
    console.log('Belvedere rooms fixed and saved.');
  } else {
    console.log('No changes needed.');
  }
  await mongoose.disconnect();
}

fixBelvedereRooms().catch(err => {
  console.error(err);
  process.exit(1);
}); 