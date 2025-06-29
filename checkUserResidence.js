const mongoose = require('mongoose');
const User = require('./src/models/User');
const Application = require('./src/models/Application');
const Room = require('./src/models/Room');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function checkAndFixUserResidence() {
    try {
        console.log('Checking user residence assignment...');
        
        // Find all users with Kudzai in the name
        const users = await User.find({ 
            $or: [
                { firstName: { $regex: 'Kudzai', $options: 'i' } },
                { lastName: { $regex: 'Kudzai', $options: 'i' } },
                { email: { $regex: 'kudzai', $options: 'i' } }
            ]
        });
        
        console.log('Found users:', users.length);
        users.forEach(user => {
            console.log('User:', {
                id: user._id,
                name: `${user.firstName} ${user.lastName}`,
                email: user.email,
                currentResidence: user.residence,
                currentRoom: user.currentRoom
            });
        });
        
        if (users.length === 0) {
            // Try to find by the specific email from the error
            const specificUser = await User.findOne({ 
                email: 'kudzaicindyrellapemhiwa@gmail.com' 
            });
            
            if (specificUser) {
                console.log('Found specific user:', {
                    id: specificUser._id,
                    name: `${specificUser.firstName} ${specificUser.lastName}`,
                    email: specificUser.email,
                    currentResidence: specificUser.residence,
                    currentRoom: specificUser.currentRoom
                });
                
                // Check if user has an application
                const application = await Application.findOne({ 
                    email: specificUser.email 
                });
                
                if (application) {
                    console.log('Application found:', {
                        id: application._id,
                        residence: application.residence,
                        allocatedRoom: application.allocatedRoom,
                        status: application.status
                    });
                    
                    // Update user residence and room if application has them
                    if (application.residence && !specificUser.residence) {
                        specificUser.residence = application.residence;
                        console.log('Updated user residence to:', application.residence);
                    }
                    
                    if (application.allocatedRoom && !specificUser.currentRoom) {
                        specificUser.currentRoom = application.allocatedRoom;
                        console.log('Updated user room to:', application.allocatedRoom);
                    }
                    
                    await specificUser.save();
                    console.log('User updated successfully');
                } else {
                    console.log('No application found for this user');
                }
                
                // Check if user has a current room assignment
                if (specificUser.currentRoom) {
                    const room = await Room.findById(specificUser.currentRoom);
                    if (room && room.residence && !specificUser.residence) {
                        specificUser.residence = room.residence;
                        await specificUser.save();
                        console.log('Updated user residence from room assignment:', room.residence);
                    }
                }
                
                console.log('Final user state:', {
                    id: specificUser._id,
                    name: `${specificUser.firstName} ${specificUser.lastName}`,
                    email: specificUser.email,
                    currentResidence: specificUser.residence,
                    currentRoom: specificUser.currentRoom
                });
            } else {
                console.log('User not found with email: kudzaicindyrellapemhiwa@gmail.com');
            }
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
}

checkAndFixUserResidence(); 