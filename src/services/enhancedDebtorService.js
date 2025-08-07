const Debtor = require('../models/Debtor');
const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');
const TransactionEntry = require('../models/TransactionEntry');
const Invoice = require('../models/Invoice');

class EnhancedDebtorService {
  
  /**
   * Add payment to debtor with month allocation
   */
  static async addPaymentToDebtor(debtorId, paymentData) {
    try {
      const debtor = await Debtor.findById(debtorId);
      if (!debtor) {
        throw new Error('Debtor not found');
      }

      // Add payment to debtor
      await debtor.addPayment(paymentData);
      
      // Create transaction entry if not already created
      if (paymentData.createTransactionEntry !== false) {
        await this.createPaymentTransactionEntry(debtor, paymentData);
      }

      return debtor;
    } catch (error) {
      console.error('Error adding payment to debtor:', error);
      throw error;
    }
  }

  /**
   * Create transaction entry for payment
   */
  static async createPaymentTransactionEntry(debtor, paymentData) {
    try {
      const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      // Determine receiving account based on payment method
      let receivingAccount = '1000'; // Default to main bank account
      switch (paymentData.paymentMethod) {
        case 'Ecocash':
          receivingAccount = '1003'; // Ecocash Wallet
          break;
        case 'Innbucks':
          receivingAccount = '1004'; // Innbucks Wallet
          break;
        case 'Cash':
          receivingAccount = '1001'; // Cash Account
          break;
        case 'Online Payment':
          receivingAccount = '1002'; // Online Payment Account
          break;
        default:
          receivingAccount = '1000'; // Main Bank Account
      }

      // Create transaction entry
      const transactionEntry = new TransactionEntry({
        transactionId,
        date: paymentData.paymentDate,
        description: `Payment from ${debtor.contactInfo?.name || debtor.debtorCode} - ${paymentData.paymentId}`,
        reference: paymentData.paymentId,
        entries: [
          {
            accountCode: receivingAccount,
            accountName: this.getAccountName(receivingAccount),
            accountType: 'Asset',
            debit: paymentData.amount,
            credit: 0,
            description: `Payment received via ${paymentData.paymentMethod}`
          },
          {
            accountCode: debtor.accountCode,
            accountName: `Accounts Receivable - ${debtor.contactInfo?.name || debtor.debtorCode}`,
            accountType: 'Asset',
            debit: 0,
            credit: paymentData.amount,
            description: `Payment for ${paymentData.allocatedMonth}`
          }
        ],
        totalDebit: paymentData.amount,
        totalCredit: paymentData.amount,
        source: 'payment',
        sourceId: paymentData.originalPayment,
        sourceModel: 'Payment',
        residence: debtor.residence,
        createdBy: paymentData.createdBy?.email || 'System',
        status: 'posted',
        metadata: {
          debtorId: debtor._id,
          debtorCode: debtor.debtorCode,
          allocatedMonth: paymentData.allocatedMonth,
          paymentMethod: paymentData.paymentMethod,
          components: paymentData.components
        }
      });

      await transactionEntry.save();

      // Add transaction entry to debtor
      await debtor.addTransactionEntry({
        transactionId,
        date: paymentData.paymentDate,
        description: `Payment from ${debtor.contactInfo?.name || debtor.debtorCode} - ${paymentData.paymentId}`,
        reference: paymentData.paymentId,
        entries: transactionEntry.entries,
        totalDebit: paymentData.amount,
        totalCredit: paymentData.amount,
        source: 'payment',
        sourceId: paymentData.originalPayment,
        sourceModel: 'Payment',
        status: 'posted',
        createdBy: paymentData.createdBy?.email || 'System',
        createdAt: new Date(),
        metadata: {
          allocatedMonth: paymentData.allocatedMonth,
          paymentMethod: paymentData.paymentMethod,
          components: paymentData.components
        }
      });

      return transactionEntry;
    } catch (error) {
      console.error('Error creating payment transaction entry:', error);
      throw error;
    }
  }

