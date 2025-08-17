require('dotenv').config();
const mongoose = require('mongoose');

async function fixDebtorFinancialCalculations() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
        console.log('=' .repeat(60));

        console.log('🔍 Fixing Debtor Financial Calculations...');
        console.log('==========================================');

        // Get all debtors
        const debtors = await mongoose.connection.db.collection('debtors').find({}).toArray();
        console.log(`📊 Found ${debtors.length} debtors to fix`);

        let updatedCount = 0;
        let errors = [];

        for (const debtor of debtors) {
            try {
                console.log(`\n👤 Processing: ${debtor.contactInfo?.name || 'Unknown'} (${debtor.debtorCode})`);
                console.log(`   Current Room Price: $${debtor.roomPrice || 'N/A'}`);
                console.log(`   Current Total Owed: $${debtor.totalOwed || 'N/A'}`);
                console.log(`   Current Balance: $${debtor.currentBalance || 'N/A'}`);

                // Calculate correct financial amounts
                let correctTotalOwed = 0;
                let correctCurrentBalance = 0;
                let correctCreditLimit = 0;

                if (debtor.roomPrice && debtor.startDate && debtor.endDate) {
                    // Calculate billing period in months
                    const startDate = new Date(debtor.startDate);
                    const endDate = new Date(debtor.endDate);
                    const monthsDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24 * 30.44));
                    
                    // Calculate total owed based on room price and months
                    correctTotalOwed = debtor.roomPrice * monthsDiff;
                    
                    // Set credit limit to 2 months of room price
                    correctCreditLimit = debtor.roomPrice * 2;
                    
                    console.log(`   Billing Period: ${monthsDiff} months`);
                    console.log(`   Correct Total Owed: $${debtor.roomPrice} × ${monthsDiff} months = $${correctTotalOwed}`);
                    console.log(`   Correct Credit Limit: $${debtor.roomPrice} × 2 = $${correctCreditLimit}`);
                } else {
                    console.log(`   ⚠️  Missing room price or dates, using existing values`);
                    correctTotalOwed = debtor.totalOwed || 0;
                    correctCreditLimit = debtor.creditLimit || 0;
                }

                // Calculate current balance (total owed - total paid)
                correctCurrentBalance = Math.max(correctTotalOwed - (debtor.totalPaid || 0), 0);
                
                // Calculate overdue amount
                const correctOverdueAmount = correctCurrentBalance > 0 ? correctCurrentBalance : 0;

                // Determine status
                let correctStatus = 'active';
                if (correctCurrentBalance === 0) {
                    correctStatus = 'paid';
                } else if (correctCurrentBalance > 0 && debtor.endDate && new Date(debtor.endDate) < new Date()) {
                    correctStatus = 'overdue';
                }

                // Update debtor if calculations are different
                const needsUpdate = (
                    correctTotalOwed !== (debtor.totalOwed || 0) ||
                    correctCurrentBalance !== (debtor.currentBalance || 0) ||
                    correctCreditLimit !== (debtor.creditLimit || 0) ||
                    correctOverdueAmount !== (debtor.overdueAmount || 0) ||
                    correctStatus !== (debtor.status || 'active')
                );

                if (needsUpdate) {
                    console.log(`   🔄 Updating financial calculations:`);
                    console.log(`      Total Owed: $${debtor.totalOwed || 'N/A'} → $${correctTotalOwed}`);
                    console.log(`      Current Balance: $${debtor.currentBalance || 'N/A'} → $${correctCurrentBalance}`);
                    console.log(`      Credit Limit: $${debtor.creditLimit || 'N/A'} → $${correctCreditLimit}`);
                    console.log(`      Overdue Amount: $${debtor.overdueAmount || 'N/A'} → $${correctOverdueAmount}`);
                    console.log(`      Status: ${debtor.status || 'N/A'} → ${correctStatus}`);

                    await mongoose.connection.db.collection('debtors').updateOne(
                        { _id: debtor._id },
                        { 
                            $set: { 
                                totalOwed: correctTotalOwed,
                                currentBalance: correctCurrentBalance,
                                creditLimit: correctCreditLimit,
                                overdueAmount: correctOverdueAmount,
                                status: correctStatus,
                                updatedAt: new Date()
                            }
                        }
                    );
                    
                    updatedCount++;
                    console.log(`   ✅ Updated successfully`);
                } else {
                    console.log(`   ✅ Financial calculations are already correct`);
                }

            } catch (error) {
                console.error(`   ❌ Error processing debtor ${debtor.debtorCode}:`, error.message);
                errors.push({ debtorCode: debtor.debtorCode, error: error.message });
            }
        }

        console.log('\n🎉 Summary:');
        console.log('===========');
        console.log(`✅ Successfully updated ${updatedCount} debtors`);
        if (errors.length > 0) {
            console.log(`❌ ${errors.length} errors occurred`);
            errors.forEach(error => {
                console.log(`   - ${error.debtorCode}: ${error.error}`);
            });
        }

        // Show final state
        console.log('\n🔍 Final Debtor Financial Status:');
        console.log('==================================');
        const finalDebtors = await mongoose.connection.db.collection('debtors').find({}).toArray();
        finalDebtors.forEach((debtor, index) => {
            console.log(`\n${index + 1}. ${debtor.contactInfo?.name || 'Unknown'} (${debtor.debtorCode})`);
            console.log(`   Room: ${debtor.roomNumber || 'N/A'} - $${debtor.roomPrice || 'N/A'}/month`);
            console.log(`   Billing Period: ${debtor.billingPeriodLegacy || 'N/A'}`);
            console.log(`   Total Owed: $${debtor.totalOwed || 'N/A'}`);
            console.log(`   Total Paid: $${debtor.totalPaid || 'N/A'}`);
            console.log(`   Current Balance: $${debtor.currentBalance || 'N/A'}`);
            console.log(`   Status: ${debtor.status || 'N/A'}`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('🔍 Starting Debtor Financial Calculations Fix...');
fixDebtorFinancialCalculations();
