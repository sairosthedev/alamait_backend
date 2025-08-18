import api from '../../config/api';

/**
 * PROPER ACCOUNTING FRONTEND SERVICE
 * 
 * Provides frontend methods to fetch GAAP-compliant financial statements:
 * - Income Statement: Accrual Basis (recognizes revenue when earned, expenses when incurred)
 * - Cash Flow Statement: Cash Basis (only actual cash movements)
 * - Balance Sheet: Cash Basis (only actual cash and cash equivalents)
 * 
 * All methods support residence filtering and follow proper accounting principles
 */

class ProperAccountingFrontendService {
    
    /**
     * FETCH ACCRUAL BASIS INCOME STATEMENT
     * 
     * @param {string} period - Year (e.g., '2024')
     * @param {string} residence - Residence ID (optional)
     * @returns {Promise<Object>} Accrual basis income statement
     */
    static async fetchAccrualBasisIncomeStatement(period, residence = null) {
        try {
            const params = { period };
            if (residence) params.residence = residence;
            
            const response = await api.get('/finance/proper-accounting/income-statement', { params });
            return response.data;
        } catch (error) {
            console.error('Error fetching accrual basis income statement:', error);
            throw error;
        }
    }
    
    /**
     * FETCH CASH BASIS CASH FLOW STATEMENT
     * 
     * @param {string} period - Year (e.g., '2024')
     * @param {string} residence - Residence ID (optional)
     * @returns {Promise<Object>} Cash basis cash flow statement
     */
    static async fetchCashBasisCashFlowStatement(period, residence = null) {
        try {
            const params = { period };
            if (residence) params.residence = residence;
            
            const response = await api.get('/finance/proper-accounting/cash-flow', { params });
            return response.data;
        } catch (error) {
            console.error('Error fetching cash basis cash flow statement:', error);
            throw error;
        }
    }
    
    /**
     * FETCH CASH BASIS BALANCE SHEET
     * 
     * @param {string} asOf - Date (e.g., '2024-12-31')
     * @param {string} residence - Residence ID (optional)
     * @returns {Promise<Object>} Cash basis balance sheet
     */
    static async fetchCashBasisBalanceSheet(asOf, residence = null) {
        try {
            const params = { asOf };
            if (residence) params.residence = residence;
            
            const response = await api.get('/finance/proper-accounting/balance-sheet', { params });
            return response.data;
        } catch (error) {
            console.error('Error fetching cash basis balance sheet:', error);
            throw error;
        }
    }
    
    /**
     * FETCH COMPLETE RESIDENCE FINANCIAL STATEMENTS
     * 
     * @param {string} period - Year (e.g., '2024')
     * @param {string} residence - Residence ID (required)
     * @param {string} asOf - Date (optional, defaults to year-end)
     * @returns {Promise<Object>} All three financial statements for a residence
     */
    static async fetchResidenceFinancialStatements(period, residence, asOf = null) {
        try {
            const params = { period, residence };
            if (asOf) params.asOf = asOf;
            
            const response = await api.get('/finance/proper-accounting/residence-statements', { params });
            return response.data;
        } catch (error) {
            console.error('Error fetching residence financial statements:', error);
            throw error;
        }
    }
    
    /**
     * FETCH AVAILABLE RESIDENCES FOR FILTERING
     * 
     * @returns {Promise<Object>} List of available residences
     */
    static async fetchAvailableResidences() {
        try {
            const response = await api.get('/finance/proper-accounting/residences');
            return response.data;
        } catch (error) {
            console.error('Error fetching available residences:', error);
            throw error;
        }
    }
    
    /**
     * FETCH ACCOUNTING BASIS EXPLANATION
     * 
     * @returns {Promise<Object>} Detailed explanation of accounting bases
     */
    static async fetchAccountingBasisExplanation() {
        try {
            const response = await api.get('/finance/proper-accounting/explanation');
            return response.data;
        } catch (error) {
            console.error('Error fetching accounting basis explanation:', error);
            throw error;
        }
    }
    
