/**
 * Script to sync room occupancy with allocations
 * 
 * This script ensures that room occupancy counts match the number of students
 * allocated to each room. It's useful for fixing inconsistencies in the database.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Application = require('../models/Application');
const Residence = require('../models/Residence');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => ('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function syncRoomOccupancy() {
  try {
    ('Starting room occupancy sync...');
    
    // Get all approved applications with allocated rooms
    const allocatedApplications = await Application.find({
      status: 'approved',
      allocatedRoom: { $exists: true, $ne: null }
    });
    
    (`Found ${allocatedApplications.length} allocated applications`);
    
    // Get all residences
    const residences = await Residence.find({});
    (`Found ${residences.length} residences`);
    
    // Create a map to track room occupancy
    const roomOccupancyMap = {};
    
    // Count allocations for each room
    allocatedApplications.forEach(app => {
      if (!roomOccupancyMap[app.allocatedRoom]) {
        roomOccupancyMap[app.allocatedRoom] = 0;
      }
      roomOccupancyMap[app.allocatedRoom] += 1;
    });
    
    (`Room occupancy map created for ${Object.keys(roomOccupancyMap).length} rooms`);
    
    // Update room occupancy in residences
    let updatedRooms = 0;
    
    for (const residence of residences) {
      let residenceUpdated = false;
      
      residence.rooms.forEach(room => {
        const allocatedCount = roomOccupancyMap[room.roomNumber] || 0;
        
        // If the current occupancy doesn't match the allocated count, update it
        if (room.currentOccupancy !== allocatedCount) {
          (`Updating room ${room.roomNumber}: ${room.currentOccupancy} -> ${allocatedCount}`);
          
          room.currentOccupancy = allocatedCount;
          
          // Update room status based on occupancy
          if (allocatedCount === 0) {
            room.status = 'available';
          } else if (allocatedCount >= room.capacity) {
            room.status = 'occupied';
          } else {
            room.status = 'reserved';
          }
          
          updatedRooms++;
          residenceUpdated = true;
        }
      });
      
      // Save the residence if any rooms were updated
      if (residenceUpdated) {
        await residence.save();
        (`Updated rooms in residence: ${residence.name}`);
      }
    }
    
    (`Room occupancy sync completed. Updated ${updatedRooms} rooms.`);
  } catch (error) {
    console.error('Error syncing room occupancy:', error);
  } finally {
    // Close MongoDB connection
    mongoose.connection.close();
    ('MongoDB connection closed');
  }
}

// Run the sync function
syncRoomOccupancy(); 