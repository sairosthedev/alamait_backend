const TransactionEntry = require('../models/TransactionEntry');
const Account = require('../models/Account');
const mongoose = require('mongoose');

/**
 * Payment Allocation Service
 * Handles allocation of lump-sum payments across lease months
 * Shows clear month-by-month payment coverage
 * 
 * NEW: Full automation - automatically allocates payments when made
 */
class PaymentAllocationService {
  
  /**
   * Allocate payment across months based on lease terms
   * @param {number} paymentAmount - Total payment amount
   * @param {Date} leaseStartDate - Lease start date
   * @param {Date} leaseEndDate - Lease end date
   * @param {number} monthlyRent - Monthly rent amount
   * @param {number} adminFee - Admin fee (first month only)
   * @returns {Object} Payment allocation result
   */
  static allocatePayment(paymentAmount, leaseStartDate, leaseEndDate, monthlyRent, adminFee = 0) {
    try {
      console.log(`💰 Allocating payment of $${paymentAmount.toFixed(2)} across lease period`);
      
      const startDate = new Date(leaseStartDate);
      const endDate = new Date(leaseEndDate);
      
      // Get lease months
      const leaseMonths = this.getLeaseMonths(startDate, endDate);
      
      // Calculate first month proration
      const firstMonthProration = this.calculateFirstMonthProration(startDate, monthlyRent);
      
      // Initialize allocation
      let remainingPayment = paymentAmount;
      const allocation = {
        totalPayment: paymentAmount,
        leasePeriod: `${leaseStartDate} to ${leaseEndDate}`,
        monthlyBreakdown: {},
        summary: {
          monthsFullyPaid: 0,
          monthsPartiallyPaid: 0,
          monthsUnpaid: 0,
          totalAllocated: 0,
          remainingBalance: 0
        }
      };
      
      // Process each month
      leaseMonths.forEach((monthData, index) => {
        const { year, month, monthName } = monthData;
        const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
        
        // Calculate month's total obligation
        let monthObligation = monthlyRent;
        
        if (index === 0) {
          // First month: prorated rent + admin fee
          monthObligation = firstMonthProration + adminFee;
        }
        
        // Determine payment allocation for this month
        let paymentAllocated = 0;
        let isFullyPaid = false;
        let isPartiallyPaid = false;
        let remainingObligation = monthObligation;
        
        if (remainingPayment > 0) {
          if (remainingPayment >= monthObligation) {
            // Full payment for this month
            paymentAllocated = monthObligation;
            remainingPayment -= monthObligation;
            isFullyPaid = true;
            allocation.summary.monthsFullyPaid++;
          } else {
            // Partial payment for this month
            paymentAllocated = remainingPayment;
            remainingPayment = 0;
            isPartiallyPaid = true;
            allocation.summary.monthsPartiallyPaid++;
          }
          remainingObligation = monthObligation - paymentAllocated;
        }
        
        // Record month allocation
        allocation.monthlyBreakdown[monthKey] = {
          month: month,
          monthName: monthName,
          year: year,
          monthObligation: monthObligation,
          paymentAllocated: paymentAllocated,
          remainingObligation: remainingObligation,
          isFullyPaid: isFullyPaid,
          isPartiallyPaid: isPartiallyPaid,
          isUnpaid: !isFullyPaid && !isPartiallyPaid,
          paymentStatus: this.getPaymentStatus(isFullyPaid, isPartiallyPaid, remainingObligation),
          notes: this.getMonthNotes(index, firstMonthProration, adminFee)
        };
        
        allocation.summary.totalAllocated += paymentAllocated;
        
        if (isPartiallyPaid || !isFullyPaid) {
          allocation.summary.monthsUnpaid++;
        }
      });
      
      allocation.summary.remainingBalance = paymentAmount - allocation.summary.totalAllocated;
      
      console.log(`✅ Payment allocation completed:`);
      console.log(`   Months fully paid: ${allocation.summary.monthsFullyPaid}`);
      console.log(`   Months partially paid: ${allocation.summary.monthsPartiallyPaid}`);
      console.log(`   Months unpaid: ${allocation.summary.monthsUnpaid}`);
      console.log(`   Total allocated: $${allocation.summary.totalAllocated.toFixed(2)}`);
      console.log(`   Remaining payment: $${allocation.summary.remainingBalance.toFixed(2)}`);
      
      return allocation;
      
    } catch (error) {
      console.error('❌ Error allocating payment:', error);
      throw error;
    }
  }

