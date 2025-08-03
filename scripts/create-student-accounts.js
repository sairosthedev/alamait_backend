const mongoose = require('mongoose');
const User = require('../src/models/User');
const StudentAccount = require('../src/models/StudentAccount');
const Account = require('../src/models/Account');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_backend';

async function createStudentAccounts() {
    try {
        console.log('🔗 Connecting to database...');
        await mongoose.connect(MONGODB_URI, { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });
        console.log('✅ Connected to database');

        // Get all students
        const students = await User.find({ role: 'student' });
        console.log(`📊 Found ${students.length} students`);

        let createdCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const student of students) {
            try {
                // Check if account already exists
                const existingAccount = await StudentAccount.findOne({ student: student._id });
                if (existingAccount) {
                    console.log(`⏭️  Skipping ${student.firstName} ${student.lastName} - account already exists`);
                    skippedCount++;
                    continue;
                }

                // Create student account
                const studentAccount = new StudentAccount({
                    student: student._id,
                    balance: 0, // Start with zero balance
                    notes: `Auto-created account for existing student`,
                    createdBy: null // System creation
                });

                await studentAccount.save();

                // Create corresponding chart of accounts entry
                const chartAccount = new Account({
                    code: studentAccount.accountCode,
                    name: `Student Account - ${student.firstName} ${student.lastName}`,
                    type: 'Asset'
                });

                await chartAccount.save();

                console.log(`✅ Created account for ${student.firstName} ${student.lastName} (${studentAccount.accountCode})`);
                createdCount++;

            } catch (error) {
                console.error(`❌ Error creating account for ${student.firstName} ${student.lastName}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n📈 Migration Summary:');
        console.log(`✅ Created: ${createdCount} accounts`);
        console.log(`⏭️  Skipped: ${skippedCount} accounts (already existed)`);
        console.log(`❌ Errors: ${errorCount} accounts`);

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from database');
        process.exit(0);
    }
}

// Run migration
createStudentAccounts(); 