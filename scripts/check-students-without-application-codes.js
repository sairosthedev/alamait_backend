const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/models/User');
const Application = require('../src/models/Application');
const Debtor = require('../src/models/Debtor');

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

async function checkStudentsWithoutApplicationCodes() {
    try {
        // Connect to database first
        await connectDB();
        
        console.log('🔍 Checking for students without application codes...');
        console.log('='.repeat(60));

        // Find all students
        const allStudents = await User.find({ role: 'student' });
        console.log(`📊 Total students found: ${allStudents.length}`);

        // Find students without application codes
        const studentsWithoutAppCodes = allStudents.filter(student => !student.applicationCode);
        console.log(`⚠️  Students without application codes: ${studentsWithoutAppCodes.length}`);

        // Find students with application codes
        const studentsWithAppCodes = allStudents.filter(student => student.applicationCode);
        console.log(`✅ Students with application codes: ${studentsWithAppCodes.length}`);

        if (studentsWithoutAppCodes.length > 0) {
            console.log('\n📋 Students without application codes:');
            console.log('-'.repeat(60));
            
            for (const student of studentsWithoutAppCodes) {
                console.log(`   ${student.firstName} ${student.lastName} (${student.email})`);
                console.log(`   ID: ${student._id}`);
                console.log(`   Created: ${student.createdAt}`);
                console.log(`   Status: ${student.status}`);
                
                // Check if they have applications
                const applications = await Application.find({ 
                    $or: [
                        { student: student._id },
                        { email: student.email }
                    ]
                });
                
                if (applications.length > 0) {
                    console.log(`   📄 Found ${applications.length} application(s):`);
                    applications.forEach(app => {
                        console.log(`      - ${app.applicationCode} (${app.status})`);
                    });
                } else {
                    console.log(`   ❌ No applications found`);
                }
                
                // Check if they have debtors
                const debtors = await Debtor.find({ user: student._id });
                if (debtors.length > 0) {
                    console.log(`   💰 Found ${debtors.length} debtor account(s):`);
                    debtors.forEach(debtor => {
                        console.log(`      - ${debtor.debtorCode} (${debtor.status})`);
                    });
                } else {
                    console.log(`   ❌ No debtor accounts found`);
                }
                
                console.log('');
            }
        }

        // Summary statistics
        console.log('\n📊 Summary Statistics:');
        console.log('-'.repeat(60));
        console.log(`Total Students: ${allStudents.length}`);
        console.log(`With Application Codes: ${studentsWithAppCodes.length}`);
        console.log(`Without Application Codes: ${studentsWithoutAppCodes.length}`);
        console.log(`Percentage Complete: ${((studentsWithAppCodes.length / allStudents.length) * 100).toFixed(1)}%`);

        // Check for orphaned applications
        console.log('\n🔍 Checking for orphaned applications...');
        const orphanedApplications = await Application.find({
            $or: [
                { student: { $exists: false } },
                { student: null }
            ]
        });
        console.log(`📄 Orphaned applications (no student link): ${orphanedApplications.length}`);

        if (orphanedApplications.length > 0) {
            console.log('\n📋 Orphaned applications:');
            orphanedApplications.forEach(app => {
                console.log(`   - ${app.applicationCode} (${app.email}) - ${app.status}`);
            });
        }

        // Check for debtors without application links
        console.log('\n🔍 Checking for debtors without application links...');
        const debtorsWithoutAppLinks = await Debtor.find({
            $or: [
                { application: { $exists: false } },
                { application: null }
            ]
        });
        console.log(`💰 Debtors without application links: ${debtorsWithoutAppLinks.length}`);

        if (debtorsWithoutAppLinks.length > 0) {
            console.log('\n📋 Debtors without application links:');
            debtorsWithoutAppLinks.forEach(debtor => {
                console.log(`   - ${debtor.debtorCode} (${debtor.contactInfo?.email || 'No email'})`);
            });
        }

        // Recommendations
        console.log('\n💡 Recommendations:');
        console.log('-'.repeat(60));
        
        if (studentsWithoutAppCodes.length > 0) {
            console.log(`1. Run migration script for ${studentsWithoutAppCodes.length} students without application codes`);
        }
        
        if (orphanedApplications.length > 0) {
            console.log(`2. Review ${orphanedApplications.length} orphaned applications`);
        }
        
        if (debtorsWithoutAppLinks.length > 0) {
            console.log(`3. Link ${debtorsWithoutAppLinks.length} debtors to applications`);
        }
        
        if (studentsWithoutAppCodes.length === 0 && orphanedApplications.length === 0 && debtorsWithoutAppLinks.length === 0) {
            console.log('✅ All students have proper application codes and links!');
        }

    } catch (error) {
        console.error('❌ Error checking students:', error);
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

// Run the check
checkStudentsWithoutApplicationCodes().then(() => {
    console.log('\n✅ Check completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ Check failed:', error);
    process.exit(1);
}); 