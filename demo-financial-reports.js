const mongoose = require('mongoose');
const Account = require('./src/models/Account');

/**
 * Financial Reports Demonstration
 * 
 * This script shows exactly what your financial reports should look like
 * now that your rental accrual system is implemented.
 * 
 * Run with: node demo-financial-reports.js
 */

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';

// Sample data for demonstration
const sampleData = {
    properties: [
        { code: 'STK', name: 'St Kilda', rent: 200.00, maintenance: 60.00, cleaning: 50.00 },
        { code: 'BEL', name: 'Belvedere', rent: 300.00, maintenance: 40.00, cleaning: 50.00 },
        { code: 'NYA', name: 'Nyanga', rent: 150.00, maintenance: 20.00, cleaning: 50.00 }
    ],
    utilities: {
        electricity: 120.00,
        water: 80.00,
        internet: 50.00,
        gas: 30.00
    },
    adminExpenses: {
        salaries: 500.00,
        marketing: 100.00,
        office: 75.00
    }
};

async function connectToDatabase() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB successfully!');
        console.log('');
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error.message);
        throw error;
    }
}

async function demonstrateFinancialReports() {
    try {
        console.log('=============================================');
        console.log('📊 FINANCIAL REPORTS DEMONSTRATION');
        console.log('=============================================\n');

        // 1. PROPERTY-SPECIFIC INCOME STATEMENTS
        console.log('🏠 1. PROPERTY-SPECIFIC INCOME STATEMENTS');
        console.log('=============================================\n');

        sampleData.properties.forEach(property => {
            const totalRevenue = property.rent;
            const totalExpenses = property.maintenance + property.cleaning;
            const propertyProfit = totalRevenue - totalExpenses;
            const profitMargin = ((propertyProfit / totalRevenue) * 100).toFixed(1);

            console.log(`${property.name.toUpperCase()} - JANUARY 2025`);
            console.log('├── REVENUE');
            console.log(`│   └── Rental Income: $${property.rent.toFixed(2)}`);
            console.log('├── DIRECT EXPENSES');
            console.log(`│   ├── Maintenance: $${property.maintenance.toFixed(2)}`);
            console.log(`│   └── Cleaning: $${property.cleaning.toFixed(2)}`);
            console.log(`├── Total Direct Expenses: $${totalExpenses.toFixed(2)}`);
            console.log(`├── PROPERTY PROFIT: $${propertyProfit.toFixed(2)}`);
            console.log(`└── Profit Margin: ${profitMargin}%`);
            console.log('');
        });

        // 2. MULTI-PROPERTY INCOME STATEMENT
        console.log('📈 2. MULTI-PROPERTY INCOME STATEMENT');
        console.log('=============================================\n');

        const totalRentalIncome = sampleData.properties.reduce((sum, p) => sum + p.rent, 0);
        const totalDirectExpenses = sampleData.properties.reduce((sum, p) => sum + p.maintenance + p.cleaning, 0);
        const totalUtilities = Object.values(sampleData.utilities).reduce((sum, val) => sum + val, 0);
        const totalAdminExpenses = Object.values(sampleData.adminExpenses).reduce((sum, val) => sum + val, 0);
        const totalExpenses = totalDirectExpenses + totalUtilities + totalAdminExpenses;
        const netIncome = totalRentalIncome - totalExpenses;

        console.log('REVENUE - JANUARY 2025');
        sampleData.properties.forEach(property => {
            const percentage = ((property.rent / totalRentalIncome) * 100).toFixed(1);
            console.log(`├── ${property.name}`);
            console.log(`│   └── Long-Term Rent: $${property.rent.toFixed(2)} (${percentage}%)`);
        });
        console.log(`└── Total Revenue: $${totalRentalIncome.toFixed(2)}`);
        console.log('');

        console.log('EXPENSES - JANUARY 2025');
        console.log('├── Direct Property Expenses');
        sampleData.properties.forEach(property => {
            const totalPropertyExpenses = property.maintenance + property.cleaning;
            console.log(`│   ├── ${property.name}: $${totalPropertyExpenses.toFixed(2)}`);
        });
        console.log(`│   └── Total Direct: $${totalDirectExpenses.toFixed(2)}`);
        console.log('├── Shared Utilities');
        console.log(`│   ├── Electricity: $${sampleData.utilities.electricity.toFixed(2)}`);
        console.log(`│   ├── Water: $${sampleData.utilities.water.toFixed(2)}`);
        console.log(`│   ├── Internet & Wi-Fi: $${sampleData.utilities.internet.toFixed(2)}`);
        console.log(`│   └── Gas: $${sampleData.utilities.gas.toFixed(2)}`);
        console.log(`│   └── Total Utilities: $${totalUtilities.toFixed(2)}`);
        console.log('├── Administrative Expenses');
        console.log(`│   ├── Salaries & Wages: $${sampleData.adminExpenses.salaries.toFixed(2)}`);
        console.log(`│   ├── Marketing & Advertising: $${sampleData.adminExpenses.marketing.toFixed(2)}`);
        console.log(`│   └── Office Expenses: $${sampleData.adminExpenses.office.toFixed(2)}`);
        console.log(`│   └── Total Admin: $${totalAdminExpenses.toFixed(2)}`);
        console.log(`└── Total Expenses: $${totalExpenses.toFixed(2)}`);
        console.log('');

        console.log(`NET INCOME: $${netIncome.toFixed(2)}`);
        const overallMargin = ((netIncome / totalRentalIncome) * 100).toFixed(1);
        console.log(`Overall Profit Margin: ${overallMargin}%`);
        console.log('');

        // 3. ACCOUNTS RECEIVABLE AGING REPORT
        console.log('💰 3. ACCOUNTS RECEIVABLE AGING REPORT');
        console.log('=============================================\n');

        console.log('ACCOUNTS RECEIVABLE - JANUARY 31, 2025');
        console.log('├── Current (0-30 days)');
        sampleData.properties.forEach(property => {
            console.log(`│   ├── ${property.name}: $${property.rent.toFixed(2)}`);
        });
        console.log(`│   └── Total Current: $${totalRentalIncome.toFixed(2)}`);
        console.log('├── 31-60 days: $0.00');
        console.log('├── 61-90 days: $0.00');
        console.log('└── Over 90 days: $0.00');
        console.log('');
        console.log(`TOTAL ACCOUNTS RECEIVABLE: $${totalRentalIncome.toFixed(2)}`);
        console.log('');

        // 4. PROPERTY PROFITABILITY ANALYSIS
        console.log('📊 4. PROPERTY PROFITABILITY ANALYSIS');
        console.log('=============================================\n');

        console.log('PROPERTY PERFORMANCE RANKING');
        console.log('(by profit margin)');
        console.log('');

        const propertyAnalysis = sampleData.properties.map(property => {
            const totalExpenses = property.maintenance + property.cleaning;
            const profit = property.rent - totalExpenses;
            const margin = (profit / property.rent) * 100;
            return { ...property, profit, margin };
        }).sort((a, b) => b.margin - a.margin);

        propertyAnalysis.forEach((property, index) => {
            const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
            console.log(`${rank} ${property.name}`);
            console.log(`   Revenue: $${property.rent.toFixed(2)}`);
            console.log(`   Direct Expenses: $${(property.maintenance + property.cleaning).toFixed(2)}`);
            console.log(`   Profit: $${property.profit.toFixed(2)}`);
            console.log(`   Margin: ${property.margin.toFixed(1)}%`);
            console.log('');
        });

        // 5. CHART OF ACCOUNTS SUMMARY
        console.log('🏗️ 5. CHART OF ACCOUNTS SUMMARY');
        console.log('=============================================\n');

        const accountSummary = await Account.aggregate([
            { $group: { _id: '$type', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        console.log('Account Distribution by Type:');
        accountSummary.forEach(type => {
            console.log(`   ${type._id}: ${type.count} accounts`);
        });

        // Show key rental accrual accounts
        console.log('\nKey Rental Accrual Accounts:');
        const keyAccounts = await Account.find({
            code: { $in: ['1101', '1102', '1103', '4001', '4002', '4003'] }
        }).sort('code');

        keyAccounts.forEach(account => {
            console.log(`   ${account.code} - ${account.name}`);
        });

        // 6. MONTHLY CASH FLOW PROJECTION
        console.log('\n💸 6. MONTHLY CASH FLOW PROJECTION');
        console.log('=============================================\n');

        console.log('CASH FLOW - FEBRUARY 2025');
        console.log('├── CASH INFLOWS');
        console.log(`│   ├── Expected Rent Collections: $${totalRentalIncome.toFixed(2)}`);
        console.log(`│   └── Total Inflows: $${totalRentalIncome.toFixed(2)}`);
        console.log('├── CASH OUTFLOWS');
        console.log(`│   ├── Property Expenses: $${totalDirectExpenses.toFixed(2)}`);
        console.log(`│   ├── Utilities: $${totalUtilities.toFixed(2)}`);
        console.log(`│   ├── Administrative: $${totalAdminExpenses.toFixed(2)}`);
        console.log(`│   └── Total Outflows: $${totalExpenses.toFixed(2)}`);
        console.log(`└── NET CASH FLOW: $${(totalRentalIncome - totalExpenses).toFixed(2)}`);
        console.log('');

        // 7. RECOMMENDATIONS
        console.log('💡 7. BUSINESS INSIGHTS & RECOMMENDATIONS');
        console.log('=============================================\n');

        console.log('📈 Performance Insights:');
        const bestProperty = propertyAnalysis[0];
        const worstProperty = propertyAnalysis[propertyAnalysis.length - 1];
        
        console.log(`   • Best Performing: ${bestProperty.name} (${bestProperty.margin.toFixed(1)}% margin)`);
        console.log(`   • Needs Attention: ${worstProperty.name} (${worstProperty.margin.toFixed(1)}% margin)`);
        console.log(`   • Overall Business Health: ${overallMargin}% profit margin`);
        console.log('');

        console.log('🎯 Action Items:');
        if (worstProperty.margin < 20) {
            console.log(`   • Review ${worstProperty.name} expenses and pricing`);
        }
        if (overallMargin < 30) {
            console.log('   • Consider utility cost optimization');
            console.log('   • Review administrative expense efficiency');
        }
        console.log('   • Monitor rent collection rates monthly');
        console.log('   • Track property-specific expense trends');

        console.log('\n🎉 Financial Reports Demonstration Complete!');
        console.log('Your rental accrual system is now providing professional-level insights!');

    } catch (error) {
        console.error('❌ Error demonstrating financial reports:', error);
    }
}

async function cleanup() {
    try {
        await mongoose.connection.close();
        console.log('✅ Database connection closed');
    } catch (error) {
        console.error('❌ Error closing database connection:', error);
    }
}

async function main() {
    try {
        await connectToDatabase();
        await demonstrateFinancialReports();
    } catch (error) {
        console.error('❌ Demonstration failed:', error);
    } finally {
        await cleanup();
        process.exit(0);
    }
}

if (require.main === module) {
    main();
}

module.exports = { demonstrateFinancialReports };
