const mongoose = require('mongoose');
const MonthlyRequest = require('./src/models/MonthlyRequest');

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait';

// Helper function to determine if a request is for past/current month or future month
function isPastOrCurrentMonth(month, year) {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // getMonth() returns 0-11
    const currentYear = currentDate.getFullYear();
    
    // If year is less than current year, it's past
    if (year < currentYear) return true;
    
    // If year is current year and month is less than or equal to current month, it's past/current
    if (year === currentYear && month <= currentMonth) return true;
    
    // Otherwise it's future
    return false;
}

// Helper function to determine appropriate status based on month/year
function getDefaultStatusForMonth(month, year, isTemplate) {
    if (isTemplate) {
        return 'draft'; // Templates always stay draft
    }
    
    const isPastOrCurrent = isPastOrCurrentMonth(month, year);
    
    if (isPastOrCurrent) {
        return 'approved'; // Auto-approve historical requests
    } else {
        return 'pending'; // Require finance approval for future
    }
}

async function migrateMonthlyRequestStatus() {
    try {
        console.log('🔄 Starting Monthly Request Status Migration...\n');
        
        // Connect to database
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to database');
        
        // Get current date info
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        
        console.log(`📅 Current Date: ${currentDate.toLocaleDateString()}`);
        console.log(`📅 Current Month: ${currentMonth}, Current Year: ${currentYear}\n`);
        
        // Get all monthly requests
        const allRequests = await MonthlyRequest.find({});
        console.log(`📊 Total Monthly Requests Found: ${allRequests.length}\n`);
        
        if (allRequests.length === 0) {
            console.log('ℹ️ No monthly requests found in database');
            return;
        }
        
        // Statistics tracking
        let stats = {
            total: allRequests.length,
            templates: 0,
            pastCurrent: 0,
            future: 0,
            updated: 0,
            unchanged: 0,
            errors: 0,
            statusChanges: {
                'draft': { to: {}, count: 0 },
                'pending': { to: {}, count: 0 },
                'approved': { to: {}, count: 0 },
                'rejected': { to: {}, count: 0 },
                'completed': { to: {}, count: 0 }
            }
        };
        
        console.log('🔄 Processing Monthly Requests...\n');
        
        for (let i = 0; i < allRequests.length; i++) {
            const request = allRequests[i];
            const originalStatus = request.status;
            
            try {
                console.log(`Processing ${i + 1}/${allRequests.length}: ${request.title} (ID: ${request._id})`);
                console.log(`  Current Status: ${originalStatus}`);
                console.log(`  Is Template: ${request.isTemplate}`);
                
                if (request.isTemplate) {
                    console.log(`  Template - Keeping as draft`);
                    stats.templates++;
                    
                    if (originalStatus !== 'draft') {
                        request.status = 'draft';
                        request.requestHistory.push({
                            date: new Date(),
                            action: 'Status migrated to draft (template)',
                            user: request.submittedBy,
                            changes: [`Status changed from ${originalStatus} to draft (template migration)`]
                        });
                        await request.save();
                        stats.updated++;
                        stats.statusChanges[originalStatus].to['draft'] = (stats.statusChanges[originalStatus].to['draft'] || 0) + 1;
                        console.log(`  ✅ Updated: ${originalStatus} → draft`);
                    } else {
                        stats.unchanged++;
                        console.log(`  ⏭️ No change needed (already draft)`);
                    }
                } else {
                    // Non-template request
                    if (request.month && request.year) {
                        const newStatus = getDefaultStatusForMonth(request.month, request.year, false);
                        console.log(`  Month/Year: ${request.month}/${request.year}`);
                        console.log(`  Calculated Status: ${newStatus}`);
                        
                        if (isPastOrCurrentMonth(request.month, request.year)) {
                            stats.pastCurrent++;
                        } else {
                            stats.future++;
                        }
                        
                        if (originalStatus !== newStatus) {
                            request.status = newStatus;
                            request.requestHistory.push({
                                date: new Date(),
                                action: 'Status migrated based on month/year',
                                user: request.submittedBy,
                                changes: [`Status changed from ${originalStatus} to ${newStatus} (month/year migration)`]
                            });
                            await request.save();
                            stats.updated++;
                            stats.statusChanges[originalStatus].to[newStatus] = (stats.statusChanges[originalStatus].to[newStatus] || 0) + 1;
                            console.log(`  ✅ Updated: ${originalStatus} → ${newStatus}`);
                        } else {
                            stats.unchanged++;
                            console.log(`  ⏭️ No change needed (already ${newStatus})`);
                        }
                    } else {
                        console.log(`  ⚠️ No month/year data - keeping current status`);
                        stats.unchanged++;
                    }
                }
                
                console.log(''); // Empty line for readability
                
            } catch (error) {
                console.error(`  ❌ Error processing request ${request._id}:`, error.message);
                stats.errors++;
            }
        }
        
        // Print migration summary
        console.log('📊 Migration Summary:');
        console.log('====================');
        console.log(`Total Requests: ${stats.total}`);
        console.log(`Templates: ${stats.templates}`);
        console.log(`Past/Current Month Requests: ${stats.pastCurrent}`);
        console.log(`Future Month Requests: ${stats.future}`);
        console.log(`Updated: ${stats.updated}`);
        console.log(`Unchanged: ${stats.unchanged}`);
        console.log(`Errors: ${stats.errors}\n`);
        
        // Print status change details
        console.log('🔄 Status Change Details:');
        console.log('========================');
        Object.keys(stats.statusChanges).forEach(fromStatus => {
            const changes = stats.statusChanges[fromStatus];
            if (Object.keys(changes.to).length > 0) {
                console.log(`From ${fromStatus}:`);
                Object.keys(changes.to).forEach(toStatus => {
                    console.log(`  → ${toStatus}: ${changes.to[toStatus]} requests`);
                });
            }
        });
        
        // Print examples of what was updated
        console.log('\n📋 Migration Examples:');
        console.log('=====================');
        console.log('✅ Templates: All templates set to "draft"');
        console.log('✅ Past/Current Months: Set to "approved" (auto-approved)');
        console.log('✅ Future Months: Set to "pending" (requires finance approval)');
        console.log('✅ Requests without month/year: Kept unchanged');
        
        console.log('\n🎉 Migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from database');
    }
}

