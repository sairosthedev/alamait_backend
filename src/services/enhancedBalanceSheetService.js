const mongoose = require('mongoose');
const TransactionEntry = require('../models/TransactionEntry');
const Account = require('../models/Account');

class EnhancedBalanceSheetService {
    
    /**
     * Generate Enhanced Balance Sheet with Negotiation Details
     * This provides clear visibility into student negotiations and their impact
     */
    static async generateEnhancedBalanceSheet(asOfDate, residenceId = null) {
        try {
            console.log(`📊 Generating Enhanced Balance Sheet as of ${asOfDate}${residenceId ? ` for residence: ${residenceId}` : ''}`);
            
            const asOf = new Date(asOfDate);
            
            // Get all transactions up to asOfDate
            const query = {
                date: { $lte: asOf },
                status: 'posted'
            };
            
            if (residenceId) {
                query.residence = residenceId;
            }
            
            const transactions = await TransactionEntry.find(query)
                .populate('residence')
                .sort({ date: 1 });
            
            console.log(`📋 Found ${transactions.length} transactions for balance sheet calculation`);
            
            // Initialize balance sheet structure
            const balanceSheet = {
                assets: {
                    currentAssets: {
                        cashAndBank: {},
                        accountsReceivable: {
                            total: 0,
                            breakdown: {
                                originalAccruals: 0,
                                negotiatedAdjustments: 0,
                                paymentsReceived: 0,
                                netOutstanding: 0
                            },
                            studentDetails: {}
                        },
                        otherCurrentAssets: {}
                    },
                    nonCurrentAssets: {}
                },
                liabilities: {
                    currentLiabilities: {},
                    nonCurrentLiabilities: {}
                },
                equity: {
                    retainedEarnings: 0,
                    currentPeriod: 0
                },
                metadata: {
                    asOfDate: asOf,
                    residenceId: residenceId,
                    totalTransactions: transactions.length,
                    negotiationSummary: {
                        totalNegotiations: 0,
                        totalDiscountsGiven: 0,
                        studentsAffected: new Set()
                    }
                }
            };
            
            // Process each transaction
            for (const transaction of transactions) {
                await this.processTransactionForBalanceSheet(transaction, balanceSheet);
            }
            
            // Calculate final balances
            this.calculateFinalBalances(balanceSheet);
            
            // Generate negotiation summary
            this.generateNegotiationSummary(balanceSheet);
            
            console.log(`✅ Enhanced Balance Sheet generated successfully`);
            return balanceSheet;
            
        } catch (error) {
            console.error('❌ Error generating enhanced balance sheet:', error);
            throw error;
        }
    }
    
    /**
     * Process individual transaction for balance sheet calculation
     */
    static async processTransactionForBalanceSheet(transaction, balanceSheet) {
        const { entries, source, metadata } = transaction;
        
        for (const entry of entries) {
            const { accountCode, accountName, accountType, debit, credit, description } = entry;
            
            // Handle Accounts Receivable (1100 series)
            if (accountCode.startsWith('1100')) {
                await this.processAccountsReceivableEntry(entry, transaction, balanceSheet);
            }
            
            // Handle Cash and Bank accounts (1000 series)
            else if (accountCode.startsWith('1000')) {
                this.processCashAndBankEntry(entry, balanceSheet);
            }
            
            // Handle Income accounts (4000 series)
            else if (accountCode.startsWith('4000')) {
                this.processIncomeEntry(entry, transaction, balanceSheet);
            }
            
            // Handle other account types
            else {
                this.processOtherAccountEntry(entry, balanceSheet);
            }
        }
    }
    
