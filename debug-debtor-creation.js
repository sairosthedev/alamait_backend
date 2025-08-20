const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Application = require('./src/models/Application');
const User = require('./src/models/User');
const Debtor = require('./src/models/Debtor');

// Database connection
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        process.exit(1);
    }
};

async function debugDebtorCreation() {
    try {
        await connectDB();
        
        console.log('\n🔍 DEBUGGING DEBTOR CREATION');
        console.log('============================\n');
        
        // Find the specific application
        const applicationId = '68a64eab8198c1baec306da3';
        const application = await Application.findById(applicationId).lean();
        
        if (!application) {
            console.log('❌ Application not found');
            return;
        }
        
        console.log('📋 APPLICATION DETAILS:');
        console.log('========================');
        console.log(`ID: ${application._id}`);
        console.log(`Student: ${application.student}`);
        console.log(`Email: ${application.email}`);
        console.log(`Name: ${application.firstName} ${application.lastName}`);
        console.log(`Status: ${application.status}`);
        console.log(`Payment Status: ${application.paymentStatus}`);
        console.log(`Allocated Room: ${application.allocatedRoom}`);
        console.log(`Residence: ${application.residence}`);
        console.log(`Start Date: ${application.startDate}`);
        console.log(`End Date: ${application.endDate}`);
        
        // Check if student exists
        const student = await User.findById(application.student).lean();
        console.log('\n👤 STUDENT DETAILS:');
        console.log('===================');
        if (student) {
            console.log(`Student ID: ${student._id}`);
            console.log(`Email: ${student.email}`);
            console.log(`Name: ${student.firstName} ${student.lastName}`);
            console.log(`Role: ${student.role}`);
            console.log(`Status: ${student.status}`);
            console.log(`Application Code: ${student.applicationCode || 'NOT SET'}`);
        } else {
            console.log('❌ Student not found!');
        }
        
        // Check if debtor already exists
        const existingDebtor = await Debtor.findOne({
            'contactInfo.email': application.email
        }).lean();
        
        console.log('\n💰 DEBTOR STATUS:');
        console.log('=================');
        if (existingDebtor) {
            console.log('✅ Debtor already exists:');
            console.log(`   Debtor ID: ${existingDebtor._id}`);
            console.log(`   Debtor Code: ${existingDebtor.debtorCode}`);
            console.log(`   Email: ${existingDebtor.contactInfo.email}`);
            console.log(`   Application Link: ${existingDebtor.application || 'NOT LINKED'}`);
            console.log(`   Application Code: ${existingDebtor.applicationCode || 'NOT SET'}`);
        } else {
            console.log('❌ No debtor found for this application');
        }
        
        // Check all debtors for this email
        const allDebtorsForEmail = await Debtor.find({
            'contactInfo.email': application.email
        }).lean();
        
        console.log('\n🔍 ALL DEBTORS FOR THIS EMAIL:');
        console.log('===============================');
        if (allDebtorsForEmail.length > 0) {
            allDebtorsForEmail.forEach((debtor, index) => {
                console.log(`${index + 1}. Debtor ID: ${debtor._id}`);
                console.log(`   Debtor Code: ${debtor.debtorCode}`);
                console.log(`   Application Link: ${debtor.application || 'NOT LINKED'}`);
                console.log(`   Application Code: ${debtor.applicationCode || 'NOT SET'}`);
                console.log(`   Created: ${debtor.createdAt}`);
            });
        } else {
            console.log('No debtors found for this email');
        }
        
        // Check if there are any debtors linked to this application
        const debtorsForApplication = await Debtor.find({
            application: application._id
        }).lean();
        
        console.log('\n🔗 DEBTORS LINKED TO THIS APPLICATION:');
        console.log('=======================================');
        if (debtorsForApplication.length > 0) {
            debtorsForApplication.forEach((debtor, index) => {
                console.log(`${index + 1}. Debtor ID: ${debtor._id}`);
                console.log(`   Debtor Code: ${debtor.debtorCode}`);
                console.log(`   Email: ${debtor.contactInfo.email}`);
            });
        } else {
            console.log('No debtors linked to this application');
        }
        
        // Check the debtor creation service
        console.log('\n🔧 DEBTOR CREATION SERVICE ANALYSIS:');
        console.log('=====================================');
        
        // Simulate what the debtor creation would need
        console.log('Required data for debtor creation:');
        console.log(`- Student ID: ${application.student}`);
        console.log(`- Residence ID: ${application.residence}`);
        console.log(`- Room Number: ${application.allocatedRoom}`);
        console.log(`- Application ID: ${application._id}`);
        console.log(`- Application Code: ${application.applicationCode || 'NOT SET'}`);
        console.log(`- Start Date: ${application.startDate}`);
        console.log(`- End Date: ${application.endDate}`);
        
        // Check if the application has an application code
        if (!application.applicationCode) {
            console.log('\n❌ PROBLEM IDENTIFIED: Application has no applicationCode!');
            console.log('This would cause debtor creation to fail.');
        } else {
            console.log(`\n✅ Application Code: ${application.applicationCode}`);
        }
        
        // Check if the student has the application code
        if (student && student.applicationCode !== application.applicationCode) {
            console.log('\n❌ PROBLEM IDENTIFIED: Student applicationCode mismatch!');
            console.log(`Student has: ${student.applicationCode}`);
            console.log(`Application has: ${application.applicationCode}`);
        }
        
        // Check recent debtor creation attempts
        console.log('\n📊 RECENT DEBTOR CREATION ATTEMPTS:');
        console.log('====================================');
        
        const recentDebtors = await Debtor.find({
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
        }).sort({ createdAt: -1 }).limit(10).lean();
        
        if (recentDebtors.length > 0) {
            console.log('Recent debtors created:');
            recentDebtors.forEach((debtor, index) => {
                console.log(`${index + 1}. ${debtor.contactInfo.email} - ${debtor.createdAt}`);
                console.log(`   Application: ${debtor.application || 'NOT LINKED'}`);
            });
        } else {
            console.log('No recent debtors found');
        }
        
        // Check for any error logs or failed attempts
        console.log('\n💡 POSSIBLE REASONS FOR FAILURE:');
        console.log('==================================');
        console.log('1. Application code missing or invalid');
        console.log('2. Student not properly linked to application');
        console.log('3. Debtor creation service error');
        console.log('4. Database connection issues during creation');
        console.log('5. Validation errors in debtor creation');
        
        console.log('\n🔄 SUGGESTED FIXES:');
        console.log('===================');
        console.log('1. Check if application has applicationCode');
        console.log('2. Verify student-application linking');
        console.log('3. Manually create debtor if needed');
        console.log('4. Check server logs for errors');
        
    } catch (error) {
        console.error('❌ Debug failed:', error);
    } finally {
        try {
            await mongoose.connection.close();
            console.log('\n✅ Database connection closed');
        } catch (closeError) {
            console.log('⚠️  Error closing database connection:', closeError.message);
        }
        process.exit(0);
    }
}

debugDebtorCreation(); 