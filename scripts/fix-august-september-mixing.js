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

async function fixAugustSeptemberMixing() {
    try {
        console.log('\n🔧 FIXING AUGUST/SEPTEMBER DATE MIXING ISSUE');
        console.log('=' .repeat(60));

        const TransactionEntry = require('../src/models/TransactionEntry');
        const Transaction = require('../src/models/Transaction');

        // Find the problematic September accrual that's dated August 31st
        const problematicAccruals = await TransactionEntry.find({
            source: 'rental_accrual',
            'metadata.type': 'monthly_rent_accrual',
            'metadata.accrualMonth': 9, // September
            'metadata.accrualYear': 2025,
            date: {
                $gte: new Date('2025-08-31'),
                $lt: new Date('2025-09-01')
            }
        });

        console.log(`🔍 Found ${problematicAccruals.length} problematic September accruals dated August 31st`);

        for (const accrual of problematicAccruals) {
            console.log(`\n📊 Processing accrual: ${accrual._id}`);
            console.log(`   Current date: ${accrual.date}`);
            console.log(`   Description: ${accrual.description}`);
            console.log(`   Metadata: Month ${accrual.metadata.accrualMonth}/${accrual.metadata.accrualYear}`);

            // The accrual should be dated September 1st, 2025
            const correctDate = new Date(2025, 8, 1); // Month is 0-indexed, so 8 = September
            console.log(`   Correct date should be: ${correctDate.toISOString()}`);

            // Update the TransactionEntry
            await TransactionEntry.findByIdAndUpdate(accrual._id, {
                date: correctDate
            });

            // Also update the corresponding Transaction if it exists
            if (accrual.transactionId) {
                const transaction = await Transaction.findOne({ transactionId: accrual.transactionId });
                if (transaction) {
                    await Transaction.findByIdAndUpdate(transaction._id, {
                        date: correctDate
                    });
                    console.log(`   ✅ Updated Transaction date to: ${correctDate.toISOString()}`);
                }
            }

            console.log(`   ✅ Updated TransactionEntry date to: ${correctDate.toISOString()}`);
        }

        // Now verify the fix
        console.log('\n🔍 VERIFYING THE FIX...');
        
        const augustEntries = await TransactionEntry.find({
            source: 'rental_accrual',
            date: { 
                $gte: new Date('2025-08-01'), 
                $lte: new Date('2025-08-31') 
            }
        });

        const septemberEntries = await TransactionEntry.find({
            source: 'rental_accrual',
            date: { 
                $gte: new Date('2025-09-01'), 
                $lte: new Date('2025-09-30') 
            }
        });

        console.log(`\n📊 AFTER FIX:`);
        console.log(`   August entries: ${augustEntries.length}`);
        console.log(`   September entries: ${septemberEntries.length}`);

        // Show August breakdown
        let augustTotal = 0;
        augustEntries.forEach((entry, index) => {
            if (entry.entries && Array.isArray(entry.entries)) {
                let entryIncome = 0;
                entry.entries.forEach(line => {
                    if (line.accountType === 'Income') {
                        entryIncome += line.credit || 0;
                    }
                });
                augustTotal += entryIncome;
                console.log(`   Entry ${index + 1}: ${entry.date.toDateString()} - $${entryIncome} (${entry.metadata?.type || 'N/A'})`);
            }
        });

        console.log(`\n💰 August Total Income: $${augustTotal.toFixed(2)}`);

        // Show September breakdown
        let septemberTotal = 0;
        septemberEntries.forEach((entry, index) => {
            if (entry.entries && Array.isArray(entry.entries)) {
                let entryIncome = 0;
                entry.entries.forEach(line => {
                    if (line.accountType === 'Income') {
                        entryIncome += line.credit || 0;
                    }
                });
                septemberTotal += entryIncome;
                console.log(`   Entry ${index + 1}: ${entry.date.toDateString()} - $${entryIncome} (${entry.metadata?.type || 'N/A'})`);
            }
        });

        console.log(`\n💰 September Total Income: $${septemberTotal.toFixed(2)}`);

        console.log('\n🎯 SUMMARY:');
        if (augustTotal === 112.26) {
            console.log(`   ✅ August income is now correct: $${augustTotal.toFixed(2)}`);
        } else {
            console.log(`   ❌ August income is still wrong: $${augustTotal.toFixed(2)} (expected $112.26)`);
        }

        if (septemberTotal === 220) {
            console.log(`   ✅ September income is now correct: $${septemberTotal.toFixed(2)}`);
        } else {
            console.log(`   ❌ September income is still wrong: $${septemberTotal.toFixed(2)} (expected $220)`);
        }

    } catch (error) {
        console.error('❌ Error fixing August/September mixing:', error);
    }
}

// Main execution
async function main() {
    try {
        await connectToDatabase();
        await fixAugustSeptemberMixing();
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

module.exports = { fixAugustSeptemberMixing };
