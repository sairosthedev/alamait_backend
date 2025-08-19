const mongoose = require('mongoose');
require('dotenv').config();

// Import the TransactionEntry model
const TransactionEntry = require('./src/models/TransactionEntry');
const FinancialReportingService = require('./src/services/financialReportingService');

async function auditCashFlows() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB Atlas\n');

        console.log('🔍 COMPREHENSIVE CASH FLOW AUDIT');
        console.log('='.repeat(80));

        // Get all transactions for 2025 with cash-related sources
        const cashSources = ['manual', 'expense_payment', 'payment', 'rental_payment'];
        const allCashTransactions = await TransactionEntry.find({
            date: { $gte: new Date('2025-01-01'), $lte: new Date('2025-12-31') },
            source: { $in: cashSources }
        }).populate('entries');

        console.log(`📊 Found ${allCashTransactions.length} transactions with cash-related sources`);
        console.log(`Sources: ${cashSources.join(', ')}\n`);

        // Analyze each transaction to understand cash movements
        let totalCashInflows = 0;
        let totalCashOutflows = 0;
        let cashAccountsSummary = {};

        console.log('🔍 DETAILED TRANSACTION ANALYSIS:');
        console.log('-'.repeat(80));

        allCashTransactions.forEach((entry, index) => {
            console.log(`\n📄 Transaction ${index + 1}:`);
            console.log(`   ID: ${entry._id}`);
            console.log(`   Date: ${entry.date.toDateString()}`);
            console.log(`   Source: ${entry.source}`);
            console.log(`   Description: ${entry.description || 'N/A'}`);
            
            let transactionCashFlow = 0;
            
            console.log('   Account Entries:');
            entry.entries.forEach(line => {
                const accountCode = line.accountCode;
                const accountName = line.accountName;
                const accountType = line.accountType;
                const debit = line.debit || 0;
                const credit = line.credit || 0;
                
                // Check if this is a cash account (starts with 10)
                const isCashAccount = /^10/.test(accountCode);
                
                // Calculate cash flow using the service method
                const cashFlow = FinancialReportingService.calculateCashFlow(accountType, debit, credit);
                
                console.log(`     ${accountCode} - ${accountName} (${accountType}):`);
                console.log(`       Debit: ${debit}, Credit: ${credit}`);
                console.log(`       Cash Flow: ${cashFlow} (${isCashAccount ? 'CASH ACCOUNT' : 'NON-CASH'})`);
                
                // Only count cash accounts for cash flow
                if (isCashAccount) {
                    transactionCashFlow += cashFlow;
                    
                    // Track by account
                    if (!cashAccountsSummary[accountCode]) {
                        cashAccountsSummary[accountCode] = {
                            name: accountName,
                            totalFlow: 0,
                            inflows: 0,
                            outflows: 0,
                            transactions: 0
                        };
                    }
                    
                    cashAccountsSummary[accountCode].totalFlow += cashFlow;
                    cashAccountsSummary[accountCode].transactions++;
                    
                    if (cashFlow > 0) {
                        cashAccountsSummary[accountCode].inflows += cashFlow;
                        totalCashInflows += cashFlow;
                    } else {
                        cashAccountsSummary[accountCode].outflows += Math.abs(cashFlow);
                        totalCashOutflows += Math.abs(cashFlow);
                    }
                }
            });
            
            console.log(`   Transaction Net Cash Flow: ${transactionCashFlow}`);
        });

        // Display cash accounts summary
        console.log('\n💰 CASH ACCOUNTS SUMMARY:');
        console.log('='.repeat(80));
        Object.entries(cashAccountsSummary).forEach(([accountCode, data]) => {
            console.log(`${accountCode} - ${data.name}:`);
            console.log(`   Total Transactions: ${data.transactions}`);
            console.log(`   Total Inflows: $${data.inflows.toLocaleString()}`);
            console.log(`   Total Outflows: $${data.outflows.toLocaleString()}`);
            console.log(`   Net Flow: $${data.totalFlow.toLocaleString()}`);
        });

        console.log('\n📊 OVERALL CASH FLOW TOTALS:');
        console.log('-'.repeat(50));
        console.log(`Total Cash Inflows: $${totalCashInflows.toLocaleString()}`);
        console.log(`Total Cash Outflows: $${totalCashOutflows.toLocaleString()}`);
        console.log(`Net Cash Flow: $${(totalCashInflows - totalCashOutflows).toLocaleString()}`);

        // Compare with the service results
        console.log('\n🔄 COMPARING WITH CASH FLOW SERVICE:');
        console.log('-'.repeat(50));
        
        const serviceCashFlow = await FinancialReportingService.generateMonthlyCashFlow('2025', 'cash');
        
        console.log('Service Results:');
        console.log(`   Operating Inflows: $${serviceCashFlow.yearly_totals.operating_activities.inflows.toLocaleString()}`);
        console.log(`   Operating Outflows: $${serviceCashFlow.yearly_totals.operating_activities.outflows.toLocaleString()}`);
        console.log(`   Net Operating: $${serviceCashFlow.yearly_totals.operating_activities.net.toLocaleString()}`);
        console.log(`   Total Net Cash Flow: $${serviceCashFlow.yearly_totals.net_cash_flow.toLocaleString()}`);

        // Check for discrepancies
        const inflowsMatch = Math.abs(totalCashInflows - serviceCashFlow.yearly_totals.operating_activities.inflows) < 0.01;
        const outflowsMatch = Math.abs(totalCashOutflows - serviceCashFlow.yearly_totals.operating_activities.outflows) < 0.01;
        const netMatch = Math.abs((totalCashInflows - totalCashOutflows) - serviceCashFlow.yearly_totals.net_cash_flow) < 0.01;

        console.log('\n✅ VERIFICATION RESULTS:');
        console.log('-'.repeat(50));
        console.log(`Inflows Match: ${inflowsMatch ? '✅ YES' : '❌ NO'}`);
        console.log(`Outflows Match: ${outflowsMatch ? '✅ YES' : '❌ NO'}`);
        console.log(`Net Flow Match: ${netMatch ? '✅ YES' : '❌ NO'}`);

        if (!inflowsMatch || !outflowsMatch || !netMatch) {
            console.log('\n⚠️  DISCREPANCIES FOUND:');
            if (!inflowsMatch) {
                console.log(`   Inflows: Manual ${totalCashInflows} vs Service ${serviceCashFlow.yearly_totals.operating_activities.inflows}`);
            }
            if (!outflowsMatch) {
                console.log(`   Outflows: Manual ${totalCashOutflows} vs Service ${serviceCashFlow.yearly_totals.operating_activities.outflows}`);
            }
            if (!netMatch) {
                console.log(`   Net: Manual ${totalCashInflows - totalCashOutflows} vs Service ${serviceCashFlow.yearly_totals.net_cash_flow}`);
            }
        }

        // Check for any transactions we might be missing
        console.log('\n🔍 CHECKING FOR MISSING TRANSACTIONS:');
        console.log('-'.repeat(50));
        
        const allTransactions = await TransactionEntry.find({
            date: { $gte: new Date('2025-01-01'), $lte: new Date('2025-12-31') }
        });
        
        const nonCashSourceTransactions = allTransactions.filter(entry => 
            !cashSources.includes(entry.source)
        );
        
        console.log(`Total transactions in 2025: ${allTransactions.length}`);
        console.log(`Cash-related transactions: ${allCashTransactions.length}`);
        console.log(`Non-cash source transactions: ${nonCashSourceTransactions.length}`);
        
        // Check if any non-cash source transactions have cash accounts
        const nonCashWithCashAccounts = [];
        for (const entry of nonCashSourceTransactions) {
            await entry.populate('entries');
            const hasCashAccount = entry.entries.some(line => /^10/.test(line.accountCode));
            if (hasCashAccount) {
                nonCashWithCashAccounts.push({
                    id: entry._id,
                    date: entry.date,
                    source: entry.source,
                    description: entry.description
                });
            }
        }
        
        if (nonCashWithCashAccounts.length > 0) {
            console.log('\n⚠️  NON-CASH SOURCE TRANSACTIONS WITH CASH ACCOUNTS:');
            nonCashWithCashAccounts.forEach(entry => {
                console.log(`   ${entry.source} - ${entry.date.toDateString()} - ${entry.description || 'N/A'}`);
            });
        } else {
            console.log('✅ No non-cash source transactions with cash accounts found');
        }

    } catch (error) {
        console.error('❌ Error auditing cash flows:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the audit
auditCashFlows();