  /**
   * Sync existing payments to debtor
   */
  static async syncExistingPaymentsToDebtor(debtorId) {
    try {
      const debtor = await Debtor.findById(debtorId).populate('user');
      if (!debtor) {
        throw new Error('Debtor not found');
      }

      // Find all payments for this student
      const payments = await Payment.find({ student: debtor.user._id })
        .sort({ date: 1 });

      console.log(`Found ${payments.length} payments to sync for debtor ${debtor.debtorCode}`);

      for (const payment of payments) {
        // Check if payment already exists in debtor
        const existingPayment = debtor.paymentHistory.find(
          ph => ph.paymentId === payment.paymentId
        );

        if (!existingPayment) {
          // Parse payment components
          const components = {
            rent: payment.rentAmount || 0,
            adminFee: payment.adminFee || 0,
            deposit: payment.deposit || 0,
            utilities: 0,
            other: 0
          };

          // Calculate other amount
          const totalComponents = Object.values(components).reduce((sum, val) => sum + val, 0);
          components.other = Math.max(0, payment.totalAmount - totalComponents);

          const paymentData = {
            paymentId: payment.paymentId,
            amount: payment.totalAmount,
            allocatedMonth: payment.paymentMonth,
            components,
            paymentMethod: payment.method,
            paymentDate: payment.date,
            status: payment.status,
            originalPayment: payment._id,
            notes: payment.description,
            createdBy: payment.createdBy
          };

          // Add payment to debtor
          await debtor.addPayment(paymentData);
          
          // Create transaction entry
          await this.createPaymentTransactionEntry(debtor, paymentData);

          console.log(`Synced payment ${payment.paymentId} to debtor ${debtor.debtorCode}`);
        }
      }

      return debtor;
    } catch (error) {
      console.error('Error syncing payments to debtor:', error);
      throw error;
    }
  }