    /**
     * GENERATE FINANCIAL STATEMENTS FOR DASHBOARD
     * 
     * @param {string} period - Year (e.g., '2024')
     * @param {string} residence - Residence ID (optional)
     * @returns {Promise<Object>} Dashboard-ready financial data
     */
    static async generateDashboardFinancialData(period, residence = null) {
        try {
            console.log(`📊 Generating dashboard financial data for period: ${period}, residence: ${residence || 'all'}`);
            
            // Fetch all three statements in parallel
            const [incomeStatement, cashFlow, balanceSheet] = await Promise.all([
                this.fetchAccrualBasisIncomeStatement(period, residence),
                this.fetchCashBasisCashFlowStatement(period, residence),
                this.fetchCashBasisBalanceSheet(`${period}-12-31`, residence)
            ]);
            
            // Extract key metrics for dashboard
            const dashboardData = {
                period,
                residence,
                summary: {
                    net_income: incomeStatement.data.net_income.after_adjustments,
                    net_cash_flow: cashFlow.data.net_change_in_cash,
                    total_assets: balanceSheet.data.assets.total_assets,
                    total_liabilities: balanceSheet.data.liabilities.total_liabilities,
                    total_equity: balanceSheet.data.equity.total_equity
                },
                income_statement: {
                    revenue: incomeStatement.data.revenue,
                    expenses: incomeStatement.data.expenses,
                    net_income: incomeStatement.data.net_income,
                    accruals: incomeStatement.data.accruals
                },
                cash_flow: {
                    operating: cashFlow.data.operating_activities,
                    investing: cashFlow.data.investing_activities,
                    financing: cashFlow.data.financing_activities,
                    net_change: cashFlow.data.net_change_in_cash
                },
                balance_sheet: {
                    assets: balanceSheet.data.assets,
                    liabilities: balanceSheet.data.liabilities,
                    equity: balanceSheet.data.equity,
                    accounting_equation: balanceSheet.data.accounting_equation
                },
                accounting_bases: {
                    income_statement: 'accrual',
                    cash_flow: 'cash',
                    balance_sheet: 'cash'
                }
            };
            
            console.log('✅ Dashboard financial data generated successfully');
            return dashboardData;
            
        } catch (error) {
            console.error('❌ Error generating dashboard financial data:', error);
            throw error;
        }
    }
    
    /**
     * GENERATE RESIDENCE COMPARISON DATA
     * 
     * @param {string} period - Year (e.g., '2024')
     * @param {Array<string>} residenceIds - Array of residence IDs to compare
     * @returns {Promise<Object>} Comparison data for multiple residences
     */
    static async generateResidenceComparisonData(period, residenceIds) {
        try {
            console.log(`🏠 Generating residence comparison data for period: ${period}, residences: ${residenceIds.join(', ')}`);
            
            if (!Array.isArray(residenceIds) || residenceIds.length === 0) {
                throw new Error('Residence IDs array is required and cannot be empty');
            }
            
            // Fetch financial statements for all residences in parallel
            const residencePromises = residenceIds.map(residenceId => 
                this.fetchResidenceFinancialStatements(period, residenceId)
            );
            
            const residenceData = await Promise.all(residencePromises);
            
            // Create comparison structure
            const comparisonData = {
                period,
                total_residences: residenceIds.length,
                residences: residenceData.map((data, index) => ({
                    id: residenceIds[index],
                    name: data.data.residence.name,
                    address: data.data.residence.address,
                    summary: data.data.summary,
                    income_statement: {
                        total_revenue: data.data.statements.income_statement.revenue.total_earned,
                        total_expenses: data.data.statements.income_statement.expenses.total_incurred,
                        net_income: data.data.statements.income_statement.net_income.after_adjustments
                    },
                    cash_flow: {
                        net_operating: data.data.statements.cash_flow_statement.operating_activities.net_operating_cash_flow,
                        net_investing: data.data.statements.cash_flow_statement.investing_activities.net_investing_cash_flow,
                        net_financing: data.data.statements.cash_flow_statement.financing_activities.net_financing_cash_flow,
                        net_change: data.data.statements.cash_flow_statement.net_change_in_cash
                    },
                    balance_sheet: {
                        total_assets: data.data.statements.balance_sheet.assets.total_assets,
                        total_liabilities: data.data.statements.balance_sheet.liabilities.total_liabilities,
                        total_equity: data.data.statements.balance_sheet.equity.total_equity
                    }
                })),
                comparison_metrics: {
                    total_net_income: residenceData.reduce((sum, data) => 
                        sum + data.data.statements.income_statement.net_income.after_adjustments, 0
                    ),
                    total_net_cash_flow: residenceData.reduce((sum, data) => 
                        sum + data.data.statements.cash_flow_statement.net_change_in_cash, 0
                    ),
                    total_assets: residenceData.reduce((sum, data) => 
                        sum + data.data.statements.balance_sheet.assets.total_assets, 0
                    ),
                    total_liabilities: residenceData.reduce((sum, data) => 
                        sum + data.data.statements.balance_sheet.liabilities.total_liabilities, 0
                    ),
                    total_equity: residenceData.reduce((sum, data) => 
                        sum + data.data.statements.balance_sheet.equity.total_equity, 0
                    )
                }
            };
            
            console.log('✅ Residence comparison data generated successfully');
            return comparisonData;
            
        } catch (error) {
            console.error('❌ Error generating residence comparison data:', error);
            throw error;
        }
    }
    
