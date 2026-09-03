const app = require('./app');
const connectDB = require('./config/database');
const { ensureUploadDirectoriesExist } = require('./utils/fileStorage');

let jobsInitialized = false;

function initializeBackgroundJobs() {
    if (jobsInitialized) return;
    jobsInitialized = true;

    try {
        const { initCronJobs } = require('./utils/cronJobs');
        initCronJobs();
        console.log('✅ Cron jobs initialized');
    } catch (err) {
        console.error('❌ Failed to initialize cron jobs:', err);
    }

    try {
        const StudentStatusJob = require('./jobs/studentStatusJob');
        StudentStatusJob.initialize();
        console.log('✅ Student status job initialized');
    } catch (error) {
        console.error('❌ Failed to initialize student status job:', error);
    }

    if (process.env.DISABLE_HEAVY_JOBS === 'true') {
        console.log('ℹ️ DISABLE_HEAVY_JOBS=true — skipping monthly accrual cron on this process');
    } else {
        const monthlyAccrualCronService = require('./services/monthlyAccrualCronService');
        try {
            monthlyAccrualCronService.start();
            console.log('✅ Monthly accrual cron service started');
        } catch (error) {
            console.error('❌ Failed to start monthly accrual cron service:', error);
        }
    }
}

async function connectDatabaseWithRetry() {
    while (true) {
        try {
            await connectDB();
            initializeBackgroundJobs();
            return;
        } catch (error) {
            console.error('Failed to connect to MongoDB:', error.message);
            console.log('Retrying MongoDB connection in 10s...');
            await new Promise((resolve) => setTimeout(resolve, 10000));
        }
    }
}

const startServer = async () => {
    ensureUploadDirectoriesExist();

    // Listen immediately so Render's proxy gets a response during MongoDB cold connect
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Server rikumhanya pa ${PORT}`);
    });

    await connectDatabaseWithRetry();
};

startServer(); 