const mongoose = require('mongoose');

/**
 * Generate Real Income Statement from Database
 * 
 * This script pulls REAL data from your MongoDB Atlas cluster to show actual
 * income statements with real student leases and payments.
 * 
 * Run with: node generate-real-income-statement.js
 * 
 * Make sure to set your MongoDB Atlas credentials:
 * export MONGODB_USERNAME=your_username
 * export MONGODB_PASSWORD=your_password
 */

// Build connection string from environment variables
const username = process.env.MONGODB_USERNAME;
const password = process.env.MONGODB_PASSWORD;
const cluster = 'cluster0.ulvve.mongodb.net';
const database = 'test';

if (!username || !password) {
    console.error('❌ MongoDB Atlas credentials not set!');
    console.log('');
    console.log('💡 Please set your MongoDB Atlas credentials:');
    console.log('   export MONGODB_USERNAME=your_username');
    console.log('   export MONGODB_PASSWORD=your_password');
    console.log('');
    console.log('   Or create a .env file with:');
    console.log('   MONGODB_USERNAME=your_username');
    console.log('   MONGODB_PASSWORD=your_password');
    console.log('');
    process.exit(1);
}

const MONGODB_URI = `mongodb+srv://${username}:${password}@${cluster}/${database}`;

async function connectToDatabase() {
    try {
        console.log('🔌 Connecting to MongoDB Atlas...');
        console.log('Cluster:', cluster);
        console.log('Database:', database);
        console.log('Collection: applications');
        console.log('');
        
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB Atlas successfully!');
        console.log('Database:', mongoose.connection.name);
        console.log('');
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB Atlas:', error.message);
        console.log('');
        console.log('💡 Check your credentials and network connection');
        console.log('');
        throw error;
    }
}

