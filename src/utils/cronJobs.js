const cron = require('node-cron');
const { handleExpiredApplications, sendExpiryWarnings } = require('./applicationUtils');
const emailOutboxService = require('../services/emailOutboxService');
const TenantAccrualCheckService = require('../services/tenantAccrualCheckService');
const AccrualIntegrityService = require('../services/accrualIntegrityService');
const FinancialReportPrecomputeService = require('../services/financialReportPrecomputeService');

let cronJobsInitialized = false;

// Schedule tasks to be run on the server
const initCronJobs = () => {
    // app.js and index.js both used to call this — guard against double schedules
    if (cronJobsInitialized) {
        console.log('⚠️ Cron jobs already initialized — skipping duplicate registration');
        return;
    }
    cronJobsInitialized = true;

    const isDev = process.env.NODE_ENV === 'development';

    // Run expired applications check every day at midnight
    cron.schedule('0 0 * * *', async () => {
        console.log('Running expired applications check...');
        await handleExpiredApplications();
        console.log('Running expiry warning emails...');
        await sendExpiryWarnings();
    });

    // Full tenant accrual sweep — daily (hourly monthlyAccrualCron already covers new months).
    // Running every 5 minutes on Atlas Flex saturates shared IOPS and slows every API.
    cron.schedule(isDev ? '0 */6 * * *' : '0 3 * * *', async () => {
        try {
            console.log('🔄 Running tenant accrual check...');
            await TenantAccrualCheckService.checkAllTenantsForMissingAccruals();
        } catch (error) {
            console.error('❌ Error in tenant accrual check cron job:', error);
        }
    }, {
        scheduled: true,
        timezone: 'Africa/Harare'
    });

    // Strong accrual integrity job (daily): ensure lease_start + monthly, then reverse duplicates.
    cron.schedule('10 2 * * *', async () => {
        try {
            console.log('🧾 Running daily accrual integrity job...');
            await AccrualIntegrityService.run({ fixDuplicates: true });
        } catch (error) {
            console.error('❌ Error in daily accrual integrity job:', error);
        }
    }, {
        scheduled: true,
        timezone: 'Africa/Harare'
    });

    // Pre-warm financial reports sparingly on Render (same process as the API).
    // Hourly full recomputes of cashflow/IS/BS saturate shared CPU + Flex IOPS.
    if (!isDev && process.env.ENABLE_REPORT_PRECOMPUTE !== 'false') {
        cron.schedule('0 */6 * * *', async () => {
            try {
                await FinancialReportPrecomputeService.warmCurrentReports();
            } catch (error) {
                console.error('❌ Error in financial report pre-compute job:', error);
            }
        }, {
            scheduled: true,
            timezone: 'Africa/Harare'
        });

        cron.schedule('30 1 * * *', async () => {
            try {
                console.log('📦 Running nightly financial report pre-compute...');
                await FinancialReportPrecomputeService.warmCurrentReports();
            } catch (error) {
                console.error('❌ Error in nightly financial report pre-compute:', error);
            }
        }, {
            scheduled: true,
            timezone: 'Africa/Harare'
        });

        // Delay startup warm so first requests are not blocked
        const warmDelayMs = Number(process.env.REPORT_WARM_STARTUP_DELAY_MS) || 180000;
        setTimeout(() => {
            FinancialReportPrecomputeService.warmCurrentReports().catch((error) => {
                console.error('❌ Error warming financial report cache on startup:', error);
            });
        }, warmDelayMs);
        console.log(`ℹ️ Report pre-compute: every 6h + nightly; startup warm in ${Math.round(warmDelayMs / 1000)}s`);
    } else {
        console.log('ℹ️ Skipping financial report pre-compute crons');
    }

    // Start email outbox retries every 60s in production
    try {
        emailOutboxService.start();
    } catch (err) {
        console.error('Failed to start EmailOutboxService:', err);
    }
};

module.exports = {
    initCronJobs
};
