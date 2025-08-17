require('dotenv').config();
const mongoose = require('mongoose');

async function testFixedService() {
    try {
        if (!process.env.MONGODB_URI) {
            console.log('❌ MONGODB_URI not found in environment variables');
            return;
        }
        
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        console.log('\n🧪 Testing Fixed Rental Accrual Service...');
        console.log('==========================================');
        
        // Test the fixed service method
        try {
            const RentalAccrualService = require('./src/services/rentalAccrualService');
            const result = await RentalAccrualService.getOutstandingRentBalances();
            
            console.log(`✅ Service call successful!`);
            console.log(`📊 Students returned: ${result.students.length}`);
            console.log(`📋 Summary:`, result.summary);
            
            if (result.students.length > 0) {
                console.log('\n👤 All Students from service:');
                result.students.forEach((student, index) => {
                    console.log(`\n  ${index + 1}. ${student.studentName}:`);
                    console.log(`     Outstanding: $${student.totalOutstanding}`);
                    console.log(`     Should be owed: $${student.totalShouldBeOwed}`);
                    console.log(`     Total paid: $${student.totalPaid}`);
                    console.log(`     Months active: ${student.monthsActive}`);
                    console.log(`     Lease: ${student.leaseStart} to ${student.leaseEnd}`);
                    console.log(`     Monthly: Rent $${student.monthlyRent}, Admin $${student.monthlyAdminFee}`);
                });
            }
            
            // Verify the fix worked
            if (result.students.length === 5) {
                console.log('\n🎉 SUCCESS! All 5 students are now showing up!');
            } else {
                console.log(`\n⚠️  Still only showing ${result.students.length} students instead of 5`);
            }
        } catch (error) {
            console.log('❌ Service call failed:', error.message);
        }
        
        console.log(`✅ Service call successful!`);
        console.log(`📊 Students returned: ${result.students.length}`);
        console.log(`📋 Summary:`, result.summary);
        
        if (result.students.length > 0) {
            console.log('\n👤 All Students from service:');
            result.students.forEach((student, index) => {
                console.log(`\n  ${index + 1}. ${student.studentName}:`);
                console.log(`     Outstanding: $${student.totalOutstanding}`);
                console.log(`     Should be owed: $${student.totalShouldBeOwed}`);
                console.log(`     Total paid: $${student.totalPaid}`);
                console.log(`     Months active: ${student.monthsActive}`);
                console.log(`     Lease: ${student.leaseStart} to ${student.leaseEnd}`);
                console.log(`     Monthly: Rent $${student.monthlyRent}, Admin $${student.monthlyAdminFee}`);
            });
        }
        
        // Verify the fix worked
        if (result.students.length === 5) {
            console.log('\n🎉 SUCCESS! All 5 students are now showing up!');
        } else {
            console.log(`\n⚠️  Still only showing ${result.students.length} students instead of 5`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🧪 Testing Fixed Rental Accrual Service...');
testFixedService();
