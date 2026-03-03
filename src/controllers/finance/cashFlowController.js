/**
 * Cash Flow Controller with Drill-down Functionality
 */

const FinancialReportingService = require('../../services/financialReportingService');
const TransactionEntry = require('../../models/TransactionEntry');
const Payment = require('../../models/Payment');

class CashFlowController {
    
    /**
     * Helper function to get account display name
     */
    static getAccountDisplayName(accountCode) {
        const accountNames = {
            // Income Accounts (4000s)
            '4001': 'Rental Income',
            '4002': 'Administrative Fees',
            '4003': 'Forfeited Deposits Income',
            '4004': 'Utilities Income',
            '4005': 'Other Income',
            
            // Asset Accounts (1000s)
            '1000': 'Cash',
            '1001': 'Bank Account',
            '1100': 'Accounts Receivable',
            '1200': 'Prepaid Expenses',
            '1300': 'Fixed Assets',
            
            // Liability Accounts (2000s)
            '2000': 'Accounts Payable',
            '2020': 'Tenant Security Deposits',
            '2200': 'Advance Payment Liability',
            '2300': 'Accrued Expenses',
            '2400': 'Deferred Income',
            
            // Expense Accounts (5000s)
            '5001': 'Maintenance Expenses',
            '5002': 'Utilities Expenses',
            '5003': 'Cleaning Expenses',
            '5004': 'Security Expenses',
            '5005': 'Management Expenses',
            '5006': 'Insurance Expenses',
            '5007': 'Property Tax Expenses',
            '5008': 'Marketing Expenses',
            '5009': 'Professional Fees',
            '5010': 'Office Expenses'
        };
        
        return accountNames[accountCode] || `Account ${accountCode}`;
    }
    
