const mongoose = require('mongoose');

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function connectToDatabase() {
    try {
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error);
        process.exit(1);
    }
}

async function disconnectFromDatabase() {
    try {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    } catch (error) {
        console.error('❌ Failed to disconnect from MongoDB:', error);
    }
}

async function adminMonthlyAccrualControl() {
    try {
        console.log('\n🎛️ ADMIN MONTHLY ACCRUAL CONTROL PANEL');
        console.log('=' .repeat(70));

        // Import required services
        const monthlyAccrualCronService = require('../src/services/monthlyAccrualCronService');
        const RentalAccrualService = require('../src/services/rentalAccrualService');
        const TransactionEntry = require('../src/models/TransactionEntry');
        const Application = require('../src/models/Application');

        // Get command line arguments
        const args = process.argv.slice(2);
        const command = args[0];

        if (!command) {
            showHelp();
            return;
        }

        switch (command.toLowerCase()) {
            case 'status':
                await showStatus();
                break;
                
            case 'start':
                await startCronService();
                break;
                
            case 'stop':
                await stopCronService();
                break;
                
            case 'trigger':
                const month = parseInt(args[1]) || null;
                const year = parseInt(args[2]) || null;
                await triggerMonthlyAccrual(month, year);
                break;
                
            case 'list':
                const listMonth = parseInt(args[1]) || null;
                const listYear = parseInt(args[2]) || null;
                await listMonthlyAccruals(listMonth, listYear);
                break;
                
            case 'cleanup':
                await cleanupMonthlyAccruals();
                break;
                
            case 'test':
                await testMonthlyAccrualService();
                break;
                
            default:
                console.log(`❌ Unknown command: ${command}`);
                showHelp();
                break;
        }

    } catch (error) {
        console.error('❌ Error in admin control:', error);
    }
}

async function showStatus() {
    try {
        console.log('\n📊 MONTHLY ACCRUAL SERVICE STATUS');
        console.log('-'.repeat(50));

        const monthlyAccrualCronService = require('../src/services/monthlyAccrualCronService');
        const TransactionEntry = require('../src/models/TransactionEntry');
        const Application = require('../src/models/Application');
        const status = monthlyAccrualCronService.getStatus();

        console.log(`🔄 Service Running: ${status.isRunning ? '✅ Yes' : '❌ No'}`);
        console.log(`📅 Schedule: ${status.schedule}`);
        console.log(`🌍 Timezone: ${status.timezone}`);
        console.log(`⏰ Last Run: ${status.lastRun ? status.lastRun.toISOString() : 'Never'}`);
        console.log(`⏭️ Next Run: ${status.nextRun ? status.nextRun.toISOString() : 'Not scheduled'}`);

        // Check database status
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        const currentMonthAccruals = await TransactionEntry.find({
            'metadata.accrualMonth': currentMonth,
            'metadata.accrualYear': currentYear,
            'metadata.type': 'monthly_rent_accrual',
            source: 'rental_accrual'
        });

        const totalAccruals = await TransactionEntry.find({
            'metadata.type': 'monthly_rent_accrual',
            source: 'rental_accrual'
        });

        console.log(`\n📋 Database Status:`);
        console.log(`   Current Month (${currentMonth}/${currentYear}): ${currentMonthAccruals.length} accruals`);
        console.log(`   Total Monthly Accruals: ${totalAccruals.length}`);

        // Check active students
        const activeStudents = await Application.find({
            status: 'approved',
            student: { $exists: true, $ne: null }
        });

        console.log(`   Active Students: ${activeStudents.length}`);

    } catch (error) {
        console.error('❌ Error showing status:', error);
    }
}

async function startCronService() {
    try {
        console.log('\n🚀 STARTING MONTHLY ACCRUAL CRON SERVICE');
        console.log('-'.repeat(50));

        const monthlyAccrualCronService = require('../src/services/monthlyAccrualCronService');
        monthlyAccrualCronService.start();

        console.log('✅ Cron service started successfully');
        console.log('   The service will now run automatically on the 1st of each month at 1:00 AM');

    } catch (error) {
        console.error('❌ Error starting cron service:', error);
    }
}

async function stopCronService() {
    try {
        console.log('\n🛑 STOPPING MONTHLY ACCRUAL CRON SERVICE');
        console.log('-'.repeat(50));

        const monthlyAccrualCronService = require('../src/services/monthlyAccrualCronService');
        monthlyAccrualCronService.stop();

        console.log('✅ Cron service stopped successfully');
        console.log('   Monthly accruals will no longer be created automatically');

    } catch (error) {
        console.error('❌ Error stopping cron service:', error);
    }
}

