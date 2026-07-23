/**
 * Ensure critical Mongo indexes exist after connect.
 * Runs in background so boot is not blocked.
 * Also drops known-dangerous indexes (e.g. Payment TTL that would delete payments).
 */
async function dropDangerousIndexes() {
    try {
        const Payment = require('../models/Payment');
        const indexes = await Payment.collection.indexes();
        for (const idx of indexes) {
            if (idx.expireAfterSeconds != null) {
                console.warn(
                    `⚠️ Dropping dangerous Payment TTL index "${idx.name}" (expireAfterSeconds=${idx.expireAfterSeconds})`
                );
                await Payment.collection.dropIndex(idx.name);
            }
        }
    } catch (err) {
        if (err.code !== 27 && !/index not found/i.test(err.message)) {
            console.warn('⚠️ dropDangerousIndexes:', err.message);
        }
    }
}

async function ensureCriticalIndexes() {
    try {
        await dropDangerousIndexes();

        const models = [
            require('../models/Payment'),
            require('../models/Debtor'),
            require('../models/Application'),
            require('../models/TransactionEntry'),
            require('../models/User'),
            require('../models/Maintenance'),
            require('../models/finance/Expense'),
            require('../models/Residence').Residence,
            require('../models/AuditLog')
        ];

        console.log('📇 Syncing MongoDB indexes (background)...');
        await Promise.all(
            models.map(async (Model) => {
                try {
                    await Model.syncIndexes();
                } catch (err) {
                    // Conflicting / unique-partial index changes can fail — log and continue
                    console.warn(`⚠️ Index sync warning for ${Model.modelName}: ${err.message}`);
                }
            })
        );
        console.log('✅ MongoDB index sync complete');
    } catch (error) {
        console.error('❌ ensureCriticalIndexes failed:', error.message);
    }
}

module.exports = { ensureCriticalIndexes, dropDangerousIndexes };
