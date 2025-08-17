const mongoose = require('mongoose');
const User = require('./src/models/User');
const Debtor = require('./src/models/Debtor');
const { createDebtorForStudent } = require('./src/services/debtorService');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function testDebtorCreation() {
    try {
        console.log('🧪 Testing Debtor Creation Process...\n');

        // 1. Test database connection
        console.log('1. Testing database connection...');
        const dbState = mongoose.connection.readyState;
        const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
        console.log(`   Database state: ${states[dbState]}`);
        
        if (dbState !== 1) {
            console.log('   ❌ Database not connected properly');
            return;
        }
        console.log('   ✅ Database connected successfully\n');

        // 2. Check if models are working
        console.log('2. Testing model functionality...');
        
        // Test User model
        const userCount = await User.countDocuments();
        console.log(`   Users in database: ${userCount}`);
        
        // Test Debtor model
        const debtorCount = await Debtor.countDocuments();
        console.log(`   Debtors in database: ${debtorCount}`);
        
        // Test code generation
        try {
            const testDebtorCode = await Debtor.generateDebtorCode();
            const testAccountCode = await Debtor.generateAccountCode();
            console.log(`   ✅ Code generation working: ${testDebtorCode}, ${testAccountCode}`);
        } catch (error) {
            console.log(`   ❌ Code generation failed: ${error.message}`);
        }
        console.log();

        // 3. Find a test student
        console.log('3. Finding a test student...');
        let testStudent = await User.findOne({ role: 'student' });
        
        if (!testStudent) {
            console.log('   ❌ No students found in database');
            console.log('   Please add a student first to test debtor creation');
            return;
        }
        
        console.log(`   ✅ Found test student: ${testStudent.firstName} ${testStudent.lastName} (${testStudent.email})`);
        console.log(`   Student ID: ${testStudent._id}`);
        console.log();

        // 4. Check if student already has debtor
        console.log('4. Checking if student already has debtor...');
        const existingDebtor = await Debtor.findOne({ user: testStudent._id });
        
        if (existingDebtor) {
            console.log(`   ⚠️  Student already has debtor: ${existingDebtor.debtorCode}`);
            console.log(`   Account Code: ${existingDebtor.accountCode}`);
            console.log();
            
            // Test with a different student
            const otherStudents = await User.find({ 
                role: 'student',
                _id: { $ne: testStudent._id }
            });
            
            if (otherStudents.length > 0) {
                const newTestStudent = otherStudents[0];
                console.log(`   Testing with different student: ${newTestStudent.firstName} ${newTestStudent.lastName}`);
                
                const newExistingDebtor = await Debtor.findOne({ user: newTestStudent._id });
                if (!newExistingDebtor) {
                    console.log('   ✅ Found student without debtor, proceeding with test');
                    testStudent = newTestStudent;
                } else {
                    console.log('   ❌ All students already have debtors');
                    return;
                }
            } else {
                console.log('   ❌ Only one student found and already has debtor');
                return;
            }
        } else {
            console.log('   ✅ Student does not have debtor account');
        }
        console.log();

        // 5. Test the createDebtorForStudent function
        console.log('5. Testing createDebtorForStudent function...');
        try {
            console.log(`   Attempting to create debtor for: ${testStudent.firstName} ${testStudent.lastName}`);
            
            const debtor = await createDebtorForStudent(testStudent, {
                createdBy: testStudent._id // Using student ID as createdBy for testing
            });
            
            console.log(`   ✅ Successfully created debtor!`);
            console.log(`   Debtor Code: ${debtor.debtorCode}`);
            console.log(`   Account Code: ${debtor.accountCode}`);
            console.log(`   Contact Info: ${debtor.contactInfo?.name}`);
            console.log(`   Status: ${debtor.status}`);
            console.log();

            // 6. Verify the debtor was saved
            console.log('6. Verifying debtor was saved to database...');
            const savedDebtor = await Debtor.findOne({ user: testStudent._id });
            
            if (savedDebtor) {
                console.log(`   ✅ Debtor found in database: ${savedDebtor.debtorCode}`);
                console.log(`   Created at: ${savedDebtor.createdAt}`);
                console.log(`   Created by: ${savedDebtor.createdBy}`);
            } else {
                console.log('   ❌ Debtor not found in database after creation');
            }

        } catch (error) {
            console.log(`   ❌ Failed to create debtor: ${error.message}`);
            console.log(`   Error stack: ${error.stack}`);
            console.log();
            
            // 7. Detailed error analysis
            console.log('7. Analyzing error...');
            
            if (error.message.includes('validation')) {
                console.log('   🔍 This appears to be a validation error');
                console.log('   Check if all required fields are present in the student object');
            } else if (error.message.includes('duplicate')) {
                console.log('   🔍 This appears to be a duplicate key error');
                console.log('   Check if debtor codes are conflicting');
            } else if (error.message.includes('connection')) {
                console.log('   🔍 This appears to be a database connection error');
                console.log('   Check MongoDB connection and permissions');
            } else {
                console.log('   🔍 Unknown error type');
                console.log('   Check the error stack trace above for more details');
            }
        }

        // 8. Test the manualAddStudent function simulation
        console.log('\n8. Testing manualAddStudent simulation...');
        try {
            // Simulate the exact same process as manualAddStudent
            console.log('   Simulating student creation process...');
            
            // Create a test student object similar to what manualAddStudent would create
            const testStudentData = {
                _id: testStudent._id,
                email: testStudent.email,
                firstName: testStudent.firstName,
                lastName: testStudent.lastName,
                phone: testStudent.phone,
                role: 'student',
                status: 'active'
            };
            
            // Test debtor creation with the same parameters as manualAddStudent
            const testDebtor = await createDebtorForStudent(testStudentData, {
                residenceId: null, // manualAddStudent passes this
                roomNumber: null,  // manualAddStudent passes this
                createdBy: testStudent._id
            });
            
            console.log(`   ✅ ManualAddStudent simulation successful!`);
            console.log(`   Created debtor: ${testDebtor.debtorCode}`);
            
        } catch (error) {
            console.log(`   ❌ ManualAddStudent simulation failed: ${error.message}`);
        }

    } catch (error) {
        console.error('❌ Test error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🧪 Test completed');
    }
}

// Run the test
testDebtorCreation(); 