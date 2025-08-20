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

async function debugIncomeStatementBug() {
    try {
        console.log('\n🔍 DEBUGGING INCOME STATEMENT BUG');
        console.log('=' .repeat(60));

        const FinancialReportingService = require('../src/services/financialReportingService');
        const TransactionEntry = require('../src/models/TransactionEntry');

        // Generate the income statement
        console.log('🧪 Generating Income Statement...');
        const incomeStatement = await FinancialReportingService.generateIncomeStatement('2025', 'accrual');
        
        console.log('\n📊 INCOME STATEMENT RESULTS:');
        console.log(`   Total Revenue: $${incomeStatement.revenue.total_revenue}`);
        console.log(`   August Revenue: $${incomeStatement.revenue.monthly[8] ? Object.values(incomeStatement.revenue.monthly[8]).reduce((sum, val) => sum + val, 0) : 0}`);
        
        if (incomeStatement.revenue.monthly[8]) {
            console.log('\n   August Breakdown:');
            Object.entries(incomeStatement.revenue.monthly[8]).forEach(([account, amount]) => {
                console.log(`     ${account}: $${amount}`);
            });
        }

        // Now let's manually check what should be in August
        console.log('\n🔍 MANUAL VERIFICATION OF AUGUST DATA:');
        
        const augustEntries = await TransactionEntry.find({
            source: 'rental_accrual',
            date: { 
                $gte: new Date('2025-08-01'), 
                $lte: new Date('2025-08-31') 
            }
        });

        console.log(`   Found ${augustEntries.length} August entries`);
        
        let manualTotal = 0;
        augustEntries.forEach((entry, index) => {
            console.log(`\n   Entry ${index + 1}:`);
            console.log(`     Date: ${entry.date}`);
            console.log(`     Type: ${entry.metadata?.type || 'N/A'}`);
            console.log(`     Total: $${entry.totalDebit}`);
            
            if (entry.entries && Array.isArray(entry.entries)) {
                let entryIncome = 0;
                entry.entries.forEach((line, lineIndex) => {
                    if (line.accountType === 'Income') {
                        const amount = line.credit || 0;
                        entryIncome += amount;
                        console.log(`       ${line.accountCode} - ${line.accountName}: $${amount} (Income)`);
                    }
                });
                console.log(`     Entry Income Total: $${entryIncome}`);
                manualTotal += entryIncome;
            }
        });
        
        console.log(`\n💰 MANUAL CALCULATION:`);
        console.log(`   Total August Income: $${manualTotal.toFixed(2)}`);
        
        // Check if there are any other entries that might be affecting this
        console.log('\n🔍 CHECKING FOR OTHER ENTRIES:');
        
        const allAccrualEntries = await TransactionEntry.find({
            source: 'rental_accrual',
            date: { 
                $gte: new Date('2025-01-01'), 
                $lte: new Date('2025-12-31') 
            }
        });
        
        console.log(`   Total 2025 accrual entries: ${allAccrualEntries.length}`);
        
        // Check if there are any entries with wrong dates or metadata
        const suspiciousEntries = allAccrualEntries.filter(entry => {
            const entryDate = new Date(entry.date);
            const month = entryDate.getMonth() + 1;
            return month === 8; // August
        });
        
        console.log(`   Entries processed as August: ${suspiciousEntries.length}`);
        
        if (suspiciousEntries.length > augustEntries.length) {
            console.log('   ⚠️ Found discrepancy! Some entries are being processed as August when they shouldn\'t be.');
            
            suspiciousEntries.forEach((entry, index) => {
                console.log(`     ${index + 1}. Date: ${entry.date}, Type: ${entry.metadata?.type}, Total: $${entry.totalDebit}`);
            });
        }

        // Check the actual income statement generation logic
        console.log('\n🔍 INCOME STATEMENT GENERATION LOGIC:');
        console.log('   The issue might be in how the monthly breakdown is calculated.');
        console.log('   Let me check if it\'s using the correct date filtering...');

    } catch (error) {
        console.error('❌ Error debugging income statement bug:', error);
    }
}

// Main execution
async function main() {
    try {
        await connectToDatabase();
        await debugIncomeStatementBug();
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

module.exports = { debugIncomeStatementBug };
