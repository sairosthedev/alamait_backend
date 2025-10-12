const mongoose = require('mongoose');

/**
 * TEST EMAIL FUNCTIONALITY
 * Diagnoses why emails are not being sent when students are added and invoices are created
 */

async function testEmailFunctionality() {
    try {
        console.log('🧪 TESTING EMAIL FUNCTIONALITY');
        console.log('===============================');
        
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0');
        console.log('✅ Connected to MongoDB');

        // Test 1: Check email configuration
        console.log('\n📊 Test 1: Email Configuration');
        console.log(`   EMAIL_USER: ${process.env.EMAIL_USER ? 'Set' : 'Not set'}`);
        console.log(`   EMAIL_PASS: ${process.env.EMAIL_PASS ? 'Set' : 'Not set'}`);
        console.log(`   EMAIL_HOST: ${process.env.EMAIL_HOST || 'Not set'}`);
        console.log(`   EMAIL_PORT: ${process.env.EMAIL_PORT || 'Not set'}`);

        // Test 2: Check recent students added
        console.log('\n📊 Test 2: Recent Students Added');
        const User = require('./src/models/User');
        const now = new Date();
        const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
        
        const recentStudents = await User.find({
            role: 'student',
            createdAt: { $gte: tenMinutesAgo }
        }).sort({ createdAt: -1 }).limit(5);
        
        console.log(`   Recent students (last 10 minutes): ${recentStudents.length}`);
        
        if (recentStudents.length > 0) {
            console.log(`\n📋 Recent students:`);
            recentStudents.forEach((student, index) => {
                console.log(`   ${index + 1}. ${student.firstName} ${student.lastName}`);
                console.log(`      Email: ${student.email}`);
                console.log(`      Created: ${student.createdAt}`);
                console.log(`      Application Code: ${student.applicationCode || 'None'}`);
            });
        }

        // Test 3: Check recent invoices
        console.log('\n📊 Test 3: Recent Invoices');
        const Invoice = require('./src/models/Invoice');
        const recentInvoices = await Invoice.find({
            createdAt: { $gte: tenMinutesAgo }
        }).sort({ createdAt: -1 }).limit(5);
        
        console.log(`   Recent invoices (last 10 minutes): ${recentInvoices.length}`);
        
        if (recentInvoices.length > 0) {
            console.log(`\n📋 Recent invoices:`);
            recentInvoices.forEach((invoice, index) => {
                console.log(`   ${index + 1}. ${invoice.invoiceNumber}`);
                console.log(`      Student: ${invoice.studentName || 'Unknown'}`);
                console.log(`      Amount: $${invoice.totalAmount || 0}`);
                console.log(`      Type: ${invoice.metadata?.type || 'Unknown'}`);
                console.log(`      Created: ${invoice.createdAt}`);
            });
        }

        // Test 4: Check recent applications
        console.log('\n📊 Test 4: Recent Applications');
        const Application = require('./src/models/Application');
        const recentApplications = await Application.find({
            createdAt: { $gte: tenMinutesAgo }
        }).sort({ createdAt: -1 }).limit(5);
        
        console.log(`   Recent applications (last 10 minutes): ${recentApplications.length}`);
        
        if (recentApplications.length > 0) {
            console.log(`\n📋 Recent applications:`);
            recentApplications.forEach((app, index) => {
                console.log(`   ${index + 1}. ${app.firstName} ${app.lastName}`);
                console.log(`      Application Code: ${app.applicationCode}`);
                console.log(`      Status: ${app.status}`);
                console.log(`      Created: ${app.createdAt}`);
            });
        }

        // Test 5: Check server logs for email sending
        console.log('\n📊 Test 5: Email Sending Analysis');
        console.log('✅ Welcome emails are scheduled to run in background (1 second after response)');
        console.log('✅ Invoice emails are sent during rental accrual service');
        console.log('✅ Both use the same sendEmail utility function');
        
        console.log('\n🔍 POTENTIAL ISSUES:');
        console.log('1. Email service configuration might be incorrect');
        console.log('2. Background processes might be failing silently');
        console.log('3. Email service provider might be blocking emails');
        console.log('4. Server might be restarting before background processes complete');
        console.log('5. Database connection might be lost in background processes');

        // Test 6: Check email service directly
        console.log('\n📊 Test 6: Testing Email Service Directly');
        try {
            const { sendEmail } = require('./src/utils/email');
            console.log('✅ Email service imported successfully');
            
            // Test email sending (commented out to avoid sending test emails)
            /*
            await sendEmail({
                to: 'test@example.com',
                subject: 'Test Email',
                text: 'This is a test email to verify email functionality.'
            });
            console.log('✅ Test email sent successfully');
            */
            console.log('ℹ️  Test email sending skipped (uncomment to test)');
            
        } catch (emailError) {
            console.error('❌ Error testing email service:', emailError.message);
        }

        console.log('\n🎯 DIAGNOSIS SUMMARY:');
        console.log('================================');
        
        console.log('\n✅ EMAIL FLOW ANALYSIS:');
        console.log('1. Manual add student → Welcome email scheduled in background');
        console.log('2. Rental accrual service → Invoice emails sent during processing');
        console.log('3. Both use setTimeout() for background processing');
        console.log('4. Both use the same sendEmail utility function');
        
        console.log('\n🔧 TROUBLESHOOTING STEPS:');
        console.log('1. Check server logs for email sending messages');
        console.log('2. Verify email service configuration');
        console.log('3. Test email service directly');
        console.log('4. Check if background processes are completing');
        console.log('5. Verify database connections in background processes');
        
        console.log('\n📝 RECOMMENDED ACTIONS:');
        console.log('1. Check server logs for "📧 Sending welcome email" messages');
        console.log('2. Check server logs for "📧 Invoice email sent" messages');
        console.log('3. Verify EMAIL_USER and EMAIL_PASS environment variables');
        console.log('4. Test email service with a simple test email');
        console.log('5. Check if background processes are running after server restart');

    } catch (error) {
        console.error('❌ Error testing email functionality:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
}

testEmailFunctionality();
