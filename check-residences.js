/**
 * 🔍 Quick Residences Collection Check
 * 
 * This script checks what's actually in your residences collection
 * to see the real data structure and content.
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function checkResidences() {
    try {
        console.log('🔍 Checking Residences Collection...\n');
        
        // Wait for connection to be ready
        await mongoose.connection.asPromise();
        
        // Get the residences collection directly
        const residencesCollection = mongoose.connection.db.collection('residences');
        
        // Count total residences
        const totalResidences = await residencesCollection.countDocuments();
        console.log(`📊 Total Residences: ${totalResidences}`);
        
        if (totalResidences === 0) {
            console.log('❌ No residences found in collection');
            return;
        }
        
        // Get sample residences
        const residences = await residencesCollection.find({}).limit(5).toArray();
        
        console.log('\n📋 Sample Residences:');
        residences.forEach((residence, index) => {
            console.log(`\n${index + 1}. Residence ID: ${residence._id}`);
            console.log(`   Name: ${residence.name || 'Not set'}`);
            console.log(`   Address: ${residence.address || 'Not set'}`);
            console.log(`   Rooms: ${residence.rooms ? residence.rooms.length : 0}`);
            
            if (residence.rooms && residence.rooms.length > 0) {
                console.log('   Sample Rooms:');
                residence.rooms.slice(0, 3).forEach((room, roomIndex) => {
                    console.log(`     - Room ${roomIndex + 1}: ${room.name || room.roomNumber || 'Unnamed'}`);
                });
                if (residence.rooms.length > 3) {
                    console.log(`     ... and ${residence.rooms.length - 3} more rooms`);
                }
            }
            
            // Show other fields
            const otherFields = Object.keys(residence).filter(key => 
                !['_id', 'name', 'address', 'rooms'].includes(key)
            );
            if (otherFields.length > 0) {
                console.log(`   Other Fields: ${otherFields.join(', ')}`);
            }
        });
        
        // Check if there are more residences
        if (totalResidences > 5) {
            console.log(`\n... and ${totalResidences - 5} more residences`);
        }
        
    } catch (error) {
        console.error('❌ Error checking residences:', error);
    }
}

async function main() {
    try {
        // Use connection string from .env file
        const connectionString = process.env.MONGODB_URI;
        
        if (!connectionString) {
            throw new Error('MONGODB_URI not found in .env file');
        }
        
        console.log('🔗 Connecting to MongoDB Atlas...');
        await mongoose.connect(connectionString, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB Atlas');
        
        // Check residences
        await checkResidences();
        
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

// Run the check
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { checkResidences };