  /**
   * Automatically allocate payment across months based on AR balances
   */
  static async autoAllocatePayment(paymentData) {
    try {
      console.log('🚀 AUTO-ALLOCATING PAYMENT:', paymentData.paymentId);
      console.log('📋 Payment Data:', JSON.stringify(paymentData, null, 2));
      
      const { totalAmount, studentId, residenceId, paymentMonth } = paymentData;
      
      if (!studentId) {
        console.error('❌ No studentId provided in payment data');
        return {
          success: false,
          error: 'Student ID is required for payment allocation',
          message: 'Cannot allocate payment - missing student ID'
        };
      }
      
      console.log(`🎯 Processing payment for student: ${studentId}, amount: $${totalAmount}`);
      
      // 1. Get student's AR balances by month
      const arBalances = await this.getStudentARBalances(studentId);
      
      if (!arBalances || arBalances.length === 0) {
        console.log('⚠️ No AR balances found for student:', studentId);
        return {
          success: false,
          error: 'No accounts receivable found for this student',
          message: 'Cannot allocate payment - no outstanding balances'
        };
      }
      
      console.log(`📊 Found ${arBalances.length} AR balances:`, arBalances);
      
      // 🆕 NEW: Detect the correct payment month from AR balances
      const oldestARMonth = arBalances[0]?.monthKey;
      const requestedPaymentMonth = paymentData.paymentMonth;
      
      console.log(`🎯 Payment Month Analysis:`);
      console.log(`   Requested Month: ${requestedPaymentMonth}`);
      console.log(`   Oldest AR Month: ${oldestARMonth}`);
      
      // 🆕 NEW: Override payment month if it doesn't match the oldest AR month
      let effectivePaymentMonth = requestedPaymentMonth;
      if (oldestARMonth && requestedPaymentMonth !== oldestARMonth) {
        console.log(`⚠️  Payment month mismatch detected!`);
        console.log(`   Requested: ${requestedPaymentMonth} (current month)`);
        console.log(`   Should be: ${oldestARMonth} (oldest AR accrual)`);
        console.log(`   🔄 Overriding payment month to ${oldestARMonth}`);
        effectivePaymentMonth = oldestARMonth;
      }
      
      // 2. Sort AR balances by date (oldest first)
      const sortedAR = arBalances.sort((a, b) => new Date(a.date) - new Date(b.date));
      console.log('📅 Sorted AR balances (oldest first):', sortedAR.map(item => ({
        month: item.monthKey,
        balance: item.balance,
        date: item.date
      })));
      
      // 3. Allocate payment to oldest balances first (FIFO principle)
      let remainingAmount = totalAmount;
      const allocationResults = [];
      
      console.log(`💰 Starting FIFO allocation of $${totalAmount} to oldest unpaid months first`);
      
      for (const arItem of sortedAR) {
        if (remainingAmount <= 0) break;
        
        const amountToAllocate = Math.min(remainingAmount, arItem.balance);
        console.log(`🎯 Allocating $${amountToAllocate} to ${arItem.monthKey} (original debt: $${arItem.originalDebt}, already paid: $${arItem.paidAmount}, remaining: $${arItem.balance})`);
        
        if (amountToAllocate > 0) {
          // Update the AR transaction with the remaining balance, not the original debit
          const updated = await this.updateARTransaction(
            arItem.transactionId, 
            amountToAllocate,
            paymentData,
            arItem.balance // Pass the current remaining balance
          );
          
          allocationResults.push({
            month: arItem.monthKey,
            originalBalance: arItem.balance,
            originalDebt: arItem.originalDebt,
            alreadyPaid: arItem.paidAmount,
            amountAllocated: amountToAllocate,
            newBalance: arItem.balance - amountToAllocate,
            transactionId: arItem.transactionId,
            allocationType: 'debt_settlement'
          });
          
          remainingAmount -= amountToAllocate;
          console.log(`✅ Allocated $${amountToAllocate} to ${arItem.monthKey}, remaining: $${remainingAmount}`);
        }
      }
      
      // 🆕 NEW: Handle advance payment if any amount remains
      let advancePayment = null;
      if (remainingAmount > 0) {
        console.log(`💳 Remaining $${remainingAmount} will be treated as advance payment`);
        
        advancePayment = {
          amount: remainingAmount,
          type: 'advance_payment',
          description: `Advance payment for future rent periods`,
          accountCode: `2500-${studentId}`, // Advance Payments liability account
          accountName: `Advance Payments - Student`
        };
        
        // Create advance payment transaction entry
        const advanceTransaction = await this.createAdvancePaymentTransaction(
          paymentData.paymentId,
          studentId,
          remainingAmount,
          paymentData
        );
        
        allocationResults.push({
          month: 'advance',
          originalBalance: 0,
          originalDebt: 0,
          alreadyPaid: 0,
          amountAllocated: remainingAmount,
          newBalance: 0,
          transactionId: advanceTransaction._id,
          allocationType: 'advance_payment',
          advanceDetails: advancePayment
        });
        
        remainingAmount = 0;
        console.log(`✅ Advance payment of $${advancePayment.amount} recorded`);
      }
      
      // 4. Create allocation record
      const allocationRecord = await this.createAllocationRecord(
        paymentData.paymentId,
        studentId,
        allocationResults,
        paymentData
      );
      
      // 🆕 NEW: Update payment month if it was overridden
      if (effectivePaymentMonth !== requestedPaymentMonth) {
        await this.updatePaymentMonthIfOverridden(
          paymentData.paymentId,
          effectivePaymentMonth,
          requestedPaymentMonth
        );
      }
      
      console.log('✅ Auto-allocation completed successfully');
      console.log('📊 Final allocation results:', allocationResults);
      console.log(`🎯 Effective Payment Month: ${effectivePaymentMonth}`);
      
      return {
        success: true,
        allocation: {
          monthlyBreakdown: allocationResults,
          summary: {
            totalAllocated: totalAmount - remainingAmount,
            remainingBalance: remainingAmount,
            monthsCovered: allocationResults.filter(r => r.allocationType === 'debt_settlement').length,
            advancePaymentAmount: advancePayment ? advancePayment.amount : 0,
            allocationMethod: 'FIFO (First In, First Out)',
            oldestMonthSettled: allocationResults.length > 0 ? allocationResults[0].month : null,
            newestMonthSettled: allocationResults.filter(r => r.allocationType === 'debt_settlement').length > 0 ? 
              allocationResults.filter(r => r.allocationType === 'debt_settlement').slice(-1)[0].month : null
          }
        },
        allocationRecord,
        message: `Payment allocated using FIFO method: ${allocationResults.filter(r => r.allocationType === 'debt_settlement').length} months settled${advancePayment ? `, $${advancePayment.amount} advance payment` : ''}`
      };
      
    } catch (error) {
      console.error('❌ Auto-allocation failed:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to auto-allocate payment'
      };
    }
  }

