const mongoose = require('mongoose');
const User = require('./src/models/User');
const Debtor = require('./src/models/Debtor');
const { createDebtorForStudent } = require('./src/services/debtorService');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function checkAndCreateMissingDebtors() {
    try {
        console.log('🔍 Checking for students without debtor accounts...');
        
        // Find all students
        const students = await User.find({ role: 'student' });
        console.log(`Found ${students.length} students total`);
        
        const studentsWithoutDebtors = [];
        const studentsWithDebtors = [];
        
        // Check each student for debtor account
        for (const student of students) {
            const debtor = await Debtor.findOne({ user: student._id });
            if (debtor) {
                studentsWithDebtors.push({
                    studentId: student._id,
                    email: student.email,
                    debtorCode: debtor.debtorCode,
                    accountCode: debtor.accountCode
                });
            } else {
                studentsWithoutDebtors.push({
                    studentId: student._id,
                    email: student.email,
                    firstName: student.firstName,
                    lastName: student.lastName
                });
            }
        }
        
        console.log(`✅ Students with debtor accounts: ${studentsWithDebtors.length}`);
        console.log(`❌ Students without debtor accounts: ${studentsWithoutDebtors.length}`);
        
        if (studentsWithoutDebtors.length === 0) {
            console.log('🎉 All students have debtor accounts!');
            return;
        }
        
        console.log('\n📋 Students without debtor accounts:');
        studentsWithoutDebtors.forEach((student, index) => {
            console.log(`${index + 1}. ${student.email} (${student.firstName} ${student.lastName})`);
        });
        
        // Create debtor accounts for missing students
        console.log('\n🔄 Creating debtor accounts for missing students...');
        const createdDebtors = [];
        const errors = [];
        
        for (const student of studentsWithoutDebtors) {
            try {
                const user = await User.findById(student.studentId);
                if (!user) {
                    console.log(`⚠️  User not found: ${student.email}`);
                    continue;
                }
                
                const debtor = await createDebtorForStudent(user, {
                    createdBy: user._id
                });
                
                createdDebtors.push({
                    studentId: student.studentId,
                    email: student.email,
                    debtorCode: debtor.debtorCode,
                    accountCode: debtor.accountCode
                });
                
                console.log(`✅ Created debtor for ${student.email}: ${debtor.debtorCode}`);
            } catch (error) {
                console.error(`❌ Error creating debtor for ${student.email}:`, error.message);
                errors.push({
                    email: student.email,
                    error: error.message
                });
            }
        }
        
        console.log('\n📊 Summary:');
        console.log(`✅ Successfully created: ${createdDebtors.length} debtor accounts`);
        console.log(`❌ Errors: ${errors.length}`);
        
        if (errors.length > 0) {
            console.log('\n❌ Errors encountered:');
            errors.forEach(error => {
                console.log(`- ${error.email}: ${error.error}`);
            });
        }
        
        if (createdDebtors.length > 0) {
            console.log('\n✅ Successfully created debtors:');
            createdDebtors.forEach(debtor => {
                console.log(`- ${debtor.email}: ${debtor.debtorCode} (${debtor.accountCode})`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error in checkAndCreateMissingDebtors:', error);
    } finally {
        mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
}

// Run the function
checkAndCreateMissingDebtors(); 