async function triggerMonthlyAccrual(month, year) {
    try {
        if (!month || !year) {
            const now = new Date();
            month = now.getMonth() + 1;
            year = now.getFullYear();
        }

        console.log(`\n🔄 MANUALLY TRIGGERING MONTHLY ACCRUAL`);
        console.log('-'.repeat(50));
        console.log(`📅 Period: ${month}/${year}`);

        const TransactionEntry = require('../src/models/TransactionEntry');

        // Check if accruals already exist
        const existingAccruals = await TransactionEntry.find({
            'metadata.accrualMonth': month,
            'metadata.accrualYear': year,
            'metadata.type': 'monthly_rent_accrual',
            source: 'rental_accrual'
        });

        if (existingAccruals.length > 0) {
            console.log(`⚠️ Monthly accruals already exist for ${month}/${year} (${existingAccruals.length} entries)`);
            console.log('   Use --force flag to recreate them');
            return;
        }

        console.log(`🏠 Creating monthly rent accruals for ${month}/${year}...`);
        
        const result = await RentalAccrualService.createMonthlyRentAccrual(month, year);

        if (result && result.success) {
            console.log(`✅ Monthly accruals created successfully!`);
            console.log(`   Accruals created: ${result.accrualsCreated}`);
            console.log(`   Month/Year: ${result.month}/${result.year}`);
            
            if (result.errors && result.errors.length > 0) {
                console.log(`   Errors: ${result.errors.length}`);
                result.errors.forEach((error, index) => {
                    console.log(`     ${index + 1}. ${error.student}: ${error.error}`);
                });
            }
        } else {
            console.log(`❌ Failed to create monthly accruals`);
            console.log(`   Error: ${result?.error || 'Unknown error'}`);
        }

    } catch (error) {
        console.error('❌ Error triggering monthly accrual:', error);
    }
}

async function listMonthlyAccruals(month, year) {
    try {
        console.log('\n📋 LISTING MONTHLY ACCRUALS');
        console.log('-'.repeat(50));

        const TransactionEntry = require('../src/models/TransactionEntry');

        let query = {
            'metadata.type': 'monthly_rent_accrual',
            source: 'rental_accrual'
        };

        if (month && year) {
            query['metadata.accrualMonth'] = month;
            query['metadata.accrualYear'] = year;
            console.log(`📅 Filtering for: ${month}/${year}`);
        }

        const accruals = await TransactionEntry.find(query).sort({ createdAt: -1 });

        if (accruals.length === 0) {
            console.log('ℹ️ No monthly accruals found');
            return;
        }

        console.log(`📊 Found ${accruals.length} monthly accrual entries`);

        accruals.forEach((accrual, index) => {
            console.log(`\n${index + 1}. Transaction ID: ${accrual.transactionId}`);
            console.log(`   Student: ${accrual.metadata?.studentName || 'N/A'}`);
            console.log(`   Room: ${accrual.metadata?.room || 'N/A'}`);
            console.log(`   Period: ${accrual.metadata?.accrualMonth}/${accrual.metadata?.accrualYear}`);
            console.log(`   Amount: $${accrual.totalDebit || accrual.totalCredit || 0}`);
            console.log(`   Date: ${accrual.date}`);
            console.log(`   Created: ${accrual.createdAt}`);
        });

    } catch (error) {
        console.error('❌ Error listing monthly accruals:', error);
    }
}

async function cleanupMonthlyAccruals() {
    try {
        console.log('\n🧹 CLEANING UP MONTHLY ACCRUALS');
        console.log('-'.repeat(50));

        // This would implement cleanup logic for duplicate or invalid accruals
        console.log('⚠️ Cleanup functionality not yet implemented');
        console.log('   This would remove duplicate or invalid monthly accrual entries');

    } catch (error) {
        console.error('❌ Error cleaning up monthly accruals:', error);
    }
}

async function testMonthlyAccrualService() {
    try {
        console.log('\n🧪 TESTING MONTHLY ACCRUAL SERVICE');
        console.log('-'.repeat(50));

        const RentalAccrualService = require('../src/services/rentalAccrualService');

        // Test with a future month to avoid conflicts
        const now = new Date();
        const testMonth = now.getMonth() === 11 ? 1 : now.getMonth() + 2;
        const testYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();

        console.log(`📅 Testing with period: ${testMonth}/${testYear}`);

        const result = await RentalAccrualService.createMonthlyRentAccrual(testMonth, testYear);

        if (result && result.success) {
            console.log(`✅ Test successful!`);
            console.log(`   Accruals created: ${result.accrualsCreated}`);
            console.log(`   Month/Year: ${result.month}/${result.year}`);
        } else {
            console.log(`❌ Test failed: ${result?.error || 'Unknown error'}`);
        }

    } catch (error) {
        console.error('❌ Error testing monthly accrual service:', error);
    }
}

function showHelp() {
    console.log('\n📖 USAGE: node scripts/admin-monthly-accrual-control.js <command> [options]');
    console.log('\n🔧 COMMANDS:');
    console.log('   status                    - Show service status and database info');
    console.log('   start                     - Start the cron service');
    console.log('   stop                      - Stop the cron service');
    console.log('   trigger [month] [year]   - Manually trigger monthly accruals');
    console.log('   list [month] [year]      - List monthly accruals (optional filter)');
    console.log('   cleanup                   - Clean up duplicate/invalid accruals');
    console.log('   test                      - Test the monthly accrual service');
    console.log('\n📝 EXAMPLES:');
    console.log('   node scripts/admin-monthly-accrual-control.js status');
    console.log('   node scripts/admin-monthly-accrual-control.js trigger 9 2025');
    console.log('   node scripts/admin-monthly-accrual-control.js list 8 2025');
}

// Main execution
async function main() {
    try {
        await connectToDatabase();
        await adminMonthlyAccrualControl();
    } catch (error) {
        console.error('❌ Main error:', error);
    } finally {
        await disconnectFromDatabase();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { adminMonthlyAccrualControl };