  /**
   * Get student's lease information from the system
   * @param {string} studentId - Student ID
   * @param {string} residence - Residence name
   * @param {string} room - Room number
   * @returns {Object} Lease information
   */
  static async getStudentLeaseInfo(studentId, residence, room) {
    try {
      // This would typically query your applications/leases collection
      // For now, returning mock data - you'll need to implement this based on your data structure
      
      // Example implementation:
      // const application = await Application.findOne({ 
      //   studentId, 
      //   'allocatedRoomDetails.residence': residence,
      //   'allocatedRoom': room,
      //   status: 'approved'
      // });
      
      // Mock data for demonstration
      return {
        startDate: '2025-05-10',
        endDate: '2025-09-30',
        monthlyRent: 180,
        adminFee: 20
      };
      
    } catch (error) {
      console.error('Error getting lease info:', error);
      return null;
    }
  }

  /**
   * Update existing AR transactions based on payment allocation
   * @param {string} studentId - Student ID
   * @param {Object} allocation - Payment allocation result
   * @param {Object} paymentData - Original payment data
   * @returns {Array} Updated transactions
   */
  static async updateARTransactions(studentId, allocation, paymentData) {
    try {
      console.log('🔄 Updating AR transactions for student:', studentId);
      
      const updatedTransactions = [];
      
      // Process each month in the allocation
      for (const [monthKey, monthData] of Object.entries(allocation.monthlyBreakdown)) {
        if (monthData.paymentAllocated > 0) {
          // Find existing AR transaction for this month
          const existingAR = await TransactionEntry.findOne({
            'entries.accountCode': { $regex: `^1100-.*-${monthKey}` },
            'entries.accountType': 'asset',
            'entries.debit': { $gt: 0 }
          });
          
                     if (existingAR) {
             // Update existing AR transaction
             // For existing AR, we need to calculate the current balance
             const currentARBalance = existingAR.entries.find(e => e.accountCode.startsWith('1100-') && e.debit > 0)?.debit || 0;
             const updatedAR = await this.updateARTransaction(
               existingAR._id,
               monthData.paymentAllocated,
               paymentData,
               currentARBalance
             );
             updatedTransactions.push(updatedAR);
           } else {
            // Create new AR transaction for this month
            const newAR = await this.createARTransaction(
              studentId,
              monthKey,
              monthData.remainingObligation, // Pass remainingObligation as amount
              paymentData
            );
            updatedTransactions.push(newAR);
          }
        }
      }
      
      console.log(`✅ Updated ${updatedTransactions.length} AR transactions`);
      return updatedTransactions;
      
    } catch (error) {
      console.error('Error updating AR transactions:', error);
      throw error;
    }
  }

