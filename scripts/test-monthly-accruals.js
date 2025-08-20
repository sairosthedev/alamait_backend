const mongoose = require('mongoose');

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function connectToDatabase() {
    try {
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error);
        process.exit(1);
    }
}

async function disconnectFromDatabase() {
    try {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    } catch (error) {
        console.error('❌ Failed to disconnect from MongoDB:', error);
    }
}

async function testMonthlyAccruals() {
    try {
        console.log('\n🧪 TESTING MONTHLY RENTAL ACCRUALS');
        console.log('=' .repeat(70));

        // Import required services and models
        const RentalAccrualService = require('../src/services/rentalAccrualService');
        const TransactionEntry = require('../src/models/TransactionEntry');
        const Application = require('../src/models/Application');
        const Debtor = require('../src/models/Debtor');

        // Get current month and year
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        console.log(`📅 Current Period: ${currentMonth}/${currentYear}`);

        // Check existing accruals for current month
        console.log('\n1️⃣ CHECKING EXISTING ACCRUALS');
        console.log('-'.repeat(50));

        const existingAccruals = await TransactionEntry.find({
            'metadata.accrualMonth': currentMonth,
            'metadata.accrualYear': currentYear,
            'metadata.type': 'monthly_rent_accrual',
            source: 'rental_accrual'
        });

        console.log(`📊 Found ${existingAccruals.length} existing monthly accruals for ${currentMonth}/${currentYear}`);

        if (existingAccruals.length > 0) {
            console.log('⚠️ Monthly accruals already exist for this month');
            console.log('   Testing with next month instead...');
            
            // Test with next month
            const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
            const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
            
            console.log(`🔄 Testing monthly accruals for ${nextMonth}/${nextYear}`);
            await testMonthlyAccrualForPeriod(nextMonth, nextYear);
        } else {
            console.log('✅ No existing accruals found - testing current month');
            await testMonthlyAccrualForPeriod(currentMonth, currentYear);
        }

        // Test the monthly accrual service directly
        console.log('\n2️⃣ TESTING MONTHLY ACCRUAL SERVICE');
        console.log('-'.repeat(50));

        const testMonth = currentMonth === 12 ? 1 : currentMonth + 1;
        const testYear = currentMonth === 12 ? currentYear + 1 : currentYear;

        console.log(`🏠 Creating monthly rent accruals for ${testMonth}/${testYear}...`);
        
        const result = await RentalAccrualService.createMonthlyRentAccrual(testMonth, testYear);

        if (result && result.success) {
            console.log(`✅ Monthly accruals created successfully!`);
            console.log(`   Accruals created: ${result.accrualsCreated}`);
            console.log(`   Month/Year: ${result.month}/${result.year}`);
            
            if (result.errors && result.errors.length > 0) {
                console.log(`   Errors: ${result.errors.length}`);
                result.errors.forEach((error, index) => {
                    console.log(`     ${index + 1}. ${error.student}: ${error.error}`);
                });
            }
        } else {
            console.log(`❌ Failed to create monthly accruals`);
            console.log(`   Error: ${result?.error || 'Unknown error'}`);
        }

        // Verify the created accruals
        console.log('\n3️⃣ VERIFYING CREATED ACCRUALS');
        console.log('-'.repeat(50));

        const newAccruals = await TransactionEntry.find({
            'metadata.accrualMonth': testMonth,
            'metadata.accrualYear': testYear,
            'metadata.type': 'monthly_rent_accrual',
            source: 'rental_accrual'
        });

        console.log(`📋 Found ${newAccruals.length} new monthly accrual entries`);

        if (newAccruals.length > 0) {
            newAccruals.forEach((accrual, index) => {
                console.log(`\n   ${index + 1}. Transaction ID: ${accrual.transactionId}`);
                console.log(`      Student: ${accrual.metadata?.studentName || 'N/A'}`);
                console.log(`      Room: ${accrual.metadata?.room || 'N/A'}`);
                console.log(`      Amount: $${accrual.totalDebit || accrual.totalCredit || 0}`);
                console.log(`      Date: ${accrual.date}`);
            });
        }

        // Test individual student accrual
        console.log('\n4️⃣ TESTING INDIVIDUAL STUDENT ACCRUAL');
        console.log('-'.repeat(50));

        // Get an active student application
        const activeStudent = await Application.findOne({
            status: 'approved',
            student: { $exists: true, $ne: null }
        });

        if (activeStudent) {
            console.log(`👤 Testing individual accrual for: ${activeStudent.firstName} ${activeStudent.lastName}`);
            
            const individualResult = await RentalAccrualService.createStudentRentAccrual(
                activeStudent, 
                testMonth, 
                testYear
            );

            if (individualResult && individualResult.success) {
                console.log(`✅ Individual accrual created successfully`);
                console.log(`   Transaction ID: ${individualResult.transactionId}`);
                console.log(`   Amount: $${individualResult.amount}`);
                console.log(`   Student: ${individualResult.student}`);
            } else {
                console.log(`❌ Individual accrual failed: ${individualResult?.error || 'Unknown error'}`);
            }
        } else {
            console.log('⚠️ No active students found for individual testing');
        }

        console.log('\n🎉 MONTHLY ACCRUAL TESTING COMPLETED');

    } catch (error) {
        console.error('❌ Error testing monthly accruals:', error);
    }
}

async function testMonthlyAccrualForPeriod(month, year) {
    try {
        console.log(`\n📊 Testing monthly accrual for ${month}/${year}`);
        
        // Check if accruals exist for this period
        const TransactionEntry = require('../src/models/TransactionEntry');
        const existingAccruals = await TransactionEntry.find({
            'metadata.accrualMonth': month,
            'metadata.accrualYear': year,
            'metadata.type': 'monthly_rent_accrual',
            source: 'rental_accrual'
        });

        if (existingAccruals.length > 0) {
            console.log(`   ⚠️ Accruals already exist: ${existingAccruals.length} entries`);
            return false;
        } else {
            console.log(`   ✅ No existing accruals - ready for testing`);
            return true;
        }
    } catch (error) {
        console.error(`   ❌ Error checking period ${month}/${year}:`, error);
        return false;
    }
}

// Main execution
async function main() {
    try {
        await connectToDatabase();
        await testMonthlyAccruals();
    } catch (error) {
        console.error('❌ Main error:', error);
    } finally {
        await disconnectFromDatabase();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { testMonthlyAccruals };