// Function to preview what changes would be made (dry run)
async function previewMigration() {
    try {
        console.log('🔍 Previewing Monthly Request Status Migration (DRY RUN)...\n');
        
        // Connect to database
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to database');
        
        // Get current date info
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        
        console.log(`📅 Current Date: ${currentDate.toLocaleDateString()}`);
        console.log(`📅 Current Month: ${currentMonth}, Current Year: ${currentYear}\n`);
        
        // Get all monthly requests
        const allRequests = await MonthlyRequest.find({});
        console.log(`📊 Total Monthly Requests Found: ${allRequests.length}\n`);
        
        if (allRequests.length === 0) {
            console.log('ℹ️ No monthly requests found in database');
            return;
        }
        
        // Statistics tracking
        let stats = {
            total: allRequests.length,
            templates: 0,
            pastCurrent: 0,
            future: 0,
            wouldUpdate: 0,
            unchanged: 0,
            statusChanges: {
                'draft': { to: {}, count: 0 },
                'pending': { to: {}, count: 0 },
                'approved': { to: {}, count: 0 },
                'rejected': { to: {}, count: 0 },
                'completed': { to: {}, count: 0 }
            }
        };
        
        console.log('🔍 Previewing Changes (No actual updates will be made)...\n');
        
        for (let i = 0; i < Math.min(allRequests.length, 10); i++) { // Show first 10 for preview
            const request = allRequests[i];
            const originalStatus = request.status;
            
            console.log(`${i + 1}. ${request.title} (ID: ${request._id})`);
            console.log(`   Current Status: ${originalStatus}`);
            console.log(`   Is Template: ${request.isTemplate}`);
            
            if (request.isTemplate) {
                stats.templates++;
                if (originalStatus !== 'draft') {
                    console.log(`   Would Change: ${originalStatus} → draft (template)`);
                    stats.wouldUpdate++;
                    stats.statusChanges[originalStatus].to['draft'] = (stats.statusChanges[originalStatus].to['draft'] || 0) + 1;
                } else {
                    console.log(`   No Change: Already draft`);
                    stats.unchanged++;
                }
            } else {
                if (request.month && request.year) {
                    const newStatus = getDefaultStatusForMonth(request.month, request.year, false);
                    console.log(`   Month/Year: ${request.month}/${request.year}`);
                    
                    if (isPastOrCurrentMonth(request.month, request.year)) {
                        stats.pastCurrent++;
                        console.log(`   Category: Past/Current Month`);
                    } else {
                        stats.future++;
                        console.log(`   Category: Future Month`);
                    }
                    
                    if (originalStatus !== newStatus) {
                        console.log(`   Would Change: ${originalStatus} → ${newStatus}`);
                        stats.wouldUpdate++;
                        stats.statusChanges[originalStatus].to[newStatus] = (stats.statusChanges[originalStatus].to[newStatus] || 0) + 1;
                    } else {
                        console.log(`   No Change: Already ${newStatus}`);
                        stats.unchanged++;
                    }
                } else {
                    console.log(`   No Change: No month/year data`);
                    stats.unchanged++;
                }
            }
            console.log('');
        }
        
        if (allRequests.length > 10) {
            console.log(`... and ${allRequests.length - 10} more requests\n`);
        }
        
        // Print preview summary
        console.log('📊 Preview Summary:');
        console.log('==================');
        console.log(`Total Requests: ${stats.total}`);
        console.log(`Templates: ${stats.templates}`);
        console.log(`Past/Current Month Requests: ${stats.pastCurrent}`);
        console.log(`Future Month Requests: ${stats.future}`);
        console.log(`Would Update: ${stats.wouldUpdate}`);
        console.log(`Unchanged: ${stats.unchanged}\n`);
        
        console.log('💡 To run the actual migration, call: migrateMonthlyRequestStatus()');
        
    } catch (error) {
        console.error('❌ Preview failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from database');
    }
}

// Instructions
console.log('📋 Monthly Request Status Migration Script');
console.log('==========================================');
console.log('');
console.log('This script will update existing monthly request records to follow the new status logic:');
console.log('✅ Templates: Set to "draft"');
console.log('✅ Past/Current Months: Set to "approved" (auto-approved)');
console.log('✅ Future Months: Set to "pending" (requires finance approval)');
console.log('');
console.log('Available functions:');
console.log('1. previewMigration() - Preview changes without making them');
console.log('2. migrateMonthlyRequestStatus() - Run the actual migration');
console.log('');
console.log('⚠️  WARNING: This will modify your database. Make sure to backup first!');
console.log('');

// Export functions for use
module.exports = {
    migrateMonthlyRequestStatus,
    previewMigration
};

// Uncomment one of these to run:
// previewMigration(); // Preview changes first
// migrateMonthlyRequestStatus(); // Run actual migration 