  /**
   * Create new AR transaction for a month
   * @param {string} studentId - Student ID
   * @param {string} monthKey - Month key (YYYY-MM)
   * @param {Object} monthData - Month allocation data
   * @param {Object} paymentData - Payment data
   * @returns {Object} New transaction
   */
  static async createARTransaction(studentId, monthKey, amount, paymentData) {
    try {
      console.log(`🏗️ Creating AR transaction for student ${studentId}, month ${monthKey}, amount $${amount}`);
      
      // Parse month key
      const [year, month] = monthKey.split('-');
      const monthName = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleString('default', { month: 'long' });
      
      // Create AR transaction
      const arTransaction = new TransactionEntry({
        date: new Date(parseInt(year), parseInt(month) - 1, 1),
        description: `Accounts Receivable - ${monthName} ${year}`,
        entries: [
          // Debit AR account (increasing AR)
          {
            accountCode: `1100-${year}-${month}-${studentId}`,
            accountName: `Accounts Receivable - ${monthName} ${year}`,
            accountType: 'asset',
            debit: amount,
            credit: 0,
            description: `Rent due for ${monthName} ${year}`,
            balance: amount
          },
          // Credit Revenue account (increasing revenue)
          {
            accountCode: '4000', // Revenue account
            accountName: 'Rental Revenue',
            accountType: 'revenue',
            debit: 0,
            credit: amount,
            description: `Rent earned for ${monthName} ${year}`,
            balance: -amount
          }
        ],
        totalDebit: amount,
        totalCredit: amount,
        source: 'accrual',
        sourceModel: 'TransactionEntry',
        createdBy: 'system',
        metadata: {
          studentId: studentId,
          monthKey: monthKey,
          year: parseInt(year),
          month: parseInt(month),
          monthName: monthName,
          type: 'rental_accrual',
          amount: amount,
          createdBy: 'system'
        }
      });
      
      await arTransaction.save();
      console.log(`✅ Created AR transaction for ${monthKey}: $${amount}`);
      
      return arTransaction;
      
    } catch (error) {
      console.error(`❌ Error creating AR transaction:`, error);
      throw error;
    }
  }

  /**
   * Create payment allocation record
   * @param {string} paymentId - Payment ID
   * @param {string} studentId - Student ID
   * @param {Object} allocation - Payment allocation result
   * @param {Object} paymentData - Payment data
   * @returns {Object} Allocation record
   */
  static async createPaymentAllocationRecord(paymentId, studentId, allocation, paymentData) {
    try {
      // This would typically create a record in a payment_allocations collection
      // For now, returning the allocation data
      
      const allocationRecord = {
        paymentId,
        studentId,
        allocation,
        paymentData,
        createdAt: new Date(),
        status: 'allocated'
      };
      
      console.log('✅ Created payment allocation record');
      return allocationRecord;
      
    } catch (error) {
      console.error('Error creating allocation record:', error);
      throw error;
    }
  }

