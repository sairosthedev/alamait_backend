const EnhancedPaymentAllocationService = require('../../services/enhancedPaymentAllocationService');
const logger = require('../../utils/logger');

/**
 * Student AR Balances Controller
 * Handles requests for student outstanding balances and payment allocation testing
 */
class StudentARBalancesController {

  /**
   * Get detailed outstanding balances for a student
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getDetailedOutstandingBalances(req, res) {
    try {
      const { studentId } = req.params;
      
      if (!studentId) {
        return res.status(400).json({
          success: false,
          error: 'Student ID is required'
        });
      }

      console.log(`🔍 API Request: Getting detailed AR balances for student ${studentId}`);
      
      const outstandingBalances = await EnhancedPaymentAllocationService.getDetailedOutstandingBalances(studentId);
      
      res.json({
        success: true,
        data: {
          studentId,
          outstandingBalances,
          totalOutstanding: outstandingBalances.reduce((sum, month) => sum + month.totalOutstanding, 0),
          monthsWithOutstanding: outstandingBalances.length
        },
        message: `Retrieved outstanding balances for student ${studentId}`
      });

    } catch (error) {
      console.error(`❌ Error getting AR balances for student ${req.params.studentId}:`, error);
      
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to retrieve outstanding balances'
      });
    }
  }

  /**
   * Get outstanding balance summary for a student
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getOutstandingBalanceSummary(req, res) {
    try {
      const { studentId } = req.params;
      
      if (!studentId) {
        return res.status(400).json({
          success: false,
          error: 'Student ID is required'
        });
      }

      console.log(`📊 API Request: Getting AR balance summary for student ${studentId}`);
      
      const summary = await EnhancedPaymentAllocationService.getOutstandingBalanceSummary(studentId);
      
      res.json({
        success: true,
        data: {
          studentId,
          summary
        },
        message: `Retrieved balance summary for student ${studentId}`
      });

    } catch (error) {
      console.error(`❌ Error getting AR balance summary for student ${req.params.studentId}:`, error);
      
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to retrieve balance summary'
      });
    }
  }

  /**
   * Test payment allocation (for development/testing)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async testPaymentAllocation(req, res) {
    try {
      const { studentId } = req.params;
      const { totalAmount, payments } = req.body;
      
      if (!studentId || !totalAmount || !payments) {
        return res.status(400).json({
          success: false,
          error: 'Student ID, total amount, and payments are required'
        });
      }

      console.log(`🧪 API Request: Testing payment allocation for student ${studentId}`);
      console.log(`💰 Payment: $${totalAmount}`, payments);
      
      // Create mock payment data for testing
      const paymentData = {
        paymentId: `TEST-${Date.now()}`,
        studentId,
        totalAmount,
        payments,
        residence: 'test-residence' // This would come from student data
      };
      
      const allocationResult = await EnhancedPaymentAllocationService.smartFIFOAllocation(paymentData);
      
      res.json({
        success: true,
        data: allocationResult,
        message: `Payment allocation test completed for student ${studentId}`
      });

    } catch (error) {
      console.error(`❌ Error testing payment allocation for student ${req.params.studentId}:`, error);
      
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to test payment allocation'
      });
    }
  }

  /**
   * Get student invoices (accruals)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getStudentInvoices(req, res) {
    try {
      const { studentId } = req.params;
      
      if (!studentId) {
        return res.status(400).json({
          success: false,
          error: 'Student ID is required'
        });
      }

      console.log(`📄 API Request: Getting invoices for student ${studentId}`);
      
      // Get all accrual transactions for this student
      const TransactionEntry = require('../../models/TransactionEntry');
      const invoices = await TransactionEntry.find({
        'entries.accountCode': { $regex: `^1100-${studentId}` },
        source: { $in: ['rental_accrual', 'lease_start'] }
      })
      .sort({ date: 1 })
      .lean();

      // Format invoices for display
      const formattedInvoices = invoices.map(invoice => {
        const invoiceDate = new Date(invoice.date);
        const monthKey = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`;
        
        // Calculate total amount for this invoice
        const totalAmount = invoice.entries
          .filter(entry => entry.accountCode.startsWith('1100-'))
          .reduce((sum, entry) => sum + (entry.debit || 0), 0);

        return {
          invoiceId: invoice._id,
          transactionId: invoice.transactionId,
          date: invoice.date,
          monthKey,
          monthName: invoiceDate.toLocaleString('default', { month: 'long', year: 'numeric' }),
          source: invoice.source,
          totalAmount,
          description: invoice.description,
          status: invoice.status,
          metadata: invoice.metadata,
          entries: invoice.entries.filter(entry => entry.accountCode.startsWith('1100-'))
        };
      });

      res.json({
        success: true,
        data: {
          studentId,
          invoices: formattedInvoices,
          totalInvoices: formattedInvoices.length,
          totalAmount: formattedInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0)
        },
        message: `Retrieved ${formattedInvoices.length} invoices for student ${studentId}`
      });

    } catch (error) {
      console.error(`❌ Error getting invoices for student ${req.params.studentId}:`, error);
      
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to retrieve student invoices'
      });
    }
  }
}

module.exports = StudentARBalancesController;
