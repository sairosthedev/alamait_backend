const cron = require('node-cron');
const StudentStatusManager = require('../utils/studentStatusManager');

/**
 * 🎯 STUDENT STATUS JOB
 * Automatically updates student statuses and handles expired students
 */
class StudentStatusJob {
    
    /**
     * Initialize the student status job
     */
    static initialize() {
        console.log('🕐 Initializing student status job...');
        
        // Run every day at 2:00 AM
        cron.schedule('0 2 * * *', async () => {
            console.log('🕐 Running daily student status update...');
            await this.runDailyStatusUpdate();
        });
        
        // Run every hour to check for expired students
        cron.schedule('0 * * * *', async () => {
            console.log('🕐 Running hourly expired student check...');
            await this.runExpiredStudentCheck();
        });
        
        console.log('✅ Student status job initialized');
    }
    
    /**
     * Run daily status update for all students
     */
    static async runDailyStatusUpdate() {
        try {
            console.log('🔄 Starting daily student status update...');
            
            const result = await StudentStatusManager.updateAllStudentStatuses();
            
            console.log('✅ Daily status update completed:');
            console.log(`   Total Students: ${result.total}`);
            console.log(`   Updated: ${result.updated}`);
            console.log(`   Unchanged: ${result.unchanged}`);
            console.log(`   Errors: ${result.errors}`);
            
            return result;
            
        } catch (error) {
            console.error('❌ Error in daily status update:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Run expired student check
     */
    static async runExpiredStudentCheck() {
        try {
            console.log('🔍 Starting expired student check...');
            
            const result = await StudentStatusManager.handleExpiredStudents();
            
            if (result.archived > 0) {
                console.log('✅ Expired student check completed:');
                console.log(`   Total Checked: ${result.total}`);
                console.log(`   Processed: ${result.processed}`);
                console.log(`   Archived: ${result.archived}`);
                console.log(`   Errors: ${result.errors}`);
            } else {
                console.log('ℹ️ No expired students found');
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ Error in expired student check:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Run status update manually (for testing or immediate execution)
     */
    static async runManualUpdate() {
        try {
            console.log('🔄 Running manual student status update...');
            
            const updateResult = await this.runDailyStatusUpdate();
            const expiredResult = await this.runExpiredStudentCheck();
            
            return {
                success: true,
                updateResult,
                expiredResult
            };
            
        } catch (error) {
            console.error('❌ Error in manual update:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get job status and statistics
     */
    static async getJobStatus() {
        try {
            const summary = await StudentStatusManager.getStatusSummary();
            
            return {
                success: true,
                jobStatus: 'running',
                lastRun: new Date(),
                summary
            };
            
        } catch (error) {
            console.error('❌ Error getting job status:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = StudentStatusJob;