  /**
   * Get real-time payment coverage for a student
   * @param {string} studentId - Student ID
   * @param {string} asOfDate - Date to check coverage as of (YYYY-MM-DD)
   * @returns {Object} Payment coverage summary
   */
  static async getStudentPaymentCoverage(studentId, asOfDate = null) {
    try {
      const date = asOfDate ? new Date(asOfDate) : new Date();
      
      // Get all AR transactions for this student
      const arTransactions = await TransactionEntry.find({
        'entries.accountCode': { $regex: `^1100-${studentId}-` },
        'entries.accountType': 'asset',
        'entries.debit': { $gt: 0 }
      });
      
      // Group by month and calculate coverage
      const monthlyCoverage = {};
      let totalAR = 0;
      let totalPaid = 0;
      
      arTransactions.forEach(transaction => {
        const monthKey = transaction.metadata?.month;
        if (monthKey) {
          if (!monthlyCoverage[monthKey]) {
            monthlyCoverage[monthKey] = {
              month: monthKey,
              arBalance: 0,
              payments: [],
              status: 'unpaid'
            };
          }
          
          const arEntry = transaction.entries.find(e => e.debit > 0);
          if (arEntry) {
            monthlyCoverage[monthKey].arBalance += arEntry.debit;
            totalAR += arEntry.debit;
          }
          
          // Add payment information
          if (transaction.metadata?.payments) {
            monthlyCoverage[monthKey].payments.push(...transaction.metadata.payments);
            monthlyCoverage[monthKey].status = 'partially_paid';
          }
          
          // Determine final status
          if (monthlyCoverage[monthKey].arBalance === 0) {
            monthlyCoverage[monthKey].status = 'fully_paid';
            totalPaid += monthlyCoverage[monthKey].payments.reduce((sum, p) => sum + p.amount, 0);
          }
        }
      });
      
      return {
        studentId,
        asOfDate: date,
        monthlyCoverage,
        summary: {
          totalAR,
          totalPaid,
          monthsWithAR: Object.keys(monthlyCoverage).length,
          monthsFullyPaid: Object.values(monthlyCoverage).filter(m => m.status === 'fully_paid').length,
          monthsPartiallyPaid: Object.values(monthlyCoverage).filter(m => m.status === 'partially_paid').length,
          monthsUnpaid: Object.values(monthlyCoverage).filter(m => m.status === 'unpaid').length
        }
      };
      
    } catch (error) {
      console.error('Error getting payment coverage:', error);
      throw error;
    }
  }

  /**
   * Get lease months between start and end dates
   */
  static getLeaseMonths(startDate, endDate) {
    const months = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      months.push({
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1,
        monthName: currentDate.toLocaleString('default', { month: 'long' })
      });
      
      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    return months;
  }
  
  /**
   * Calculate first month proration based on start date
   */
  static calculateFirstMonthProration(startDate, monthlyRent) {
    const daysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
    const daysFromStart = daysInMonth - startDate.getDate() + 1;
    const prorationRatio = daysFromStart / daysInMonth;
    
    return monthlyRent * prorationRatio;
  }
  
  /**
   * Get payment status description
   */
  static getPaymentStatus(isFullyPaid, isPartiallyPaid, remainingObligation) {
    if (isFullyPaid) {
      return '✅ Fully Paid';
    } else if (isPartiallyPaid) {
      return `⚠️ Partially Paid ($${remainingObligation.toFixed(2)} owing)`;
    } else {
      return `❌ Unpaid ($${remainingObligation.toFixed(2)} owing)`;
    }
  }
  
  /**
   * Get month-specific notes
   */
  static getMonthNotes(monthIndex, firstMonthProration, adminFee) {
    if (monthIndex === 0) {
      let notes = `Prorated rent: $${firstMonthProration.toFixed(2)}`;
      if (adminFee > 0) notes += `, Admin fee: $${adminFee.toFixed(2)}`;
      return notes;
    }
    return `Standard monthly rent`;
  }
  
