const app = require('./app');
const connectDB = require('./config/database');
const { ensureUploadDirectoriesExist } = require('./utils/fileStorage');

const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();

        // Ensure upload directories exist
        ensureUploadDirectoriesExist();

        // Initialize cron jobs (includes EmailOutboxService in production)
        try {
            const { initCronJobs } = require('./utils/cronJobs');
            initCronJobs();
            console.log('✅ Cron jobs initialized');
        } catch (err) {
            console.error('❌ Failed to initialize cron jobs:', err);
        }

        // Start monthly accrual cron service after database connection
        const monthlyAccrualCronService = require('./services/monthlyAccrualCronService');
        try {
            monthlyAccrualCronService.start();
            console.log('✅ Monthly accrual cron service started');
        } catch (error) {
            console.error('❌ Failed to start monthly accrual cron service:', error);
        }

        // Start server
        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => {
            console.log(`Server rikumhanya pa ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer(); 