const mongoose = require('mongoose');
const Debtor = require('./src/models/Debtor');
const User = require('./src/models/User');
const Application = require('./src/models/Application');
const Residence = require('./src/models/Residence');
const Payment = require('./src/models/Payment');
const TransactionEntry = require('./src/models/TransactionEntry');
require('dotenv').config();

async function clearAndRebuildDebtors() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('Connected to MongoDB');
        console.log('=' .repeat(60));

        // Step 1: Clear all existing debtors
        console.log('🗑️  Clearing all existing debtors...');
        const deleteResult = await Debtor.deleteMany({});
        console.log(`✅ Deleted ${deleteResult.deletedCount} existing debtors`);

        // Step 2: Get all students with applications
        console.log('\n📋 Finding students with applications...');
        const studentsWithApplications = await Application.find({
            status: { $in: ['approved', 'active', 'completed'] }
        }).populate('student', 'firstName lastName email phone')
          .populate('residence', 'name address');

        console.log(`Found ${studentsWithApplications.length} students with applications`);

        // Step 3: Create new debtors with proper syncing
        console.log('\n🔄 Creating new debtors with application, residence, and payment syncing...');
        
        const newDebtors = [];
        
        for (const application of studentsWithApplications) {
            try {
                const student = application.student;
                const residence = application.residence;
                
                if (!student) {
                    console.log(`⚠️  Skipping application ${application._id} - no student found`);
                    continue;
                }

                // Calculate billing period from application
                const startDate = new Date(application.startDate);
                const endDate = new Date(application.endDate);
                const billingPeriod = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24 * 30.44)); // months
                
                // Get room price from residence or application
                const roomPrice = residence?.roomPrice || application.roomPrice || 0;
                
                // Calculate expected total
                const expectedTotal = roomPrice * billingPeriod;
                
                // Get payments for this student
                const payments = await Payment.find({
                    student: student._id,
                    status: { $in: ['verified', 'paid', 'confirmed'] }
                });
                
                // Calculate total paid
                const totalPaid = payments.reduce((sum, payment) => {
                    let paymentTotal = 0;
                    if (payment.rentAmount && payment.rentAmount > 0) paymentTotal += payment.rentAmount;
                    if (payment.rent && payment.rent > 0) paymentTotal += payment.rent;
                    if (payment.adminFee && payment.adminFee > 0) paymentTotal += payment.adminFee;
                    if (payment.deposit && payment.deposit > 0) paymentTotal += payment.deposit;
                    if (payment.amount && payment.amount > 0) paymentTotal += payment.amount;
                    return sum + paymentTotal;
                }, 0);
                
                // Calculate current balance
                const currentBalance = Math.max(expectedTotal - totalPaid, 0);
                const overdueAmount = currentBalance > 0 ? currentBalance : 0;
                
                // Determine status
                let status = 'active';
                if (currentBalance === 0) {
                    status = 'paid';
                } else if (currentBalance > 0 && endDate < new Date()) {
                    status = 'overdue';
                }
                
                // Generate codes
                const debtorCode = `DR${String(newDebtors.length + 1).padStart(4, '0')}`;
                const accountCode = `110${String(newDebtors.length + 1).padStart(3, '0')}`;
                
                // Create debtor object
                const debtorData = {
                    debtorCode,
                    user: student._id,
                    accountCode,
                    status,
                    
                    // Financial Information
                    currentBalance,
                    totalOwed: expectedTotal,
                    totalPaid,
                    overdueAmount,
                    creditLimit: roomPrice * 2, // 2 months credit limit
                    paymentTerms: 'monthly',
                    
                    // Application Information
                    application: application._id,
                    billingPeriod: `${billingPeriod} months`,
                    startDate: application.startDate,
                    endDate: application.endDate,
                    
                    // Residence Information
                    residence: residence?._id,
                    roomNumber: application.roomNumber || application.room || 'N/A',
                    roomPrice,
                    
                    // Contact Information
                    contactInfo: {
                        name: `${student.firstName} ${student.lastName}`,
                        email: student.email,
                        phone: student.phone || 'N/A'
                    },
                    
                    // Payment Information
                    payments: payments.map(p => p._id),
                    lastPaymentDate: payments.length > 0 ? payments[payments.length - 1].date : null,
                    lastPaymentAmount: payments.length > 0 ? payments[payments.length - 1].amount || 0 : 0,
                    
                    // Notes
                    notes: `Auto-generated from application ${application._id}. Room: ${application.roomNumber || 'N/A'}, Residence: ${residence?.name || 'N/A'}`,
                    
                    // Audit
                    createdBy: application.createdBy || student._id
                };
                
                newDebtors.push(debtorData);
                
                console.log(`✅ Created debtor for ${student.firstName} ${student.lastName}`);
                console.log(`   Expected: $${expectedTotal.toFixed(2)}, Paid: $${totalPaid.toFixed(2)}, Owing: $${currentBalance.toFixed(2)}`);
                
            } catch (error) {
                console.error(`❌ Error processing application ${application._id}:`, error.message);
            }
        }
        
        // Step 4: Insert all new debtors
        if (newDebtors.length > 0) {
            console.log(`\n💾 Inserting ${newDebtors.length} new debtors...`);
            const insertResult = await Debtor.insertMany(newDebtors);
            console.log(`✅ Successfully created ${insertResult.length} debtors`);
        }
        
        // Step 5: Verify the new system
        console.log('\n🔍 Verifying new debtors system...');
        const totalDebtors = await Debtor.countDocuments();
        const debtorsWithApplications = await Debtor.countDocuments({ application: { $exists: true } });
        const debtorsWithResidences = await Debtor.countDocuments({ residence: { $exists: true } });
        const debtorsWithPayments = await Debtor.countDocuments({ 'payments.0': { $exists: true } });
        
        console.log(`📊 New System Status:`);
        console.log(`- Total Debtors: ${totalDebtors}`);
        console.log(`- With Applications: ${debtorsWithApplications}`);
        console.log(`- With Residences: ${debtorsWithResidences}`);
        console.log(`- With Payments: ${debtorsWithPayments}`);
        
        // Show sample of new debtors
        const sampleNewDebtors = await Debtor.find()
            .populate('user', 'firstName lastName email')
            .populate('residence', 'name')
            .populate('application', 'startDate endDate roomNumber')
            .limit(3);
            
        console.log('\n📋 Sample New Debtors:');
        sampleNewDebtors.forEach((debtor, index) => {
            console.log(`\n${index + 1}. ${debtor.contactInfo?.name || 'N/A'}`);
            console.log(`   Code: ${debtor.debtorCode}`);
            console.log(`   Account: ${debtor.accountCode}`);
            console.log(`   Expected: $${debtor.totalOwed?.toFixed(2) || '0.00'}`);
            console.log(`   Paid: $${debtor.totalPaid?.toFixed(2) || '0.00'}`);
            console.log(`   Owing: $${debtor.currentBalance?.toFixed(2) || '0.00'}`);
            console.log(`   Status: ${debtor.status}`);
            console.log(`   Room: ${debtor.roomNumber}`);
            console.log(`   Residence: ${debtor.residence?.name || 'N/A'}`);
            console.log(`   Billing Period: ${debtor.billingPeriod}`);
        });
        
        console.log('\n🎉 Debtors system rebuilt successfully!');
        console.log('\n✅ New Features:');
        console.log('- Automatic syncing with applications');
        console.log('- Residence and room information included');
        console.log('- Payment history linked');
        console.log('- Accurate financial calculations');
        console.log('- Proper billing period calculations');
        
    } catch (error) {
        console.error('Error rebuilding debtors:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

clearAndRebuildDebtors(); 