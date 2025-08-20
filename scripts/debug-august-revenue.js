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

async function debugAugustRevenue() {
    try {
        console.log('\n🔍 DEBUGGING AUGUST 2025 REVENUE');
        console.log('=' .repeat(60));

        const TransactionEntry = require('../src/models/TransactionEntry');
        const FinancialReportingService = require('../src/services/financialReportingService');

        // Get all August 2025 rental accrual entries
        const augustEntries = await TransactionEntry.find({
            source: 'rental_accrual',
            date: { 
                $gte: new Date('2025-08-01'), 
                $lte: new Date('2025-08-31') 
            }
        });

        console.log(`📊 Found ${augustEntries.length} rental accrual entries for August 2025`);

        let totalIncome = 0;
        const incomeByAccount = {};

        augustEntries.forEach((entry, index) => {
            console.log(`\n📋 Entry ${index + 1}:`);
            console.log(`   Date: ${entry.date}`);
            console.log(`   Type: ${entry.metadata?.type || 'N/A'}`);
            console.log(`   Description: ${entry.description}`);
            console.log(`   Total Debit: $${entry.totalDebit}`);
            console.log(`   Total Credit: $${entry.totalCredit}`);
            
            if (entry.entries && Array.isArray(entry.entries)) {
                console.log(`   Line Items:`);
                entry.entries.forEach((line, lineIndex) => {
                    console.log(`     ${lineIndex + 1}. ${line.accountCode} - ${line.accountName}`);
                    console.log(`         Type: ${line.accountType}`);
                    console.log(`         Debit: $${line.debit || 0}`);
                    console.log(`         Credit: $${line.credit || 0}`);
                    
                    // Calculate income
                    if (line.accountType === 'Income') {
                        const amount = line.credit || 0;
                        totalIncome += amount;
                        
                        const key = `${line.accountCode} - ${line.accountName}`;
                        incomeByAccount[key] = (incomeByAccount[key] || 0) + amount;
                        
                        console.log(`         ✅ COUNTED AS INCOME: $${amount}`);
                    } else {
                        console.log(`         ❌ NOT COUNTED AS INCOME (Type: ${line.accountType})`);
                    }
                });
            }
        });

        console.log(`\n💰 INCOME SUMMARY:`);
        console.log(`   Total Income: $${totalIncome.toFixed(2)}`);
        Object.entries(incomeByAccount).forEach(([account, amount]) => {
            console.log(`   ${account}: $${amount.toFixed(2)}`);
        });

        // Now test the actual income statement generation
        console.log(`\n🧪 TESTING INCOME STATEMENT GENERATION:`);
        const incomeStatement = await FinancialReportingService.generateIncomeStatement('2025', 'accrual');
        
        console.log(`   August Revenue from Income Statement:`);
        if (incomeStatement.revenue && incomeStatement.revenue.monthly && incomeStatement.revenue.monthly[8]) {
            Object.entries(incomeStatement.revenue.monthly[8]).forEach(([account, amount]) => {
                console.log(`     ${account}: $${amount.toFixed(2)}`);
            });
        } else {
            console.log(`     No August revenue found in income statement`);
        }

        console.log(`\n🔍 ANALYSIS:`);
        if (totalIncome !== 332.26) {
            console.log(`   ❌ Expected total: $332.26, Actual total: $${totalIncome.toFixed(2)}`);
            console.log(`   ❌ The issue is that deposits are being counted as income!`);
        } else {
            console.log(`   ✅ Total income calculation is correct: $${totalIncome.toFixed(2)}`);
            console.log(`   ❌ But the income statement shows $312.26 - there's a bug in the generation logic!`);
        }

    } catch (error) {
        console.error('❌ Error debugging August revenue:', error);
    }
}

// Main execution
async function main() {
    try {
        await connectToDatabase();
        await debugAugustRevenue();
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

module.exports = { debugAugustRevenue };
