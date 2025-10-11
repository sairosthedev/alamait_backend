const ProperAccountingService = require('../../services/properAccountingService');
const { validateMongoId } = require('../../utils/validators');
const { Residence } = require('../../models/Residence');

/**
 * PROPER ACCOUNTING CONTROLLER
 * 
 * Provides GAAP-compliant financial statement endpoints:
 * - Income Statement: Accrual Basis (recognizes revenue when earned, expenses when incurred)
 * - Cash Flow Statement: Cash Basis (only actual cash movements)
 * - Balance Sheet: Cash Basis (only actual cash and cash equivalents)
 * 
 * All endpoints support residence filtering and follow proper accounting principles
 */

class ProperAccountingController {
    
    /**
     * GENERATE ACCRUAL BASIS INCOME STATEMENT
     * GET /api/finance/proper-accounting/income-statement?period=2024&residence=67d723cf20f89c4ae69804f3
     * 
     * Accrual Basis Principles:
     * - Revenue recognized when EARNED (not when cash received)
     * - Expenses recognized when INCURRED (not when cash paid)
     * - Includes accruals, deferrals, and period matching
     */
    static async generateAccrualBasisIncomeStatement(req, res) {
        try {
            const { period, residence } = req.query;
            
            // Validate required parameters
            if (!period) {
                return res.status(400).json({
                    success: false,
                    message: 'Period parameter is required (e.g., 2024)',
                    example: '/api/finance/proper-accounting/income-statement?period=2024&residence=67d723cf20f89c4ae69804f3'
                });
            }
            
            // Validate period format
            if (!/^\d{4}$/.test(period)) {
                return res.status(400).json({
                    success: false,
                    message: 'Period must be a 4-digit year (e.g., 2024)'
                });
            }
            
            // Validate residence ID if provided
            if (residence && !validateMongoId(residence)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid residence ID format'
                });
            }
            
            // Check if residence exists if provided
            if (residence) {
                const residenceExists = await Residence.findById(residence);
                if (!residenceExists) {
                    return res.status(404).json({
                        success: false,
                        message: 'Residence not found'
                    });
                }
            }
            
            console.log(`🔄 Generating accrual basis income statement for period: ${period}, residence: ${residence || 'all'}`);
            
            // Generate accrual basis income statement
            const incomeStatement = await ProperAccountingService.generateAccrualBasisIncomeStatement(period, residence);
            
