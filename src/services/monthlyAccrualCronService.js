const cron = require('node-cron');
const mongoose = require('mongoose');
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
        this.lastBackfillRun = null;
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
            
            // Schedule: Run every 5 minutes in production, 1st of month at 1:00 AM in development
            // Cron format: '*/5 * * * *' = every 5 minutes
            const cronSchedule = process.env.NODE_ENV === 'production' ? '*/5 * * * *' : '0 1 1 * *';
            const scheduleDescription = process.env.NODE_ENV === 'production' 
                ? 'Every 5 minutes (Zimbabwe time)' 
                : '1st of each month at 1:00 AM (Zimbabwe time)';
            
            this.job = cron.schedule(cronSchedule, async () => {
                await this.processMonthlyAccrualsInstance();
            }, {
                scheduled: true,
                timezone: "Africa/Harare" // Zimbabwe timezone
            });
            
            this.isRunning = true;
            this.calculateNextRun();
            
            console.log('✅ Monthly accrual cron service started successfully');
            console.log(`   Next run: ${this.nextRun}`);
            console.log(`   Schedule: ${scheduleDescription}`);
            
            // Only run immediately if it's the first time and we're in development
            if (!this.lastRun && process.env.NODE_ENV !== 'production') {
                console.log('🔄 Running initial monthly accrual check (development mode)...');
                setTimeout(() => this.processMonthlyAccrualsInstance(), 5000); // Wait 5 seconds
            } else if (process.env.NODE_ENV === 'production') {
                console.log('🏭 Production mode: Cron service started, waiting for scheduled execution');
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
     * Ensure database connection is available
     */
    async ensureDatabaseConnection() {
        try {
            if (mongoose.connection.readyState !== 1) {
                console.log('🔄 Database not connected, waiting for connection...');
                
                // Wait for connection to be established (up to 30 seconds)
                let attempts = 0;
                const maxAttempts = 30;
                
                while (mongoose.connection.readyState !== 1 && attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    attempts++;
                    console.log(`   Waiting for database connection... (${attempts}/${maxAttempts})`);
                }
                
                if (mongoose.connection.readyState !== 1) {
                    throw new Error('Database connection timeout - connection not established within 30 seconds');
                }
                
                console.log('✅ Database connection established');
            } else {
                console.log('✅ Database connection already established');
            }
        } catch (error) {
            console.error('❌ Failed to ensure database connection:', error);
            throw error;
        }
    }

    /**
     * Process monthly accruals for the current month
     */
    static async processMonthlyAccruals() {
        const instance = new MonthlyAccrualCronService();
        return await instance.processMonthlyAccrualsInstance();
    }

    async processMonthlyAccrualsInstance() {
        try {
            // Ensure database connection is available
            await this.ensureDatabaseConnection();
            
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
            
            // After attempting current month, backfill any missing prior months (both lease start and monthly accruals)
            console.log('🧩 Running comprehensive backfill for missing accruals (lease start + monthly)...');
            const RentalAccrualService = require('./rentalAccrualService');
            const backfill = await RentalAccrualService.backfillMissingAccruals();
            if (backfill.success) {
                console.log(`   Backfill -> lease start created: ${backfill.leaseStartCreated}, monthly created: ${backfill.monthlyCreated}, total created: ${backfill.created}, skipped: ${backfill.skipped}, errors: ${backfill.errors?.length || 0}`);
            } else {
                console.log(`   Backfill -> failed: ${backfill.error}`);
            }

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
            // Ensure database connection is available
            await this.ensureDatabaseConnection();
            
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
            
            if (process.env.NODE_ENV === 'production') {
                // Production: Next run is in 5 minutes
                const nextRun = new Date(now);
                nextRun.setMinutes(nextRun.getMinutes() + 5);
                nextRun.setSeconds(0);
                nextRun.setMilliseconds(0);
                this.nextRun = nextRun;
            } else {
                // Development: Next run is 1st of next month at 1:00 AM
                let nextMonth = now.getMonth() + 1;
                let nextYear = now.getFullYear();
                
                if (nextMonth > 12) {
                    nextMonth = 1;
                    nextYear++;
                }
                
                this.nextRun = new Date(nextYear, nextMonth - 1, 1, 1, 0, 0);
            }
            
        } catch (error) {
            console.error('❌ Error calculating next run:', error);
            this.nextRun = null;
        }
    }
    
    /**
     * Get service status
     */
    getStatus() {
        const schedule = process.env.NODE_ENV === 'production' 
            ? '*/5 * * * * (Every 5 minutes)' 
            : '0 1 1 * * (1st of each month at 1:00 AM)';
            
        return {
            isRunning: this.isRunning,
            lastRun: this.lastRun,
            nextRun: this.nextRun,
            schedule: schedule,
            timezone: 'Africa/Harare',
            environment: process.env.NODE_ENV || 'development'
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
module.exports.MonthlyAccrualCronService = MonthlyAccrualCronService;
