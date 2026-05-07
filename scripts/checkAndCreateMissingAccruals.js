/**
 * Script to check for missing accruals and optionally create them
 * 
 * Usage:
 *   node scripts/checkAndCreateMissingAccruals.js                    # Dry run (check only)
 *   node scripts/checkAndCreateMissingAccruals.js --fix               # Create missing accruals
 *   node scripts/checkAndCreateMissingAccruals.js --fix --year=2025    # For specific year
 *   node scripts/checkAndCreateMissingAccruals.js --fix --month=1 --year=2025  # For specific month/year
 */

require('dotenv').config();
const mongoose = require('mongoose');
const RentalAccrualService = require('../src/services/rentalAccrualService');

async function checkAndCreateMissingAccruals() {
    try {
        // Parse command line arguments
        const args = process.argv.slice(2);
        const dryRun = !args.includes('--fix');
        const yearArg = args.find(arg => arg.startsWith('--year='));
        const monthArg = args.find(arg => arg.startsWith('--month='));
        
        const year = yearArg ? parseInt(yearArg.split('=')[1]) : null;
        const month = monthArg ? parseInt(monthArg.split('=')[1]) : null;

        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 30000
        });
        console.log('✅ Connected to MongoDB\n');

        const options = {
            dryRun,
            ...(year && { startYear: year, endYear: year }),
            ...(month && year && { startMonth: month, endMonth: month, startYear: year, endYear: year })
        };

        if (dryRun) {
            console.log('⚠️  DRY RUN MODE - No accruals will be created\n');
        } else {
            console.log('🔧 FIX MODE - Missing accruals will be created\n');
        }

        const result = await RentalAccrualService.checkAndCreateMissingAccruals(options);

        console.log('\n📊 Final Results:');
        console.log(`   Missing accruals found: ${result.totalMissing}`);
        if (!dryRun) {
            console.log(`   Accruals created: ${result.totalCreated}`);
            console.log(`   Errors: ${result.totalErrors}`);
        }

        if (result.missingAccruals.length > 0) {
            console.log('\n📋 Missing Accruals Details:');
            result.missingAccruals.slice(0, 20).forEach(accrual => {
                console.log(`   - ${accrual.studentName}: ${accrual.month}/${accrual.year}`);
            });
            if (result.missingAccruals.length > 20) {
                console.log(`   ... and ${result.missingAccruals.length - 20} more`);
            }
        }

        await mongoose.disconnect();
        console.log('\n✅ Done');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

checkAndCreateMissingAccruals();
