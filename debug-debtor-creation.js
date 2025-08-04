const mongoose = require('mongoose');
const User = require('./src/models/User');
const Debtor = require('./src/models/Debtor');
const { createDebtorForStudent } = require('./src/services/debtorService');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function debugDebtorCreation() {
    try {
        console.log('🔍 Starting debtor creation debug...\n');

        // 1. Check if there are any students without debtor accounts
        console.log('1. Checking students without debtor accounts...');
        const students = await User.find({ role: 'student' });
        console.log(`   Found ${students.length} students total`);

        const studentsWithoutDebtors = [];
        for (const student of students) {
            const debtor = await Debtor.findOne({ user: student._id });
            if (!debtor) {
                studentsWithoutDebtors.push(student);
            }
        }

        console.log(`   Found ${studentsWithoutDebtors.length} students without debtor accounts\n`);

        if (studentsWithoutDebtors.length === 0) {
            console.log('✅ All students have debtor accounts!');
            return;
        }

        // 2. Show students without debtors
        console.log('2. Students without debtor accounts:');
        studentsWithoutDebtors.forEach((student, index) => {
            console.log(`   ${index + 1}. ${student.firstName} ${student.lastName} (${student.email})`);
        });
        console.log();

        // 3. Test debtor creation for the first student without debtor
        if (studentsWithoutDebtors.length > 0) {
            const testStudent = studentsWithoutDebtors[0];
            console.log(`3. Testing debtor creation for: ${testStudent.firstName} ${testStudent.lastName}`);
            
            try {
                const debtor = await createDebtorForStudent(testStudent, {
                    createdBy: testStudent._id
                });
                console.log(`   ✅ Successfully created debtor: ${debtor.debtorCode}`);
                console.log(`   Account Code: ${debtor.accountCode}`);
            } catch (error) {
                console.log(`   ❌ Failed to create debtor: ${error.message}`);
                console.log(`   Error details:`, error);
            }
        }

        // 4. Check if there are any existing debtors
        console.log('\n4. Checking existing debtors...');
        const existingDebtors = await Debtor.find({});
        console.log(`   Found ${existingDebtors.length} existing debtors`);
        
        if (existingDebtors.length > 0) {
            console.log('   Sample debtors:');
            existingDebtors.slice(0, 3).forEach(debtor => {
                console.log(`   - ${debtor.debtorCode}: ${debtor.contactInfo?.name || 'No name'}`);
            });
        }

    } catch (error) {
        console.error('❌ Debug error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔍 Debug completed');
    }
}

// Run the debug
debugDebtorCreation(); 