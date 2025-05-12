const cron = require('node-cron');
const { handleExpiredApplications } = require('./applicationUtils');

// Schedule tasks to be run on the server
const initCronJobs = () => {
    // Run expired applications check every day at midnight
    cron.schedule('0 0 * * *', async () => {
        console.log('Running expired applications check...');
        await handleExpiredApplications();
    });
};

module.exports = {
    initCronJobs
}; 