const Debtor = require('../models/Debtor');
const TransactionEntry = require('../models/TransactionEntry');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');

class DebtorDataSyncService {
    
    /**
     * Sync all debtor data arrays from transaction entries
     */
    static async syncDebtorDataArrays(debtorId) {
        try {
            const debtor = await Debtor.findById(debtorId).populate('user', 'firstName lastName');
            if (!debtor) {
                throw new Error(`Debtor not found: ${debtorId}`);
            }

            console.log(`🔄 Syncing data arrays for debtor: ${debtor.debtorCode} (${debtor.user?.firstName} ${debtor.user?.lastName})`);

            // Get all transaction entries for this debtor
            const transactionEntries = await TransactionEntry.find({
                $or: [
                    { 'entries.accountCode': debtor.accountCode },
                    { sourceId: debtor._id },
                    { 'metadata.studentId': debtor.user._id.toString() }
                ]
            }).sort({ date: 1 });

            // Get all payments for this debtor
            const payments = await Payment.find({
                student: debtor.user._id
            }).sort({ paymentDate: 1 });

            // Get all invoices for this debtor
            const invoices = await Invoice.find({
                student: debtor.user._id
            }).sort({ invoiceDate: 1 });

            // Clear existing arrays
            debtor.paymentHistory = [];
            debtor.monthlyPayments = [];
            debtor.monthsAccrued = [];
            debtor.monthsPaid = [];
            debtor.transactionEntries = [];
            debtor.invoices = [];

            // Sync transaction entries
            await this.syncTransactionEntries(debtor, transactionEntries);

            // Sync payment history
            await this.syncPaymentHistory(debtor, payments);

            // Sync invoices
            await this.syncInvoices(debtor, invoices);

            // Sync monthly payments
            await this.syncMonthlyPayments(debtor);

            // Sync months accrued and paid
            await this.syncMonthsAccruedAndPaid(debtor);

            // Save the updated debtor
            await debtor.save();

            console.log(`✅ Successfully synced data arrays for debtor: ${debtor.debtorCode}`);
            console.log(`   📊 Transaction Entries: ${debtor.transactionEntries.length}`);
            console.log(`   💰 Payment History: ${debtor.paymentHistory.length}`);
            console.log(`   📅 Monthly Payments: ${debtor.monthlyPayments.length}`);
            console.log(`   📈 Months Accrued: ${debtor.monthsAccrued.length}`);
            console.log(`   💳 Months Paid: ${debtor.monthsPaid.length}`);
            console.log(`   📄 Invoices: ${debtor.invoices.length}`);

            return debtor;

        } catch (error) {
            console.error(`❌ Error syncing debtor data arrays:`, error);
            throw error;
        }
    }

    /**
     * Sync transaction entries array
     */
    static async syncTransactionEntries(debtor, transactionEntries) {
        console.log(`   🔄 Syncing ${transactionEntries.length} transaction entries`);

        debtor.transactionEntries = transactionEntries.map(tx => ({
            transactionId: tx.transactionId,
            date: tx.date,
            description: tx.description,
            reference: tx.reference,
            entries: tx.entries,
            totalDebit: tx.totalDebit,
            totalCredit: tx.totalCredit,
            source: tx.source,
            sourceId: tx.sourceId,
            sourceModel: tx.sourceModel,
            status: tx.status,
            metadata: tx.metadata,
            createdBy: tx.createdBy,
            createdAt: tx.createdAt
        }));
    }

    /**
     * Sync payment history array
     */
    static async syncPaymentHistory(debtor, payments) {
        console.log(`   🔄 Syncing ${payments.length} payments`);

        debtor.paymentHistory = payments.map(payment => ({
            paymentId: payment.paymentId,
            amount: payment.amount,
            allocatedMonth: payment.allocatedMonth || this.getMonthFromDate(payment.paymentDate),
            components: {
                rent: payment.components?.rent || 0,
                adminFee: payment.components?.adminFee || 0,
                deposit: payment.components?.deposit || 0,
                utilities: payment.components?.utilities || 0,
                other: payment.components?.other || 0
            },
            paymentMethod: payment.paymentMethod,
            paymentDate: payment.paymentDate,
            status: payment.status,
            originalPayment: payment._id,
            notes: payment.notes,
            createdBy: payment.createdBy,
            createdAt: payment.createdAt
        }));
    }

    /**
     * Sync invoices array
     */
    static async syncInvoices(debtor, invoices) {
        console.log(`   🔄 Syncing ${invoices.length} invoices`);

        debtor.invoices = invoices.map(invoice => ({
            invoiceId: invoice.invoiceId,
            amount: invoice.amount,
            month: invoice.month || this.getMonthFromDate(invoice.invoiceDate),
            invoiceDate: invoice.invoiceDate,
            dueDate: invoice.dueDate,
            status: invoice.status,
            components: {
                rent: invoice.components?.rent || 0,
                utilities: invoice.components?.utilities || 0,
                adminFee: invoice.components?.adminFee || 0,
                other: invoice.components?.other || 0
            },
            originalInvoice: invoice._id,
            notes: invoice.notes,
            createdBy: invoice.createdBy,
            createdAt: invoice.createdAt
        }));
    }

