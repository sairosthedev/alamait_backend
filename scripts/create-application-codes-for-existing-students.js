const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/models/User');
const Application = require('../src/models/Application');
const Debtor = require('../src/models/Debtor');
const { createDebtorForStudent } = require('../src/services/debtorService');

// Database connection
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:12345678@cluster0.qzq1z.mongodb.net/alamait?retryWrites=true&w=majority&appName=Cluster0');
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        process.exit(1);
    }
};

async function createApplicationCodesForExistingStudents() {
    try {
        // Connect to database first
        await connectDB();
        
        console.log('🔄 Creating application codes for existing students...');
        console.log('='.repeat(60));

        // Find students without application codes
        const studentsWithoutAppCodes = await User.find({ 
            role: 'student',
            $or: [
                { applicationCode: { $exists: false } },
                { applicationCode: null },
                { applicationCode: '' }
            ]
        });

        console.log(`📊 Found ${studentsWithoutAppCodes.length} students without application codes`);

        if (studentsWithoutAppCodes.length === 0) {
            console.log('✅ All students already have application codes!');
            return;
        }

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const student of studentsWithoutAppCodes) {
            try {
                console.log(`\n🔄 Processing: ${student.firstName} ${student.lastName} (${student.email})`);
                
                // Check if student already has an application
                let existingApplication = await Application.findOne({
                    $or: [
                        { student: student._id },
                        { email: student.email }
                    ]
                });

                let applicationCode;

                if (existingApplication) {
                    // Use existing application code
                    applicationCode = existingApplication.applicationCode;
                    console.log(`   📄 Found existing application: ${applicationCode}`);
                    
                    // Update the application to link to student if not already linked
                    if (!existingApplication.student) {
                        existingApplication.student = student._id;
                        await existingApplication.save();
                        console.log(`   🔗 Linked application to student`);
                    }
                } else {
                    // Generate new application code
                    applicationCode = `APP${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
                    console.log(`   🆕 Generated new application code: ${applicationCode}`);
                    
                    // Create application record
                    const application = new Application({
                        student: student._id,
                        email: student.email,
                        firstName: student.firstName,
                        lastName: student.lastName,
                        phone: student.phone,
                        requestType: 'new',
                        status: 'approved', // Assume approved since they're existing students
                        paymentStatus: 'paid', // Assume paid since they're existing students
                        startDate: student.createdAt || new Date(),
                        endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
                        preferredRoom: student.currentRoom || 'Unknown',
                        allocatedRoom: student.currentRoom || 'Unknown',
                        residence: student.residence,
                        applicationCode: applicationCode,
                        applicationDate: student.createdAt || new Date(),
                        actionDate: new Date()
                    });

                    await application.save();
                    console.log(`   📄 Created new application record`);
                }

                // Update student with application code
                student.applicationCode = applicationCode;
                await student.save();
                console.log(`   ✅ Updated student with application code`);

                // Check if student has debtor account
                const existingDebtor = await Debtor.findOne({ user: student._id });
                
                if (existingDebtor) {
                    // Update existing debtor with application link
                    existingDebtor.application = existingApplication?._id || (await Application.findOne({ applicationCode }))._id;
                    existingDebtor.applicationCode = applicationCode;
                    await existingDebtor.save();
                    console.log(`   🔗 Updated existing debtor with application link`);
                } else {
                    // Create new debtor account
                    try {
                        const debtor = await createDebtorForStudent(student, {
                            createdBy: student._id,
                            application: existingApplication?._id || (await Application.findOne({ applicationCode }))._id,
                            applicationCode: applicationCode,
                            residenceId: student.residence,
                            roomNumber: student.currentRoom || 'Unknown',
                            startDate: student.createdAt || new Date(),
                            endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
                            roomPrice: 750 // Default price, adjust as needed
                        });
                        console.log(`   💰 Created new debtor account: ${debtor.debtorCode}`);
                    } catch (debtorError) {
                        console.log(`   ⚠️  Failed to create debtor: ${debtorError.message}`);
                    }
                }

                successCount++;
                console.log(`   ✅ Successfully processed`);

            } catch (error) {
                errorCount++;
                const errorInfo = {
                    student: `${student.firstName} ${student.lastName} (${student.email})`,
                    error: error.message
                };
                errors.push(errorInfo);
                console.log(`   ❌ Error: ${error.message}`);
            }
        }

        // Summary
        console.log('\n📊 Migration Summary:');
        console.log('-'.repeat(60));
        console.log(`Total Students Processed: ${studentsWithoutAppCodes.length}`);
        console.log(`Successful: ${successCount}`);
        console.log(`Failed: ${errorCount}`);
        console.log(`Success Rate: ${((successCount / studentsWithoutAppCodes.length) * 100).toFixed(1)}%`);

        if (errors.length > 0) {
            console.log('\n❌ Errors encountered:');
            errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error.student}: ${error.error}`);
            });
        }

        // Final verification
        console.log('\n🔍 Final verification...');
        const remainingStudentsWithoutCodes = await User.find({ 
            role: 'student',
            $or: [
                { applicationCode: { $exists: false } },
                { applicationCode: null },
                { applicationCode: '' }
            ]
        });
        
        console.log(`Students still without application codes: ${remainingStudentsWithoutCodes.length}`);

        if (remainingStudentsWithoutCodes.length === 0) {
            console.log('✅ All students now have application codes!');
        } else {
            console.log('⚠️  Some students still need manual attention');
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        // Close database connection
        try {
            await mongoose.connection.close();
            console.log('✅ Database connection closed');
        } catch (closeError) {
            console.log('⚠️  Error closing database connection:', closeError.message);
        }
    }
}

// Run the migration
createApplicationCodesForExistingStudents().then(() => {
    console.log('\n✅ Migration completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
}); 