    /**
     * EXPORT FINANCIAL STATEMENTS TO CSV
     * 
     * @param {Object} financialData - Financial statement data
     * @param {string} statementType - Type of statement ('income', 'cash-flow', 'balance-sheet')
     * @param {string} filename - Export filename
     */
    static exportFinancialStatementToCSV(financialData, statementType, filename) {
        try {
            let csvContent = '';
            let headers = [];
            let rows = [];
            
            switch (statementType) {
                case 'income':
                    headers = ['Category', 'Code', 'Name', 'Earned', 'Received', 'Receivable', 'Incurred', 'Paid', 'Payable'];
                    rows = this.formatIncomeStatementForCSV(financialData);
                    break;
                    
                case 'cash-flow':
                    headers = ['Activity Type', 'Category', 'Amount', 'Net Cash Flow'];
                    rows = this.formatCashFlowStatementForCSV(financialData);
                    break;
                    
                case 'balance-sheet':
                    headers = ['Section', 'Category', 'Amount', 'Total'];
                    rows = this.formatBalanceSheetForCSV(financialData);
                    break;
                    
                default:
                    throw new Error('Invalid statement type');
            }
            
            // Create CSV content
            csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
            
            // Create and download file
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${filename}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log(`✅ Financial statement exported to CSV: ${filename}.csv`);
            
        } catch (error) {
            console.error('❌ Error exporting financial statement to CSV:', error);
            throw error;
        }
    }
    
    /**
     * FORMAT INCOME STATEMENT DATA FOR CSV EXPORT
     */
    static formatIncomeStatementForCSV(data) {
        const rows = [];
        
        // Add revenue rows
        Object.entries(data.revenue).forEach(([key, value]) => {
            if (typeof value === 'object' && value.code) {
                rows.push([
                    'Revenue',
                    value.code,
                    value.name,
                    value.earned || 0,
                    value.received || 0,
                    value.receivable || 0,
                    '', '', ''
                ]);
            }
        });
        
        // Add expense rows
        Object.entries(data.expenses).forEach(([key, value]) => {
            if (typeof value === 'object' && value.code) {
                rows.push([
                    'Expense',
                    value.code,
                    value.name,
                    '', '', '',
                    value.incurred || 0,
                    value.paid || 0,
                    value.payable || 0
                ]);
            }
        });
        
        return rows;
    }
    
    /**
     * FORMAT CASH FLOW STATEMENT DATA FOR CSV EXPORT
     */
    static formatCashFlowStatementForCSV(data) {
        const rows = [];
        
        // Operating activities
        Object.entries(data.operating_activities).forEach(([key, value]) => {
            if (typeof value === 'number') {
                rows.push(['Operating', key.replace(/_/g, ' '), value, '']);
            }
        });
        rows.push(['Operating', 'Net Operating Cash Flow', '', data.operating_activities.net_operating_cash_flow]);
        
        // Investing activities
        Object.entries(data.investing_activities).forEach(([key, value]) => {
            if (typeof value === 'number') {
                rows.push(['Investing', key.replace(/_/g, ' '), value, '']);
            }
        });
        rows.push(['Investing', 'Net Investing Cash Flow', '', data.investing_activities.net_investing_cash_flow]);
        
        // Financing activities
        Object.entries(data.financing_activities).forEach(([key, value]) => {
            if (typeof value === 'number') {
                rows.push(['Financing', key.replace(/_/g, ' '), value, '']);
            }
        });
        rows.push(['Financing', 'Net Financing Cash Flow', '', data.financing_activities.net_financing_cash_flow]);
        
        return rows;
    }
    
    /**
     * FORMAT BALANCE SHEET DATA FOR CSV EXPORT
     */
    static formatBalanceSheetForCSV(data) {
        const rows = [];
        
        // Assets
        Object.entries(data.assets).forEach(([key, value]) => {
            if (typeof value === 'number' && key !== 'total_assets') {
                rows.push(['Assets', key.replace(/_/g, ' '), value, '']);
            }
        });
        rows.push(['Assets', 'Total Assets', '', data.assets.total_assets]);
        
        // Liabilities
        Object.entries(data.liabilities).forEach(([key, value]) => {
            if (typeof value === 'number' && key !== 'total_liabilities') {
                rows.push(['Liabilities', key.replace(/_/g, ' '), value, '']);
            }
        });
        rows.push(['Liabilities', 'Total Liabilities', '', data.liabilities.total_liabilities]);
        
        // Equity
        Object.entries(data.equity).forEach(([key, value]) => {
            if (typeof value === 'number' && key !== 'total_equity') {
                rows.push(['Equity', key.replace(/_/g, ' '), value, '']);
            }
        });
        rows.push(['Equity', 'Total Equity', '', data.equity.total_equity]);
        
        return rows;
    }
}

export default ProperAccountingFrontendService;
