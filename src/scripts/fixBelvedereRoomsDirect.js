// fixBelvedereRoomsDirect.js
// Node.js script to fix 'tripple' typo and missing/invalid fields in Belvedere Student House rooms
const mongoose = require('mongoose');
const Residence = require('../models/Residence');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/alamait';

async function fixBelvedereRoomsDirect() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const residence = await Residence.findOne({ name: 'Belvedere Student House' });
  if (!residence) {
    console.log('Residence not found.');
    await mongoose.disconnect();
    return;
  }
  let updated = false;
  for (let i = 0; i < residence.rooms.length; i++) {
    let room = residence.rooms[i];
    if (room.type === 'tripple') {
      room.type = 'triple';
      updated = true;
    }
    // Ensure area and floor are present and numeric
    if (room.area === undefined || room.area === null || isNaN(Number(room.area))) {
      room.area = 20;
      updated = true;
    } else {
      room.area = Number(room.area);
    }
    if (room.floor === undefined || room.floor === null || isNaN(Number(room.floor))) {
      room.floor = 1;
      updated = true;
    } else {
      room.floor = Number(room.floor);
    }
    // Convert price, currentOccupancy, capacity to numbers if needed
    if (room.price !== undefined && isNaN(Number(room.price)) === false) {
      room.price = Number(room.price);
    }
    if (room.currentOccupancy !== undefined && isNaN(Number(room.currentOccupancy)) === false) {
      room.currentOccupancy = Number(room.currentOccupancy);
    }
    if (room.capacity !== undefined && isNaN(Number(room.capacity)) === false) {
      room.capacity = Number(room.capacity);
    }
  }
  if (updated) {
    await residence.save();
    console.log('Residence rooms fixed.');
  } else {
    console.log('No changes needed.');
  }
  await mongoose.disconnect();
}

fixBelvedereRoomsDirect().catch(err => {
  console.error(err);
  process.exit(1);
}); 