const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Residence = require('./src/models/Residence');

// Database connection
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:12345678@cluster0.qzq1z.mongodb.net/alamait?retryWrites=true&w=majority&appName=Cluster0');
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        process.exit(1);
    }
};

async function debugManualAddRooms() {
    try {
        await connectDB();
        
        console.log('\n🔍 DEBUGGING MANUAL ADD STUDENT ROOMS ISSUE');
        console.log('==========================================\n');
        
        // Get all residences
        const residences = await Residence.find().lean();
        console.log(`📊 Found ${residences.length} residences`);
        
        let totalRooms = 0;
        let availableRooms = 0;
        let reservedRooms = 0;
        let occupiedRooms = 0;
        let maintenanceRooms = 0;
        let otherRooms = 0;
        
        residences.forEach((residence, index) => {
            console.log(`\n🏠 Residence ${index + 1}: ${residence.name} (${residence._id})`);
            console.log(`   Total rooms: ${residence.rooms ? residence.rooms.length : 0}`);
            
            if (residence.rooms && Array.isArray(residence.rooms)) {
                residence.rooms.forEach(room => {
                    totalRooms++;
                    const status = room.status || 'no-status';
                    
                    console.log(`   - Room ${room.roomNumber}: ${status} (${room.type || 'no-type'}) - $${room.price || 'no-price'}`);
                    
                    switch (status.toLowerCase()) {
                        case 'available':
                            availableRooms++;
                            break;
                        case 'reserved':
                            reservedRooms++;
                            break;
                        case 'occupied':
                            occupiedRooms++;
                            break;
                        case 'maintenance':
                            maintenanceRooms++;
                            break;
                        default:
                            otherRooms++;
                            console.log(`     ⚠️  Unknown status: "${status}"`);
                    }
                });
            } else {
                console.log('   ⚠️  No rooms array found');
            }
        });
        
        console.log('\n📈 ROOM STATUS SUMMARY');
        console.log('======================');
        console.log(`Total rooms: ${totalRooms}`);
        console.log(`Available: ${availableRooms}`);
        console.log(`Reserved: ${reservedRooms}`);
        console.log(`Occupied: ${occupiedRooms}`);
        console.log(`Maintenance: ${maintenanceRooms}`);
        console.log(`Other/Unknown: ${otherRooms}`);
        
        console.log('\n🔍 MANUAL ADD STUDENT FILTERING');
        console.log('==============================');
        console.log('Current filter: room.status === "available" || room.status === "reserved"');
        console.log(`Rooms that would show: ${availableRooms + reservedRooms}`);
        console.log(`Rooms that would NOT show: ${occupiedRooms + maintenanceRooms + otherRooms}`);
        
        console.log('\n💡 RECOMMENDATIONS');
        console.log('==================');
        if (availableRooms + reservedRooms === 0) {
            console.log('❌ No available or reserved rooms found!');
            console.log('   This explains why no rooms are showing in manual add student.');
            console.log('   Consider:');
            console.log('   1. Check if rooms have correct status values');
            console.log('   2. Maybe show all rooms regardless of status');
            console.log('   3. Check if rooms are being created properly');
        } else {
            console.log('✅ Some available/reserved rooms found');
            console.log('   If rooms still not showing, check:');
            console.log('   1. Frontend filtering logic');
            console.log('   2. API response structure');
            console.log('   3. Residence selection logic');
        }
        
        // Test the getAllResidences service response
        console.log('\n🧪 TESTING GETALLRESIDENCES SERVICE');
        console.log('==================================');
        
        // Simulate what the service would return
        const serviceResponse = residences.map(residence => ({
            ...residence,
            rooms: (residence.rooms || []).map(room => ({
                ...room,
                residenceName: residence.name,
                residenceId: residence._id,
            }))
        }));
        
        console.log(`Service would return ${serviceResponse.length} residences`);
        serviceResponse.forEach((residence, index) => {
            console.log(`  Residence ${index + 1}: ${residence.name} - ${residence.rooms.length} rooms`);
        });
        
    } catch (error) {
        console.error('❌ Debug failed:', error);
    } finally {
        try {
            await mongoose.connection.close();
            console.log('\n✅ Database connection closed');
        } catch (closeError) {
            console.log('⚠️  Error closing database connection:', closeError.message);
        }
        process.exit(0);
    }
}

debugManualAddRooms(); 