  /**
   * Sync all debtors with their payments
   */
  static async syncAllDebtors() {
    try {
      const debtors = await Debtor.find().populate('user');
      console.log(`Found ${debtors.length} debtors to sync`);

      const results = {
        total: debtors.length,
        synced: 0,
        errors: 0,
        errors: []
      };

      for (const debtor of debtors) {
        try {
          await this.syncExistingPaymentsToDebtor(debtor._id);
          results.synced++;
          console.log(`✅ Synced debtor ${debtor.debtorCode}`);
        } catch (error) {
          results.errors++;
          results.errors.push({
            debtorCode: debtor.debtorCode,
            error: error.message
          });
          console.error(`❌ Error syncing debtor ${debtor.debtorCode}:`, error.message);
        }
      }

      return results;
    } catch (error) {
      console.error('Error syncing all debtors:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive debtor data
   */
  static async getComprehensiveDebtorData(debtorId, options = {}) {
    try {
      const { includeHistory = true, months = 12 } = options;

      const debtor = await Debtor.findById(debtorId)
        .populate('user', 'firstName lastName email phone')
        .populate('residence', 'name address city state zipCode')
        .populate('application', 'startDate endDate roomNumber status')
        .populate('createdBy', 'firstName lastName email');

      if (!debtor) {
        throw new Error('Debtor not found');
      }

      // Calculate payment statistics
      const paymentStats = this.calculatePaymentStatistics(debtor.paymentHistory, months);
      
      // Calculate transaction statistics
      const transactionStats = this.calculateTransactionStatistics(debtor.transactionEntries, months);

      // Get monthly payment summary
      const monthlySummary = this.getMonthlyPaymentSummary(debtor, months);

      const response = {
        success: true,
        debtor: {
          ...debtor.toObject(),
          paymentHistory: includeHistory ? debtor.paymentHistory : [],
          transactionEntries: includeHistory ? debtor.transactionEntries : [],
          invoices: includeHistory ? debtor.invoices : []
        },
        statistics: {
          payments: paymentStats,
          transactions: transactionStats,
          monthly: monthlySummary
        },
        summary: {
          totalPayments: debtor.paymentHistory.length,
          totalTransactions: debtor.transactionEntries.length,
          totalInvoices: debtor.invoices.length,
          currentBalance: debtor.currentBalance,
          totalOwed: debtor.totalOwed,
          totalPaid: debtor.totalPaid,
          overdueAmount: debtor.overdueAmount,
          daysOverdue: debtor.daysOverdue
        }
      };

      return response;
    } catch (error) {
      console.error('Error getting comprehensive debtor data:', error);
      throw error;
    }
  }

  /**
   * Calculate payment statistics
   */
  static calculatePaymentStatistics(payments, months = 12) {
    const now = new Date();
    const cutoffDate = new Date(now.getFullYear(), now.getMonth() - months, 1);
    
    const recentPayments = payments.filter(payment => 
      new Date(payment.paymentDate) >= cutoffDate
    );

    const totalAmount = recentPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const averageAmount = recentPayments.length > 0 ? totalAmount / recentPayments.length : 0;

    // Group by month
    const monthlyData = {};
    recentPayments.forEach(payment => {
      const month = payment.allocatedMonth;
      if (!monthlyData[month]) {
        monthlyData[month] = {
          month,
          totalAmount: 0,
          paymentCount: 0,
          averageAmount: 0
        };
      }
      monthlyData[month].totalAmount += payment.amount;
      monthlyData[month].paymentCount += 1;
    });

    // Calculate averages
    Object.values(monthlyData).forEach(monthData => {
      monthData.averageAmount = monthData.paymentCount > 0 
        ? monthData.totalAmount / monthData.paymentCount 
        : 0;
    });

    return {
      totalPayments: recentPayments.length,
      totalAmount,
      averageAmount,
      monthlyData: Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month))
    };
  }

  /**
   * Calculate transaction statistics
   */
  static calculateTransactionStatistics(transactions, months = 12) {
    const now = new Date();
    const cutoffDate = new Date(now.getFullYear(), now.getMonth() - months, 1);
    
    const recentTransactions = transactions.filter(transaction => 
      new Date(transaction.date) >= cutoffDate
    );

    const totalDebits = recentTransactions.reduce((sum, txn) => sum + txn.totalDebit, 0);
    const totalCredits = recentTransactions.reduce((sum, txn) => sum + txn.totalCredit, 0);

    return {
      totalTransactions: recentTransactions.length,
      totalDebits,
      totalCredits,
      netAmount: totalCredits - totalDebits
    };
  }

  /**
   * Get monthly payment summary
   */
  static getMonthlyPaymentSummary(debtor, months = 12) {
    const now = new Date();
    const cutoffDate = new Date(now.getFullYear(), now.getMonth() - months, 1);
    
    const recentMonthlyPayments = debtor.monthlyPayments.filter(mp => {
      const [year, month] = mp.month.split('-');
      const paymentDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      return paymentDate >= cutoffDate;
    });

    return recentMonthlyPayments.sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * Get account name by code
   */
  static getAccountName(accountCode) {
    const accountNames = {
      '1000': 'Main Bank Account',
      '1001': 'Cash Account',
      '1002': 'Online Payment Account',
      '1003': 'Ecocash Wallet',
      '1004': 'Innbucks Wallet',
      '2000': 'Accounts Payable',
      '4001': 'Rent Income',
      '4002': 'Admin Fee Income',
      '4003': 'Deposit Income'
    };
    
    return accountNames[accountCode] || `Account ${accountCode}`;
  }

  /**
   * Update debtor financial summary
   */
  static async updateDebtorFinancialSummary(debtorId) {
    try {
      const debtor = await Debtor.findById(debtorId);
      if (!debtor) {
        throw new Error('Debtor not found');
      }

      // Calculate current period
      const currentMonth = new Date().toISOString().slice(0, 7);
      const currentPeriodPayment = debtor.monthlyPayments.find(mp => mp.month === currentMonth);
      
      if (currentPeriodPayment) {
        debtor.financialSummary.currentPeriod = {
          month: currentMonth,
          expectedAmount: currentPeriodPayment.expectedAmount,
          paidAmount: currentPeriodPayment.paidAmount,
          outstandingAmount: currentPeriodPayment.outstandingAmount,
          status: currentPeriodPayment.status
        };
      }

      // Calculate year to date
      const currentYear = new Date().getFullYear();
      const yearPayments = debtor.monthlyPayments.filter(mp => {
        const [year] = mp.month.split('-');
        return parseInt(year) === currentYear;
      });

      const yearTotalPaid = yearPayments.reduce((sum, mp) => sum + mp.paidAmount, 0);
      const yearTotalExpected = yearPayments.reduce((sum, mp) => sum + mp.expectedAmount, 0);
      const yearPaymentCount = yearPayments.reduce((sum, mp) => sum + mp.paymentCount, 0);

      debtor.financialSummary.yearToDate = {
        year: currentYear,
        totalExpected: yearTotalExpected,
        totalPaid: yearTotalPaid,
        totalOutstanding: Math.max(0, yearTotalExpected - yearTotalPaid),
        paymentCount: yearPaymentCount
      };

      await debtor.save();
      return debtor;
    } catch (error) {
      console.error('Error updating debtor financial summary:', error);
      throw error;
    }
  }
}

module.exports = EnhancedDebtorService;
