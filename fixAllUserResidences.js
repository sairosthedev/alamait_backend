const mongoose = require('mongoose');
const User = require('./src/models/User');
const Application = require('./src/models/Application');
const Room = require('./src/models/Room');
const Residence = require('./src/models/Residence');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function fixAllUserResidences() {
    try {
        console.log('Starting comprehensive user residence fix...');
        
        // Get all users
        const users = await User.find({ role: 'student' });
        console.log(`Found ${users.length} students to process`);
        
        let updatedCount = 0;
        let errorCount = 0;
        
        for (const user of users) {
            try {
                console.log(`\nProcessing user: ${user.firstName} ${user.lastName} (${user.email})`);
                console.log(`Current state - Residence: ${user.residence}, Room: ${user.currentRoom}`);
                
                let needsUpdate = false;
                
                // Check if user has an application
                const application = await Application.findOne({ 
                    email: user.email 
                });
                
                if (application) {
                    console.log(`  Application found - Residence: ${application.residence}, Allocated Room: ${application.allocatedRoom}`);
                    
                    // Update residence if application has it and user doesn't
                    if (application.residence && (!user.residence || user.residence.toString() !== application.residence.toString())) {
                        user.residence = application.residence;
                        console.log(`  Updated residence to: ${application.residence}`);
                        needsUpdate = true;
                    }
                    
                    // Update room if application has allocated room
                    if (application.allocatedRoom) {
                        // Find the room by name and residence
                        const room = await Room.findOne({
                            name: application.allocatedRoom,
                            residence: application.residence
                        });
                        
                        if (room) {
                            if (!user.currentRoom || user.currentRoom.toString() !== room._id.toString()) {
                                user.currentRoom = room._id;
                                console.log(`  Updated room to: ${room._id} (${room.name})`);
                                needsUpdate = true;
                            }
                        } else {
                            console.log(`  Warning: Room "${application.allocatedRoom}" not found in residence ${application.residence}`);
                        }
                    }
                } else {
                    console.log(`  No application found for this user`);
                }
                
                // If user has a current room but no residence, try to get residence from room
                if (user.currentRoom && !user.residence) {
                    let room;
                    
                    // Check if currentRoom is an ObjectId or string
                    if (mongoose.Types.ObjectId.isValid(user.currentRoom)) {
                        room = await Room.findById(user.currentRoom);
                    } else {
                        // If it's a string, try to find by name
                        room = await Room.findOne({ name: user.currentRoom });
                    }
                    
                    if (room && room.residence) {
                        user.residence = room.residence;
                        console.log(`  Updated residence from room: ${room.residence}`);
                        needsUpdate = true;
                    }
                }
                
                // If user has residence but currentRoom is a string, try to convert to ObjectId
                if (user.residence && user.currentRoom && typeof user.currentRoom === 'string') {
                    const room = await Room.findOne({
                        name: user.currentRoom,
                        residence: user.residence
                    });
                    
                    if (room) {
                        user.currentRoom = room._id;
                        console.log(`  Converted room string to ObjectId: ${room._id}`);
                        needsUpdate = true;
                    }
                }
                
                // Save if any updates were made
                if (needsUpdate) {
                    await user.save();
                    updatedCount++;
                    console.log(`  ✅ User updated successfully`);
                } else {
                    console.log(`  ℹ️  No updates needed`);
                }
                
                // Log final state
                console.log(`  Final state - Residence: ${user.residence}, Room: ${user.currentRoom}`);
                
            } catch (error) {
                console.error(`  ❌ Error processing user ${user.email}:`, error.message);
                errorCount++;
            }
        }
        
        console.log(`\n=== SUMMARY ===`);
        console.log(`Total students processed: ${users.length}`);
        console.log(`Users updated: ${updatedCount}`);
        console.log(`Errors: ${errorCount}`);
        
        // Show some statistics
        const usersWithResidence = await User.countDocuments({ 
            role: 'student', 
            residence: { $exists: true, $ne: null } 
        });
        
        const usersWithRoom = await User.countDocuments({ 
            role: 'student', 
            currentRoom: { $exists: true, $ne: null } 
        });
        
        console.log(`Students with residence: ${usersWithResidence}/${users.length}`);
        console.log(`Students with room: ${usersWithRoom}/${users.length}`);
        
    } catch (error) {
        console.error('Error in fixAllUserResidences:', error);
    } finally {
        mongoose.connection.close();
    }
}

fixAllUserResidences(); 