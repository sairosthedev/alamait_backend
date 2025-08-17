require('dotenv').config();
const mongoose = require('mongoose');
const AccountingService = require('./src/services/accountingService');

async function debugBalanceSheet() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔍 Debugging Balance Sheet Calculation...');

        const monthEnd = new Date(2025, 11, 31);
        console.log(`\n📅 As of: ${monthEnd.toDateString()}`);

        // Check individual account balances
        console.log('\n📊 Individual Account Balances:');
        
        const bankBalance = await AccountingService.getAccountBalance('1001', monthEnd);
        console.log(`Bank Account (1001): $${bankBalance.toLocaleString()}`);
        
        const ecocashBalance = await AccountingService.getAccountBalance('1002', monthEnd);
        console.log(`Ecocash (1002): $${ecocashBalance.toLocaleString()}`);
        
        const innbucksBalance = await AccountingService.getAccountBalance('1003', monthEnd);
        console.log(`Innbucks (1003): $${innbucksBalance.toLocaleString()}`);
        
        const pettyCashBalance = await AccountingService.getAccountBalance('1004', monthEnd);
        console.log(`Petty Cash (1004): $${pettyCashBalance.toLocaleString()}`);
        
        const cashBalance = await AccountingService.getAccountBalance('1005', monthEnd);
        console.log(`Cash on Hand (1005): $${cashBalance.toLocaleString()}`);
        
        const adminPettyCashBalance = await AccountingService.getAccountBalance('1011', monthEnd);
        console.log(`Admin Petty Cash (1011): $${adminPettyCashBalance.toLocaleString()}`);

        // Calculate total cash
        const totalCash = bankBalance + ecocashBalance + innbucksBalance + pettyCashBalance + cashBalance + adminPettyCashBalance;
        console.log(`\n💰 Total Cash: $${totalCash.toLocaleString()}`);

        // Check Accounts Receivable
        const accountsReceivable = await AccountingService.getAccountsReceivableBalance(monthEnd);
        console.log(`\n📊 Accounts Receivable: $${accountsReceivable.toLocaleString()}`);

        // Check Liabilities
        const accountsPayable = await AccountingService.getAccountBalance('2000', monthEnd);
        console.log(`\n📋 Accounts Payable (2000): $${accountsPayable.toLocaleString()}`);
        
        const tenantDeposits = await AccountingService.getAccountBalance('2020', monthEnd);
        console.log(`📋 Tenant Deposits (2020): $${tenantDeposits.toLocaleString()}`);

        // Calculate total liabilities
        const totalLiabilities = accountsPayable + tenantDeposits;
        console.log(`📋 Total Liabilities: $${totalLiabilities.toLocaleString()}`);

        // Check Retained Earnings
        const retainedEarnings = await AccountingService.getRetainedEarnings(monthEnd);
        console.log(`\n📈 Retained Earnings: $${retainedEarnings.toLocaleString()}`);

        // Calculate totals
        const totalAssets = totalCash + accountsReceivable;
        const totalEquity = retainedEarnings;
        const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
        
        console.log(`\n⚖️ BALANCE SHEET TOTALS:`);
        console.log(`📋 Total Assets: $${totalAssets.toLocaleString()}`);
        console.log(`📋 Total Liabilities: $${totalLiabilities.toLocaleString()}`);
        console.log(`📋 Total Equity: $${totalEquity.toLocaleString()}`);
        console.log(`📋 Liabilities + Equity: $${totalLiabilitiesAndEquity.toLocaleString()}`);
        
        const difference = totalAssets - totalLiabilitiesAndEquity;
        console.log(`\n🔍 DIFFERENCE: $${difference.toLocaleString()}`);
        
        if (Math.abs(difference) > 0.01) {
            console.log(`❌ Balance sheet is off by $${difference.toLocaleString()}`);
        } else {
            console.log(`✅ Balance sheet is balanced!`);
        }

        await mongoose.connection.close();
        console.log('\n🔌 Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error debugging balance sheet:', error);
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }
    }
}

// Run the debug
debugBalanceSheet();