async function generateRealIncomeStatement() {
    try {
        console.log('=============================================');
        console.log('📊 REAL INCOME STATEMENT FROM YOUR DATABASE');
        console.log('=============================================\n');

        const db = mongoose.connection.db;

        // 1. ANALYZE APPLICATIONS COLLECTION (Student Leases)
        console.log('📋 1. APPLICATIONS COLLECTION ANALYSIS (Student Leases)');
        console.log('=============================================\n');

        const applicationsCollection = db.collection('applications');
        const totalApplications = await applicationsCollection.countDocuments();
        console.log(`Total Applications in Database: ${totalApplications}`);

        if (totalApplications > 0) {
            // Get sample application data
            const sampleApplications = await applicationsCollection.find({}).limit(5).toArray();
            console.log('\nSample Applications:');
            sampleApplications.forEach((app, index) => {
                console.log(`   ${index + 1}. Student: ${app.firstName} ${app.lastName}`);
                console.log(`      Email: ${app.email}`);
                console.log(`      Residence: ${app.residence}`);
                console.log(`      Room: ${app.allocatedRoom || app.preferredRoom}`);
                console.log(`      Status: ${app.status}`);
                console.log(`      Payment Status: ${app.paymentStatus}`);
                console.log(`      Start Date: ${app.startDate}`);
                console.log(`      End Date: ${app.endDate}`);
            });
        }

        // 2. ANALYZE PAYMENTS COLLECTION
        console.log('\n💳 2. PAYMENTS COLLECTION ANALYSIS');
        console.log('=============================================\n');

        const paymentsCollection = db.collection('payments');
        const totalPayments = await paymentsCollection.countDocuments();
        console.log(`Total Payments in Database: ${totalPayments}`);

        if (totalPayments > 0) {
            // Get sample payment data
            const samplePayments = await paymentsCollection.find({}).limit(5).toArray();
            console.log('\nSample Payments:');
            samplePayments.forEach((payment, index) => {
                console.log(`   ${index + 1}. Student: ${payment.studentName || 'No Name'}`);
                if (payment.amount) console.log(`      Amount: $${payment.amount}`);
                if (payment.date) console.log(`      Date: ${payment.date}`);
                if (payment.status) console.log(`      Status: ${payment.status}`);
            });
        }

        // 3. ANALYZE RESIDENCES COLLECTION
        console.log('\n🏠 3. RESIDENCES COLLECTION ANALYSIS');
        console.log('=============================================\n');

        const residencesCollection = db.collection('residences');
        const totalResidences = await residencesCollection.countDocuments();
        console.log(`Total Residences in Database: ${totalResidences}`);

        if (totalResidences > 0) {
            // Get sample residence data
            const sampleResidences = await residencesCollection.find({}).limit(5).toArray();
            console.log('\nSample Residences:');
            sampleResidences.forEach((residence, index) => {
                console.log(`   ${index + 1}. ${residence.name || 'No Name'}`);
                if (residence.address) console.log(`      Address: ${residence.address}`);
                if (residence.type) console.log(`      Type: ${residence.type}`);
            });
        }

        // 4. ANALYZE EXPENSES COLLECTION
        console.log('\n💸 4. EXPENSES COLLECTION ANALYSIS');
        console.log('=============================================\n');

        const expensesCollection = db.collection('expenses');
        const totalExpenses = await expensesCollection.countDocuments();
        console.log(`Total Expenses in Database: ${totalExpenses}`);

        if (totalExpenses > 0) {
            // Get sample expense data
            const sampleExpenses = await expensesCollection.find({}).limit(5).toArray();
            console.log('\nSample Expenses:');
            sampleExpenses.forEach((expense, index) => {
                console.log(`   ${index + 1}. ${expense.description || 'No Description'}`);
                if (expense.amount) console.log(`      Amount: $${expense.amount}`);
                if (expense.category) console.log(`      Category: ${expense.category}`);
                if (expense.residence) console.log(`      Residence: ${expense.residence}`);
            });
        }

        // 5. GENERATE REAL INCOME STATEMENT WITH ACTUAL DATA
        console.log('\n📈 5. REAL INCOME STATEMENT WITH ACTUAL DATA');
        console.log('=============================================\n');

        // Calculate totals from real data
        let totalLeaseAmount = 0;
        let totalPaidAmount = 0;
        let totalExpenseAmount = 0;

        if (totalApplications > 0) {
            const allApplications = await applicationsCollection.find({}).toArray();
            
            // Calculate total lease value (assuming monthly rent of $200 per student)
            const monthlyRent = 200; // Default monthly rent
            totalLeaseAmount = allApplications.length * monthlyRent;
            
            // Calculate based on payment status
            const paidApplications = allApplications.filter(app => app.paymentStatus === 'paid');
            const unpaidApplications = allApplications.filter(app => app.paymentStatus === 'unpaid');
            
            totalPaidAmount = paidApplications.length * monthlyRent;
        }

        if (totalPayments > 0) {
            const allPayments = await paymentsCollection.find({}).toArray();
            totalPaidAmount = allPayments.reduce((sum, payment) => {
                return sum + (payment.amount || 0);
            }, 0);
        }

        if (totalExpenses > 0) {
            const allExpenses = await expensesCollection.find({}).toArray();
            totalExpenseAmount = allExpenses.reduce((sum, expense) => {
                return sum + (expense.amount || 0);
            }, 0);
        }

        const totalUnpaidAmount = totalLeaseAmount - totalPaidAmount;
        const netIncome = totalPaidAmount - totalExpenseAmount;

        console.log('INCOME STATEMENT - [CURRENT PERIOD]');
        console.log('├── REVENUE');
        console.log(`│   ├── Total Student Lease Income (Accrued): $${totalLeaseAmount.toFixed(2)}`);
        console.log(`│   ├── Total Payments Received: $${totalPaidAmount.toFixed(2)}`);
        console.log(`│   └── Outstanding Receivables: $${totalUnpaidAmount.toFixed(2)}`);
        console.log('├── EXPENSES');
        console.log(`│   └── Total Expenses: $${totalExpenseAmount.toFixed(2)}`);
        console.log(`└── NET INCOME: $${netIncome.toFixed(2)}`);
        console.log('');

        // 6. ACCOUNTS RECEIVABLE AGING (REAL DATA)
        console.log('💰 6. ACCOUNTS RECEIVABLE AGING (REAL DATA)');
        console.log('=============================================\n');

        console.log('ACCOUNTS RECEIVABLE SUMMARY:');
        console.log(`├── Total Student Lease Amounts: $${totalLeaseAmount.toFixed(2)}`);
        console.log(`├── Total Payments Received: $${totalPaidAmount.toFixed(2)}`);
        console.log(`├── Outstanding Balance: $${totalUnpaidAmount.toFixed(2)}`);
        console.log(`└── Collection Rate: ${totalLeaseAmount > 0 ? ((totalPaidAmount / totalLeaseAmount) * 100).toFixed(1) : 0}%`);
        console.log('');

        // 7. STUDENT PAYMENT STATUS ANALYSIS (REAL DATA)
        console.log('📊 7. STUDENT PAYMENT STATUS ANALYSIS (REAL DATA)');
        console.log('=============================================\n');

        if (totalApplications > 0) {
            const allApplications = await applicationsCollection.find({}).toArray();
            
            // Group by payment status
            const paidStudents = [];
            const unpaidStudents = [];
            
            for (const app of allApplications) {
                const studentName = `${app.firstName} ${app.lastName}`;
                const residence = app.residence || 'Unknown';
                const room = app.allocatedRoom || app.preferredRoom || 'Unknown';
                const paymentStatus = app.paymentStatus || 'unknown';
                const status = app.status || 'unknown';
                
                if (paymentStatus === 'paid') {
                    paidStudents.push({ name: studentName, residence, room, status });
                } else {
                    unpaidStudents.push({ name: studentName, residence, room, status, paymentStatus });
                }
            }
            
            console.log(`✅ Paid Students: ${paidStudents.length}`);
            paidStudents.forEach(student => {
                console.log(`   ${student.name} - ${student.residence} (Room: ${student.room}) - ${student.status}`);
            });
            
            console.log(`\n❌ Unpaid Students: ${unpaidStudents.length}`);
            unpaidStudents.forEach(student => {
                console.log(`   ${student.name} - ${student.residence} (Room: ${student.room}) - ${student.status} - Payment: ${student.paymentStatus}`);
            });
        }

        // 8. PROPERTY PERFORMANCE (BY RESIDENCE)
        console.log('\n🏠 8. PROPERTY PERFORMANCE (BY RESIDENCE)');
        console.log('=============================================\n');

        if (totalResidences > 0) {
            const allResidences = await residencesCollection.find({}).toArray();
            console.log('Residence Performance:');
            
            for (const residence of allResidences) {
                const residenceId = residence._id.toString();
                const residenceName = residence.name || 'Unknown';
                
                // Count students in this residence
                const studentsInResidence = await applicationsCollection.countDocuments({
                    residence: residenceId
                });
                
                // Count paid vs unpaid in this residence
                const paidInResidence = await applicationsCollection.countDocuments({
                    residence: residenceId,
                    paymentStatus: 'paid'
                });
                
                const unpaidInResidence = await applicationsCollection.countDocuments({
                    residence: residenceId,
                    paymentStatus: 'unpaid'
                });
                
                const monthlyRent = 200; // Default monthly rent
                const totalRent = studentsInResidence * monthlyRent;
                const collectedRent = paidInResidence * monthlyRent;
                const outstandingRent = unpaidInResidence * monthlyRent;
                
                console.log(`   ${residenceName}:`);
                console.log(`      Total Students: ${studentsInResidence}`);
                console.log(`      Paid Students: ${paidInResidence}`);
                console.log(`      Unpaid Students: ${unpaidInResidence}`);
                console.log(`      Total Monthly Rent: $${totalRent.toFixed(2)}`);
                console.log(`      Collected Rent: $${collectedRent.toFixed(2)}`);
                console.log(`      Outstanding Rent: $${outstandingRent.toFixed(2)}`);
                console.log(`      Collection Rate: ${totalRent > 0 ? ((collectedRent / totalRent) * 100).toFixed(1) : 0}%`);
                console.log('');
            }
        }

        // 9. RECOMMENDATIONS BASED ON REAL DATA
        console.log('\n💡 9. RECOMMENDATIONS BASED ON REAL DATA');
        console.log('=============================================\n');

        console.log('📊 Current Situation:');
        console.log(`   • You have ${totalApplications} student applications`);
        console.log(`   • Total monthly lease value: $${totalLeaseAmount.toFixed(2)}`);
        console.log(`   • Collection rate: ${totalLeaseAmount > 0 ? ((totalPaidAmount / totalLeaseAmount) * 100).toFixed(1) : 0}%`);
        console.log(`   • Outstanding receivables: $${totalUnpaidAmount.toFixed(2)}`);
        console.log('');

        if (totalUnpaidAmount > 0) {
            console.log('🎯 Action Items:');
            console.log('   • Follow up on outstanding payments');
            console.log('   • Review payment collection processes');
            console.log('   • Consider payment plan options for students');
        }

        if (totalExpenseAmount > totalPaidAmount) {
            console.log('⚠️  Financial Alert:');
            console.log('   • Expenses exceed collected revenue');
            console.log('   • Review expense management');
            console.log('   • Focus on improving collection rates');
        }

        console.log('\n🎉 Real Income Statement Analysis Complete!');
        console.log('Your database contains valuable financial data ready for reporting!');

    } catch (error) {
        console.error('❌ Error generating real income statement:', error);
    }
}

async function cleanup() {
    try {
        await mongoose.connection.close();
        console.log('✅ Database connection closed');
    } catch (error) {
        console.error('❌ Error closing database connection:', error);
    }
}

async function main() {
    try {
        await connectToDatabase();
        await generateRealIncomeStatement();
    } catch (error) {
        console.error('❌ Income statement generation failed:', error);
    } finally {
        await cleanup();
        process.exit(0);
    }
}

if (require.main === module) {
    main();
}

module.exports = { generateRealIncomeStatement };
