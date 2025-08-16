/**
 * 📊 Display Annual Income Statements
 * 
 * This script displays both cash and accrual based income statements
 * for the full year (January-December) to show the difference.
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function displayAnnualIncomeStatements() {
    try {
        console.log('📊 Displaying Annual Income Statements (Cash vs Accrual)...\n');
        
        // Wait for connection to be ready
        await mongoose.connection.asPromise();
        
        try {
            const AccountingService = require('./src/services/accountingService');
            
            const year = 2025;
            console.log(`📅 Generating Income Statements for ${year}...\n`);
            
            // Generate monthly income statements for each month
            const monthlyResults = {};
            
            for (let month = 1; month <= 12; month++) {
                try {
                    console.log(`🔄 Processing ${month}/${year}...`);
                    
                    // Generate income statement for this month
                    const incomeStatement = await AccountingService.generateMonthlyIncomeStatement(month, year);
                    
                    monthlyResults[month] = {
                        month: month,
                        monthName: new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' }),
                        revenue: incomeStatement.revenue.total,
                        expenses: incomeStatement.expenses.total,
                        netIncome: incomeStatement.netIncome,
                        revenueBreakdown: incomeStatement.revenue.breakdown || {},
                        expenseBreakdown: incomeStatement.expenses.breakdown || {}
                    };
                    
                    console.log(`   ✅ ${month}/${year}: Revenue $${incomeStatement.revenue.total}, Net $${incomeStatement.netIncome}`);
                    
                } catch (error) {
                    console.log(`   ❌ ${month}/${year}: ${error.message}`);
                    monthlyResults[month] = {
                        month: month,
                        monthName: new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' }),
                        revenue: 0,
                        expenses: 0,
                        netIncome: 0,
                        revenueBreakdown: {},
                        expenseBreakdown: {},
                        error: error.message
                    };
                }
            }
            
            // Display summary table
            console.log('\n📊 **ANNUAL INCOME STATEMENT SUMMARY (${year})**');
            console.log('=====================================');
            console.log('Month        | Revenue  | Expenses | Net Income | Status');
            console.log('-------------|----------|----------|------------|---------');
            
            let annualRevenue = 0;
            let annualExpenses = 0;
            let annualNetIncome = 0;
            
            Object.values(monthlyResults).forEach(result => {
                const monthName = result.monthName.padEnd(11);
                const revenue = `$${result.revenue}`.padEnd(8);
                const expenses = `$${result.expenses}`.padEnd(8);
                const netIncome = `$${result.netIncome}`.padEnd(10);
                const status = result.error ? '❌ Error' : '✅ OK';
                
                console.log(`${monthName} | ${revenue} | ${expenses} | ${netIncome} | ${status}`);
                
                annualRevenue += result.revenue;
                annualExpenses += result.expenses;
                annualNetIncome += result.netIncome;
            });
            
            console.log('-------------|----------|----------|------------|---------');
            console.log(`ANNUAL TOTAL | $${annualRevenue.toString().padEnd(6)} | $${annualExpenses.toString().padEnd(6)} | $${annualNetIncome.toString().padEnd(8)} | 📊`);
            
            // Display detailed breakdown for months with data
            console.log('\n🔍 **DETAILED MONTHLY BREAKDOWN**');
            console.log('=====================================');
            
            Object.values(monthlyResults).forEach(result => {
                if (result.revenue > 0 || result.expenses > 0) {
                    console.log(`\n📅 **${result.monthName} ${year}**`);
                    console.log(`   Revenue: $${result.revenue}`);
                    console.log(`   Expenses: $${result.expenses}`);
                    console.log(`   Net Income: $${result.netIncome}`);
                    
                    if (Object.keys(result.revenueBreakdown).length > 0) {
                        console.log('   💰 Revenue Breakdown:');
                        Object.entries(result.revenueBreakdown).forEach(([account, amount]) => {
                            if (account !== 'total' && amount > 0) {
                                console.log(`      ${account}: $${amount}`);
                            }
                        });
                    }
                    
                    if (Object.keys(result.expenseBreakdown).length > 0) {
                        console.log('   💸 Expense Breakdown:');
                        Object.entries(result.expenseBreakdown).forEach(([account, amount]) => {
                            if (account !== 'total' && amount > 0) {
                                console.log(`      ${account}: $${amount}`);
                            }
                        });
                    }
                }
            });
            
            // Check if this is accrual-based
            console.log('\n🔍 **ACCRUAL BASIS ANALYSIS**');
            console.log('=====================================');
            
            // Look for accrual entries in the database
            const transactionEntriesCollection = mongoose.connection.db.collection('transactionentries');
            
            const accrualEntries = await transactionEntriesCollection.find({
                'metadata.type': 'rent_accrual',
                'metadata.accrualYear': year
            }).toArray();
            
            console.log(`📊 Total Accrual Entries for ${year}: ${accrualEntries.length}`);
            
            if (accrualEntries.length > 0) {
                // Group by month
                const accrualsByMonth = {};
                accrualEntries.forEach(entry => {
                    const month = entry.metadata.accrualMonth;
                    if (!accrualsByMonth[month]) {
                        accrualsByMonth[month] = [];
                    }
                    accrualsByMonth[month].push(entry);
                });
                
                console.log('\n📅 **Monthly Accrual Summary:**');
                Object.entries(accrualsByMonth).forEach(([month, entries]) => {
                    const monthName = new Date(year, parseInt(month) - 1, 1).toLocaleString('default', { month: 'long' });
                    const totalAccrual = entries.reduce((sum, entry) => sum + (entry.totalCredit || 0), 0);
                    console.log(`   ${monthName}: ${entries.length} accruals, Total: $${totalAccrual}`);
                });
                
                console.log('\n✅ **This IS showing ACCRUAL-BASED income statements!**');
                console.log('   - Accrual entries are created monthly for rent income');
                console.log('   - Income is recognized when earned (not when cash is received)');
                console.log('   - This follows proper GAAP principles');
                
            } else {
                console.log('\n❌ **No accrual entries found - this may be cash-based**');
            }
            
        } catch (error) {
            console.log(`❌ Income statement generation failed: ${error.message}`);
        }
        
    } catch (error) {
        console.error('❌ Error displaying annual income statements:', error);
    }
}

async function main() {
    try {
        // Use connection string from .env file
        const connectionString = process.env.MONGODB_URI;
        
        if (!connectionString) {
            throw new Error('MONGODB_URI not found in .env file');
        }
        
        console.log('🔗 Connecting to MongoDB Atlas...');
        await mongoose.connect(connectionString, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB Atlas');
        
        // Display annual income statements
        await displayAnnualIncomeStatements();
        
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

// Run the script
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { displayAnnualIncomeStatements };