    /**
     * Process Accounts Receivable entries with negotiation tracking
     */
    static async processAccountsReceivableEntry(entry, transaction, balanceSheet) {
        const { accountCode, accountName, debit, credit, description } = entry;
        const { source, metadata } = transaction;
        
        // Extract student information
        const studentId = this.extractStudentIdFromAccountCode(accountCode);
        const studentName = this.extractStudentNameFromDescription(description) || 
                           this.extractStudentNameFromAccountName(accountName);
        
        // Initialize student details if not exists
        if (!balanceSheet.assets.currentAssets.accountsReceivable.studentDetails[studentId]) {
            balanceSheet.assets.currentAssets.accountsReceivable.studentDetails[studentId] = {
                studentId,
                studentName,
                accountCode,
                originalAccruals: 0,
                negotiatedAdjustments: 0,
                paymentsReceived: 0,
                netOutstanding: 0,
                transactions: []
            };
        }
        
        const studentDetail = balanceSheet.assets.currentAssets.accountsReceivable.studentDetails[studentId];
        
        // Track transaction
        studentDetail.transactions.push({
            transactionId: transaction.transactionId,
            date: transaction.date,
            source: source,
            description: description,
            debit: debit,
            credit: credit,
            type: this.determineTransactionType(source, metadata, description)
        });
        
        // Process based on transaction type
        switch (source) {
            case 'rental_accrual':
                // Original rent accrual
                studentDetail.originalAccruals += debit || 0;
                balanceSheet.assets.currentAssets.accountsReceivable.breakdown.originalAccruals += debit || 0;
                break;
                
            case 'payment':
                // Payment received
                studentDetail.paymentsReceived += credit || 0;
                balanceSheet.assets.currentAssets.accountsReceivable.breakdown.paymentsReceived += credit || 0;
                break;
                
            case 'manual':
                // Check if this is a negotiation
                if (this.isNegotiationTransaction(transaction, metadata)) {
                    const discountAmount = credit || 0;
                    studentDetail.negotiatedAdjustments += discountAmount;
                    balanceSheet.assets.currentAssets.accountsReceivable.breakdown.negotiatedAdjustments += discountAmount;
                    
                    // Track negotiation summary
                    balanceSheet.metadata.negotiationSummary.totalNegotiations++;
                    balanceSheet.metadata.negotiationSummary.totalDiscountsGiven += discountAmount;
                    balanceSheet.metadata.negotiationSummary.studentsAffected.add(studentId);
                } else {
                    // Other manual adjustments
                    studentDetail.originalAccruals += (debit || 0) - (credit || 0);
                }
                break;
                
            default:
                // Other transaction types
                studentDetail.originalAccruals += (debit || 0) - (credit || 0);
        }
        
        // Calculate net outstanding for this student
        studentDetail.netOutstanding = Math.max(0, 
            studentDetail.originalAccruals - 
            studentDetail.negotiatedAdjustments - 
            studentDetail.paymentsReceived
        );
    }
    
    /**
     * Process Cash and Bank entries
     */
    static processCashAndBankEntry(entry, balanceSheet) {
        const { accountCode, accountName, debit, credit } = entry;
        
        if (!balanceSheet.assets.currentAssets.cashAndBank[accountCode]) {
            balanceSheet.assets.currentAssets.cashAndBank[accountCode] = {
                accountCode,
                accountName,
                balance: 0
            };
        }
        
        balanceSheet.assets.currentAssets.cashAndBank[accountCode].balance += (debit || 0) - (credit || 0);
    }
    
    /**
     * Process Income entries
     */
    static processIncomeEntry(entry, transaction, balanceSheet) {
        const { accountCode, accountName, debit, credit } = entry;
        const { source, metadata } = transaction;
        
        // Track income adjustments from negotiations
        if (source === 'manual' && this.isNegotiationTransaction(transaction, metadata)) {
            // This is a negotiation that reduces income
            if (!balanceSheet.metadata.negotiationSummary.incomeAdjustments) {
                balanceSheet.metadata.negotiationSummary.incomeAdjustments = {};
            }
            
            if (!balanceSheet.metadata.negotiationSummary.incomeAdjustments[accountCode]) {
                balanceSheet.metadata.negotiationSummary.incomeAdjustments[accountCode] = {
                    accountCode,
                    accountName,
                    totalReductions: 0
                };
            }
            
            balanceSheet.metadata.negotiationSummary.incomeAdjustments[accountCode].totalReductions += debit || 0;
        }
    }
    
    /**
     * Process other account entries
     */
    static processOtherAccountEntry(entry, balanceSheet) {
        const { accountCode, accountName, accountType, debit, credit } = entry;
        
        // Categorize by account type
        let category;
        if (accountType === 'Asset') {
            category = balanceSheet.assets.nonCurrentAssets;
        } else if (accountType === 'Liability') {
            category = balanceSheet.liabilities.currentLiabilities;
        } else if (accountType === 'Equity') {
            category = balanceSheet.equity;
        }
        
        if (category && !category[accountCode]) {
            category[accountCode] = {
                accountCode,
                accountName,
                balance: 0
            };
        }
        
        if (category && category[accountCode]) {
            category[accountCode].balance += (debit || 0) - (credit || 0);
        }
    }
    
