const mongoose = require('mongoose');
require('dotenv').config();

// Import the TransactionEntry model
const TransactionEntry = require('./src/models/TransactionEntry');

async function showExactTransactions() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB Atlas\n');

        console.log('🔍 EXACT TRANSACTIONS FOR CASH FLOW 2025');
        console.log('='.repeat(100));

        // Get all transactions for 2025 with cash-related sources
        const cashSources = ['manual', 'expense_payment', 'payment', 'rental_payment'];
        const allCashTransactions = await TransactionEntry.find({
            date: { $gte: new Date('2025-01-01'), $lte: new Date('2025-12-31') },
            source: { $in: cashSources }
        }).populate('entries').sort({ date: 1 });

        console.log(`📊 Found ${allCashTransactions.length} cash-related transactions in 2025\n`);

        // Group transactions by month
        const monthlyTransactions = {};
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        monthNames.forEach(month => {
            monthlyTransactions[month.toLowerCase()] = [];
        });

        allCashTransactions.forEach(entry => {
            const month = monthNames[entry.date.getMonth()];
            monthlyTransactions[month.toLowerCase()].push(entry);
        });

        // Display transactions by month
        monthNames.forEach(monthName => {
            const monthKey = monthName.toLowerCase();
            const transactions = monthlyTransactions[monthKey];
            
            if (transactions.length > 0) {
                console.log(`\n📅 ${monthName.toUpperCase()} 2025 - ${transactions.length} Transactions`);
                console.log('='.repeat(80));
                
                let monthCashInflows = 0;
                let monthCashOutflows = 0;
                
                transactions.forEach((entry, index) => {
                    console.log(`\n  📄 Transaction ${index + 1}:`);
                    console.log(`     Date: ${entry.date.toDateString()}`);
                    console.log(`     Source: ${entry.source}`);
                    console.log(`     Description: ${entry.description || 'N/A'}`);
                    
                    let transactionCashFlow = 0;
                    
                    console.log('     Account Entries:');
                    entry.entries.forEach(line => {
                        const accountCode = line.accountCode;
                        const accountName = line.accountName;
                        const accountType = line.accountType;
                        const debit = line.debit || 0;
                        const credit = line.credit || 0;
                        
                        // Check if this is a cash account (starts with 10)
                        const isCashAccount = /^10/.test(accountCode);
                        
                        // Calculate cash flow
                        let cashFlow;
                        if (accountType === 'Asset') {
                            cashFlow = credit - debit;
                        } else if (accountType === 'Liability') {
                            cashFlow = debit - credit;
                        } else if (accountType === 'Income') {
                            cashFlow = credit;
                        } else if (accountType === 'Expense') {
                            cashFlow = -(debit - credit);
                        }
                        
                        console.log(`       ${accountCode} - ${accountName} (${accountType}):`);
                        console.log(`         Debit: $${debit}, Credit: $${credit}`);
                        console.log(`         Cash Flow: $${cashFlow} ${isCashAccount ? '(CASH ACCOUNT)' : '(NON-CASH)'}`);
                        
                        // Only count cash accounts for cash flow
                        if (isCashAccount) {
                            transactionCashFlow += cashFlow;
                            
                            if (cashFlow > 0) {
                                monthCashInflows += cashFlow;
                            } else {
                                monthCashOutflows += Math.abs(cashFlow);
                            }
                        }
                    });
                    
                    console.log(`     Transaction Net Cash Flow: $${transactionCashFlow}`);
                });
                
                const monthNet = monthCashInflows - monthCashOutflows;
                console.log(`\n  💰 ${monthName} Summary:`);
                console.log(`     Cash Inflows: $${monthCashInflows.toLocaleString()}`);
                console.log(`     Cash Outflows: $${monthCashOutflows.toLocaleString()}`);
                console.log(`     Net Cash Flow: $${monthNet.toLocaleString()}`);
                
            } else {
                console.log(`\n📅 ${monthName.toUpperCase()} 2025 - No Transactions`);
                console.log('-'.repeat(40));
            }
        });

        // Show overall summary
        console.log('\n📊 OVERALL CASH FLOW SUMMARY 2025');
        console.log('='.repeat(80));
        
        let totalInflows = 0;
        let totalOutflows = 0;
        
        allCashTransactions.forEach(entry => {
            entry.entries.forEach(line => {
                if (/^10/.test(line.accountCode)) { // Cash accounts only
                    const debit = line.debit || 0;
                    const credit = line.credit || 0;
                    const accountType = line.accountType;
                    
                    let cashFlow;
                    if (accountType === 'Asset') {
                        cashFlow = credit - debit;
                    } else if (accountType === 'Liability') {
                        cashFlow = debit - credit;
                    } else if (accountType === 'Income') {
                        cashFlow = credit;
                    } else if (accountType === 'Expense') {
                        cashFlow = -(debit - credit);
                    }
                    
                    if (cashFlow > 0) {
                        totalInflows += cashFlow;
                    } else {
                        totalOutflows += Math.abs(cashFlow);
                    }
                }
            });
        });
        
        console.log(`Total Cash Inflows: $${totalInflows.toLocaleString()}`);
        console.log(`Total Cash Outflows: $${totalOutflows.toLocaleString()}`);
        console.log(`Net Cash Flow: $${(totalInflows - totalOutflows).toLocaleString()}`);
        
        // Show cash account breakdown
        console.log('\n💰 CASH ACCOUNTS BREAKDOWN');
        console.log('='.repeat(80));
        
        const cashAccounts = {};
        allCashTransactions.forEach(entry => {
            entry.entries.forEach(line => {
                if (/^10/.test(line.accountCode)) {
                    const accountCode = line.accountCode;
                    const accountName = line.accountName;
                    const debit = line.debit || 0;
                    const credit = line.credit || 0;
                    const accountType = line.accountType;
                    
                    if (!cashAccounts[accountCode]) {
                        cashAccounts[accountCode] = {
                            name: accountName,
                            inflows: 0,
                            outflows: 0,
                            transactions: 0
                        };
                    }
                    
                    let cashFlow;
                    if (accountType === 'Asset') {
                        cashFlow = credit - debit;
                    } else if (accountType === 'Liability') {
                        cashFlow = debit - credit;
                    } else if (accountType === 'Income') {
                        cashFlow = credit;
                    } else if (accountType === 'Expense') {
                        cashFlow = -(debit - credit);
                    }
                    
                    cashAccounts[accountCode].transactions++;
                    
                    if (cashFlow > 0) {
                        cashAccounts[accountCode].inflows += cashFlow;
                    } else {
                        cashAccounts[accountCode].outflows += Math.abs(cashFlow);
                    }
                }
            });
        });
        
        Object.entries(cashAccounts).forEach(([accountCode, data]) => {
            const net = data.inflows - data.outflows;
            console.log(`${accountCode} - ${data.name}:`);
            console.log(`  Transactions: ${data.transactions}`);
            console.log(`  Inflows: $${data.inflows.toLocaleString()}`);
            console.log(`  Outflows: $${data.outflows.toLocaleString()}`);
            console.log(`  Net: $${net.toLocaleString()}`);
            console.log('');
        });

    } catch (error) {
        console.error('❌ Error showing exact transactions:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the script
showExactTransactions();
