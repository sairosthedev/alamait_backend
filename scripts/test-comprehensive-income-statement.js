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

async function testComprehensiveIncomeStatement() {
    try {
        console.log('\n🧪 TESTING COMPREHENSIVE MONTHLY INCOME STATEMENT');
        console.log('=' .repeat(70));

        const FinancialReportingService = require('../src/services/financialReportingService');
        const TransactionEntry = require('../src/models/TransactionEntry');

        // Test the comprehensive monthly income statement
        console.log('🔍 Testing generateComprehensiveMonthlyIncomeStatement...');
        const result = await FinancialReportingService.generateComprehensiveMonthlyIncomeStatement('2025', 'accrual');
        
        console.log('\n📊 RESULT STRUCTURE:');
        console.log(`   Period: ${result.period}`);
        console.log(`   Basis: ${result.basis}`);
        console.log(`   Monthly Breakdown Keys: ${Object.keys(result.monthly_breakdown)}`);
        
        // Check August specifically
        console.log('\n📅 AUGUST 2025 BREAKDOWN:');
        const august = result.monthly_breakdown[7]; // Month index 7 = August
        if (august) {
            console.log(`   Month: ${august.month}`);
            console.log(`   Month Number: ${august.monthNumber}`);
            console.log(`   Total Revenue: $${august.total_revenue}`);
            console.log(`   Total Expenses: $${august.total_expenses}`);
            console.log(`   Net Income: $${august.net_income}`);
            console.log(`   Transaction Count: ${august.transaction_count}`);
            
            if (Object.keys(august.revenue).length > 0) {
                console.log('   Revenue Breakdown:');
                Object.entries(august.revenue).forEach(([account, amount]) => {
                    console.log(`     ${account}: $${amount}`);
                });
            }
        } else {
            console.log('   ❌ August not found at index 7');
        }
        
        // Check all months to see the pattern
        console.log('\n📋 ALL MONTHS BREAKDOWN:');
        Object.entries(result.monthly_breakdown).forEach(([index, monthData]) => {
            if (monthData.total_revenue > 0) {
                console.log(`   Index ${index}: ${monthData.month} - Revenue: $${monthData.total_revenue}`);
            }
        });
        
        // Now let's manually verify what should be in August
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
        
        // Check if there's a month indexing issue
        console.log('\n🔍 CHECKING FOR MONTH INDEXING ISSUES:');
        
        const allAccrualEntries = await TransactionEntry.find({
            source: 'rental_accrual',
            date: { 
                $gte: new Date('2025-01-01'), 
                $lte: new Date('2025-12-31') 
            }
        });
        
        console.log(`   Total 2025 accrual entries: ${allAccrualEntries.length}`);
        
        // Check what month each entry is being processed as
        allAccrualEntries.forEach((entry, index) => {
            const entryDate = new Date(entry.date);
            const monthIndex = entryDate.getMonth(); // 0-11
            const monthName = entryDate.toLocaleString('default', { month: 'long' });
            
            if (entry.entries && Array.isArray(entry.entries)) {
                let entryIncome = 0;
                entry.entries.forEach(line => {
                    if (line.accountType === 'Income') {
                        entryIncome += line.credit || 0;
                    }
                });
                
                if (entryIncome > 0) {
                    console.log(`   Entry ${index + 1}: Date: ${entryDate.toDateString()}, Month Index: ${monthIndex} (${monthName}), Income: $${entryIncome}`);
                }
            }
        });

    } catch (error) {
        console.error('❌ Error testing comprehensive income statement:', error);
    }
}

// Main execution
async function main() {
    try {
        await connectToDatabase();
        await testComprehensiveIncomeStatement();
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

module.exports = { testComprehensiveIncomeStatement };
