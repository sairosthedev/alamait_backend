const cacheService = require('./cacheService');
const FinancialReportingService = require('./financialReportingService');
const EnhancedCashFlowService = require('./enhancedCashFlowService');
const SimpleBalanceSheetService = require('./simpleBalanceSheetService');
const AccountingService = require('./accountingService');
const { financialCacheKey, TTL } = require('../utils/financialCache');

const isDebugMode = () => process.env.NODE_ENV === 'development' && process.env.DEBUG === 'true';

async function precomputeIncomeStatement(period, basis) {
    const cacheKey = financialCacheKey('income-statement', { period, basis, residence: null });
    await cacheService.getOrSet(cacheKey, TTL.PRECOMPUTE, async () =>
        FinancialReportingService.generateIncomeStatement(String(period), basis)
    );
}

async function precomputeMonthlyIncome(period, basis) {
    const cacheKey = financialCacheKey('comprehensive-monthly-income', { period, basis });
    await cacheService.getOrSet(cacheKey, TTL.PRECOMPUTE, async () =>
        FinancialReportingService.generateComprehensiveMonthlyIncomeStatement(String(period), basis)
    );
}

async function precomputeMonthlyBalanceSheet(period, basis) {
    const cacheKey = financialCacheKey('comprehensive-monthly-balance-sheet', { period, basis, residence: null });
    await cacheService.getOrSet(cacheKey, TTL.PRECOMPUTE, async () =>
        FinancialReportingService.generateComprehensiveMonthlyBalanceSheet(String(period), basis, null)
    );
}

async function precomputeSimpleBalanceSheet(period) {
    const cacheKey = financialCacheKey('simple-monthly-balance-sheet', { period, residence: null, type: 'cumulative' });
    await cacheService.getOrSet(cacheKey, TTL.PRECOMPUTE, async () =>
        SimpleBalanceSheetService.generateMonthlyBalanceSheet(parseInt(period, 10), null, 'cumulative')
    );
}

async function precomputeCashFlow(period, basis) {
    await EnhancedCashFlowService.generateDetailedCashFlowStatement(String(period), basis, null);
}

async function precomputeMonthlyIncomeExpenses(period, basis) {
    const cacheKey = financialCacheKey('monthly-income-expenses', { period, basis, residence: null });
    await cacheService.getOrSet(cacheKey, TTL.PRECOMPUTE, async () => {
        const monthlyBreakdown = {};
        let totalAnnualRevenue = 0;
        let totalAnnualExpenses = 0;
        let totalAnnualNetIncome = 0;

        const monthResults = await Promise.all(
            Array.from({ length: 12 }, (_, index) => {
                const month = index + 1;
                return AccountingService.generateMonthlyIncomeStatement(month, parseInt(period, 10), null)
                    .then((monthData) => ({ month, monthData }))
                    .catch(() => ({ month, monthData: null }));
            })
        );

        monthResults.forEach(({ month, monthData }) => {
            const monthName = new Date(parseInt(period, 10), month - 1, 1).toLocaleString('en-US', { month: 'long' });
            if (monthData && monthData.success) {
                monthlyBreakdown[month] = {
                    month,
                    monthName,
                    revenue: monthData.revenue || { total: 0 },
                    expenses: monthData.expenses || { total: 0 },
                    netIncome: monthData.netIncome || 0,
                    summary: {
                        totalRevenue: monthData.revenue?.total || 0,
                        totalExpenses: monthData.expenses?.total || 0,
                        totalNetIncome: monthData.netIncome || 0
                    }
                };
                totalAnnualRevenue += monthData.revenue?.total || 0;
                totalAnnualExpenses += monthData.expenses?.total || 0;
                totalAnnualNetIncome += monthData.netIncome || 0;
            } else {
                monthlyBreakdown[month] = {
                    month,
                    monthName,
                    revenue: { total: 0 },
                    expenses: { total: 0 },
                    netIncome: 0,
                    summary: { totalRevenue: 0, totalExpenses: 0, totalNetIncome: 0 }
                };
            }
        });

        return {
            period: String(period),
            basis,
            residence: null,
            monthlyBreakdown,
            annualSummary: {
                totalAnnualRevenue,
                totalAnnualExpenses,
                totalAnnualNetIncome,
                averageMonthlyRevenue: totalAnnualRevenue / 12,
                averageMonthlyExpenses: totalAnnualExpenses / 12,
                averageMonthlyNetIncome: totalAnnualNetIncome / 12
            }
        };
    });
}

async function precomputePeriod(period) {
    const bases = ['cash', 'accrual'];
    const tasks = [
        precomputeSimpleBalanceSheet(period),
        ...bases.flatMap((basis) => [
            precomputeIncomeStatement(period, basis),
            precomputeMonthlyIncome(period, basis),
            precomputeMonthlyBalanceSheet(period, basis),
            precomputeCashFlow(period, basis),
            precomputeMonthlyIncomeExpenses(period, basis)
        ])
    ];

    await Promise.allSettled(tasks);
}

class FinancialReportPrecomputeService {
    static async warmCurrentReports() {
        const currentYear = new Date().getFullYear();
        const years = [currentYear, currentYear - 1];

        if (isDebugMode()) {
            console.log(`📦 Pre-computing financial reports for years: ${years.join(', ')}`);
        }

        const start = Date.now();
        await Promise.allSettled(years.map((year) => precomputePeriod(year)));

        if (isDebugMode()) {
            console.log(`✅ Financial report pre-compute finished in ${Date.now() - start}ms`);
        }
    }
}

module.exports = FinancialReportPrecomputeService;
