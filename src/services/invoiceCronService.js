const cron = require('node-cron');
const mongoose = require('mongoose');
const RentalAccrualService = require('./rentalAccrualService');
const TransactionEntry = require('../models/TransactionEntry');
const Invoice = require('../models/Invoice');
const Application = require('../models/Application');
const logger = require('../utils/logger');

/**
 * Invoice Cron Service
 * 
 * Automatically creates invoices every 5 minutes for:
 * 1. New transactions that don't have invoices yet
 * 2. Missing invoices for existing transactions (backfill)
 * 
 * Runs every 5 minutes to ensure timely invoice creation
 */

class InvoiceCronService {
    
    constructor() {
        this.isRunning = false;
        this.lastRun = null;
        this.nextRun = null;
        this.job = null;
        this.lastBackfillRun = null;
    }
    
    /**
     * Start the invoice cron job
     */
    start() {
        try {
            if (this.isRunning) {
                console.log('📄 Invoice cron service is already running');
                return;
            }

            // Run every 5 minutes
            this.job = cron.schedule('*/5 * * * *', async () => {
                await this.processInvoices();
            }, {
                scheduled: false,
                timezone: "Africa/Harare"
            });

            this.job.start();
            this.isRunning = true;
            
            // Calculate next run time
            const now = new Date();
            this.nextRun = new Date(now.getTime() + (5 * 60 * 1000)); // 5 minutes from now
            
            console.log('📄 Invoice cron service started - running every 5 minutes');
            console.log(`   Next run: ${this.nextRun.toLocaleString('en-US', { timeZone: 'Africa/Harare' })}`);
            
        } catch (error) {
            console.error('❌ Failed to start invoice cron service:', error);
            throw error;
        }
    }
    
    /**
     * Stop the invoice cron job
     */
    stop() {
        try {
            if (this.job) {
                this.job.stop();
                this.job = null;
            }
            this.isRunning = false;
            console.log('📄 Invoice cron service stopped');
        } catch (error) {
            console.error('❌ Failed to stop invoice cron service:', error);
        }
    }
    
    /**
     * Get service status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            lastRun: this.lastRun,
            nextRun: this.nextRun,
            lastBackfillRun: this.lastBackfillRun
        };
    }
    
    /**
     * Ensure database connection is available
     */
    async ensureDatabaseConnection() {
        if (mongoose.connection.readyState !== 1) {
            console.log('📄 Invoice cron service waiting for database connection...');
            await new Promise((resolve) => {
                const checkConnection = () => {
                    if (mongoose.connection.readyState === 1) {
                        resolve();
                    } else {
                        setTimeout(checkConnection, 1000);
                    }
                };
                checkConnection();
            });
        }
    }
    
    /**
     * Main invoice processing function
     */
    async processInvoices() {
        try {
            // Ensure database connection is available
            await this.ensureDatabaseConnection();
            
            const now = new Date();
            this.lastRun = now;
            
            console.log(`\n📄 INVOICE PROCESS STARTED`);
            console.log(`   Date: ${now.toISOString()}`);
            console.log(`   Time: ${now.toLocaleTimeString('en-US', { timeZone: 'Africa/Harare' })}`);
            
            // Process new invoices
            const newInvoiceResult = await this.createNewInvoices();
            
            // Process backfill invoices (run less frequently to avoid performance issues)
            const shouldRunBackfill = this.shouldRunBackfill();
            let backfillResult = null;
            
            if (shouldRunBackfill) {
                console.log(`🔄 Running invoice backfill process...`);
                backfillResult = await this.backfillMissingInvoices();
                this.lastBackfillRun = now;
            } else {
                console.log(`⏭️ Skipping backfill - last run: ${this.lastBackfillRun ? this.lastBackfillRun.toLocaleString() : 'never'}`);
            }
            
            // Calculate next run time
            this.nextRun = new Date(now.getTime() + (5 * 60 * 1000));
            
            console.log(`✅ Invoice process completed`);
            console.log(`   New invoices created: ${newInvoiceResult.created}`);
            console.log(`   New invoice errors: ${newInvoiceResult.errors}`);
            if (backfillResult) {
                console.log(`   Backfill invoices created: ${backfillResult.created}`);
                console.log(`   Backfill invoice errors: ${backfillResult.errors}`);
            }
            console.log(`   Next run: ${this.nextRun.toLocaleString('en-US', { timeZone: 'Africa/Harare' })}`);
            
        } catch (error) {
            console.error('❌ Error in invoice cron process:', error);
        }
    }
    
    /**
     * Create invoices for new transactions that don't have invoices yet
     */
    async createNewInvoices() {
        try {
            console.log(`📄 Creating invoices for new transactions...`);
            
            // Find transaction entries that need invoices but don't have them yet
            const transactionsNeedingInvoices = await TransactionEntry.find({
                $and: [
                    {
                        $or: [
                            { 'metadata.type': 'lease_start' },
                            { 'metadata.type': 'monthly_rent_accrual' }
                        ]
                    },
                    {
                        // Check if invoice already exists for this transaction
                        $expr: {
                            $not: {
                                $in: [
                                    "$_id",
                                    {
                                        $map: {
                                            input: { $objectToArray: "$$ROOT" },
                                            as: "field",
                                            in: "$$field.v"
                                        }
                                    }
                                ]
                            }
                        }
                    }
                ]
            }).populate('sourceId').limit(50); // Limit to avoid overwhelming the system
            
            console.log(`   Found ${transactionsNeedingInvoices.length} transactions needing invoices`);
            
            let created = 0;
            let errors = 0;
            
            for (const transaction of transactionsNeedingInvoices) {
                try {
                    const invoiceResult = await this.createInvoiceForTransaction(transaction);
                    if (invoiceResult.success) {
                        created++;
                        console.log(`   ✅ Created invoice for transaction: ${transaction.transactionId}`);
                    } else {
                        errors++;
                        console.log(`   ❌ Failed to create invoice for transaction: ${transaction.transactionId} - ${invoiceResult.error}`);
                    }
                } catch (error) {
                    errors++;
                    console.error(`   ❌ Error creating invoice for transaction ${transaction.transactionId}:`, error.message);
                }
            }
            
            return { created, errors };
            
        } catch (error) {
            console.error('❌ Error in createNewInvoices:', error);
            return { created: 0, errors: 1 };
        }
    }
    
