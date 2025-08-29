const Vendor = require('../models/Vendor');
const Account = require('../models/Account');

/**
 * 🆕 NEW: Real-time vendor update when AP transactions are created
 * This method is called automatically by TransactionEntry post-save hook
 * @param {string} accountCode - The vendor's AP account code (e.g., 200001)
 * @param {Object} transactionData - The transaction data that was just created
 */
exports.updateVendorFromAPTransaction = async (accountCode, transactionData) => {
    try {
        console.log(`🔄 Real-time update for vendor (Account: ${accountCode})`);
        
        // Find vendor by account code
        const vendor = await Vendor.findOne({ chartOfAccountsCode: accountCode });
        
        if (!vendor) {
            console.log(`   ⚠️ No vendor found for account code: ${accountCode}`);
            return { success: false, message: 'Vendor not found' };
        }
        
        console.log(`   📊 Updating vendor: ${vendor.vendorCode} (${vendor.businessName})`);
        
        // Get AP transactions for this vendor
        const TransactionEntry = require('../models/TransactionEntry');
        const apTransactions = await TransactionEntry.find({
            'entries.accountCode': accountCode
        }).sort({ date: 1 });
        
        let totalOwedFromAP = 0;
        let totalPaidFromAP = 0;
        
        // Process all AP transactions
        apTransactions.forEach(transaction => {
            transaction.entries.forEach(entry => {
                if (entry.accountCode === accountCode) {
                    if (transaction.source === 'expense_payment' || transaction.source === 'vendor_payment' || transaction.source === 'maintenance_expense') {
                        // This is an expense/invoice (we owe money to vendor)
                        totalOwedFromAP += entry.credit || 0;
                    } else if (transaction.source === 'payment' || transaction.source === 'vendor_payment_settlement' || transaction.source === 'vendor_payment') {
                        // This is a payment to vendor (we pay vendor)
                        totalPaidFromAP += entry.debit || 0;
                    }
                }
            });
        });
        
        const currentBalanceFromAP = totalOwedFromAP - totalPaidFromAP;
        
        // Update vendor totals
        vendor.currentBalance = currentBalanceFromAP;
        vendor.updatedAt = new Date();
        
        // Update vendor status based on balance
        if (currentBalanceFromAP === 0) {
            vendor.status = 'active';
        } else if (currentBalanceFromAP > 0) {
            vendor.status = 'active'; // Still active but has outstanding balance
        } else {
            vendor.status = 'active'; // Overpaid, still active
        }
        
        await vendor.save();
        
        console.log(`   ✅ Real-time update completed for ${vendor.vendorCode}:`);
        console.log(`      Total Owed: $${totalOwedFromAP.toFixed(2)}`);
        console.log(`      Total Paid: $${totalPaidFromAP.toFixed(2)}`);
        console.log(`      Current Balance: $${currentBalanceFromAP.toFixed(2)}`);
        
        return {
            success: true,
            vendor: vendor.vendorCode,
            vendorName: vendor.businessName,
            totalOwed: totalOwedFromAP,
            totalPaid: totalPaidFromAP,
            currentBalance: currentBalanceFromAP
        };
        
    } catch (error) {
        console.error(`❌ Error in real-time vendor update for account ${accountCode}:`, error);
        return { success: false, error: error.message };
    }
};

/**
 * Sync vendor totals with AP data
 * This ensures the vendors collection reflects the correct owed and paid amounts from the accounting system
 */
