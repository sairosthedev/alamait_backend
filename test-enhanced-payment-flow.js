require('dotenv').config();
const mongoose = require('mongoose');
const Payment = require('./src/models/Payment');
const Debtor = require('./src/models/Debtor');
const User = require('./src/models/User');
const Residence = require('./src/models/Residence');

async function testEnhancedPaymentFlow() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
        console.log('=' .repeat(60));

        console.log('🧪 Testing Enhanced Payment Creation Flow...');
        console.log('==========================================');

        // Test 1: Check existing debtors and payments
        console.log('\n🔍 Test 1: Current System State');
        console.log('================================');
        
        const existingDebtors = await Debtor.find({});
        const existingPayments = await Payment.find({});
        
        console.log(`📊 Current Debtors: ${existingDebtors.length}`);
        console.log(`📊 Current Payments: ${existingPayments.length}`);
        
        // Show sample debtor
        if (existingDebtors.length > 0) {
            const sampleDebtor = existingDebtors[0];
            console.log(`\n📋 Sample Debtor:`);
            console.log(`   Code: ${sampleDebtor.debtorCode}`);
            console.log(`   User ID: ${sampleDebtor.user}`);
            console.log(`   Total Paid: $${sampleDebtor.totalPaid}`);
            console.log(`   Payment History: ${sampleDebtor.paymentHistory.length}`);
            console.log(`   Monthly Payments: ${sampleDebtor.monthlyPayments.length}`);
        }

        // Test 2: Test PaymentService.createPaymentWithUserMapping
        console.log('\n🔍 Test 2: Testing PaymentService Integration');
        console.log('=============================================');
        
        try {
            const PaymentService = require('./src/services/paymentService');
            
            // Find a test student and residence
            const testStudent = await User.findOne({ role: 'student' });
            const testResidence = await Residence.findOne({});
            
            if (!testStudent || !testResidence) {
                console.log('⚠️  No test student or residence found, skipping PaymentService test');
            } else {
                console.log(`🧪 Testing with:`);
                console.log(`   Student: ${testStudent.firstName} ${testStudent.lastName} (${testStudent._id})`);
                console.log(`   Residence: ${testResidence.name} (${testResidence._id})`);
                
                // Test payment creation with all required fields
                const testPaymentData = {
                    paymentId: `TEST-${Date.now()}`, // Required field
                    student: testStudent._id,
                    residence: testResidence._id,
                    totalAmount: 250,
                    rentAmount: 200,
                    adminFee: 30,
                    deposit: 20,
                    paymentMonth: '2025-09',
                    date: new Date(),
                    method: 'Bank Transfer',
                    status: 'Confirmed',
                    description: 'Test payment for enhanced flow'
                };
                
                console.log('\n💰 Creating test payment via PaymentService...');
                const result = await PaymentService.createPaymentWithUserMapping(testPaymentData, testStudent._id);
                
                console.log('✅ PaymentService test completed');
                console.log(`   Payment ID: ${result.payment._id}`);
                console.log(`   Debtor Code: ${result.debtor?.debtorCode || 'N/A'}`);
                console.log(`   User ID: ${result.userId}`);
                
                // Verify debtor was updated
                if (result.debtor) {
                    const updatedDebtor = await Debtor.findById(result.debtor._id);
                    console.log(`   Debtor Updated:`);
                    console.log(`      Total Paid: $${updatedDebtor.totalPaid}`);
                    console.log(`      Payment History: ${updatedDebtor.paymentHistory.length}`);
                    console.log(`      Monthly Payments: ${updatedDebtor.monthlyPayments.length}`);
                }
            }
            
        } catch (error) {
            console.error('❌ PaymentService test failed:', error.message);
        }

        // Test 3: Test direct payment creation and debtor sync
        console.log('\n🔍 Test 3: Testing Direct Payment Creation');
        console.log('==========================================');
        
        try {
            // Find another test student (different from the first one)
            const testStudent2 = await User.findOne({ 
                role: 'student', 
                _id: { $ne: testStudent?._id } 
            });
            
            if (!testStudent2) {
                console.log('⚠️  No second test student found, skipping direct payment test');
            } else {
                console.log(`🧪 Testing direct payment creation with:`);
                console.log(`   Student: ${testStudent2.firstName} ${testStudent2.lastName} (${testStudent2._id})`);
                
                // Create payment directly with all required fields
                const directPayment = new Payment({
                    paymentId: `TEST-DIRECT-${Date.now()}`, // Required field
                    user: testStudent2._id,
                    student: testStudent2._id,
                    residence: testResidence._id,
                    totalAmount: 300,
                    rentAmount: 250,
                    adminFee: 40,
                    deposit: 10,
                    paymentMonth: '2025-09',
                    date: new Date(),
                    method: 'Cash',
                    status: 'Confirmed',
                    description: 'Direct payment test'
                });
                
                await directPayment.save();
                console.log('✅ Direct payment created');
                
                // Find or create debtor
                let debtor = await Debtor.findOne({ user: testStudent2._id });
                if (!debtor) {
                    console.log('🏗️  Creating debtor for test student...');
                    const { createDebtorForStudent } = require('./src/services/debtorService');
                    debtor = await createDebtorForStudent(testStudent2, {
                        residenceId: testResidence._id,
                        createdBy: testStudent2._id,
                        startDate: new Date(),
                        roomPrice: 300
                    });
                    console.log('✅ Debtor created');
                }
                
                // Test debtor.addPayment
                if (debtor) {
                    console.log('💰 Testing debtor.addPayment...');
                    await debtor.addPayment({
                        paymentId: directPayment._id.toString(),
                        amount: 300,
                        allocatedMonth: '2025-09',
                        components: {
                            rent: 250,
                            adminFee: 40,
                            deposit: 10
                        },
                        paymentMethod: 'Cash',
                        paymentDate: new Date(),
                        status: 'Confirmed',
                        notes: 'Direct payment test',
                        createdBy: testStudent2._id
                    });
                    
                    console.log('✅ Payment added to debtor');
                    console.log(`   New Total Paid: $${debtor.totalPaid}`);
                    console.log(`   Payment History: ${debtor.paymentHistory.length}`);
                    console.log(`   Monthly Payments: ${debtor.monthlyPayments.length}`);
                }
            }
            
        } catch (error) {
            console.error('❌ Direct payment test failed:', error.message);
        }

        // Test 4: Verify data consistency
        console.log('\n🔍 Test 4: Data Consistency Verification');
        console.log('========================================');
        
        const finalDebtors = await Debtor.find({});
        const finalPayments = await Payment.find({});
        
        console.log(`📊 Final Counts:`);
        console.log(`   Debtors: ${finalDebtors.length}`);
        console.log(`   Payments: ${finalPayments.length}`);
        
        // Check for orphaned payments
        let orphanedPayments = 0;
        for (const payment of finalPayments) {
            const debtor = await Debtor.findOne({ user: payment.user });
            if (debtor) {
                const paymentInHistory = debtor.paymentHistory.find(ph => 
                    ph.paymentId === payment._id.toString()
                );
                if (!paymentInHistory) {
                    orphanedPayments++;
                }
            }
        }
        
        console.log(`🔍 Data Consistency:`);
        console.log(`   Orphaned Payments: ${orphanedPayments}`);
        console.log(`   Sync Success Rate: ${((finalPayments.length - orphanedPayments) / finalPayments.length * 100).toFixed(1)}%`);

        console.log('\n🎉 Enhanced Payment Flow Test Complete!');
        console.log('========================================');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🧪 Starting Enhanced Payment Flow Test...');
testEnhancedPaymentFlow();