    /**
     * Calculate final balances
     */
    static calculateFinalBalances(balanceSheet) {
        // Calculate total Accounts Receivable
        let totalAR = 0;
        Object.values(balanceSheet.assets.currentAssets.accountsReceivable.studentDetails).forEach(student => {
            totalAR += student.netOutstanding;
        });
        
        balanceSheet.assets.currentAssets.accountsReceivable.total = totalAR;
        balanceSheet.assets.currentAssets.accountsReceivable.breakdown.netOutstanding = totalAR;
        
        // Calculate total Cash and Bank
        let totalCashAndBank = 0;
        Object.values(balanceSheet.assets.currentAssets.cashAndBank).forEach(account => {
            totalCashAndBank += account.balance;
        });
        
        // Calculate total assets
        balanceSheet.assets.totalCurrentAssets = totalCashAndBank + totalAR;
        balanceSheet.assets.totalAssets = balanceSheet.assets.totalCurrentAssets;
        
        // Calculate total liabilities
        let totalLiabilities = 0;
        Object.values(balanceSheet.liabilities.currentLiabilities).forEach(liability => {
            totalLiabilities += liability.balance;
        });
        balanceSheet.liabilities.totalLiabilities = totalLiabilities;
        
        // Calculate equity
        balanceSheet.equity.totalEquity = balanceSheet.assets.totalAssets - balanceSheet.liabilities.totalLiabilities;
    }
    
    /**
     * Generate negotiation summary
     */
    static generateNegotiationSummary(balanceSheet) {
        const summary = balanceSheet.metadata.negotiationSummary;
        
        // Convert Set to Array for JSON serialization
        summary.studentsAffected = Array.from(summary.studentsAffected);
        
        // Calculate average discount per negotiation
        summary.averageDiscountPerNegotiation = summary.totalNegotiations > 0 
            ? summary.totalDiscountsGiven / summary.totalNegotiations 
            : 0;
        
        // Calculate total income impact
        let totalIncomeImpact = 0;
        if (summary.incomeAdjustments) {
            Object.values(summary.incomeAdjustments).forEach(adjustment => {
                totalIncomeImpact += adjustment.totalReductions;
            });
        }
        summary.totalIncomeImpact = totalIncomeImpact;
        
        console.log(`📊 Negotiation Summary: ${summary.totalNegotiations} negotiations, $${summary.totalDiscountsGiven} total discounts, ${summary.studentsAffected.length} students affected`);
    }
    
    /**
     * Helper methods
     */
    static extractStudentIdFromAccountCode(accountCode) {
        // Extract student ID from account codes like "1100-68e7763d3f4d94b74d6e9bee"
        const parts = accountCode.split('-');
        return parts.length > 1 ? parts[1] : accountCode;
    }
    
    static extractStudentNameFromDescription(description) {
        // Extract student name from descriptions like "A/R reduction for negotiated rent discount - Kudzai Pemhiwa"
        const match = description.match(/- ([^-]+)$/);
        return match ? match[1].trim() : null;
    }
    
    static extractStudentNameFromAccountName(accountName) {
        // Extract student name from account names like "Accounts Receivable - Kudzai Pemhiwa"
        const match = accountName.match(/Accounts Receivable - (.+)$/);
        return match ? match[1].trim() : null;
    }
    
    static determineTransactionType(source, metadata, description) {
        if (source === 'rental_accrual') return 'rent_accrual';
        if (source === 'payment') return 'payment_received';
        if (source === 'manual' && this.isNegotiationTransaction({ metadata }, metadata)) return 'negotiation';
        return 'other';
    }
    
    static isNegotiationTransaction(transaction, metadata) {
        return metadata?.type === 'negotiated_payment_adjustment' ||
               transaction.description?.toLowerCase().includes('negotiated') ||
               transaction.description?.toLowerCase().includes('discount');
    }
    
    /**
     * Generate Student Negotiation Report
     */
    static async generateStudentNegotiationReport(asOfDate, residenceId = null) {
        try {
            const balanceSheet = await this.generateEnhancedBalanceSheet(asOfDate, residenceId);
            
            const report = {
                reportDate: asOfDate,
                residenceId: residenceId,
                summary: balanceSheet.metadata.negotiationSummary,
                students: Object.values(balanceSheet.assets.currentAssets.accountsReceivable.studentDetails)
                    .filter(student => student.negotiatedAdjustments > 0)
                    .map(student => ({
                        studentId: student.studentId,
                        studentName: student.studentName,
                        originalAccruals: student.originalAccruals,
                        negotiatedAdjustments: student.negotiatedAdjustments,
                        paymentsReceived: student.paymentsReceived,
                        netOutstanding: student.netOutstanding,
                        negotiationCount: student.transactions.filter(t => t.type === 'negotiation').length,
                        totalDiscounts: student.negotiatedAdjustments
                    }))
                    .sort((a, b) => b.totalDiscounts - a.totalDiscounts)
            };
            
            return report;
            
        } catch (error) {
            console.error('❌ Error generating student negotiation report:', error);
            throw error;
        }
    }
}

module.exports = EnhancedBalanceSheetService;
