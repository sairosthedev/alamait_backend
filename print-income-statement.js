const mongoose = require('mongoose');
const FinancialReportingService = require('./src/services/financialReportingService');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    const year = process.argv[2] || '2025';

    const accrual = await FinancialReportingService.generateIncomeStatement(year, 'accrual');
    const cash = await FinancialReportingService.generateIncomeStatement(year, 'cash');
    const monthlyAccrual = await FinancialReportingService.generateComprehensiveMonthlyIncomeStatement(year, 'accrual');

    console.log(JSON.stringify({
      success: true,
      data: {
        accrual,
        cash,
        monthlyAccrual
      }
    }, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await mongoose.disconnect();
  }
})();