    /**
     * Sync monthly payments array
     */
    static async syncMonthlyPayments(debtor) {
        console.log(`   🔄 Syncing monthly payments`);

        // Group payments by month
        const monthlyPaymentGroups = {};
        
        debtor.paymentHistory.forEach(payment => {
            const month = payment.allocatedMonth;
            if (!monthlyPaymentGroups[month]) {
                monthlyPaymentGroups[month] = {
                    month: month,
                    totalAmount: 0,
                    paymentCount: 0,
                    payments: [],
                    components: {
                        rent: 0,
                        adminFee: 0,
                        deposit: 0,
                        utilities: 0,
                        other: 0
                    }
                };
            }
            
            monthlyPaymentGroups[month].totalAmount += payment.amount;
            monthlyPaymentGroups[month].paymentCount += 1;
            monthlyPaymentGroups[month].payments.push({
                paymentId: payment.paymentId,
                amount: payment.amount,
                date: payment.paymentDate,
                status: payment.status
            });
            
            // Sum components
            Object.keys(payment.components).forEach(component => {
                monthlyPaymentGroups[month].components[component] += payment.components[component] || 0;
            });
        });

        debtor.monthlyPayments = Object.values(monthlyPaymentGroups);
    }

    /**
     * Sync months accrued and paid arrays
     */
    static async syncMonthsAccruedAndPaid(debtor) {
        console.log(`   🔄 Syncing months accrued and paid`);

        // Group transaction entries by month for accruals
        const monthlyAccrualGroups = {};
        
        debtor.transactionEntries.forEach(tx => {
            if (tx.source === 'rental_accrual' && tx.metadata?.type) {
                const month = tx.metadata.month || this.getMonthFromDate(tx.date);
                
                if (!monthlyAccrualGroups[month]) {
                    monthlyAccrualGroups[month] = {
                        month: month,
                        amount: 0,
                        transactionCount: 0,
                        isLeaseStartMonth: false,
                        isProrated: false,
                        transactions: []
                    };
                }
                
                monthlyAccrualGroups[month].amount += tx.totalDebit;
                monthlyAccrualGroups[month].transactionCount += 1;
                monthlyAccrualGroups[month].transactions.push({
                    transactionId: tx.transactionId,
                    amount: tx.totalDebit,
                    date: tx.date,
                    type: tx.metadata.type
                });
                
                // Check if this is lease start month
                if (tx.metadata.type === 'lease_start') {
                    monthlyAccrualGroups[month].isLeaseStartMonth = true;
                    monthlyAccrualGroups[month].isProrated = true;
                }
            }
        });

        debtor.monthsAccrued = Object.values(monthlyAccrualGroups);

        // Group payments by month for paid months
        const monthlyPaidGroups = {};
        
        debtor.paymentHistory.forEach(payment => {
            const month = payment.allocatedMonth;
            
            if (!monthlyPaidGroups[month]) {
                monthlyPaidGroups[month] = {
                    month: month,
                    amount: 0,
                    paymentCount: 0,
                    payments: []
                };
            }
            
            monthlyPaidGroups[month].amount += payment.amount;
            monthlyPaidGroups[month].paymentCount += 1;
            monthlyPaidGroups[month].payments.push({
                paymentId: payment.paymentId,
                amount: payment.amount,
                date: payment.paymentDate,
                status: payment.status
            });
        });

        debtor.monthsPaid = Object.values(monthlyPaidGroups);

        // Update summary fields
        this.updateMonthsSummary(debtor);
    }

    /**
     * Update months summary fields
     */
    static updateMonthsSummary(debtor) {
        // Months Accrued Summary
        if (debtor.monthsAccrued.length > 0) {
            const sortedAccrued = debtor.monthsAccrued.sort((a, b) => a.month.localeCompare(b.month));
            debtor.monthsAccruedSummary = {
                totalMonths: sortedAccrued.length,
                totalAmount: sortedAccrued.reduce((sum, month) => sum + month.amount, 0),
                firstMonth: sortedAccrued[0].month,
                lastMonth: sortedAccrued[sortedAccrued.length - 1].month,
                averageAmount: sortedAccrued.reduce((sum, month) => sum + month.amount, 0) / sortedAccrued.length,
                leaseStartMonth: sortedAccrued.find(m => m.isLeaseStartMonth)?.month || null,
                leaseEndMonth: debtor.endDate ? this.getMonthFromDate(debtor.endDate) : null,
                expectedMonthsFromLease: debtor.startDate && debtor.endDate ? 
                    this.getMonthsBetween(debtor.startDate, debtor.endDate) : 0
            };
        }

        // Months Paid Summary
        if (debtor.monthsPaid.length > 0) {
            const sortedPaid = debtor.monthsPaid.sort((a, b) => a.month.localeCompare(b.month));
            debtor.monthsPaidSummary = {
                totalMonths: sortedPaid.length,
                totalAmount: sortedPaid.reduce((sum, month) => sum + month.amount, 0),
                firstMonth: sortedPaid[0].month,
                lastMonth: sortedPaid[sortedPaid.length - 1].month,
                averageAmount: sortedPaid.reduce((sum, month) => sum + month.amount, 0) / sortedPaid.length
            };
        }
    }

    /**
     * Sync all debtors data arrays
     */
    static async syncAllDebtorsDataArrays() {
        try {
            console.log('🔄 Starting sync for all debtors...');
            
            const debtors = await Debtor.find({});
            let successCount = 0;
            let errorCount = 0;

            for (const debtor of debtors) {
                try {
                    await this.syncDebtorDataArrays(debtor._id);
                    successCount++;
                } catch (error) {
                    console.error(`❌ Error syncing debtor ${debtor.debtorCode}:`, error.message);
                    errorCount++;
                }
            }

            console.log(`✅ Sync completed: ${successCount} successful, ${errorCount} errors`);
            return { successCount, errorCount };

        } catch (error) {
            console.error('❌ Error in sync all debtors:', error);
            throw error;
        }
    }

    /**
     * Helper: Get month from date (YYYY-MM format)
     */
    static getMonthFromDate(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }

    /**
     * Helper: Get months between two dates
     */
    static getMonthsBetween(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
    }
}

module.exports = DebtorDataSyncService;
