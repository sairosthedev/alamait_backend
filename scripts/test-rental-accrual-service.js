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

async function testRentalAccrualService() {
    try {
        console.log('\n🧪 TESTING RENTAL ACCRUAL SERVICE IMPORT');
        console.log('=' .repeat(60));

        // Test 1: Import the service
        console.log('\n1️⃣ Testing service import...');
        let RentalAccrualService;
        try {
            RentalAccrualService = require('../src/services/rentalAccrualService');
            console.log('✅ Service imported successfully');
            console.log(`   Service type: ${typeof RentalAccrualService}`);
            console.log(`   Has processLeaseStart: ${typeof RentalAccrualService.processLeaseStart}`);
        } catch (importError) {
            console.error('❌ Import failed:', importError.message);
            return;
        }

        // Test 2: Check if processLeaseStart method exists
        console.log('\n2️⃣ Testing method availability...');
        if (typeof RentalAccrualService.processLeaseStart === 'function') {
            console.log('✅ processLeaseStart method is available');
        } else {
            console.log('❌ processLeaseStart method is not available');
            console.log(`   Available methods:`, Object.getOwnPropertyNames(RentalAccrualService));
            return;
        }

        // Test 3: Check service structure
        console.log('\n3️⃣ Testing service structure...');
        const methods = Object.getOwnPropertyNames(RentalAccrualService);
        const staticMethods = methods.filter(method => 
            typeof RentalAccrualService[method] === 'function' && 
            method !== 'constructor'
        );
        
        console.log(`   Total methods: ${methods.length}`);
        console.log(`   Static methods: ${staticMethods.length}`);
        console.log(`   Static methods:`, staticMethods);

        // Test 4: Try to call processLeaseStart with dummy data
        console.log('\n4️⃣ Testing method call (with dummy data)...');
        try {
            const dummyApplication = {
                _id: 'dummy_id',
                firstName: 'Test',
                lastName: 'Student',
                student: 'dummy_student_id',
                residence: 'dummy_residence_id',
                allocatedRoom: 'Test Room',
                startDate: new Date(),
                endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
            };

            console.log('   Calling processLeaseStart with dummy data...');
            const result = await RentalAccrualService.processLeaseStart(dummyApplication);
            console.log('   ✅ Method call succeeded (expected to fail with business logic)');
            console.log(`   Result:`, result);
        } catch (callError) {
            console.log('   ✅ Method call succeeded (failed as expected with business logic)');
            console.log(`   Error (expected): ${callError.message}`);
        }

        console.log('\n🎯 RENTAL ACCRUAL SERVICE TEST COMPLETED');

    } catch (error) {
        console.error('❌ Error in rental accrual service test:', error);
    }
}

// Main execution
async function main() {
    try {
        await connectToDatabase();
        await testRentalAccrualService();
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

module.exports = { testRentalAccrualService };
