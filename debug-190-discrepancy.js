const mongoose = require('mongoose');
const BalanceSheetService = require('./src/services/balanceSheetService');

// Connect to database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function debug190Discrepancy() {
    try {
        console.log('🔌 Connecting to database...');
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to database');

        // Test August 2025 balance sheet generation
        const asOfDate = '2025-08-31';
        console.log(`\n📊 Testing balance sheet generation for ${asOfDate}`);

        // Generate balance sheet using the actual service
        const balanceSheet = await BalanceSheetService.generateBalanceSheet(asOfDate);
        
        console.log(`\n💰 Balance Sheet Results:`);
        console.log(`Assets: $${balanceSheet.assets.totalAssets.toFixed(2)}`);
        console.log(`Liabilities: $${balanceSheet.liabilities.totalLiabilities.toFixed(2)}`);
        console.log(`Equity: $${balanceSheet.equity.totalEquity.toFixed(2)}`);
        
        // Check if it's balanced using the accounting equation
        const accountingEquation = balanceSheet.accountingEquation;
        console.log(`Accounting Equation: ${accountingEquation.message}`);

        // Check if it's balanced
        const totalAssets = balanceSheet.assets.totalAssets;
        const totalLiabilities = balanceSheet.liabilities.totalLiabilities;
        const totalEquity = balanceSheet.equity.totalEquity;
        const balanceCheck = totalAssets - (totalLiabilities + totalEquity);

        console.log(`\n🔍 Balance Check Calculation:`);
        console.log(`Total Assets: $${totalAssets.toFixed(2)}`);
        console.log(`Total Liabilities: $${totalLiabilities.toFixed(2)}`);
        console.log(`Total Equity: $${totalEquity.toFixed(2)}`);
        console.log(`Assets - (Liabilities + Equity): $${balanceCheck.toFixed(2)}`);
        
        if (Math.abs(balanceCheck) > 0.01) {
            console.log(`\n🚨 UNBALANCED by $${balanceCheck.toFixed(2)}`);
            
            // Check if it's close to $190
            if (Math.abs(Math.abs(balanceCheck) - 190) < 5) {
                console.log(`🎯 This matches the reported $190 discrepancy!`);
            }
        } else {
            console.log(`\n✅ Balance sheet is balanced`);
        }

        // Show detailed breakdown
        console.log(`\n📋 Detailed Breakdown:`);
        
        // Assets
        console.log(`\n💎 ASSETS:`);
        console.log(`  Current Assets: $${balanceSheet.assets.totalCurrent.toFixed(2)}`);
        console.log(`  Non-Current Assets: $${balanceSheet.assets.totalNonCurrent.toFixed(2)}`);
        console.log(`  Total Assets: $${balanceSheet.assets.totalAssets.toFixed(2)}`);
        
        // Liabilities
        console.log(`\n📊 LIABILITIES:`);
        console.log(`  Current Liabilities: $${balanceSheet.liabilities.totalCurrent.toFixed(2)}`);
        console.log(`  Non-Current Liabilities: $${balanceSheet.liabilities.totalNonCurrent.toFixed(2)}`);
        console.log(`  Total Liabilities: $${balanceSheet.liabilities.totalLiabilities.toFixed(2)}`);
        
        // Equity
        console.log(`\n🏛️ EQUITY:`);
        console.log(`  Capital: $${balanceSheet.equity.capital.toFixed(2)}`);
        console.log(`  Retained Earnings: $${balanceSheet.equity.retainedEarnings.toFixed(2)}`);
        console.log(`  Other Equity: $${balanceSheet.equity.otherEquity.toFixed(2)}`);
        console.log(`  Total Equity: $${balanceSheet.equity.totalEquity.toFixed(2)}`);

        // Test September 2025 to see if the discrepancy persists
        console.log(`\n📊 Testing September 2025 balance sheet...`);
        const septBalanceSheet = await BalanceSheetService.generateBalanceSheet('2025-09-30');
        
        const septTotalAssets = septBalanceSheet.assets.totalAssets;
        const septTotalLiabilities = septBalanceSheet.liabilities.totalLiabilities;
        const septTotalEquity = septBalanceSheet.equity.totalEquity;
        const septBalanceCheck = septTotalAssets - (septTotalLiabilities + septTotalEquity);

        console.log(`\n💰 September Balance Sheet Results:`);
        console.log(`Assets: $${septTotalAssets.toFixed(2)}`);
        console.log(`Liabilities: $${septTotalLiabilities.toFixed(2)}`);
        console.log(`Equity: $${septTotalEquity.toFixed(2)}`);
        console.log(`Balance Check: $${septBalanceCheck.toFixed(2)}`);
        console.log(`Accounting Equation: ${septBalanceSheet.accountingEquation.message}`);

        // Compare the two months
        console.log(`\n📈 Month-over-Month Comparison:`);
        console.log(`August Balance Check: $${balanceCheck.toFixed(2)}`);
        console.log(`September Balance Check: $${septBalanceCheck.toFixed(2)}`);
        console.log(`Difference: $${(septBalanceCheck - balanceCheck).toFixed(2)}`);

        // Check specific accounts mentioned by user - need to look at individual account balances
        console.log(`\n🎯 User-Reported Issues Analysis:`);
        console.log(`The user mentioned AR is over by $90 and advance payment by $60.`);
        console.log(`However, the balance sheet shows overall imbalance of $${Math.abs(balanceCheck).toFixed(2)}`);
        console.log(`This suggests the issue is in the overall balance sheet calculation, not just specific accounts.`);

        const userReportedAROver = 90;
        const userReportedAdvanceOver = 60;
        const userReportedTotal = userReportedAROver + userReportedAdvanceOver; // 150
        const actualTotal = Math.abs(balanceCheck);

        console.log(`\n🔍 User Report vs Actual:`);
        console.log(`User reported AR over by: $${userReportedAROver}`);
        console.log(`User reported Advance Payment over by: $${userReportedAdvanceOver}`);
        console.log(`User reported total: $${userReportedTotal}`);
        console.log(`Actual balance sheet discrepancy: $${actualTotal.toFixed(2)}`);

        if (Math.abs(actualTotal - 190) < 5) {
            console.log(`\n✅ Confirmed: Balance sheet is off by approximately $190`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from database');
    }
}

debug190Discrepancy();
