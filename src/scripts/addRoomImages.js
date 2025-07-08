// addRoomImages.js
// Script to append images to specific rooms
const mongoose = require('mongoose');
const Room = require('../models/Room');
const path = require('path');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/alamait';

const roomImages = {
  m1: [
    '/public/m1.jpg',
  ],
  m4: [
    '/public/M4.jpg',
    '/public/M4 closet.jpg',
  ],
  executive: [
    '/public/executive.jpg',
  ],
};

async function addImages() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  for (const [roomName, imagesToAdd] of Object.entries(roomImages)) {
    const room = await Room.findOne({ name: new RegExp(`^${roomName}$`, 'i') });
    if (!room) {
      console.log(`Room not found: ${roomName}`);
      continue;
    }
    // Merge images, avoid duplicates
    const currentImages = Array.isArray(room.images) ? room.images : [];
    const newImages = [...new Set([...currentImages, ...imagesToAdd])];
    room.images = newImages;
    await room.save();
    console.log(`Updated images for room: ${roomName}`);
  }
  await mongoose.disconnect();
}

addImages().catch(err => {
  console.error(err);
  process.exit(1);
}); 