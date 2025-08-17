require('dotenv').config();
const mongoose = require('mongoose');
const RentalAccrualService = require('./src/services/rentalAccrualService');

async function testUpdatedAccrualService() {
    try {
        // Connect to MongoDB using the same method as your server
        if (!process.env.MONGODB_URI) {
            console.log('❌ MONGODB_URI not found in environment variables');
            console.log('💡 Your server is running, so it must have access to MongoDB');
            return;
        }
        
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        
        console.log(`\n🧪 Testing Updated Rental Accrual Service...`);
        console.log(`=============================================`);
        console.log(`Testing for: ${currentMonth}/${currentYear}`);
        
        // Test 1: Get Outstanding Balances
        console.log('\n1️⃣ Testing getOutstandingRentBalances()...');
        try {
            const outstandingBalances = await RentalAccrualService.getOutstandingRentBalances();
            console.log('   ✅ Success!');
            console.log('   📊 Summary:', outstandingBalances.summary);
            console.log('   👥 Students with outstanding balances:', outstandingBalances.students.length);
            
            if (outstandingBalances.students.length > 0) {
                console.log('\n   📋 Sample student:');
                const sample = outstandingBalances.students[0];
                console.log(`      Name: ${sample.studentName}`);
                console.log(`      Outstanding: $${sample.totalOutstanding}`);
                console.log(`      Should be owed: $${sample.totalShouldBeOwed}`);
                console.log(`      Total paid: $${sample.totalPaid}`);
                console.log(`      Months active: ${sample.monthsActive}`);
            }
        } catch (error) {
            console.log('   ❌ Failed:', error.message);
        }
        
        // Test 2: Get Monthly Summary
        console.log('\n2️⃣ Testing getRentAccrualSummary()...');
        try {
            const monthlySummary = await RentalAccrualService.getRentAccrualSummary(currentMonth, currentYear);
            console.log('   ✅ Success!');
            console.log('   📊 Monthly Summary:', {
                month: monthlySummary.month,
                year: monthlySummary.year,
                totalStudents: monthlySummary.totalStudents,
                totalRentAccrued: monthlySummary.totalRentAccrued,
                totalAdminFeesAccrued: monthlySummary.totalAdminFeesAccrued,
                totalAmountAccrued: monthlySummary.totalAmountAccrued,
                accrualsCreated: monthlySummary.accrualsCreated,
                pendingAccruals: monthlySummary.pendingAccruals
            });
        } catch (error) {
            console.log('   ❌ Failed:', error.message);
        }
        
        // Test 3: Get Yearly Summary
        console.log('\n3️⃣ Testing getYearlySummary()...');
        try {
            const yearlySummary = await RentalAccrualService.getYearlySummary(currentYear);
            console.log('   ✅ Success!');
            console.log('   📊 Yearly Summary:', {
                year: yearlySummary.year,
                totalAmountAccrued: yearlySummary.totalAmountAccrued,
                totalStudents: yearlySummary.totalStudents,
                averageMonthlyAccrual: yearlySummary.averageMonthlyAccrual
            });
            
            console.log('\n   📅 Monthly Breakdown:');
            yearlySummary.monthlyBreakdown.forEach(month => {
                console.log(`      ${month.monthName}: ${month.students} students, $${month.total}`);
            });
        } catch (error) {
            console.log('   ❌ Failed:', error.message);
        }
        
        // Test 4: Check what data is available
        console.log('\n4️⃣ Checking available data...');
        try {
            const collections = await mongoose.connection.db.listCollections().toArray();
            const applicationsCount = await mongoose.connection.db.collection('applications').countDocuments();
            const paymentsCount = await mongoose.connection.db.collection('payments').countDocuments();
            
            console.log('   📚 Collections found:', collections.length);
            console.log('   📋 Applications:', applicationsCount);
            console.log('   💰 Payments:', paymentsCount);
            
            // Check applications structure
            if (applicationsCount > 0) {
                const sampleApp = await mongoose.connection.db.collection('applications').findOne();
                console.log('   🔍 Sample application fields:', Object.keys(sampleApp));
                console.log('   📅 Sample dates:', {
                    startDate: sampleApp.startDate,
                    endDate: sampleApp.endDate,
                    status: sampleApp.status,
                    paymentStatus: sampleApp.paymentStatus
                });
            }
            
        } catch (error) {
            console.log('   ❌ Failed:', error.message);
        }
        
        console.log('\n✅ Testing completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🚀 Starting Updated Accrual Service Test...');
testUpdatedAccrualService();
