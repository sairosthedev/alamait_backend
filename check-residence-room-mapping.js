require('dotenv').config();
const mongoose = require('mongoose');

async function checkResidenceRoomMapping() {
    try {
        // Connect to MongoDB using the same method as your server
        if (!process.env.MONGODB_URI) {
            console.log('❌ MONGODB_URI not found in environment variables');
            return;
        }
        
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        console.log('\n🔍 Checking Residence and Room Mapping...');
        console.log('==========================================');
        
        // Get all residences
        console.log('\n1️⃣ Checking residences...');
        const residences = await mongoose.connection.db.collection('residences').find({}).toArray();
        console.log(`   📊 Total residences: ${residences.length}`);
        
        const residenceMap = {};
        residences.forEach(residence => {
            residenceMap[residence._id.toString()] = residence;
            console.log(`   🏢 ${residence.name} (ID: ${residence._id})`);
        });
        
        // Get applications with room allocations
        console.log('\n2️⃣ Checking applications with room allocations...');
        const applications = await mongoose.connection.db.collection('applications').find({
            status: 'approved'
        }).toArray();
        
        console.log(`   📊 Approved applications: ${applications.length}`);
        
        // Group by residence and room
        const roomAllocations = {};
        
        applications.forEach(app => {
            const residenceId = app.residence?.toString();
            const residenceName = residenceMap[residenceId]?.name || 'Unknown';
            const allocatedRoom = app.allocatedRoom || app.preferredRoom || 'Unknown';
            
            if (!roomAllocations[residenceName]) {
                roomAllocations[residenceName] = {};
            }
            
            if (!roomAllocations[residenceName][allocatedRoom]) {
                roomAllocations[residenceName][allocatedRoom] = [];
            }
            
            roomAllocations[residenceName][allocatedRoom].push({
                student: `${app.firstName} ${app.lastName}`,
                email: app.email,
                startDate: app.startDate,
                endDate: app.endDate
            });
        });
        
        console.log('\n3️⃣ Room allocations by residence:');
        Object.keys(roomAllocations).forEach(residenceName => {
            console.log(`\n   🏢 ${residenceName}:`);
            Object.keys(roomAllocations[residenceName]).forEach(roomName => {
                const students = roomAllocations[residenceName][roomName];
                console.log(`      🏠 ${roomName}: ${students.length} student(s)`);
                students.forEach(student => {
                    console.log(`         👤 ${student.student} (${student.email})`);
                    console.log(`         📅 ${student.startDate?.toDateString()} to ${student.endDate?.toDateString()}`);
                });
            });
        });
        
        // Check if there are any existing room prices
        console.log('\n4️⃣ Checking for existing room prices...');
        
        // Look for any collection that might have pricing
        const collections = await mongoose.connection.db.listCollections().toArray();
        const pricingCollections = collections.filter(col => 
            col.name.toLowerCase().includes('price') || 
            col.name.toLowerCase().includes('rate') ||
            col.name.toLowerCase().includes('fee')
        );
        
        if (pricingCollections.length > 0) {
            console.log('   💰 Found potential pricing collections:');
            pricingCollections.forEach(col => {
                console.log(`      📚 ${col.name}`);
            });
        } else {
            console.log('   ❌ No pricing collections found');
        }
        
        // Check if applications have any pricing info
        console.log('\n5️⃣ Checking applications for pricing info...');
        const sampleApp = applications[0];
        console.log('   🔍 Sample application fields:', Object.keys(sampleApp));
        
        // Look for any price-related fields
        const priceFields = Object.keys(sampleApp).filter(field => 
            field.toLowerCase().includes('price') || 
            field.toLowerCase().includes('rate') ||
            field.toLowerCase().includes('fee') ||
            field.toLowerCase().includes('cost')
        );
        
        if (priceFields.length > 0) {
            console.log('   💵 Found price-related fields:', priceFields);
        } else {
            console.log('   ❌ No price-related fields found');
        }
        
        console.log('\n💡 Current Situation:');
        console.log('=====================');
        console.log('✅ You have students allocated to specific rooms');
        console.log('✅ You have residences with names (St Kilda, Belvedere, Nyanga)');
        console.log('❌ No room pricing data is currently stored');
        console.log('❌ No way to calculate individual student rent amounts');
        
        console.log('\n💡 Recommendations:');
        console.log('===================');
        console.log('1. Create a room pricing system');
        console.log('2. Store room prices in the rooms collection');
        console.log('3. Link applications to room prices');
        console.log('4. Update rental accrual service to use actual room prices');
        
        // Suggest a pricing structure
        console.log('\n💡 Suggested Pricing Structure:');
        console.log('===============================');
        console.log('St Kilda:');
        console.log('  - M1-M6: $180/month (Student rooms)');
        console.log('  - Admin fee: $20/month');
        console.log('');
        console.log('Belvedere:');
        console.log('  - B1-B4: $200/month (Premium rooms)');
        console.log('  - Admin fee: $25/month');
        console.log('');
        console.log('Nyanga:');
        console.log('  - N1-N3: $160/month (Standard rooms)');
        console.log('  - Admin fee: $15/month');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🔍 Starting Residence and Room Mapping Check...');
checkResidenceRoomMapping();
