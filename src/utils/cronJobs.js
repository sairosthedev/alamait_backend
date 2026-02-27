const cron = require('node-cron');
const { handleExpiredApplications, sendExpiryWarnings } = require('./applicationUtils');
const emailOutboxService = require('../services/emailOutboxService');
const TenantAccrualCheckService = require('../services/tenantAccrualCheckService');

// Schedule tasks to be run on the server
const initCronJobs = () => {
    // Run expired applications check every day at midnight
    cron.schedule('0 0 * * *', async () => {
        console.log('Running expired applications check...');
        await handleExpiredApplications();
        console.log('Running expiry warning emails...');
        await sendExpiryWarnings();
    });

    // Check all current tenants for missing accruals every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
        try {
            console.log('🔄 Running tenant accrual check...');
            await TenantAccrualCheckService.checkAllTenantsForMissingAccruals();
        } catch (error) {
            console.error('❌ Error in tenant accrual check cron job:', error);
        }
    }, {
        scheduled: true,
        timezone: "Africa/Harare"
    });

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