require('dotenv').config();
const { previewMigration, migrateMonthlyRequestStatus } = require('./migrate-monthly-request-status');

// Check if we should run preview or actual migration
const args = process.argv.slice(2);
const isPreview = args.includes('--preview') || args.includes('-p');
const isDryRun = args.includes('--dry-run') || args.includes('-d');

console.log('🚀 Monthly Request Status Migration Runner');
console.log('==========================================\n');

if (isPreview || isDryRun) {
    console.log('🔍 Running in PREVIEW mode (no changes will be made)\n');
    previewMigration()
        .then(() => {
            console.log('\n✅ Preview completed successfully!');
            console.log('💡 To run the actual migration, use: node run-migration.js');
        })
        .catch(error => {
            console.error('❌ Preview failed:', error);
            process.exit(1);
        });
} else {
    console.log('⚠️  WARNING: This will modify your database!');
    console.log('💡 To preview changes first, use: node run-migration.js --preview\n');
    
    // Ask for confirmation
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    rl.question('Are you sure you want to proceed with the migration? (yes/no): ', (answer) => {
        rl.close();
        
        if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
            console.log('\n🔄 Starting migration...\n');
            migrateMonthlyRequestStatus()
                .then(() => {
                    console.log('\n✅ Migration completed successfully!');
                })
                .catch(error => {
                    console.error('❌ Migration failed:', error);
                    process.exit(1);
                });
        } else {
            console.log('❌ Migration cancelled by user');
            process.exit(0);
        }
    });
} 