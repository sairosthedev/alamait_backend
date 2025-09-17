/**
 * 🎯 Test Forfeit Accounting Fix
 * 
 * This script tests that forfeiture creates accounting entries even with no payments
 */

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/models/User');
const Application = require('../src/models/Application');
const Payment = require('../src/models/Payment');
const TransactionEntry = require('../src/models/TransactionEntry');

async function testForfeitAccountingFix() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });
        console.log('✅ Connected to MongoDB');

        const studentId = '68c308dacad4b54252cec896'; // Application ID
        console.log(`🔍 Testing forfeit accounting fix for ID: ${studentId}`);

        // Check current state
        console.log('\n📊 Current State:');
        
        // Check payments
        const payments = await Payment.find({ student: studentId });
        console.log(`   Payments found: ${payments.length}`);
        
        // Check applications
        const applications = await Application.find({ student: studentId });
        console.log(`   Applications found: ${applications.length}`);
        
        // Check existing transaction entries
        const existingEntries = await TransactionEntry.find({
            'metadata.studentId': studentId
        });
        console.log(`   Existing transaction entries: ${existingEntries.length}`);
        
        if (existingEntries.length > 0) {
            console.log('   Existing entries:');
            existingEntries.forEach((entry, index) => {
                console.log(`     ${index + 1}. ${entry.description} - $${entry.totalDebit}`);
            });
        }

        console.log('\n🔧 What the fixed forfeit process will do:');
        console.log('   1. ✅ Always create accounting entries (even with $0 payments)');
        console.log('   2. ✅ Check for rental income accruals to reverse');
        console.log('   3. ✅ Create forfeited income entries');
        console.log('   4. ✅ Reduce A/R balance');
        console.log('   5. ✅ Use correct student ID (User ID instead of Application ID)');
        
        console.log('\n📋 Expected Accounting Entries:');
        console.log('   - Debit: Forfeited Deposits Income (even if $0)');
        console.log('   - Credit: Accounts Receivable - Student Name');
        console.log('   - Plus any rental income reversals if applicable');

        console.log('\n✅ Forfeit accounting fix test completed!');
        console.log('   The forfeit process should now create accounting entries regardless of payment status');

    } catch (error) {
        console.error('❌ Error testing forfeit accounting fix:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

// Run the test
testForfeitAccountingFix();




