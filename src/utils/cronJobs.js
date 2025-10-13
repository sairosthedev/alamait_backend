const cron = require('node-cron');
const { handleExpiredApplications, sendExpiryWarnings } = require('./applicationUtils');
const emailOutboxService = require('../services/emailOutboxService');

// Schedule tasks to be run on the server
const initCronJobs = () => {
    // Run expired applications check every day at midnight
    cron.schedule('0 0 * * *', async () => {
        console.log('Running expired applications check...');
        await handleExpiredApplications();
        console.log('Running expiry warning emails...');
        await sendExpiryWarnings();
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