  /**
   * Get payment summary for display
   */
  static getPaymentSummary(allocation) {
    const summary = {
      totalPayment: allocation.totalPayment,
      monthsCovered: allocation.summary.monthsFullyPaid + allocation.summary.monthsPartiallyPaid,
      totalObligation: Object.values(allocation.monthlyBreakdown).reduce((sum, month) => sum + month.monthObligation, 0),
      remainingBalance: Object.values(allocation.monthlyBreakdown).reduce((sum, month) => sum + month.remainingObligation, 0),
      paymentEfficiency: ((allocation.summary.totalAllocated / allocation.totalPayment) * 100).toFixed(1)
    };
    
    return summary;
  }

  /**
   * Get student's AR balances by month from TransactionEntry collection
   * This method retrieves actual AR balances from the accounting system
   * @param {string} studentId - Student ID
   * @returns {Array} Array of AR balance objects by month
   */
  static async getStudentARBalances(studentId) {
    try {
      console.log(`🔍 Getting AR balances for student: ${studentId}`);
      
      // 🆕 NEW: Get ALL transactions for this student to analyze accruals vs payments
      const allStudentTransactions = await TransactionEntry.find({
        'entries.accountCode': { $regex: `^1100-${studentId}` }
      }).sort({ 'entries.date': 1 });
      
      console.log(`📊 Found ${allStudentTransactions.length} total transactions for student ${studentId}`);
      
      // 🆕 NEW: Separate accruals from payments
      const accruals = allStudentTransactions.filter(tx => 
        tx.source === 'rental_accrual' || 
        (tx.source === 'lease_start' && tx.metadata?.proratedRent > 0)
      );
      
      const payments = allStudentTransactions.filter(tx => 
        tx.source === 'payment'
      );
      
      console.log(`📈 Accruals found: ${accruals.length}`);
      console.log(`💰 Payments found: ${payments.length}`);
      
      // 🆕 NEW: Calculate remaining debt for each month
      const monthlyBalances = {};
      
      accruals.forEach(accrual => {
        const accrualDate = new Date(accrual.date);
        const monthKey = `${accrualDate.getFullYear()}-${String(accrualDate.getMonth() + 1).padStart(2, '0')}`;
        
        // Calculate total debt for this month (excluding security deposits)
        let totalDebt = 0;
        accrual.entries.forEach(entry => {
          if (entry.accountCode.startsWith('1100-') && entry.accountType === 'Asset' && entry.debit > 0) {
            // Exclude security deposits - they are liabilities, not AR
            if (!entry.description.toLowerCase().includes('security deposit')) {
              totalDebt += entry.debit;
            }
          }
        });
        
        // Calculate already paid amount for this month
        let paidAmount = 0;
        payments.forEach(payment => {
          if (payment.metadata?.paymentMonth === monthKey) {
            payment.entries.forEach(entry => {
              if (entry.accountCode.startsWith('1100-') && entry.accountType === 'Asset' && entry.credit > 0) {
                paidAmount += entry.credit;
              }
            });
          }
        });
        
        const remainingDebt = Math.max(0, totalDebt - paidAmount);
        
        if (remainingDebt > 0) {
          monthlyBalances[monthKey] = {
            monthKey,
            year: accrualDate.getFullYear(),
            month: accrualDate.getMonth() + 1,
            monthName: accrualDate.toLocaleString('default', { month: 'long' }),
            balance: remainingDebt,
            originalDebt: totalDebt,
            paidAmount: paidAmount,
            transactionId: accrual._id,
            date: accrual.date,
            accountCode: accrual.entries.find(e => e.accountCode.startsWith('1100-'))?.accountCode,
            accountName: accrual.entries.find(e => e.accountCode.startsWith('1100-'))?.accountName,
            source: accrual.source,
            metadata: accrual.metadata
          };
        }
      });
      
      // Convert to array and sort by date (oldest first - FIFO principle)
      const balancesArray = Object.values(monthlyBalances).sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA - dateB;
      });
      
      console.log(`📅 Monthly AR balances for student ${studentId} (FIFO order):`, balancesArray.map(b => ({
        month: b.monthKey,
        balance: b.balance,
        originalDebt: b.originalDebt,
        paidAmount: b.paidAmount,
        date: b.date
      })));
      
