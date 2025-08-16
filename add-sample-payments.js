const mongoose = require('mongoose');

/**
 * Add Sample Payment Records
 * 
 * This script adds sample payment records for existing students
 * so you can see complete financial reports with both paid and unpaid students.
 * 
 * Run with: node add-sample-payments.js
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

async function addSamplePayments() {
    try {
        console.log('=============================================');
        console.log('💰 ADDING SAMPLE PAYMENT RECORDS');
        console.log('=============================================\n');

        const db = mongoose.connection.db;
        const applicationsCollection = db.collection('applications');
        const paymentsCollection = db.collection('payments');

        // Get existing applications
        const applications = await applicationsCollection.find({}).toArray();
        console.log(`Found ${applications.length} student applications`);

        if (applications.length === 0) {
            console.log('❌ No applications found. Please add student applications first.');
            return;
        }

        // Clear existing payments
        const existingPayments = await paymentsCollection.countDocuments();
        if (existingPayments > 0) {
            console.log(`Clearing ${existingPayments} existing payment records...`);
            await paymentsCollection.deleteMany({});
        }

        // Create sample payments for students with 'paid' status
        const samplePayments = [];
        let totalPayments = 0;

        for (const app of applications) {
            if (app.paymentStatus === 'paid') {
                // Create payment record for paid students
                const payment = {
                    studentId: app._id,
                    studentName: `${app.firstName} ${app.lastName}`,
                    email: app.email,
                    residence: app.residence,
                    room: app.allocatedRoom || app.preferredRoom,
                    amount: 200.00, // Monthly rent
                    paymentDate: new Date(),
                    paymentMethod: 'Bank Transfer',
                    reference: `PAY-${app.applicationCode}`,
                    status: 'completed',
                    description: `Monthly rent payment for ${app.firstName} ${app.lastName}`,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                
                samplePayments.push(payment);
                totalPayments += payment.amount;
            }
        }

        if (samplePayments.length > 0) {
            // Insert payment records
            const result = await paymentsCollection.insertMany(samplePayments);
            console.log(`✅ Added ${result.length} payment records`);
            console.log(`💰 Total payments recorded: $${totalPayments.toFixed(2)}`);
            
            console.log('\n📋 Payment Records Added:');
            samplePayments.forEach((payment, index) => {
                console.log(`   ${index + 1}. ${payment.studentName} - Room ${payment.room}`);
                console.log(`      Amount: $${payment.amount.toFixed(2)}`);
                console.log(`      Reference: ${payment.reference}`);
                console.log(`      Date: ${payment.paymentDate.toLocaleDateString()}`);
            });
        } else {
            console.log('⚠️  No students with "paid" status found');
        }

        // Show current payment status summary
        console.log('\n📊 CURRENT PAYMENT STATUS SUMMARY:');
        console.log('=============================================');

        const paidStudents = applications.filter(app => app.paymentStatus === 'paid');
        const unpaidStudents = applications.filter(app => app.paymentStatus === 'unpaid');
        const waitlistedStudents = applications.filter(app => app.status === 'waitlisted');

        console.log(`✅ Paid Students: ${paidStudents.length}`);
        console.log(`❌ Unpaid Students: ${unpaidStudents.length}`);
        console.log(`⏳ Waitlisted Students: ${waitlistedStudents.length}`);

        if (paidStudents.length > 0) {
            console.log('\n💰 Paid Students:');
            paidStudents.forEach(student => {
                console.log(`   • ${student.firstName} ${student.lastName} - Room ${student.allocatedRoom || student.preferredRoom}`);
            });
        }

        if (unpaidStudents.length > 0) {
            console.log('\n💸 Unpaid Students:');
            unpaidStudents.forEach(student => {
                console.log(`   • ${student.firstName} ${student.lastName} - Room ${student.allocatedRoom || student.preferredRoom}`);
            });
        }

        // Show financial summary
        console.log('\n💵 FINANCIAL SUMMARY:');
        console.log('=============================================');

        const monthlyRent = 200;
        const totalLeaseValue = applications.length * monthlyRent;
        const totalCollected = paidStudents.length * monthlyRent;
        const totalOutstanding = unpaidStudents.length * monthlyRent;
        const collectionRate = totalLeaseValue > 0 ? (totalCollected / totalLeaseValue) * 100 : 0;

        console.log(`📊 Total Monthly Lease Value: $${totalLeaseValue.toFixed(2)}`);
        console.log(`✅ Total Collected: $${totalCollected.toFixed(2)}`);
        console.log(`❌ Total Outstanding: $${totalOutstanding.toFixed(2)}`);
        console.log(`📈 Collection Rate: ${collectionRate.toFixed(1)}%`);

        console.log('\n🎉 Sample payment records added successfully!');
        console.log('Now you can run generate-real-income-statement.js to see complete financial reports!');

    } catch (error) {
        console.error('❌ Error adding sample payments:', error);
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
        await addSamplePayments();
    } catch (error) {
        console.error('❌ Failed to add sample payments:', error);
    } finally {
        await cleanup();
        process.exit(0);
    }
}

if (require.main === module) {
    main();
}

module.exports = { addSamplePayments };
