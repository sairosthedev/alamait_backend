require('dotenv').config();
const mongoose = require('mongoose');

async function checkRoomPricingData() {
    try {
        // Connect to MongoDB using the same method as your server
        if (!process.env.MONGODB_URI) {
            console.log('❌ MONGODB_URI not found in environment variables');
            return;
        }
        
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        console.log('\n🔍 Checking Room Pricing Data...');
        console.log('================================');
        
        // Check rooms collection
        console.log('\n1️⃣ Checking rooms collection...');
        try {
            const roomsCount = await mongoose.connection.db.collection('rooms').countDocuments();
            console.log(`   📊 Total rooms: ${roomsCount}`);
            
            if (roomsCount > 0) {
                const sampleRoom = await mongoose.connection.db.collection('rooms').findOne();
                console.log('   🔍 Sample room fields:', Object.keys(sampleRoom));
                console.log('   💰 Sample room data:', {
                    name: sampleRoom.name,
                    price: sampleRoom.price,
                    residence: sampleRoom.residence,
                    type: sampleRoom.type
                });
                
                // Check for price field
                const roomsWithPrice = await mongoose.connection.db.collection('rooms').countDocuments({
                    price: { $exists: true, $ne: null }
                });
                console.log(`   💵 Rooms with price: ${roomsWithPrice}`);
            }
        } catch (error) {
            console.log('   ❌ Error:', error.message);
        }
        
        // Check applications for room pricing
        console.log('\n2️⃣ Checking applications for room pricing...');
        try {
            const applicationsCount = await mongoose.connection.db.collection('applications').countDocuments();
            console.log(`   📊 Total applications: ${applicationsCount}`);
            
            if (applicationsCount > 0) {
                const sampleApp = await mongoose.connection.db.collection('applications').findOne();
                console.log('   🔍 Sample application fields:', Object.keys(sampleApp));
                console.log('   🏠 Sample application data:', {
                    firstName: sampleApp.firstName,
                    lastName: sampleApp.lastName,
                    residence: sampleApp.residence,
                    room: sampleApp.room,
                    allocatedRoom: sampleApp.allocatedRoom,
                    preferredRoom: sampleApp.preferredRoom
                });
                
                // Check if applications have room prices
                const appsWithRoomPrice = await mongoose.connection.db.collection('applications').countDocuments({
                    roomPrice: { $exists: true, $ne: null }
                });
                console.log(`   💵 Applications with room price: ${appsWithRoomPrice}`);
            }
        } catch (error) {
            console.log('   ❌ Error:', error.message);
        }
        
        // Check residences collection
        console.log('\n3️⃣ Checking residences collection...');
        try {
            const residencesCount = await mongoose.connection.db.collection('residences').countDocuments();
            console.log(`   📊 Total residences: ${residencesCount}`);
            
            if (residencesCount > 0) {
                const sampleResidence = await mongoose.connection.db.collection('residences').findOne();
                console.log('   🔍 Sample residence fields:', Object.keys(sampleResidence));
                console.log('   🏢 Sample residence data:', {
                    name: sampleResidence.name,
                    address: sampleResidence.address,
                    type: sampleResidence.type
                });
            }
        } catch (error) {
            console.log('   ❌ Error:', error.message);
        }
        
        // Check if there's a room prices collection
        console.log('\n4️⃣ Checking for room prices collection...');
        try {
            const collections = await mongoose.connection.db.listCollections().toArray();
            const roomPricesCollection = collections.find(col => 
                col.name.toLowerCase().includes('price') || 
                col.name.toLowerCase().includes('room')
            );
            
            if (roomPricesCollection) {
                console.log(`   📚 Found potential pricing collection: ${roomPricesCollection.name}`);
                const priceCount = await mongoose.connection.db.collection(roomPricesCollection.name).countDocuments();
                console.log(`   📊 Documents in ${roomPricesCollection.name}: ${priceCount}`);
                
                if (priceCount > 0) {
                    const samplePrice = await mongoose.connection.db.collection(roomPricesCollection.name).findOne();
                    console.log('   🔍 Sample price fields:', Object.keys(samplePrice));
                }
            } else {
                console.log('   ❌ No specific room prices collection found');
            }
        } catch (error) {
            console.log('   ❌ Error:', error.message);
        }
        
        // Check applications with room allocation
        console.log('\n5️⃣ Checking applications with room allocation...');
        try {
            const appsWithRoom = await mongoose.connection.db.collection('applications').find({
                $or: [
                    { room: { $exists: true, $ne: null } },
                    { allocatedRoom: { $exists: true, $ne: null } },
                    { preferredRoom: { $exists: true, $ne: null } }
                ]
            }).toArray();
            
            console.log(`   🏠 Applications with room info: ${appsWithRoom.length}`);
            
            if (appsWithRoom.length > 0) {
                console.log('\n   📋 Sample room allocations:');
                appsWithRoom.slice(0, 3).forEach((app, index) => {
                    console.log(`      ${index + 1}. ${app.firstName} ${app.lastName}`);
                    console.log(`         Residence: ${app.residence || 'N/A'}`);
                    console.log(`         Room: ${app.room || 'N/A'}`);
                    console.log(`         Allocated Room: ${app.allocatedRoom || 'N/A'}`);
                    console.log(`         Preferred Room: ${app.preferredRoom || 'N/A'}`);
                    console.log('');
                });
            }
        } catch (error) {
            console.log('   ❌ Error:', error.message);
        }
        
        console.log('\n💡 Recommendations for Room Pricing:');
        console.log('=====================================');
        console.log('1. Check if rooms collection has price field');
        console.log('2. Check if applications reference room prices');
        console.log('3. Look for a separate room prices collection');
        console.log('4. Consider linking applications to rooms for pricing');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🔍 Starting Room Pricing Data Check...');
checkRoomPricingData();