            res.status(200).json({
                success: true,
                message: `Accrual basis income statement generated for ${period}${residence ? ` (residence: ${residence})` : ''}`,
                data: incomeStatement,
                accounting_basis: 'accrual',
                accounting_principles: {
                    revenue_recognition: 'Revenue recognized when earned, not when cash received',
                    expense_recognition: 'Expenses recognized when incurred, not when cash paid',
                    period_matching: 'Expenses matched to revenue they help generate',
                    gaap_compliant: 'Follows Generally Accepted Accounting Principles'
                }
            });
            
        } catch (error) {
            console.error('❌ Error generating accrual basis income statement:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate accrual basis income statement',
                error: error.message
            });
        }
    }
    
    /**
     * GENERATE CASH BASIS CASH FLOW STATEMENT
     * GET /api/finance/proper-accounting/cash-flow?period=2024&residence=67d723cf20f89c4ae69804f3
     * 
     * Cash Basis Principles:
     * - Only actual cash receipts and payments
     * - No accruals or deferrals
     * - Must reconcile with cash balance changes
     */
    static async generateCashBasisCashFlowStatement(req, res) {
        try {
            const { period, residence } = req.query;
            
            // Validate required parameters
            if (!period) {
                return res.status(400).json({
                    success: false,
                    message: 'Period parameter is required (e.g., 2024)',
                    example: '/api/finance/proper-accounting/cash-flow?period=2024&residence=67d723cf20f89c4ae69804f3'
                });
            }
            
            // Validate period format
            if (!/^\d{4}$/.test(period)) {
                return res.status(400).json({
                    success: false,
                    message: 'Period must be a 4-digit year (e.g., 2024)'
                });
            }
            
            // Validate residence ID if provided
            if (residence && !validateMongoId(residence)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid residence ID format'
                });
            }
            
            // Check if residence exists if provided
            if (residence) {
                const residenceExists = await Residence.findById(residence);
                if (!residenceExists) {
                    return res.status(404).json({
                        success: false,
                        message: 'Residence not found'
                    });
                }
            }
            
            console.log(`💵 Generating cash basis cash flow statement for period: ${period}, residence: ${residence || 'all'}`);
            
            // Generate cash basis cash flow statement
            const cashFlowStatement = await ProperAccountingService.generateCashBasisCashFlowStatement(period, residence);
            
            res.status(200).json({
                success: true,
                message: `Cash basis cash flow statement generated for ${period}${residence ? ` (residence: ${residence})` : ''}`,
                data: cashFlowStatement,
                accounting_basis: 'cash',
                accounting_principles: {
                    cash_basis: 'Only actual cash receipts and payments recorded',
                    no_accruals: 'No recognition of earned but unpaid revenue',
                    no_deferrals: 'No recognition of incurred but unpaid expenses',
                    cash_reconciliation: 'Must reconcile with actual cash balance changes'
                }
            });
            
        } catch (error) {
            console.error('❌ Error generating cash basis cash flow statement:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate cash basis cash flow statement',
                error: error.message
            });
        }
    }
    
    /**
     * GENERATE CASH BASIS BALANCE SHEET
     * GET /api/finance/proper-accounting/balance-sheet?asOf=2024-12-31&residence=67d723cf20f89c4ae69804f3
     * 
     * Cash Basis Principles:
     * - Only actual cash and cash equivalents
     * - No accounts receivable or accounts payable
     * - No prepaid expenses or deferred revenue
     * - Real-time balances from transaction entries
     */
    static async generateCashBasisBalanceSheet(req, res) {
        try {
            const { asOf, residence } = req.query;
            
            // Validate required parameters
            if (!asOf) {
                return res.status(400).json({
                    success: false,
                    message: 'asOf parameter is required (e.g., 2024-12-31)',
                    example: '/api/finance/proper-accounting/balance-sheet?asOf=2024-12-31&residence=67d723cf20f89c4ae69804f3'
                });
            }
            
            // Validate date format
            const asOfDate = new Date(asOf);
            if (isNaN(asOfDate.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'asOf must be a valid date (e.g., 2024-12-31)'
                });
            }
            
            // Validate residence ID if provided
            if (residence && !validateMongoId(residence)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid residence ID format'
                });
            }
            
            // Check if residence exists if provided
            if (residence) {
                const residenceExists = await Residence.findById(residence);
                if (!residenceExists) {
                    return res.status(404).json({
                        success: false,
                        message: 'Residence not found'
                    });
                }
            }
            
            console.log(`💰 Generating cash basis balance sheet as of: ${asOf}, residence: ${residence || 'all'}`);
            
            // Generate cash basis balance sheet
            const balanceSheet = await ProperAccountingService.generateCashBasisBalanceSheet(asOf, residence);
            
            res.status(200).json({
                success: true,
                message: `Cash basis balance sheet generated as of ${asOf}${residence ? ` (residence: ${residence})` : ''}`,
                data: balanceSheet,
                accounting_basis: 'cash',
                accounting_principles: {
                    cash_basis: 'Only actual cash and cash equivalents recorded',
                    no_receivables: 'No accounts receivable (cash basis)',
                    no_prepaid: 'No prepaid expenses (cash basis)',
                    real_time_balances: 'Balances calculated from actual transaction entries',
                    gaap_compliant: 'Follows cash basis accounting principles'
                }
            });
            
        } catch (error) {
            console.error('❌ Error generating cash basis balance sheet:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate cash basis balance sheet',
                error: error.message
            });
        }
    }
    
    /**
     * GENERATE COMPLETE RESIDENCE FINANCIAL STATEMENTS
     * GET /api/finance/proper-accounting/residence-statements?period=2024&residence=67d723cf20f89c4ae69804f3&asOf=2024-12-31
     * 
     * Provides all three statements for a specific residence:
     * - Accrual Basis Income Statement
     * - Cash Basis Cash Flow Statement
     * - Cash Basis Balance Sheet
     */
    static async generateResidenceFinancialStatements(req, res) {
        try {
            const { period, residence, asOf } = req.query;
            
            // Validate required parameters
            if (!period) {
                return res.status(400).json({
                    success: false,
                    message: 'Period parameter is required (e.g., 2024)',
                    example: '/api/finance/proper-accounting/residence-statements?period=2024&residence=67d723cf20f89c4ae69804f3&asOf=2024-12-31'
                });
            }
            
            if (!residence) {
                return res.status(400).json({
                    success: false,
                    message: 'Residence parameter is required',
                    example: '/api/finance/proper-accounting/residence-statements?period=2024&residence=67d723cf20f89c4ae69804f3&asOf=2024-12-31'
                });
            }
            
            // Validate period format
            if (!/^\d{4}$/.test(period)) {
                return res.status(400).json({
                    success: false,
                    message: 'Period must be a 4-digit year (e.g., 2024)'
                });
            }
            
            // Validate residence ID
            if (!validateMongoId(residence)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid residence ID format'
                });
            }
            
            // Check if residence exists
            const residenceExists = await Residence.findById(residence);
            if (!residenceExists) {
                return res.status(404).json({
                    success: false,
                    message: 'Residence not found'
                });
            }
            
            // Validate asOf date if provided
            let asOfDate = asOf;
            if (asOf) {
                const date = new Date(asOf);
                if (isNaN(date.getTime())) {
                    return res.status(400).json({
                        success: false,
                        message: 'asOf must be a valid date (e.g., 2024-12-31)'
                    });
                }
            } else {
                asOfDate = `${period}-12-31`; // Default to year-end
            }
            
            console.log(`🏠 Generating complete financial statements for residence: ${residence}, period: ${period}, asOf: ${asOfDate}`);
            
            // Generate all three statements
            const financialStatements = await ProperAccountingService.generateResidenceFinancialStatements(period, residence, asOfDate);
            
            res.status(200).json({
                success: true,
                message: `Complete financial statements generated for residence: ${residenceExists.name}`,
                data: financialStatements,
                accounting_bases: {
                    income_statement: 'accrual',
                    cash_flow_statement: 'cash',
                    balance_sheet: 'cash'
                },
                accounting_principles: {
                    accrual_income: 'Revenue and expenses recognized when earned/incurred',
                    cash_flow: 'Only actual cash movements recorded',
                    cash_balance: 'Only actual cash and cash equivalents recorded',
                    gaap_compliant: 'Follows proper accounting principles for each statement type'
                }
            });
            
        } catch (error) {
            console.error('❌ Error generating residence financial statements:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate residence financial statements',
                error: error.message
            });
        }
    }
    
    /**
     * GET AVAILABLE RESIDENCES FOR FILTERING
     * GET /api/finance/proper-accounting/residences
     * 
     * Returns list of all residences available for financial statement filtering
     */
    static async getAvailableResidences(req, res) {
        try {
            console.log('🏠 Fetching available residences for financial statement filtering');
            
            // Get all residences
            const residences = await Residence.find({}, 'name address _id');
            
            res.status(200).json({
                success: true,
                message: 'Available residences for financial statement filtering',
                data: {
                    total_residences: residences.length,
                    residences: residences.map(res => ({
                        id: res._id,
                        name: res.name,
                        address: res.address
                    }))
                }
            });
            
        } catch (error) {
            console.error('❌ Error fetching available residences:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch available residences',
                error: error.message
            });
        }
    }
    
    /**
     * GET ACCOUNTING BASIS EXPLANATION
     * GET /api/finance/proper-accounting/explanation
     * 
     * Returns detailed explanation of the accounting bases used
     */
    static async getAccountingBasisExplanation(req, res) {
        try {
            const explanation = {
                success: true,
                message: 'Accounting Basis Explanation',
                data: {
                    income_statement: {
                        basis: 'Accrual Basis',
                        principles: [
                            'Revenue recognized when EARNED (not when cash received)',
                            'Expenses recognized when INCURRED (not when cash paid)',
                            'Includes accruals, deferrals, and period matching',
                            'Follows GAAP principles for accurate financial reporting',
                            'Shows true profitability regardless of cash timing'
                        ],
                        examples: [
                            'Rent earned in December but received in January → Recorded in December',
                            'Utility bill incurred in December but paid in January → Recorded in December',
                            'Prepaid insurance for 6 months → Only 2 months recorded in current period'
                        ]
                    },
                    cash_flow_statement: {
                        basis: 'Cash Basis',
                        principles: [
                            'Only actual cash receipts and payments recorded',
                            'No accruals or deferrals',
                            'Must reconcile with cash balance changes',
                            'Shows actual cash position and liquidity',
                            'Useful for cash management and budgeting'
                        ],
                        examples: [
                            'Rent received in January → Recorded in January (regardless of when earned)',
                            'Utility bill paid in January → Recorded in January (regardless of when incurred)',
                            'No accounts receivable or accounts payable included'
                        ]
                    },
                    balance_sheet: {
                        basis: 'Cash Basis',
                        principles: [
                            'Only actual cash and cash equivalents recorded',
                            'No accounts receivable or accounts payable',
                            'No prepaid expenses or deferred revenue',
                            'Real-time balances from transaction entries',
                            'Shows actual cash position at a point in time'
                        ],
                        examples: [
                            'Bank account balance → Actual cash available',
                            'Petty cash → Actual petty cash on hand',
                            'No future receivables or payables included'
                        ]
                    },
                    why_this_combination: [
                        'Income Statement (Accrual): Shows true profitability and performance',
                        'Cash Flow (Cash): Shows actual cash position and liquidity',
                        'Balance Sheet (Cash): Shows actual cash resources available',
                        'This combination provides complete financial picture for decision making'
                    ]
                }
            };
            
            res.status(200).json(explanation);
            
        } catch (error) {
            console.error('❌ Error providing accounting basis explanation:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to provide accounting basis explanation',
                error: error.message
            });
        }
    }
}

module.exports = ProperAccountingController;
