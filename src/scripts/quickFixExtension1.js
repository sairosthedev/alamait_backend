/**
 * Quick fix for Extension 1 room occupancy
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Residence = require('../models/Residence');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function quickFix() {
  try {
    const residence = await Residence.findOne({ name: 'St Kilda Student House' });
    const room = residence.rooms.find(r => r.roomNumber === 'Extension 1');
    
    console.log(`Current occupancy: ${room.currentOccupancy}`);
    console.log(`Capacity: ${room.capacity}`);
    
    // Set occupancy to 5 (based on approved applications)
    room.currentOccupancy = 5;
    room.status = 'reserved'; // 5/6 = reserved (not full)
    
    await residence.save();
    
    console.log(`✅ Updated Extension 1 occupancy to 5`);
    console.log(`✅ Status set to: ${room.status}`);
    console.log(`✅ Available spots: ${room.capacity - room.currentOccupancy}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

quickFix();


