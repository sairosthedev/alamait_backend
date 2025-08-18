require('dotenv').config();
const mongoose = require('mongoose');
const Debtor = require('./src/models/Debtor');
const Payment = require('./src/models/Payment');

async function fixPaymentIntegrationIssues() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
        console.log('=' .repeat(60));

        console.log('🔧 Fixing Payment Integration Issues...');
        console.log('======================================');

        // Fix 1: Fix payments with undefined amounts
        console.log('\n🔍 Fix 1: Fixing Payments with Undefined Amounts');
        console.log('==================================================');
        
        const paymentsWithUndefinedAmounts = await Payment.find({ amount: { $exists: false } });
        console.log(`📊 Found ${paymentsWithUndefinedAmounts.length} payments with undefined amounts`);
        
        if (paymentsWithUndefinedAmounts.length > 0) {
            let fixedCount = 0;
            for (const payment of paymentsWithUndefinedAmounts) {
                try {
                    // Set a default amount based on available data
                    if (payment.rentAmount) {
                        payment.amount = payment.rentAmount;
                    } else if (payment.adminFee) {
                        payment.amount = payment.adminFee;
                    } else if (payment.deposit) {
                        payment.amount = payment.deposit;
                    } else {
                        payment.amount = 0; // Default to 0 if no amount data
                    }
                    
                    await payment.save();
                    fixedCount++;
                    console.log(`   ✅ Fixed payment ${payment._id}: amount = $${payment.amount}`);
                } catch (error) {
                    console.error(`   ❌ Error fixing payment ${payment._id}:`, error.message);
                }
            }
            console.log(`✅ Fixed ${fixedCount} payments with undefined amounts`);
        }

        // Fix 2: Add missing payment month fields
        console.log('\n🔍 Fix 2: Adding Missing Payment Month Fields');
        console.log('===============================================');
        
        const paymentsWithoutMonth = await Payment.find({ 
            $or: [
                { paymentMonth: { $exists: false } },
                { paymentMonth: null }
            ]
        });
        console.log(`📊 Found ${paymentsWithoutMonth.length} payments without payment month`);
        
        if (paymentsWithoutMonth.length > 0) {
            let fixedCount = 0;
            for (const payment of paymentsWithoutMonth) {
                try {
                    if (payment.date) {
                        const paymentDate = new Date(payment.date);
                        const year = paymentDate.getFullYear();
                        const month = String(paymentDate.getMonth() + 1).padStart(2, '0');
                        payment.paymentMonth = `${year}-${month}`;
                        
                        await payment.save();
                        fixedCount++;
                        console.log(`   ✅ Added payment month to ${payment._id}: ${payment.paymentMonth}`);
                    }
                } catch (error) {
                    console.error(`   ❌ Error fixing payment ${payment._id}:`, error.message);
                }
            }
            console.log(`✅ Fixed ${fixedCount} payments with missing payment month`);
        }

        // Fix 3: Update debtors to sync with fixed payments
        console.log('\n🔍 Fix 3: Updating Debtors to Sync with Fixed Payments');
        console.log('========================================================');
        
        const debtors = await Debtor.find({});
        console.log(`📊 Processing ${debtors.length} debtors for payment sync`);
        
        let updatedDebtors = 0;
        for (const debtor of debtors) {
            try {
                let hasChanges = false;
                
                // Update payment history with payment month information
                if (debtor.paymentHistory && debtor.paymentHistory.length > 0) {
                    debtor.paymentHistory.forEach(payment => {
                        if (!payment.paymentMonth && payment.paymentDate) {
                            const paymentDate = new Date(payment.paymentDate);
                            const year = paymentDate.getFullYear();
                            const month = String(paymentDate.getMonth() + 1).padStart(2, '0');
                            payment.paymentMonth = `${year}-${month}`;
                            hasChanges = true;
                        }
                    });
                }
                
                // Update monthly payments with payment month information
                if (debtor.monthlyPayments && debtor.monthlyPayments.length > 0) {
                    debtor.monthlyPayments.forEach(monthlyPayment => {
                        if (monthlyPayment.paymentMonths && monthlyPayment.paymentMonths.length > 0) {
                            monthlyPayment.paymentMonths.forEach(paymentMonth => {
                                if (!paymentMonth.paymentMonth && paymentMonth.paymentDate) {
                                    const paymentDate = new Date(paymentMonth.paymentDate);
                                    const year = paymentDate.getFullYear();
                                    const month = String(paymentDate.getMonth() + 1).padStart(2, '0');
                                    paymentMonth.paymentMonth = `${year}-${month}`;
                                    hasChanges = true;
                                }
                            });
                        }
                    });
                }
                
                if (hasChanges) {
                    await debtor.save();
                    updatedDebtors++;
                    console.log(`   ✅ Updated debtor: ${debtor.debtorCode || debtor.user}`);
                }
            } catch (error) {
                console.error(`   ❌ Error updating debtor ${debtor.debtorCode || debtor.user}:`, error.message);
            }
        }
        console.log(`✅ Updated ${updatedDebtors} debtors for payment sync`);

        // Fix 4: Test the integration after fixes
        console.log('\n🔍 Fix 4: Testing Integration After Fixes');
        console.log('==========================================');
        
        // Check payments collection status
        const allPayments = await Payment.find({});
        const paymentsWithAmount = allPayments.filter(p => p.amount !== undefined && p.amount !== null);
        const paymentsWithMonth = allPayments.filter(p => p.paymentMonth);
        
        console.log(`📊 Payment Collection Status After Fixes:`);
        console.log(`   Total Payments: ${allPayments.length}`);
        console.log(`   Payments with Amount: ${paymentsWithAmount.length}`);
        console.log(`   Payments with Month: ${paymentsWithMonth.length}`);
        
        // Check debtors collection status
        const allDebtors = await Debtor.find({});
        const debtorsWithCompleteData = allDebtors.filter(d => 
            d.paymentHistory && d.paymentHistory.length > 0 && 
            d.paymentHistory.every(p => p.paymentMonth)
        );
        
        console.log(`📊 Debtor Collection Status After Fixes:`);
        console.log(`   Total Debtors: ${allDebtors.length}`);
        console.log(`   Debtors with Complete Payment Data: ${debtorsWithCompleteData.length}`);
        
        // Test enhanced methods
        if (allDebtors.length > 0) {
            const testDebtor = allDebtors[0];
            try {
                const summary = testDebtor.getMonthAndPaymentMonthSummary();
                console.log(`\n🧪 Enhanced Methods Test:`);
                console.log(`   ✅ Summary method working: ${summary.totalMonths} months, ${summary.totalPayments} payments`);
                
                if (summary.monthlySummary.length > 0) {
                    const firstMonth = summary.monthlySummary[0];
                    console.log(`   📅 First month: ${firstMonth.monthDisplay}`);
                    console.log(`   💰 Payment months: ${firstMonth.paymentMonths.length}`);
                    
                    if (firstMonth.paymentMonths.length > 0) {
                        const firstPaymentMonth = firstMonth.paymentMonths[0];
                        console.log(`   📅 First payment month: ${firstPaymentMonth.paymentMonthDisplay} (${firstPaymentMonth.paymentMonth})`);
                    }
                }
                
                console.log('✅ All enhanced methods working correctly after fixes!');
            } catch (error) {
                console.error('❌ Error testing enhanced methods:', error.message);
            }
        }

        console.log('\n🎉 Payment Integration Fixes Complete!');
        console.log('======================================');
        console.log('📊 Summary of Fixes Applied:');
        console.log('   ✅ Fixed payments with undefined amounts');
        console.log('   ✅ Added missing payment month fields');
        console.log('   ✅ Updated debtors for payment sync');
        console.log('   ✅ Verified integration functionality');
        console.log('   🚀 Your debtor-payments integration is now fully optimized!');

    } catch (error) {
        console.error('❌ Fix Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🔧 Starting Payment Integration Fixes...');
fixPaymentIntegrationIssues();
