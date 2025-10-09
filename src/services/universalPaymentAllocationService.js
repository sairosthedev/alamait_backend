const mongoose = require('mongoose');
const TransactionEntry = require('../models/TransactionEntry');

class UniversalPaymentAllocationService {
  /**
   * Universal Payment Allocation Service
   * Handles payment allocation for both general AR (1100) and student-specific AR (1100-{studentId}) accounts
   */

  /**
   * Get current AR balances by account type
   */
  static async getARBalances() {
    try {
      const allARTransactions = await TransactionEntry.find({
        'entries.accountCode': { $regex: /^1100/ },
        status: 'posted'
      });

      const accountBalances = {};
      const studentBalances = {};

      allARTransactions.forEach(tx => {
        tx.entries.forEach(entry => {
          if (entry.accountCode.startsWith('1100')) {
            // Track account-level balances
            if (!accountBalances[entry.accountCode]) {
              accountBalances[entry.accountCode] = {
                totalDebit: 0,
                totalCredit: 0,
                transactions: []
              };
            }
            
            accountBalances[entry.accountCode].totalDebit += entry.debit || 0;
            accountBalances[entry.accountCode].totalCredit += entry.credit || 0;
            accountBalances[entry.accountCode].transactions.push(tx);

            // Track student-level balances
            if (entry.accountCode === '1100') {
              // For general AR, extract student name from description
              const studentName = this.extractStudentNameFromDescription(tx.description);
              if (studentName) {
                if (!studentBalances[studentName]) {
                  studentBalances[studentName] = {
                    accountCode: '1100',
                    totalDebit: 0,
                    totalCredit: 0,
                    transactions: []
                  };
                }
                studentBalances[studentName].totalDebit += entry.debit || 0;
                studentBalances[studentName].totalCredit += entry.credit || 0;
                studentBalances[studentName].transactions.push(tx);
              }
            } else if (entry.accountCode.startsWith('1100-')) {
              // For student-specific AR, use the student ID
              const studentId = entry.accountCode.split('-')[1];
              if (!studentBalances[studentId]) {
                studentBalances[studentId] = {
                  accountCode: entry.accountCode,
                  totalDebit: 0,
                  totalCredit: 0,
                  transactions: []
                };
              }
              studentBalances[studentId].totalDebit += entry.debit || 0;
              studentBalances[studentId].totalCredit += entry.credit || 0;
              studentBalances[studentId].transactions.push(tx);
            }
          }
        });
      });

      // Calculate net balances
      const accountNetBalances = {};
      Object.entries(accountBalances).forEach(([accountCode, data]) => {
        accountNetBalances[accountCode] = {
          balance: data.totalDebit - data.totalCredit,
          totalDebit: data.totalDebit,
          totalCredit: data.totalCredit,
          transactionCount: data.transactions.length
        };
      });

      const studentNetBalances = {};
      Object.entries(studentBalances).forEach(([studentId, data]) => {
        studentNetBalances[studentId] = {
          balance: data.totalDebit - data.totalCredit,
          accountCode: data.accountCode,
          totalDebit: data.totalDebit,
          totalCredit: data.totalCredit,
          transactionCount: data.transactions.length
        };
      });

      return {
        accountBalances: accountNetBalances,
        studentBalances: studentNetBalances,
        totalAR: Object.values(accountNetBalances).reduce((sum, acc) => sum + acc.balance, 0)
      };
    } catch (error) {
      console.error('❌ Error getting AR balances:', error);
      throw error;
    }
  }

  /**
   * Extract student name from transaction description
   */
  static extractStudentNameFromDescription(description) {
    if (!description) return null;
    
    // Try to extract student name from patterns like "Rent accrual: John Doe - January 2025"
    const match = description.match(/: ([^-]+) - /);
    if (match) {
      return match[1].trim();
    }
    
    // Try other patterns
    const patterns = [
      /for ([^-]+)/,
      /([A-Z][a-z]+ [A-Z][a-z]+)/,
      /([A-Z][a-z]+ Doe)/,
      /([A-Z][a-z]+ Smith)/
    ];
    
    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return null;
  }