    /**
     * Get detailed transactions for a specific account and month
     * This endpoint provides drill-down functionality for cash flow statements
     */
    static async getAccountTransactionDetails(req, res) {
        try {
            const { period, month, accountCode, residenceId, sourceType, page = '1', limit: limitParam = '50' } = req.query;
            
            // Validate required parameters
            if (!period || !month || !accountCode) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required parameters: period, month, accountCode'
                });
            }
            
            const pageNum = Math.max(1, parseInt(page, 10) || 1);
            const limitNum = Math.min(200, Math.max(1, parseInt(limitParam, 10) || 50));
            const skip = (pageNum - 1) * limitNum;
            
            const monthNames = {
                'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
                'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
            };
            
            const monthIndex = monthNames[month.toLowerCase()];
            if (monthIndex === undefined) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid month: ${month}. Use full month name (e.g., 'august')`
                });
            }
            
            const startDate = new Date(period, monthIndex, 1);
            const endDate = new Date(period, monthIndex + 1, 0);
            
            // Single fast query: all posted entries touching this account in the month (index-friendly)
            const baseQuery = {
                date: { $gte: startDate, $lte: endDate },
                status: 'posted',
                'entries.accountCode': accountCode
            };
            
            if (residenceId) {
                const mongoose = require('mongoose');
                const residenceObjectId = mongoose.Types.ObjectId.isValid(residenceId) 
                    ? new mongoose.Types.ObjectId(residenceId) 
                    : residenceId;
                baseQuery.$or = [
                    { residence: residenceObjectId },
                    { residence: residenceId },
                    { 'metadata.residenceId': residenceId },
                    { 'metadata.residenceId': residenceObjectId },
                    { 'metadata.residence': residenceId },
                    { 'metadata.residence': residenceObjectId }
                ];
            }
            
            const [paymentEntries, totalCount] = await Promise.all([
                TransactionEntry.find(baseQuery)
                    .select('transactionId date description reference source status entries totalDebit totalCredit metadata residence')
                    .sort({ date: -1 })
                    .skip(skip)
                    .limit(limitNum)
                    .lean(),
                TransactionEntry.countDocuments(baseQuery)
            ]);
            
            // Entries already filtered by date range and accountCode in query
            let transactionEntries = paymentEntries.filter(entry => {
                if (!entry.entries || !Array.isArray(entry.entries)) return false;
                return entry.entries.some(line => line.accountCode === accountCode);
            });
            
            // Apply intelligent filtering based on account type, description, and sourceType
            transactionEntries = transactionEntries.filter(entry => {
                if (!entry.description) return false;
                
                const description = entry.description.toLowerCase();
                const accountName = CashFlowController.getAccountDisplayName(accountCode).toLowerCase();
                
                // If sourceType is provided, use it for filtering
                if (sourceType) {
                    const sourceTypeLower = sourceType.toLowerCase();
                    if (sourceTypeLower === 'rentals') {
                        // Show only rent payments allocated to the specific month, exclude advance payments
                        const currentYear = period;
                        const currentMonth = month.toLowerCase();
                        const monthNames = {
                            'january': '01', 'february': '02', 'march': '03', 'april': '04', 
                            'may': '05', 'june': '06', 'july': '07', 'august': '08', 
                            'september': '09', 'october': '10', 'november': '11', 'december': '12'
                        };
                        const monthNumber = monthNames[currentMonth];
                        const targetPeriod = `${currentYear}-${monthNumber}`;
                        
                        // Show only "Payment allocation: rent for YYYY-MM" for the current month
                        return description.includes('payment allocation') && 
                               description.includes('rent') && 
                               description.includes(targetPeriod) &&
                               !description.includes('advance') && !description.includes('prepayment');
                    } else if (sourceTypeLower === 'allocation') {
                        // Show only actual rent payments for the specific month (not advance payments)
                        const currentYear = period;
                        const currentMonth = month.toLowerCase();
                        const monthNames = {
                            'january': '01', 'february': '02', 'march': '03', 'april': '04', 
                            'may': '05', 'june': '06', 'july': '07', 'august': '08', 
                            'september': '09', 'october': '10', 'november': '11', 'december': '12'
                        };
                        const monthNumber = monthNames[currentMonth];
                        const targetPeriod = `${currentYear}-${monthNumber}`;
                        
                        // Show only "Payment allocation: rent for YYYY-MM" for the current month
                        return description.includes('payment allocation') && 
                               description.includes('rent') && 
                               description.includes(targetPeriod);
                    } else if (sourceTypeLower === 'admin' || sourceTypeLower === 'administrative') {
                        return description.includes('admin') || description.includes('advance_admin');
                    } else if (sourceTypeLower === 'advance' || sourceTypeLower === 'advance payments') {
                        // Show advance payments for future months, exclude advance admin fees
                        const currentYear = period;
                        const currentMonth = month.toLowerCase();
                        const monthNames = {
                            'january': '01', 'february': '02', 'march': '03', 'april': '04', 
                            'may': '05', 'june': '06', 'july': '07', 'august': '08', 
                            'september': '09', 'october': '10', 'november': '11', 'december': '12'
                        };
                        const monthNumber = monthNames[currentMonth];
                        const currentPeriod = `${currentYear}-${monthNumber}`;
                        
                        // Show advance rent payments OR payment allocations for future months, but exclude admin fees
                        return (description.includes('advance rent payment') || 
                                (description.includes('payment allocation') && description.includes('rent') && !description.includes(currentPeriod))) &&
                               !description.includes('admin');
                    } else if (sourceTypeLower === 'deposits' || sourceTypeLower === 'security deposits') {
                        return description.includes('deposit') || description.includes('security');
                    } else if (sourceTypeLower === 'utilities') {
                        return description.includes('utilities') || description.includes('electricity') || description.includes('water');
                    }
                }
                
                // For cash accounts (1000s), be more specific about what we're looking for
                if (accountCode.startsWith('100')) {
                    // If it's the main cash account (1000), look for admin fees specifically
                    if (accountCode === '1000') {
                        return description.includes('admin') || description.includes('advance_admin');
                    }
                    // For other cash accounts, include all cash-related transactions
                    return true;
                }
                
                // For income accounts (4000s), match based on account name keywords
                if (accountCode.startsWith('400')) {
                    if (accountName.includes('rental')) {
                        return description.includes('rent') || description.includes('rental') || description.includes('accommodation');
                    }
                    if (accountName.includes('admin')) {
                        return description.includes('admin') || description.includes('advance_admin');
                    }
                    if (accountName.includes('forfeit')) {
                        return description.includes('forfeit') || description.includes('no-show');
                    }
                    if (accountName.includes('utilities')) {
                        return description.includes('utilities') || description.includes('electricity') || 
                               description.includes('water') || description.includes('gas');
                    }
                    // For other income accounts, include all income-related transactions
                    return true;
                }
                
                // For liability accounts (2000s), match based on account name keywords
                if (accountCode.startsWith('200')) {
                    if (accountName.includes('advance')) {
                        return description.includes('advance') || description.includes('prepayment');
                    }
                    if (accountName.includes('deposit') || accountName.includes('security')) {
                        return description.includes('deposit') || description.includes('security');
                    }
                    if (accountName.includes('payable')) {
                        return description.includes('payable') || description.includes('vendor') || description.includes('supplier');
                    }
                    if (accountName.includes('deferred')) {
                        return description.includes('deferred') || description.includes('prepaid');
                    }
                    // For other liability accounts, include all liability-related transactions
                    return true;
                }
                
                // For asset accounts (1000s), match based on account name keywords
                if (accountCode.startsWith('110')) {
                    if (accountName.includes('receivable')) {
                        return description.includes('receivable') || description.includes('debt') || 
                               description.includes('outstanding') || description.includes('student');
                    }
                    if (accountName.includes('prepaid')) {
                        return description.includes('prepaid') || description.includes('advance');
                    }
                    // For other asset accounts, include all asset-related transactions
                    return true;
                }
                
                // For expense accounts (5000s), match based on account name keywords
                if (accountCode.startsWith('500')) {
                    if (accountName.includes('maintenance')) {
                        return description.includes('maintenance') || description.includes('repair') || 
                               description.includes('fix') || description.includes('service');
                    }
                    if (accountName.includes('utilities')) {
                        return description.includes('utilities') || description.includes('electricity') || 
                               description.includes('water') || description.includes('gas') || description.includes('internet');
                    }
                    if (accountName.includes('cleaning')) {
                        return description.includes('cleaning') || description.includes('housekeeping') || 
                               description.includes('janitorial');
                    }
                    if (accountName.includes('security')) {
                        return description.includes('security') || description.includes('guard') || 
                               description.includes('surveillance');
                    }
                    if (accountName.includes('management')) {
                        return description.includes('management') || description.includes('admin') || 
                               description.includes('oversight');
                    }
                    if (accountName.includes('insurance')) {
                        return description.includes('insurance') || description.includes('coverage');
                    }
                    if (accountName.includes('tax')) {
                        return description.includes('tax') || description.includes('government');
                    }
                    if (accountName.includes('marketing')) {
                        return description.includes('marketing') || description.includes('advertising') || 
                               description.includes('promotion');
                    }
                    if (accountName.includes('professional')) {
                        return description.includes('professional') || description.includes('legal') || 
                               description.includes('consulting') || description.includes('accounting');
                    }
                    if (accountName.includes('office')) {
                        return description.includes('office') || description.includes('supplies') || 
                               description.includes('stationery');
                    }
                    // For other expense accounts, include all expense-related transactions
                    return true;
                }
                
                // For any other account codes, include all transactions
                return true;
            });
            
            console.log(`💳 Found ${transactionEntries.length} transaction entries with account code ${accountCode} after filtering`);
            
            // If no transactions found after filtering, use all for this account (drop sourceType filter)
            if (transactionEntries.length === 0) {
                transactionEntries = paymentEntries.filter(entry => entry.entries && entry.entries.some(line => line.accountCode === accountCode));
            }
            
            // Batch load payments for references (avoids N+1)
            const refIds = [...new Set(transactionEntries.map(e => e.reference).filter(Boolean))];
            const paymentsMap = {};
            if (refIds.length > 0) {
                const payments = await Payment.find({ _id: { $in: refIds } }).populate('student', 'firstName lastName').lean();
                payments.forEach(p => { paymentsMap[p._id.toString()] = p; });
            }
            
            const accountTransactions = [];
            for (const entry of transactionEntries) {
                if (entry.entries && Array.isArray(entry.entries)) {
                    for (const line of entry.entries) {
                        if (line.accountCode === accountCode) {
                            const payment = entry.reference ? paymentsMap[entry.reference.toString()] : null;
                            const studentName = (payment && payment.student) ? `${payment.student.firstName} ${payment.student.lastName}` : 'N/A';
                            let debtorName = 'N/A';
                            if (line.accountName && line.accountName.includes('-')) {
                                debtorName = line.accountName.split('-')[1]?.trim() || 'N/A';
                            }
                            accountTransactions.push({
                                transactionId: entry.transactionId,
                                date: entry.date,
                                amount: line.credit || line.debit || 0,
                                type: line.credit > 0 ? 'credit' : 'debit',
                                description: entry.description,
                                accountCode: line.accountCode,
                                accountName: line.accountName,
                                debtorName,
                                studentName,
                                reference: entry.reference,
                                source: entry.source,
                                paymentId: payment ? payment.paymentId : null,
                                paymentDate: payment ? payment.date : null,
                                paymentMethod: payment ? payment.method : null
                            });
                        }
                    }
                }
            }
            
            accountTransactions.sort((a, b) => {
                const dateCompare = new Date(a.date) - new Date(b.date);
                return dateCompare !== 0 ? dateCompare : b.amount - a.amount;
            });
            
            const summary = {
                totalTransactions: totalCount,
                totalAmount: accountTransactions.reduce((sum, tx) => sum + tx.amount, 0),
                totalCredits: accountTransactions.filter(tx => tx.type === 'credit').reduce((sum, tx) => sum + tx.amount, 0),
                totalDebits: accountTransactions.filter(tx => tx.type === 'debit').reduce((sum, tx) => sum + tx.amount, 0),
                uniqueStudents: [...new Set(accountTransactions.map(tx => tx.studentName).filter(name => name !== 'N/A'))].length,
                dateRange: { start: startDate.toISOString().split('T')[0], end: endDate.toISOString().split('T')[0] }
            };
            
            res.json({
                success: true,
                data: {
                    accountCode,
                    accountName: CashFlowController.getAccountDisplayName(accountCode),
                    month,
                    period,
                    sourceType: sourceType || null,
                    summary,
                    transactions: accountTransactions,
                    pagination: {
                        page: pageNum,
                        limit: limitNum,
                        totalCount,
                        totalPages: Math.ceil(totalCount / limitNum)
                    }
                }
            });
            
        } catch (error) {
            console.error('Error getting account transaction details:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving transaction details',
                error: error.message
            });
        }
    }
    
    /**
     * Get cash flow statement with drill-down links
     */
    static async getCashFlowWithDrillDown(req, res) {
        try {
            const { period, basis, residenceId } = req.query;
            
            // Generate the regular cash flow statement
            const cashFlowData = await FinancialReportingService.generateMonthlyCashFlow(
                period || new Date().getFullYear().toString(),
                basis || 'cash'
            );
            
            // Add drill-down URLs to each account breakdown
            const addDrillDownLinks = (breakdown, month) => {
                Object.keys(breakdown).forEach(accountCode => {
                    if (breakdown[accountCode].inflows > 0 || breakdown[accountCode].outflows > 0) {
                        // Use the account code directly from the breakdown (now properly categorized)
                        // The generateMonthlyCashFlow method now returns proper account codes (4001, 4002, etc.)
                        breakdown[accountCode].drillDownUrl = `/api/finance/cashflow/account-details?period=${period}&month=${month}&accountCode=${accountCode}${residenceId ? `&residenceId=${residenceId}` : ''}`;
                    }
                });
            };
            
            // Add drill-down links to monthly breakdowns
            Object.keys(cashFlowData.monthly_breakdown).forEach(month => {
                addDrillDownLinks(cashFlowData.monthly_breakdown[month].operating_activities.breakdown, month);
                addDrillDownLinks(cashFlowData.monthly_breakdown[month].investing_activities.breakdown, month);
                addDrillDownLinks(cashFlowData.monthly_breakdown[month].financing_activities.breakdown, month);
            });
            
            // Add drill-down links to yearly totals
            addDrillDownLinks(cashFlowData.yearly_totals.operating_activities.breakdown, 'yearly');
            addDrillDownLinks(cashFlowData.yearly_totals.investing_activities.breakdown, 'yearly');
            addDrillDownLinks(cashFlowData.yearly_totals.financing_activities.breakdown, 'yearly');
            
            res.json({
                success: true,
                data: cashFlowData
            });
            
        } catch (error) {
            console.error('Error getting cash flow with drill-down:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating cash flow statement',
                error: error.message
            });
        }
    }
}

module.exports = CashFlowController;
