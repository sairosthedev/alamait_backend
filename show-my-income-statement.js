const mongoose = require('mongoose');
const FinancialReportingService = require('./src/services/financialReportingService');

// 🔐 User's actual MongoDB Atlas credentials
const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function showMyIncomeStatement() {
    try {
        console.log('🏠 Loading Your Income Statement...\n');
        
        // Connect to your MongoDB Atlas cluster
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Connected to your MongoDB Atlas cluster');
        
        const year = process.argv[2] || '2025';
        console.log(`📊 Generating Income Statement for ${year}...\n`);
        
        // Show ACCRUAL BASIS Income Statement
        console.log('🔵 ACCRUAL BASIS - Income when earned:');
        console.log('='.repeat(50));
        const accrualStatement = await FinancialReportingService.generateIncomeStatement(year, 'accrual');
        
        console.log(`💰 Revenue: $${accrualStatement.revenue.total_revenue.toLocaleString()}`);
        console.log(`💸 Expenses: $${accrualStatement.expenses.total_expenses.toLocaleString()}`);
        console.log(`📈 Net Income: $${accrualStatement.net_income.toLocaleString()}`);
        console.log(`📊 Transactions: ${accrualStatement.transaction_count}`);
        console.log('');
        
        // Show CASH BASIS Income Statement
        console.log('🟢 CASH BASIS - Income when cash received:');
        console.log('='.repeat(50));
        const cashStatement = await FinancialReportingService.generateIncomeStatement(year, 'cash');
        
        console.log(`💰 Revenue: $${cashStatement.revenue.total_revenue.toLocaleString()}`);
        console.log(`💸 Expenses: $${cashStatement.expenses.total_expenses.toLocaleString()}`);
        console.log(`📈 Net Income: $${cashStatement.net_income.toLocaleString()}`);
        console.log(`📊 Transactions: ${cashStatement.transaction_count}`);
        console.log('');
        
        // Show Monthly Breakdown
        console.log('📅 MONTHLY BREAKDOWN (Cash Basis):');
        console.log('='.repeat(50));
        const monthlyBreakdown = await FinancialReportingService.generateComprehensiveMonthlyIncomeStatement(year, 'cash');
        
        monthlyBreakdown.month_names.forEach((month, index) => {
            const monthData = monthlyBreakdown.monthly_breakdown[index];
            if (monthData.total_revenue > 0 || monthData.total_expenses > 0) {
                console.log(`${month.padEnd(10)} | Revenue: $${monthData.total_revenue.toString().padStart(6)} | Expenses: $${monthData.total_expenses.toString().padStart(6)} | Net: $${monthData.net_income.toString().padStart(6)}`);
            }
        });
        
        console.log('');
        console.log('🎯 YEAR TOTALS:');
        console.log(`Total Revenue: $${monthlyBreakdown.year_totals.total_revenue.toLocaleString()}`);
        console.log(`Total Expenses: $${monthlyBreakdown.year_totals.total_expenses.toLocaleString()}`);
        console.log(`Net Income: $${monthlyBreakdown.year_totals.net_income.toLocaleString()}`);
        console.log(`Total Transactions: ${monthlyBreakdown.year_totals.total_transactions}`);
        
        console.log('\n🎉 Your Income Statement is ready!');
        
    } catch (error) {
        console.error('❌ Error loading income statement:', error);
        
        if (error.message.includes('authentication')) {
            console.log('\n🔐 AUTHENTICATION ERROR:');
            console.log('Please check your MongoDB Atlas credentials');
        } else if (error.message.includes('ECONNREFUSED')) {
            console.log('\n🌐 CONNECTION ERROR:');
            console.log('Please check your MongoDB Atlas connection string');
        }
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

// Run the function
showMyIncomeStatement();
