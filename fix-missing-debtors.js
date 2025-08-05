const mongoose = require('mongoose');
const User = require('./src/models/User');
const Debtor = require('./src/models/Debtor');
const { createDebtorForStudent } = require('./src/services/debtorService');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function fixMissingDebtors() {
    try {
        console.log('🔧 Starting debtor account fix...\n');

        // 1. Find all students
        console.log('1. Finding all students...');
        const students = await User.find({ role: 'student' });
        console.log(`   Found ${students.length} students\n`);

        if (students.length === 0) {
            console.log('❌ No students found in the database');
            return;
        }

        // 2. Check which students don't have debtor accounts
        console.log('2. Checking for missing debtor accounts...');
        const studentsWithoutDebtors = [];
        const studentsWithDebtors = [];

        for (const student of students) {
            const debtor = await Debtor.findOne({ user: student._id });
            if (debtor) {
                studentsWithDebtors.push(student);
            } else {
                studentsWithoutDebtors.push(student);
            }
        }

        console.log(`   Students with debtors: ${studentsWithDebtors.length}`);
        console.log(`   Students without debtors: ${studentsWithoutDebtors.length}\n`);

        if (studentsWithoutDebtors.length === 0) {
            console.log('✅ All students already have debtor accounts!');
            return;
        }

        // 3. Show students without debtors
        console.log('3. Students missing debtor accounts:');
        studentsWithoutDebtors.forEach((student, index) => {
            console.log(`   ${index + 1}. ${student.firstName} ${student.lastName} (${student.email})`);
        });
        console.log();

        // 4. Create debtor accounts for missing students
        console.log('4. Creating missing debtor accounts...');
        const createdDebtors = [];
        const failedDebtors = [];

        for (const student of studentsWithoutDebtors) {
            try {
                console.log(`   Creating debtor for: ${student.firstName} ${student.lastName}`);
                
                const debtor = await createDebtorForStudent(student, {
                    createdBy: student._id
                });
                
                createdDebtors.push({
                    student: student.email,
                    debtorCode: debtor.debtorCode,
                    accountCode: debtor.accountCode
                });
                
                console.log(`   ✅ Created: ${debtor.debtorCode} (${debtor.accountCode})`);
            } catch (error) {
                console.log(`   ❌ Failed: ${error.message}`);
                failedDebtors.push({
                    student: student.email,
                    error: error.message
                });
            }
        }

        // 5. Summary
        console.log('\n5. Summary:');
        console.log(`   ✅ Successfully created: ${createdDebtors.length} debtor accounts`);
        console.log(`   ❌ Failed to create: ${failedDebtors.length} debtor accounts`);
        
        if (createdDebtors.length > 0) {
            console.log('\n   Created debtors:');
            createdDebtors.forEach(debtor => {
                console.log(`   - ${debtor.student}: ${debtor.debtorCode} (${debtor.accountCode})`);
            });
        }
        
        if (failedDebtors.length > 0) {
            console.log('\n   Failed to create:');
            failedDebtors.forEach(failure => {
                console.log(`   - ${failure.student}: ${failure.error}`);
            });
        }

        // 6. Final verification
        console.log('\n6. Final verification...');
        const finalStudents = await User.find({ role: 'student' });
        const finalStudentsWithoutDebtors = [];
        
        for (const student of finalStudents) {
            const debtor = await Debtor.findOne({ user: student._id });
            if (!debtor) {
                finalStudentsWithoutDebtors.push(student);
            }
        }
        
        console.log(`   Students still without debtors: ${finalStudentsWithoutDebtors.length}`);
        
        if (finalStudentsWithoutDebtors.length === 0) {
            console.log('   🎉 All students now have debtor accounts!');
        } else {
            console.log('   ⚠️  Some students still missing debtor accounts');
            finalStudentsWithoutDebtors.forEach(student => {
                console.log(`   - ${student.firstName} ${student.lastName} (${student.email})`);
            });
        }

    } catch (error) {
        console.error('❌ Error during debtor fix:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔧 Debtor fix completed');
    }
}

// Run the fix
fixMissingDebtors(); 