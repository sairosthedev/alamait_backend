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

async function fixApplicationAndCreateDebtor() {
    try {
        await connectDB();
        
        console.log('\n🔧 FIXING APPLICATION AND CREATING DEBTOR');
        console.log('==========================================\n');
        
        // Find the specific application
        const applicationId = '68a64eab8198c1baec306da3';
        const application = await Application.findById(applicationId);
        
        if (!application) {
            console.log('❌ Application not found');
            return;
        }
        
        console.log('📋 CURRENT APPLICATION STATE:');
        console.log('==============================');
        console.log(`ID: ${application._id}`);
        console.log(`Email: ${application.email}`);
        console.log(`Name: ${application.firstName} ${application.lastName}`);
        console.log(`Status: ${application.status}`);
        console.log(`Application Code: ${application.applicationCode || 'MISSING'}`);
        
        // Generate application code if missing
        if (!application.applicationCode) {
            console.log('\n🔧 GENERATING APPLICATION CODE...');
            const applicationCode = `APP${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
            application.applicationCode = applicationCode;
            console.log(`✅ Generated application code: ${applicationCode}`);
        }
        
        // Save the application with the code
        await application.save();
        console.log('✅ Application updated with application code');
        
        // Update the student with the application code
        const student = await User.findById(application.student);
        if (student) {
            console.log('\n👤 UPDATING STUDENT...');
            student.applicationCode = application.applicationCode;
            await student.save();
            console.log(`✅ Student updated with application code: ${application.applicationCode}`);
        } else {
            console.log('❌ Student not found');
        }
        
        // Check if debtor already exists
        const existingDebtor = await Debtor.findOne({
            'contactInfo.email': application.email
        });
        
        if (existingDebtor) {
            console.log('\n💰 DEBTOR ALREADY EXISTS:');
            console.log('==========================');
            console.log(`Debtor ID: ${existingDebtor._id}`);
            console.log(`Debtor Code: ${existingDebtor.debtorCode}`);
            console.log(`Email: ${existingDebtor.contactInfo.email}`);
            
            // Update the existing debtor to link to this application
            existingDebtor.application = application._id;
            existingDebtor.applicationCode = application.applicationCode;
            await existingDebtor.save();
            console.log('✅ Updated existing debtor with application link');
            
        } else {
            console.log('\n💰 CREATING NEW DEBTOR...');
            
            // Create debtor data
            const debtorData = {
                debtorCode: `DEBT${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
                contactInfo: {
                    firstName: application.firstName,
                    lastName: application.lastName,
                    email: application.email,
                    phone: application.phone
                },
                application: application._id,
                applicationCode: application.applicationCode,
                residenceId: application.residence,
                roomNumber: application.allocatedRoom,
                startDate: application.startDate,
                endDate: application.endDate,
                roomPrice: 220, // Default price for Exclusive Room
                currentBalance: 0,
                totalPaid: 0,
                status: 'active',
                createdBy: application.actionBy || application.student
            };
            
            // Create the debtor
            const debtor = new Debtor(debtorData);
            await debtor.save();
            
            console.log('✅ New debtor created successfully!');
            console.log(`Debtor ID: ${debtor._id}`);
            console.log(`Debtor Code: ${debtor.debtorCode}`);
            console.log(`Application Link: ${debtor.application}`);
            console.log(`Application Code: ${debtor.applicationCode}`);
        }
        
        // Verify the fix
        console.log('\n🔍 VERIFICATION:');
        console.log('================');
        
        const updatedApplication = await Application.findById(applicationId).lean();
        const updatedStudent = await User.findById(application.student).lean();
        const updatedDebtor = await Debtor.findOne({
            'contactInfo.email': application.email
        }).lean();
        
        console.log('\n📋 UPDATED APPLICATION:');
        console.log(`Application Code: ${updatedApplication.applicationCode}`);
        console.log(`Status: ${updatedApplication.status}`);
        
        console.log('\n👤 UPDATED STUDENT:');
        console.log(`Application Code: ${updatedStudent.applicationCode}`);
        console.log(`Status: ${updatedStudent.status}`);
        
        console.log('\n💰 UPDATED DEBTOR:');
        if (updatedDebtor) {
            console.log(`Debtor Code: ${updatedDebtor.debtorCode}`);
            console.log(`Application Link: ${updatedDebtor.application}`);
            console.log(`Application Code: ${updatedDebtor.applicationCode}`);
            console.log(`Status: ${updatedDebtor.status}`);
        } else {
            console.log('❌ No debtor found');
        }
        
        console.log('\n✅ FIX COMPLETE!');
        console.log('================');
        console.log('1. Application now has application code');
        console.log('2. Student linked to application code');
        console.log('3. Debtor created and linked to application');
        console.log('4. All entities properly connected');
        
    } catch (error) {
        console.error('❌ Fix failed:', error);
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

fixApplicationAndCreateDebtor(); 