exports.syncVendorTotalsWithAP = async (vendorId = null) => {
    try {
        const TransactionEntry = require('../models/TransactionEntry');
        
        let vendorsToSync = [];
        
        if (vendorId) {
            // Sync specific vendor
            const vendor = await Vendor.findById(vendorId);
            if (!vendor) {
                throw new Error(`Vendor with ID ${vendorId} not found`);
            }
            vendorsToSync = [vendor];
        } else {
            // Sync all vendors
            vendorsToSync = await Vendor.find({});
        }

        console.log(`🔄 Syncing ${vendorsToSync.length} vendor(s) with AP data...`);

        let syncedCount = 0;
        let errorCount = 0;

        for (const vendor of vendorsToSync) {
            try {
                if (!vendor.chartOfAccountsCode) {
                    console.warn(`⚠️ No AP account code found for vendor ${vendor.vendorCode}`);
                    continue;
                }

                // Get all AP transactions for this vendor
                const apTransactions = await TransactionEntry.find({
                    'entries.accountCode': vendor.chartOfAccountsCode
                })
                .sort({ date: 1 })
                .lean();

                let totalOwedFromAP = 0;
                let totalPaidFromAP = 0;

                // Calculate totals from AP transactions
                apTransactions.forEach(transaction => {
                    transaction.entries.forEach(entry => {
                        if (entry.accountCode === vendor.chartOfAccountsCode) {
                            if (transaction.source === 'expense_payment' || transaction.source === 'vendor_payment' || transaction.source === 'maintenance_expense') {
                                // This is an expense/invoice (we owe money to vendor)
                                totalOwedFromAP += entry.credit || 0;
                            } else if (transaction.source === 'payment' || transaction.source === 'vendor_payment_settlement' || transaction.source === 'vendor_payment') {
                                // This is a payment to vendor (we pay vendor)
                                totalPaidFromAP += entry.debit || 0;
                            }
                        }
                    });
                });

                // Calculate current balance from AP data
                const currentBalanceFromAP = totalOwedFromAP - totalPaidFromAP;

                // Update vendor with AP data
                const updateData = {
                    currentBalance: currentBalanceFromAP,
                    updatedAt: new Date()
                };

                // Update status based on balance
                if (currentBalanceFromAP === 0) {
                    updateData.status = 'active';
                } else if (currentBalanceFromAP > 0) {
                    updateData.status = 'active'; // Still active but has outstanding balance
                } else {
                    updateData.status = 'active'; // Overpaid, still active
                }

                await Vendor.findByIdAndUpdate(vendor._id, updateData);

                console.log(`✅ Synced vendor ${vendor.vendorCode}: Owed $${totalOwedFromAP.toFixed(2)}, Paid $${totalPaidFromAP.toFixed(2)}, Balance $${currentBalanceFromAP.toFixed(2)}`);
                syncedCount++;

            } catch (error) {
                console.error(`❌ Error syncing vendor ${vendor.vendorCode}:`, error.message);
                errorCount++;
            }
        }

        console.log(`🔄 Sync completed: ${syncedCount} synced, ${errorCount} errors`);

        return {
            success: true,
            syncedCount,
            errorCount,
            totalProcessed: vendorsToSync.length
        };

    } catch (error) {
        console.error('❌ Error in syncVendorTotalsWithAP:', error);
        throw error;
    }
};

/**
 * Get vendor collection summary with AP data
 * Returns a summary of all vendors with their AP-linked totals
 */
exports.getVendorCollectionSummary = async () => {
    try {
        const TransactionEntry = require('../models/TransactionEntry');

        // Get all vendors with AP accounts
        const vendors = await Vendor.find({
            chartOfAccountsCode: { $exists: true, $ne: null }
        });

        let totalOwed = 0;
        let totalPaid = 0;
        let totalOutstanding = 0;
        let vendorCount = 0;
        let outstandingCount = 0;

        for (const vendor of vendors) {
            if (!vendor.chartOfAccountsCode) continue;

            // Get AP transactions for this vendor
            const apTransactions = await TransactionEntry.find({
                'entries.accountCode': vendor.chartOfAccountsCode
            }).lean();

            let vendorOwed = 0;
            let vendorPaid = 0;

            apTransactions.forEach(transaction => {
                transaction.entries.forEach(entry => {
                    if (entry.accountCode === vendor.chartOfAccountsCode) {
                        if (transaction.source === 'expense_payment' || transaction.source === 'vendor_payment' || transaction.source === 'maintenance_expense') {
                            vendorOwed += entry.credit || 0;
                        } else if (transaction.source === 'payment' || transaction.source === 'vendor_payment_settlement' || transaction.source === 'vendor_payment') {
                            vendorPaid += entry.debit || 0;
                        }
                    }
                });
            });

            const vendorOutstanding = vendorOwed - vendorPaid;

            totalOwed += vendorOwed;
            totalPaid += vendorPaid;
            totalOutstanding += vendorOutstanding;
            vendorCount++;

            if (vendorOutstanding > 0) {
                outstandingCount++;
            }
        }

        return {
            totalOwed,
            totalPaid,
            totalOutstanding,
            vendorCount,
            outstandingCount,
            paymentRate: totalOwed > 0 ? (totalPaid / totalOwed) * 100 : 0
        };

    } catch (error) {
        console.error('❌ Error in getVendorCollectionSummary:', error);
        throw error;
    }
};
