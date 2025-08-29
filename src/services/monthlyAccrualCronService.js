const cron = require('node-cron');
const RentalAccrualService = require('./rentalAccrualService');
const logger = require('../utils/logger'); // We'll create this if it doesn't exist

/**
 * Monthly Rental Accrual Cron Service
 * 
 * Automatically creates monthly rent accruals for all active students
 * Runs on the 1st of each month at 1:00 AM
 */
class MonthlyAccrualCronService {
    
    constructor() {
        this.isRunning = false;
        this.lastRun = null;
        this.nextRun = null;
        this.job = null;
    }
    
    /**
     * Start the monthly accrual cron job
     */
    start() {
        try {
            if (this.isRunning) {
                console.log('⚠️ Monthly accrual cron service is already running');
                return;
            }
            
            // Schedule: Run on the 1st of each month at 1:00 AM
            // Cron format: '0 1 1 * *' = minute hour day month day-of-week
            this.job = cron.schedule('0 1 1 * *', async () => {
                await this.processMonthlyAccruals();
            }, {
                scheduled: true,
                timezone: "Africa/Harare" // Zimbabwe timezone
            });
            
            this.isRunning = true;
            this.calculateNextRun();
            
            console.log('✅ Monthly accrual cron service started successfully');
            console.log(`   Next run: ${this.nextRun}`);
            console.log(`   Schedule: 1st of each month at 1:00 AM (Zimbabwe time)`);
            
            // Also run immediately if it's the first time (for testing)
            if (!this.lastRun) {
                console.log('🔄 Running initial monthly accrual check...');
                setTimeout(() => this.processMonthlyAccruals(), 5000); // Wait 5 seconds
            }
            
        } catch (error) {
            console.error('❌ Failed to start monthly accrual cron service:', error);
            throw error;
        }
    }
    
    /**
     * Stop the monthly accrual cron job
     */
    stop() {
        try {
            if (this.job) {
                this.job.stop();
                this.job = null;
            }
            
            this.isRunning = false;
            console.log('✅ Monthly accrual cron service stopped');
            
        } catch (error) {
            console.error('❌ Failed to stop monthly accrual cron service:', error);
            throw error;
        }
    }
    
    /**
     * Process monthly accruals for the current month
     */
    async processMonthlyAccruals() {
        try {
            const now = new Date();
            const month = now.getMonth() + 1;
            const year = now.getFullYear();
            
            console.log(`\n🕐 MONTHLY ACCRUAL PROCESS STARTED`);
            console.log(`   Date: ${now.toISOString()}`);
            console.log(`   Month: ${month}/${year}`);
            console.log(`   Time: ${now.toLocaleTimeString('en-US', { timeZone: 'Africa/Harare' })}`);
            
            // Even if some accruals exist, still attempt creation for missing students (per-student dedupe inside service)
            const existingAccruals = await this.checkExistingAccruals(month, year);
            if (existingAccruals.length > 0) {
                console.log(`ℹ️ Found ${existingAccruals.length} existing accrual entries for ${month}/${year}. Continuing to create for missing students...`);
            }

            // Create monthly accruals for all active students (service checks per student and skips existing)
            console.log(`🏠 Creating monthly rent accruals for ${month}/${year}...`);
            const result = await RentalAccrualService.createMonthlyRentAccrual(month, year);
            
            if (result && result.success) {
                console.log(`✅ Monthly accruals created successfully for ${month}/${year}`);
                console.log(`   Accruals created: ${result.accrualsCreated}`);
                console.log(`   Errors: ${result.errors?.length || 0}`);
                
                if (result.errors && result.errors.length > 0) {
                    console.log('⚠️ Some errors occurred:');
                    result.errors.forEach((error, index) => {
                        console.log(`   ${index + 1}. ${error.student}: ${error.error}`);
                    });
                }
            } else {
                console.log(`❌ Failed to create monthly accruals for ${month}/${year}`);
                console.log(`   Error: ${result?.error || 'Unknown error'}`);
            }
            
            // After attempting current month, backfill any missing prior months
            console.log('🧩 Running backfill for missing monthly accruals...');
            const backfill = await RentalAccrualService.backfillMissingAccruals();
            console.log(`   Backfill -> created: ${backfill.created}, skipped: ${backfill.skipped}, errors: ${backfill.errors?.length || 0}`);

            this.lastRun = now;
            this.calculateNextRun();
            
            console.log(`✅ Monthly accrual process completed for ${month}/${year}`);
            console.log(`   Next scheduled run: ${this.nextRun}`);
            
        } catch (error) {
            console.error('❌ Error in monthly accrual process:', error);
            this.lastRun = new Date();
            this.calculateNextRun();
        }
    }
    
    /**
     * Check if accruals already exist for a specific month
     */
    async checkExistingAccruals(month, year) {
        try {
            const TransactionEntry = require('../models/TransactionEntry');
            
            const existingAccruals = await TransactionEntry.find({
                'metadata.accrualMonth': month,
                'metadata.accrualYear': year,
                'metadata.type': 'monthly_rent_accrual',
                source: 'rental_accrual'
            });
            
            return existingAccruals;
            
        } catch (error) {
            console.error('❌ Error checking existing accruals:', error);
            return [];
        }
    }
    
    /**
     * Calculate the next scheduled run
     */
    calculateNextRun() {
        try {
            const now = new Date();
            let nextMonth = now.getMonth() + 1;
            let nextYear = now.getFullYear();
            
            if (nextMonth > 12) {
                nextMonth = 1;
                nextYear++;
            }
            
            this.nextRun = new Date(nextYear, nextMonth - 1, 1, 1, 0, 0);
            
        } catch (error) {
            console.error('❌ Error calculating next run:', error);
            this.nextRun = null;
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
            schedule: '0 1 1 * * (1st of each month at 1:00 AM)',
            timezone: 'Africa/Harare'
        };
    }
    
    /**
     * Manually trigger monthly accruals (for testing/admin use)
     */
    async triggerManualAccrual(month = null, year = null) {
        try {
            if (!month || !year) {
                const now = new Date();
                month = now.getMonth() + 1;
                year = now.getFullYear();
            }
            
            console.log(`🔄 Manually triggering monthly accruals for ${month}/${year}...`);
            
            // Create monthly accruals for the specified month (not current month)
            const result = await RentalAccrualService.createMonthlyRentAccrual(month, year);
            
            if (result && result.success) {
                console.log(`✅ Manual monthly accruals created successfully for ${month}/${year}`);
                console.log(`   Accruals created: ${result.accrualsCreated}`);
                console.log(`   Errors: ${result.errors?.length || 0}`);
                
                if (result.errors && result.errors.length > 0) {
                    console.log('⚠️ Some errors occurred:');
                    result.errors.forEach((error, index) => {
                        console.log(`   ${index + 1}. ${error.student}: ${error.error}`);
                    });
                }
            } else {
                console.log(`❌ Failed to create manual monthly accruals for ${month}/${year}`);
                console.log(`   Error: ${result?.error || 'Unknown error'}`);
            }
            
        } catch (error) {
            console.error('❌ Error in manual accrual trigger:', error);
            throw error;
        }
    }
}

// Create singleton instance
const monthlyAccrualCronService = new MonthlyAccrualCronService();

module.exports = monthlyAccrualCronService;