  /**
   * Allocate payment to appropriate AR account
   */
  static async allocatePayment(paymentData) {
    try {
      const {
        amount,
        studentId,
        studentName,
        paymentMethod = 'Cash',
        date = new Date(),
        reference = null,
        residence = null,
        createdBy = 'system'
      } = paymentData;

      console.log(`🎯 Allocating payment: $${amount} for ${studentName || studentId}`);

      // Get current AR structure to determine account type
      const arBalances = await this.getARBalances();
      
      // Determine which account to use
      let targetAccountCode = '1100'; // Default to general AR
      let targetAccountName = 'Accounts Receivable - Tenants';
      let allocationType = 'general';

      // Check if student-specific account exists
      if (studentId) {
        const studentSpecificAccount = `1100-${studentId}`;
        if (arBalances.accountBalances[studentSpecificAccount]) {
          targetAccountCode = studentSpecificAccount;
          targetAccountName = `Accounts Receivable - ${studentName || studentId}`;
          allocationType = 'student_specific';
          console.log(`   ✅ Using student-specific account: ${targetAccountCode}`);
        } else {
          console.log(`   ℹ️  Using general AR account: ${targetAccountCode}`);
        }
      }

      // Determine cash/bank account based on payment method
      let cashAccountCode = '1000'; // Default to Cash
      let cashAccountName = 'Cash';
      
      if (paymentMethod.toLowerCase().includes('bank') || 
          paymentMethod.toLowerCase().includes('transfer') ||
          paymentMethod.toLowerCase().includes('ecocash')) {
        cashAccountCode = '1001';
        cashAccountName = 'Bank Account';
      }

      // Create payment allocation transaction
      const studentDisplay = studentName || studentId || 'GENERAL';
      const monthSuffix = paymentData.paymentMonth ? ` (${paymentData.paymentMonth})` : '';
      const paymentAllocation = new TransactionEntry({
        transactionId: `PAYMENT-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        date: date,
        description: `Payment allocation: $${amount} for ${studentDisplay}${monthSuffix}`,
        reference: `${reference || `PAYMENT-${studentDisplay}`}${monthSuffix}`,
        entries: [
          {
            accountCode: cashAccountCode,
            accountName: cashAccountName,
            accountType: 'Asset',
            debit: amount,
            credit: 0,
            description: `${paymentMethod} received for rent payment`
          },
          {
            accountCode: targetAccountCode,
            accountName: targetAccountName,
            accountType: 'Asset',
            debit: 0,
            credit: amount,
            description: `Rent receivable settled for ${studentName || studentId}`
          }
        ],
        totalDebit: amount,
        totalCredit: amount,
        source: 'payment',
        sourceId: new mongoose.Types.ObjectId(),
        sourceModel: 'Payment',
        residence: residence,
        createdBy: createdBy,
        status: 'posted',
        metadata: {
          studentId: studentId,
          studentName: studentName,
          paymentType: 'rent',
          amount: amount,
          paymentMethod: paymentMethod,
          allocationType: allocationType,
          targetAccountCode: targetAccountCode
        }
      });

      await paymentAllocation.save();
      console.log(`   ✅ Created payment allocation transaction: ${paymentAllocation.transactionId}`);
      
      return paymentAllocation;
    } catch (error) {
      console.error('❌ Error allocating payment:', error);
      throw error;
    }
  }

  /**
   * Get outstanding balances for specific student
   */
  static async getStudentOutstandingBalance(studentId, studentName = null) {
    try {
      const arBalances = await this.getARBalances();
      
      // Check student-specific account first
      const studentSpecificAccount = `1100-${studentId}`;
      if (arBalances.accountBalances[studentSpecificAccount]) {
        return {
          studentId: studentId,
          studentName: studentName,
          accountCode: studentSpecificAccount,
          outstandingBalance: arBalances.accountBalances[studentSpecificAccount].balance,
          allocationType: 'student_specific'
        };
      }

      // Check general AR account for student name
      if (studentName && arBalances.studentBalances[studentName]) {
        return {
          studentId: studentId,
          studentName: studentName,
          accountCode: '1100',
          outstandingBalance: arBalances.studentBalances[studentName].balance,
          allocationType: 'general'
        };
      }

      return {
        studentId: studentId,
        studentName: studentName,
        accountCode: '1100',
        outstandingBalance: 0,
        allocationType: 'general'
      };
    } catch (error) {
      console.error('❌ Error getting student outstanding balance:', error);
      throw error;
    }
  }

  /**
   * Process multiple payments with FIFO allocation
   */
  static async processMultiplePayments(payments) {
    try {
      const results = [];
      
      for (const payment of payments) {
        try {
          const result = await this.allocatePayment(payment);
          results.push({
            success: true,
            payment: payment,
            transaction: result
          });
        } catch (error) {
          results.push({
            success: false,
            payment: payment,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      console.error('❌ Error processing multiple payments:', error);
      throw error;
    }
  }

  /**
   * Get payment allocation report
   */
  static async getPaymentAllocationReport(startDate = null, endDate = null) {
    try {
      const query = {
        source: 'payment',
        status: 'posted'
      };

      if (startDate && endDate) {
        query.date = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      const payments = await TransactionEntry.find(query).sort({ date: -1 });

      const report = {
        totalPayments: payments.length,
        totalAmount: 0,
        byAllocationType: {
          general: { count: 0, amount: 0 },
          student_specific: { count: 0, amount: 0 }
        },
        byStudent: {},
        byPaymentMethod: {}
      };

      payments.forEach(payment => {
        const amount = payment.totalDebit;
        const allocationType = payment.metadata?.allocationType || 'unknown';
        const studentName = payment.metadata?.studentName || 'Unknown';
        const paymentMethod = payment.metadata?.paymentMethod || 'Unknown';

        report.totalAmount += amount;

        // By allocation type
        if (report.byAllocationType[allocationType]) {
          report.byAllocationType[allocationType].count++;
          report.byAllocationType[allocationType].amount += amount;
        }

        // By student
        if (!report.byStudent[studentName]) {
          report.byStudent[studentName] = { count: 0, amount: 0 };
        }
        report.byStudent[studentName].count++;
        report.byStudent[studentName].amount += amount;

        // By payment method
        if (!report.byPaymentMethod[paymentMethod]) {
          report.byPaymentMethod[paymentMethod] = { count: 0, amount: 0 };
        }
        report.byPaymentMethod[paymentMethod].count++;
        report.byPaymentMethod[paymentMethod].amount += amount;
      });

      return report;
    } catch (error) {
      console.error('❌ Error getting payment allocation report:', error);
      throw error;
    }
  }
}

module.exports = UniversalPaymentAllocationService;