      return balancesArray;
      
    } catch (error) {
      console.error(`❌ Error getting AR balances for student ${studentId}:`, error);
      throw error;
    }
  }

  /**
   * Create advance payment transaction for liability account
   */
  static async createAdvancePaymentTransaction(paymentId, studentId, amount, paymentData) {
    try {
      console.log(`💳 Creating advance payment transaction for student ${studentId}, amount: $${amount}`);
      
      const TransactionEntry = require('../models/TransactionEntry');
      
      // Create advance payment transaction
      const advanceTransaction = new TransactionEntry({
        transactionId: `TXN${Date.now()}ADV${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        date: new Date(),
        description: `Advance payment from ${paymentData.paymentId}`,
        reference: paymentId,
        entries: [
          // Credit the Advance Payments liability account (increasing liability)
          {
            accountCode: `2500-${studentId}`,
            accountName: `Advance Payments - Student`,
            accountType: 'Liability',
            debit: 0,
            credit: amount,
            description: `Advance payment for future rent periods`
          },
          // Debit the Cash/Bank account (increasing cash)
          {
            accountCode: '1000', // Cash/Bank account
            accountName: 'Bank Account',
            accountType: 'Asset',
            debit: amount,
            credit: 0,
            description: `Advance payment received from student`
          }
        ],
        totalDebit: amount,
        totalCredit: amount,
        source: 'manual',
        sourceId: null, // No specific source for manual transactions
        sourceModel: 'TransactionEntry',
        residence: paymentData.residence,
        createdBy: 'system@alamait.com',
        status: 'posted',
        metadata: {
          paymentId: paymentId,
          studentId: studentId,
          amount: amount,
          type: 'advance_payment',
          originalPayment: paymentData
        }
      });
      
      await advanceTransaction.save();
      console.log(`✅ Advance payment transaction created: ${advanceTransaction._id}`);
      
      return advanceTransaction;
      
    } catch (error) {
      console.error('❌ Error creating advance payment transaction:', error);
      throw error;
    }
  }

  /**
   * Update existing AR transaction
   * @param {string} transactionId - Transaction ID
   * @param {number} paymentAmount - Amount paid
   * @param {Object} paymentData - Payment data
   * @returns {Object} Updated transaction
   */
  static async updateARTransaction(transactionId, paymentAmount, paymentData, currentBalance) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      // Get the original AR transaction to reference
      const originalTransaction = await TransactionEntry.findById(transactionId).session(session);
      if (!originalTransaction) {
        throw new Error(`Transaction not found: ${transactionId}`);
      }
      
      // Find the AR entry in the original transaction
      const arEntry = originalTransaction.entries.find(e => 
        e.accountCode.startsWith('1100-') && e.debit > 0
      );
      
      if (!arEntry) {
        throw new Error('AR entry not found in transaction');
      }
      
      // Calculate new balance using the current remaining balance
      const newBalance = currentBalance - paymentAmount;
      
      if (newBalance < 0) {
        throw new Error(`Payment allocation exceeds AR balance. Current: $${currentBalance}, Payment: $${paymentAmount}`);
      }
      
      // Create a new payment allocation transaction
      const paymentAllocationTransaction = new TransactionEntry({
        transactionId: `PAY-ALLOC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        date: new Date(),
        description: `Payment allocation: $${paymentAmount.toFixed(2)} from ${paymentData.paymentId}`,
        reference: `AR-${transactionId}`,
        entries: [
          // Credit the AR account (reducing the receivable)
          {
            accountCode: arEntry.accountCode,
            accountName: arEntry.accountName,
            accountType: arEntry.accountType,
            debit: 0,
            credit: paymentAmount,
            description: `Payment allocation for ${paymentData.paymentMonth || 'month'}`
          },
          // Debit the cash/bank account (increasing cash)
          {
            accountCode: '1000', // Cash/Bank account
            accountName: 'Bank Account',
            accountType: 'asset',
            debit: paymentAmount,
            credit: 0,
            description: `Payment received from ${paymentData.paymentId}`
          }
        ],
        totalDebit: paymentAmount,
        totalCredit: paymentAmount,
        source: 'manual', // Use 'manual' instead of 'payment' for test scenarios
        sourceModel: 'TransactionEntry', // Use TransactionEntry as the source model
        // sourceId is optional for manual transactions
        createdBy: 'system',
        metadata: {
          paymentAllocation: {
            originalTransactionId: transactionId,
            paymentId: paymentData.paymentId,
            amount: paymentAmount,
            date: new Date(),
            allocatedBy: 'system',
            studentId: paymentData.studentId
          }
        }
      });
      
      // Save the new payment allocation transaction
      await paymentAllocationTransaction.save({ session });
      
      // Update the original AR transaction to reflect the new balance
      arEntry.debit = newBalance;
      
      // Add payment allocation metadata to original transaction
      if (!originalTransaction.metadata) {
        originalTransaction.metadata = {};
      }
      
      if (!originalTransaction.metadata.paymentAllocations) {
        originalTransaction.metadata.paymentAllocations = [];
      }
      
      originalTransaction.metadata.paymentAllocations.push({
        paymentId: paymentData.paymentId,
        amount: paymentAmount,
        date: new Date(),
        allocatedBy: 'system',
        allocationTransactionId: paymentAllocationTransaction._id
      });
      
      // Save the updated original transaction
      await originalTransaction.save({ session });
      
      await session.commitTransaction();
      session.endSession();
      
      console.log(`✅ Created payment allocation transaction for $${paymentAmount}`);
      console.log(`✅ Updated AR transaction ${transactionId} - new balance: $${newBalance.toFixed(2)}`);
      
      return {
        originalTransaction,
        allocationTransaction: paymentAllocationTransaction,
        newARBalance: newBalance
      };
      
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error('Error updating AR transaction:', error);
      throw error;
    }
  }

  /**
   * Update payment month if it was overridden during allocation
   */
  static async updatePaymentMonthIfOverridden(paymentId, effectivePaymentMonth, originalPaymentMonth) {
    try {
      if (effectivePaymentMonth !== originalPaymentMonth) {
        console.log(`🔄 Updating payment ${paymentId} month from ${originalPaymentMonth} to ${effectivePaymentMonth}`);
        
        const Payment = require('../models/Payment');
        const updatedPayment = await Payment.findByIdAndUpdate(
          paymentId,
          { 
            paymentMonth: effectivePaymentMonth,
            'metadata.monthOverride': {
              original: originalPaymentMonth,
              effective: effectivePaymentMonth,
              reason: 'Auto-corrected to match oldest AR accrual month',
              correctedAt: new Date()
            }
          },
          { new: true }
        );
        
        console.log(`✅ Payment month updated successfully`);
        return updatedPayment;
      }
      
      return null; // No update needed
    } catch (error) {
      console.error('❌ Error updating payment month:', error);
      return null;
    }
  }

  /**
   * Create allocation record
   */
  static async createAllocationRecord(paymentId, studentId, allocationResults, paymentData) {
    try {
      // In a real implementation, you would save this to a dedicated collection
      const allocationRecord = {
        paymentId,
        studentId,
        allocationDate: new Date(),
        allocations: allocationResults,
        totalAmount: allocationResults.reduce((sum, a) => sum + a.amountAllocated, 0),
        paymentData: {
          amount: paymentData.totalAmount,
          date: paymentData.date,
          method: paymentData.method
        },
        createdAt: new Date()
      };
      
      console.log('✅ Created payment allocation record');
      return allocationRecord;
      
    } catch (error) {
      console.error('Error creating allocation record:', error);
      throw error;
    }
  }

  /**
   * Get payment allocation summary for a student
   */
  static async getAllocationSummary(studentId) {
    try {
      const arBalances = await this.getStudentARBalances(studentId);
      
      if (!arBalances) {
        return {
          studentId,
          totalARBalance: 0,
          monthlyBreakdown: [],
          summary: {
            monthsWithBalance: 0,
            totalOwing: 0,
            oldestBalance: null
          }
        };
      }
      
      const totalARBalance = arBalances.reduce((sum, item) => sum + item.balance, 0);
      
      return {
        studentId,
        totalARBalance,
        monthlyBreakdown: arBalances,
        summary: {
          monthsWithBalance: arBalances.length,
          totalOwing: totalARBalance,
          oldestBalance: arBalances.length > 0 ? arBalances[0].transactionDate : null
        }
      };
      
    } catch (error) {
      console.error('Error getting allocation summary:', error);
      throw error;
    }
  }
}

module.exports = PaymentAllocationService;
