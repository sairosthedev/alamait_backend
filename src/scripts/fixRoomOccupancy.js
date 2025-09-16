/**
 * Script to fix room occupancy by excluding expired/forfeited students
 * 
 * This script recalculates room occupancy using the new accurate logic
 * that excludes students with expired applications or forfeited status.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const RoomOccupancyUtils = require('../utils/roomOccupancyUtils');
const Residence = require('../models/Residence');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function fixRoomOccupancy() {
  try {
    console.log('🔧 Starting room occupancy fix...');
    
    // Get all residences
    const residences = await Residence.find({});
    console.log(`Found ${residences.length} residences`);
    
    let totalResidencesUpdated = 0;
    let totalRoomsUpdated = 0;
    
    for (const residence of residences) {
      console.log(`\n🏠 Processing residence: ${residence.name}`);
      
      try {
        const result = await RoomOccupancyUtils.syncAllRoomOccupancies(residence._id);
        
        if (result.success) {
          console.log(`✅ Updated ${result.totalUpdated}/${result.totalRooms} rooms in ${residence.name}`);
          
          if (result.totalUpdated > 0) {
            totalResidencesUpdated++;
            totalRoomsUpdated += result.totalUpdated;
          }
          
          // Show details for updated rooms
          result.results.forEach(roomResult => {
            if (roomResult.updated) {
              console.log(`   📍 Room ${roomResult.roomNumber}: ${roomResult.oldOccupancy} → ${roomResult.newOccupancy} (${roomResult.status})`);
            }
          });
        } else {
          console.log(`❌ Failed to update rooms in ${residence.name}`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing residence ${residence.name}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Room occupancy fix completed!`);
    console.log(`📊 Summary:`);
    console.log(`   - Residences processed: ${residences.length}`);
    console.log(`   - Residences updated: ${totalResidencesUpdated}`);
    console.log(`   - Total rooms updated: ${totalRoomsUpdated}`);
    
  } catch (error) {
    console.error('❌ Error fixing room occupancy:', error);
  } finally {
    // Close MongoDB connection
    mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the fix function
fixRoomOccupancy();

