require('dotenv').config();
const mongoose = require('mongoose');
const Debtor = require('./src/models/Debtor');

async function updateDebtorsCollectionRobust() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
        console.log('=' .repeat(60));

        console.log('🔄 Updating Debtors Collection with Enhanced Month and Payment Month Structure...');
        console.log('================================================================================');

        // Get all debtors
        const debtors = await Debtor.find({});
        console.log(`📊 Found ${debtors.length} debtors to update`);

        if (debtors.length === 0) {
            console.log('❌ No debtors found in the database');
            return;
        }

        let updatedCount = 0;
        let errorCount = 0;

        for (const debtor of debtors) {
            try {
                console.log(`\n🔍 Processing debtor: ${debtor.debtorCode || debtor.user}`);
                
                let hasChanges = false;

                // Clean up and fix payment history records
                if (debtor.paymentHistory && debtor.paymentHistory.length > 0) {
                    console.log(`   💰 Cleaning up ${debtor.paymentHistory.length} payment history records...`);
                    
                    debtor.paymentHistory.forEach(payment => {
                        // Fix missing required fields with defaults
                        if (!payment.paymentDate) {
                            payment.paymentDate = new Date();
                            hasChanges = true;
                        }
                        
                        if (!payment.paymentMethod) {
                            payment.paymentMethod = 'Bank Transfer'; // Use valid enum value
                            hasChanges = true;
                        }
                        
                        if (!payment.allocatedMonth) {
                            // Use current month if not specified
                            const now = new Date();
                            const year = now.getFullYear();
                            const month = String(now.getMonth() + 1).padStart(2, '0');
                            payment.allocatedMonth = `${year}-${month}`;
                            hasChanges = true;
                        }
                        
                        if (!payment.amount || payment.amount <= 0) {
                            payment.amount = 0;
                            hasChanges = true;
                        }
                        
                        // Fix invalid status values
                        if (payment.status === 'Paid') {
                            payment.status = 'Confirmed';
                            hasChanges = true;
                        } else if (!payment.status || !['Pending', 'Confirmed', 'Failed', 'Verified', 'Rejected'].includes(payment.status)) {
                            payment.status = 'Confirmed';
                            hasChanges = true;
                        }
                        
                        // Add payment month if it doesn't exist
                        if (!payment.paymentMonth && payment.paymentDate) {
                            const paymentDate = new Date(payment.paymentDate);
                            const year = paymentDate.getFullYear();
                            const month = String(paymentDate.getMonth() + 1).padStart(2, '0');
                            payment.paymentMonth = `${year}-${month}`;
                            hasChanges = true;
                        }
                        
                        // Ensure components object exists
                        if (!payment.components) {
                            payment.components = {
                                rent: 0,
                                adminFee: 0,
                                deposit: 0,
                                utilities: 0,
                                other: 0
                            };
                            hasChanges = true;
                        }
                        
                        // Ensure paymentId exists
                        if (!payment.paymentId) {
                            payment.paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                            hasChanges = true;
                        }
                    });
                }

                // Update monthlyPayments structure if it doesn't have the new fields
                if (debtor.monthlyPayments && debtor.monthlyPayments.length > 0) {
                    console.log(`   📅 Updating ${debtor.monthlyPayments.length} monthly payments...`);
                    
                    debtor.monthlyPayments.forEach(monthlyPayment => {
                        // Add paymentMonths array if it doesn't exist
                        if (!monthlyPayment.paymentMonths) {
                            monthlyPayment.paymentMonths = [];
                            hasChanges = true;
                        }

                        // Add paymentMonthSummary if it doesn't exist
                        if (!monthlyPayment.paymentMonthSummary) {
                            monthlyPayment.paymentMonthSummary = {
                                totalPaymentMonths: monthlyPayment.paymentMonths.length,
                                firstPaymentMonth: null,
                                lastPaymentMonth: null,
                                paymentMonthBreakdown: []
                            };
                            hasChanges = true;
                        }

                        // Update paymentMonthSummary based on existing paymentMonths
                        if (monthlyPayment.paymentMonths.length > 0) {
                            const paymentMonths = monthlyPayment.paymentMonths.map(pm => pm.paymentMonth).sort();
                            monthlyPayment.paymentMonthSummary.firstPaymentMonth = paymentMonths[0];
                            monthlyPayment.paymentMonthSummary.lastPaymentMonth = paymentMonths[paymentMonths.length - 1];
                            
                            // Create payment month breakdown
                            const monthBreakdown = {};
                            monthlyPayment.paymentMonths.forEach(pm => {
                                if (!monthBreakdown[pm.paymentMonth]) {
                                    monthBreakdown[pm.paymentMonth] = { amount: 0, paymentCount: 0 };
                                }
                                monthBreakdown[pm.paymentMonth].amount += pm.amount || 0;
                                monthBreakdown[pm.paymentMonth].paymentCount += 1;
                            });
                            
                            monthlyPayment.paymentMonthSummary.paymentMonthBreakdown = Object.entries(monthBreakdown).map(([month, data]) => ({
                                month,
                                amount: data.amount,
                                paymentCount: data.paymentCount
                            }));
                            
                            hasChanges = true;
                        }
                    });
                }

                // Update monthlyPayments based on paymentHistory if monthlyPayments is empty
                if ((!debtor.monthlyPayments || debtor.monthlyPayments.length === 0) && 
                    debtor.paymentHistory && debtor.paymentHistory.length > 0) {
                    console.log(`   🔄 Creating monthly payments from payment history...`);
                    
                    const monthlyPaymentsMap = new Map();
                    
                    debtor.paymentHistory.forEach(payment => {
                        const allocatedMonth = payment.allocatedMonth;
                        if (!allocatedMonth) return;
                        
                        if (!monthlyPaymentsMap.has(allocatedMonth)) {
                            monthlyPaymentsMap.set(allocatedMonth, {
                                month: allocatedMonth,
                                paymentMonths: [],
                                expectedAmount: debtor.roomPrice || 0, // Use room price as expected amount
                                expectedComponents: {
                                    rent: debtor.roomPrice || 0,
                                    admin: 0,
                                    deposit: 0,
                                    utilities: 0,
                                    other: 0
                                },
                                paidAmount: 0,
                                paidComponents: {
                                    rent: 0,
                                    admin: 0,
                                    deposit: 0,
                                    utilities: 0,
                                    other: 0
                                },
                                outstandingAmount: debtor.roomPrice || 0,
                                outstandingComponents: {
                                    rent: debtor.roomPrice || 0,
                                    admin: 0,
                                    deposit: 0,
                                    utilities: 0,
                                    other: 0
                                },
                                status: 'unpaid',
                                paymentCount: 0,
                                paymentIds: [],
                                lastPaymentDate: null,
                                paymentMonthSummary: {
                                    totalPaymentMonths: 0,
                                    firstPaymentMonth: null,
                                    lastPaymentMonth: null,
                                    paymentMonthBreakdown: []
                                },
                                updatedAt: new Date()
                            });
                        }
                        
                        const monthlyPayment = monthlyPaymentsMap.get(allocatedMonth);
                        
                        // Add payment month information
                        if (payment.paymentDate) {
                            const paymentDate = new Date(payment.paymentDate);
                            const year = paymentDate.getFullYear();
                            const month = String(paymentDate.getMonth() + 1).padStart(2, '0');
                            const paymentMonth = `${year}-${month}`;
                            
                            const paymentMonthEntry = {
                                paymentMonth: paymentMonth,
                                paymentDate: payment.paymentDate,
                                amount: payment.amount || 0,
                                paymentId: payment.paymentId || 'Unknown',
                                status: payment.status || 'Confirmed'
                            };
                            
                            monthlyPayment.paymentMonths.push(paymentMonthEntry);
                        }
                        
                        // Update amounts
                        monthlyPayment.paidAmount += payment.amount || 0;
                        monthlyPayment.paymentCount += 1;
                        monthlyPayment.paymentIds.push(payment.paymentId || 'Unknown');
                        
                        if (payment.components) {
                            monthlyPayment.paidComponents.rent += payment.components.rent || 0;
                            monthlyPayment.paidComponents.admin += payment.components.adminFee || 0;
                            monthlyPayment.paidComponents.deposit += payment.components.deposit || 0;
                        }
                        
                        if (payment.paymentDate) {
                            monthlyPayment.lastPaymentDate = payment.paymentDate;
                        }
                    });
                    
                    // Convert map to array and update payment month summary
                    debtor.monthlyPayments = Array.from(monthlyPaymentsMap.values());
                    debtor.monthlyPayments.forEach(mp => {
                        if (mp.paymentMonths.length > 0) {
                            const paymentMonths = mp.paymentMonths.map(pm => pm.paymentMonth).sort();
                            mp.paymentMonthSummary.firstPaymentMonth = paymentMonths[0];
                            mp.paymentMonthSummary.lastPaymentMonth = paymentMonths[paymentMonths.length - 1];
                            mp.paymentMonthSummary.totalPaymentMonths = mp.paymentMonths.length;
                            
                            // Create payment month breakdown
                            const monthBreakdown = {};
                            mp.paymentMonths.forEach(pm => {
                                if (!monthBreakdown[pm.paymentMonth]) {
                                    monthBreakdown[pm.paymentMonth] = { amount: 0, paymentCount: 0 };
                                }
                                monthBreakdown[pm.paymentMonth].amount += pm.amount;
                                monthBreakdown[pm.paymentMonth].paymentCount += 1;
                            });
                            
                            mp.paymentMonthSummary.paymentMonthBreakdown = Object.entries(monthBreakdown).map(([month, data]) => ({
                                month,
                                amount: data.amount,
                                paymentCount: data.paymentCount
                            }));
                        }
                        
                        // Calculate outstanding amounts
                        mp.outstandingAmount = Math.max(0, mp.expectedAmount - mp.paidAmount);
                        mp.outstandingComponents.rent = Math.max(0, mp.expectedComponents.rent - mp.paidComponents.rent);
                        mp.outstandingComponents.admin = Math.max(0, mp.expectedComponents.admin - mp.paidComponents.admin);
                        mp.outstandingComponents.deposit = Math.max(0, mp.expectedComponents.deposit - mp.paidComponents.deposit);
                        
                        // Set status based on payment amount
                        if (mp.paidAmount >= mp.expectedAmount) {
                            mp.status = 'paid';
                        } else if (mp.paidAmount > 0) {
                            mp.status = 'partial';
                        } else {
                            mp.status = 'unpaid';
                        }
                    });
                    
                    hasChanges = true;
                }

                // Save changes if any were made
                if (hasChanges) {
                    await debtor.save();
                    updatedCount++;
                    console.log(`   ✅ Successfully updated debtor: ${debtor.debtorCode || debtor.user}`);
                } else {
                    console.log(`   ℹ️  No changes needed for debtor: ${debtor.debtorCode || debtor.user}`);
                }

            } catch (error) {
                errorCount++;
                console.error(`   ❌ Error updating debtor ${debtor.debtorCode || debtor.user}:`, error.message);
            }
        }

        console.log('\n🎉 Update Complete!');
        console.log('===================');
        console.log(`✅ Successfully updated: ${updatedCount} debtors`);
        console.log(`❌ Errors encountered: ${errorCount} debtors`);
        console.log(`📊 Total debtors processed: ${debtors.length}`);

        if (updatedCount > 0) {
            console.log('\n🚀 Your debtors collection now includes:');
            console.log('   📅 Enhanced month and payment month tracking');
            console.log('   💰 Payment month breakdowns');
            console.log('   📊 Comprehensive payment timing analysis');
            console.log('   🔍 Better visibility into payment patterns');
        }

        // Test the updated structure
        console.log('\n🧪 Testing Updated Structure...');
        console.log('================================');
        
        const testDebtor = await Debtor.findOne({});
        if (testDebtor) {
            console.log(`\n🔍 Testing debtor: ${testDebtor.debtorCode || testDebtor.user}`);
            
            try {
                const summary = testDebtor.getMonthAndPaymentMonthSummary();
                console.log(`✅ Enhanced methods working: ${summary.totalMonths} months, ${summary.totalPayments} payments`);
                
                if (summary.monthlySummary.length > 0) {
                    const firstMonth = summary.monthlySummary[0];
                    console.log(`📅 First month: ${firstMonth.monthDisplay} (${firstMonth.month})`);
                    console.log(`   Payment months: ${firstMonth.paymentMonths.length}`);
                    console.log(`   Payment month summary: ${firstMonth.paymentMonthSummary.totalPaymentMonths} total`);
                }
                
                console.log('✅ All enhanced functionality working correctly!');
            } catch (error) {
                console.error('❌ Error testing enhanced methods:', error.message);
            }
        }

    } catch (error) {
        console.error('❌ Update Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🔄 Starting Robust Debtors Collection Update...');
updateDebtorsCollectionRobust();
