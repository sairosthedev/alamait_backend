const mongoose = require('mongoose');
const Debtor = require('./src/models/Debtor');
const User = require('./src/models/User');
const TransactionEntry = require('./src/models/TransactionEntry');
const Residence = require('./src/models/Residence');
require('dotenv').config();

async function checkDebtorsStatus() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('Connected to MongoDB');
        console.log('=' .repeat(60));

        // Check total debtors
        const totalDebtors = await Debtor.countDocuments();
        console.log(`📊 Total Debtors in Database: ${totalDebtors}`);

        if (totalDebtors === 0) {
            console.log('\n❌ No debtors found in database!');
            console.log('\n🔧 What needs to be done:');
            console.log('1. Create debtor accounts for existing students');
            console.log('2. Set up automatic debtor creation for new students');
            console.log('3. Link debtors to their transactions');
            console.log('4. Calculate financial totals from transactions');
            
            // Check if there are students that could be debtors
            const totalStudents = await User.countDocuments({ role: 'student' });
            console.log(`\n👥 Total Students: ${totalStudents}`);
            
            if (totalStudents > 0) {
                console.log('\n✅ Found students that can be converted to debtors');
                console.log('Run: node create-debtors-from-students.js');
            }
            
            return;
        }

        // Get sample debtors
        const sampleDebtors = await Debtor.find()
            .populate('user', 'firstName lastName email')
            .populate('residence', 'name')
            .limit(5);

        console.log('\n📋 Sample Debtors:');
        sampleDebtors.forEach((debtor, index) => {
            console.log(`\n${index + 1}. ${debtor.contactInfo?.name || 'N/A'}`);
            console.log(`   Code: ${debtor.debtorCode}`);
            console.log(`   Account: ${debtor.accountCode}`);
            console.log(`   Balance: $${debtor.currentBalance?.toFixed(2) || '0.00'}`);
            console.log(`   Status: ${debtor.status}`);
            console.log(`   Residence: ${debtor.residence?.name || 'N/A'}`);
        });

        // Check financial data
        const debtorsWithBalance = await Debtor.countDocuments({ currentBalance: { $gt: 0 } });
        const debtorsWithTransactions = await Debtor.countDocuments({ totalOwed: { $gt: 0 } });
        
        console.log('\n💰 Financial Status:');
        console.log(`- Debtors with balance: ${debtorsWithBalance}/${totalDebtors}`);
        console.log(`- Debtors with transactions: ${debtorsWithTransactions}/${totalDebtors}`);

        // Check for transactions linked to debtors
        const debtorAccountCodes = await Debtor.distinct('accountCode');
        console.log(`\n🔗 Debtor Account Codes: ${debtorAccountCodes.length}`);
        
        if (debtorAccountCodes.length > 0) {
            const transactionsForDebtors = await TransactionEntry.countDocuments({
                'entries.accountCode': { $in: debtorAccountCodes }
            });
            console.log(`- Transactions linked to debtors: ${transactionsForDebtors}`);
            
            if (transactionsForDebtors === 0) {
                console.log('\n⚠️  No transactions found for debtors!');
                console.log('This means debtor totals are not being calculated from actual transactions.');
            }
        }

        // Check for issues
        const issues = [];
        
        // Check debtors without users
        const debtorsWithoutUsers = await Debtor.countDocuments({ user: { $exists: false } });
        if (debtorsWithoutUsers > 0) {
            issues.push(`${debtorsWithoutUsers} debtors without linked users`);
        }

        // Check debtors without residences
        const debtorsWithoutResidences = await Debtor.countDocuments({ residence: { $exists: false } });
        if (debtorsWithoutResidences > 0) {
            issues.push(`${debtorsWithoutResidences} debtors without residences`);
        }

        // Check debtors with zero totals
        const debtorsWithZeroTotals = await Debtor.countDocuments({
            totalOwed: 0,
            totalPaid: 0,
            currentBalance: 0
        });
        if (debtorsWithZeroTotals > 0) {
            issues.push(`${debtorsWithZeroTotals} debtors with zero financial totals`);
        }

        if (issues.length > 0) {
            console.log('\n⚠️  Issues Found:');
            issues.forEach(issue => console.log(`- ${issue}`));
        } else {
            console.log('\n✅ No major issues found');
        }

        // Recommendations
        console.log('\n🔧 Recommendations:');
        if (transactionsForDebtors === 0) {
            console.log('1. Create transactions for debtors to calculate accurate totals');
            console.log('2. Update debtor totals from transaction history');
        }
        if (debtorsWithZeroTotals > 0) {
            console.log('3. Calculate debtor totals from existing transactions');
        }
        console.log('4. Ensure automatic debtor creation for new students');
        console.log('5. Set up regular balance calculations');

    } catch (error) {
        console.error('Error checking debtors status:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

checkDebtorsStatus(); 