    /**
     * Backfill missing invoices for existing transactions
     */
    async backfillMissingInvoices() {
        try {
            console.log(`🔄 Backfilling missing invoices...`);
            
            // Find all transaction entries that should have invoices
            const allTransactions = await TransactionEntry.find({
                $or: [
                    { 'metadata.type': 'lease_start' },
                    { 'metadata.type': 'monthly_rent_accrual' }
                ]
            }).sort({ createdAt: -1 }).limit(100); // Limit to avoid performance issues
            
            console.log(`   Checking ${allTransactions.length} transactions for missing invoices`);
            
            let created = 0;
            let errors = 0;
            let skipped = 0;
            
            for (const transaction of allTransactions) {
                try {
                    // Check if invoice already exists for this transaction
                    const existingInvoice = await Invoice.findOne({
                        $or: [
                            { transactionId: transaction.transactionId },
                            { 'metadata.transactionId': transaction.transactionId },
                            { 'metadata.transactionEntryId': transaction._id }
                        ]
                    });
                    
                    if (existingInvoice) {
                        skipped++;
                        continue;
                    }
                    
                    const invoiceResult = await this.createInvoiceForTransaction(transaction);
                    if (invoiceResult.success) {
                        created++;
                        console.log(`   ✅ Backfilled invoice for transaction: ${transaction.transactionId}`);
                    } else {
                        errors++;
                        console.log(`   ❌ Failed to backfill invoice for transaction: ${transaction.transactionId} - ${invoiceResult.error}`);
                    }
                } catch (error) {
                    errors++;
                    console.error(`   ❌ Error backfilling invoice for transaction ${transaction.transactionId}:`, error.message);
                }
            }
            
            console.log(`   Backfill completed: ${created} created, ${skipped} skipped, ${errors} errors`);
            return { created, errors, skipped };
            
        } catch (error) {
            console.error('❌ Error in backfillMissingInvoices:', error);
            return { created: 0, errors: 1, skipped: 0 };
        }
    }
    
    /**
     * Create invoice for a specific transaction
     */
    async createInvoiceForTransaction(transaction) {
        try {
            const metadata = transaction.metadata || {};
            const transactionType = metadata.type;
            
            if (transactionType === 'lease_start') {
                // Create lease start invoice
                const application = await Application.findById(metadata.applicationId);
                if (!application) {
                    return { success: false, error: 'Application not found' };
                }
                
                const invoice = await RentalAccrualService.createAndSendLeaseStartInvoice(
                    application,
                    metadata.proratedRent || 0,
                    metadata.adminFee || 0,
                    metadata.securityDeposit || 0
                );
                
                return { success: true, invoice };
                
            } else if (transactionType === 'monthly_rent_accrual') {
                // Create monthly rent invoice
                const student = {
                    student: metadata.studentId,
                    firstName: metadata.studentName?.split(' ')[0] || 'Unknown',
                    lastName: metadata.studentName?.split(' ').slice(1).join(' ') || 'Student',
                    email: metadata.studentEmail || 'unknown@example.com',
                    phone: metadata.studentPhone || '',
                    residence: metadata.residenceId,
                    allocatedRoom: metadata.roomNumber
                };
                
                const invoice = await RentalAccrualService.createAndSendMonthlyInvoice(
                    student,
                    metadata.accrualMonth || metadata.month,
                    metadata.accrualYear || metadata.year,
                    metadata.monthlyRent || 0
                );
                
                return { success: true, invoice };
            }
            
            return { success: false, error: 'Unknown transaction type' };
            
        } catch (error) {
            console.error('❌ Error creating invoice for transaction:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Determine if backfill should run (run every 30 minutes to avoid performance issues)
     */
    shouldRunBackfill() {
        if (!this.lastBackfillRun) {
            return true; // First run
        }
        
        const now = new Date();
        const timeSinceLastBackfill = now.getTime() - this.lastBackfillRun.getTime();
        const thirtyMinutes = 30 * 60 * 1000; // 30 minutes in milliseconds
        
        return timeSinceLastBackfill >= thirtyMinutes;
    }
    
    /**
     * Manual trigger for invoice processing (for testing/admin use)
     */
    static async triggerInvoiceProcessing() {
        try {
            console.log('🚨 Manual invoice processing trigger requested');
            await instance.processInvoices();
            
            return {
                success: true,
                message: 'Invoice processing completed successfully',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Manual invoice processing trigger failed:', error);
            return {
                success: false,
                error: 'Manual invoice processing trigger failed',
                details: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

// Create singleton instance
const instance = new InvoiceCronService();

module.exports = {
    InvoiceCronService,
    instance
};

