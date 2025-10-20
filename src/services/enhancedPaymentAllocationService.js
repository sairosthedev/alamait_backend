const mongoose = require('mongoose');
const TransactionEntry = require('../models/TransactionEntry');
const Payment = require('../models/Payment');
const AdvancePayment = require('../models/AdvancePayment');
const { logTransactionOperation, logSystemOperation } = require('../utils/auditLogger');

class EnhancedPaymentAllocationService {
  /**
   * 🎯 ENHANCED Smart FIFO Payment Allocation with Business Rules
   * 
   * Business Rules:
   * 1. Rent → monthly accrual, must never be over-paid (no double pay for same month)
   * 2. Admin Fee → once-off, settles in the month payment was received
   * 3. Deposit → once-off, settles in the month payment was received
   * 4. Excess rent prepayments → go to Deferred Income, released when accrual is created
   * 
   * @param {Object} paymentData - Payment data including studentId, totalAmount, payments array
   * @returns {Object} Allocation results with monthly breakdown
   */
  static async smartFIFOAllocation(paymentData) {
    try {
      console.log('🚀 ENHANCED SMART FIFO PAYMENT ALLOCATION:', paymentData.paymentId);
      console.log('📋 Payment Data:', JSON.stringify(paymentData, null, 2));
      
      const { studentId, totalAmount, payments } = paymentData;
      
      // 🆕 FIX: Clear any potential caching issues by adding a small delay
      // This ensures we get the latest data from the database
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!studentId || !totalAmount || !payments || !payments.length) {
        throw new Error('Missing required payment data: studentId, totalAmount, or payments array');
      }
      
      console.log(`🎯 Processing payment for student: ${studentId}, total amount: $${totalAmount}`);
      
      // 1. Get current debtor status and once-off charge flags
      const debtor = await this.getDebtorStatus(studentId);
      if (!debtor) {
        throw new Error(`Debtor not found for student: ${studentId}`);
      }
      
      console.log(`📊 Current debtor status:`);
      console.log(`   Admin Fee paid: ${debtor.onceOffCharges?.adminFee?.isPaid || false}`);
      console.log(`   Deposit paid: ${debtor.onceOffCharges?.deposit?.isPaid || false}`);
      console.log(`   Deferred Income: $${debtor.deferredIncome?.totalAmount || 0}`);
      
      // 2. Get detailed outstanding balances by month (FIFO order)
      const outstandingBalances = await this.getDetailedOutstandingBalances(studentId);
      
      if (!outstandingBalances || outstandingBalances.length === 0) {
        console.log('ℹ️ No outstanding balances found for student - treating all payments as advance payments');
        
        // Handle all payments as advance payments when no outstanding balances
        const allocationResults = [];
        let totalAllocated = 0;
        
        // Group payment components by type for efficient allocation
        const paymentByType = {};
        payments.forEach(payment => {
          if (!paymentByType[payment.type]) {
            paymentByType[payment.type] = 0;
          }
          paymentByType[payment.type] += payment.amount;
        });
        
        console.log('📊 Payment breakdown by type:', paymentByType);
        
        // Process each payment type as advance payment
        for (const [paymentType, totalAmount] of Object.entries(paymentByType)) {
          console.log(`💳 Processing ${paymentType} payment as advance: $${totalAmount}`);
          
          const advanceResult = await this.handleAdvancePayment(
            paymentData.paymentId, studentId, totalAmount, paymentData, paymentType
          );
          allocationResults.push(advanceResult);
          totalAllocated += totalAmount;
        }
        
        // Create allocation record
        const allocationRecord = await this.createAllocationRecord(
          paymentData.paymentId,
          studentId,
          allocationResults,
          paymentData
        );
        
        console.log('✅ All payments processed as advance payments');
        
        return {
          success: true,
          allocation: {
            monthlyBreakdown: allocationResults,
            summary: {
              totalAllocated: totalAllocated,
              remainingBalance: 0,
              monthsCovered: 0,
              advancePaymentAmount: totalAllocated,
              allocationMethod: 'Advance Payment (No Outstanding Balances)',
              oldestMonthSettled: null,
              newestMonthSettled: null
            }
          },
          allocationRecord,
          message: `All payments processed as advance payments: $${totalAllocated} total`
        };
      }
      
      console.log(`📊 Found ${outstandingBalances.length} months with outstanding balances`);
      
      // 3. Process payments according to business rules
      const allocationResults = [];
      let totalAllocated = 0;
      
      // Group payment components by type for efficient allocation
      const paymentByType = {};
      payments.forEach(payment => {
        if (!paymentByType[payment.type]) {
          paymentByType[payment.type] = 0;
        }
        paymentByType[payment.type] += payment.amount;
      });
      
      console.log('📊 Payment breakdown by type:', paymentByType);
      
      // 🆕 FIX: Auto-determine monthAllocated for admin fees and deposits if missing
      const enhancedPayments = payments.map(payment => {
        if ((payment.type === 'admin' || payment.type === 'deposit') && !payment.monthAllocated) {
          // Find the month that has this charge outstanding
          const monthWithCharge = outstandingBalances.find(month => {
            if (payment.type === 'admin') return month.adminFee.outstanding > 0;
            if (payment.type === 'deposit') return month.deposit.outstanding > 0;
            return false;
          });
          
          if (monthWithCharge) {
            console.log(`🔧 Auto-assigning ${payment.type} payment to month: ${monthWithCharge.monthKey}`);
            return { ...payment, monthAllocated: monthWithCharge.monthKey };
          }
        }
        return payment;
      });
      
      console.log('📊 Enhanced payments with auto-assigned months:', enhancedPayments);
      
      // Process each payment type according to business rules
      for (const [paymentType, totalAmount] of Object.entries(paymentByType)) {
        console.log(`💳 Processing ${paymentType} payment: $${totalAmount}`);
        
        let remainingAmount = totalAmount;
        
        // 🆕 FIX: Get the specific payment entries for this type to access monthAllocated
        const paymentsOfType = enhancedPayments.filter(p => p.type === paymentType);
        
        // 🆕 BUSINESS RULE: Handle once-off charges (Admin Fee, Deposit)
        if (paymentType === 'admin' || paymentType === 'deposit') {
          // 🆕 FIX: Check actual outstanding balances instead of debtor flags
          const totalOutstanding = outstandingBalances.reduce((total, month) => {
            if (paymentType === 'admin') {
              return total + month.adminFee.outstanding;
            } else if (paymentType === 'deposit') {
              return total + month.deposit.outstanding;
            }
            return total;
          }, 0);
          
          console.log(`📊 Total outstanding ${paymentType}: $${totalOutstanding}`);
          
          // 🆕 FIX: Check if there are any charges owed (even if not yet paid)
          const totalCharged = outstandingBalances.reduce((total, month) => {
            if (paymentType === 'admin') {
              return total + month.adminFee.owed;
            } else if (paymentType === 'deposit') {
              return total + month.deposit.owed;
            }
            return total;
          }, 0);
          
          console.log(`📊 Total charged ${paymentType}: $${totalCharged}`);
          
          // If no outstanding balance but there are charges, it means they've been fully paid
          if (totalOutstanding === 0 && totalCharged > 0) {
            console.log(`✅ ${paymentType} charges have been fully paid. Treating extra as advance payment.`);
            // If deposit already paid and extra received, post directly to 2020 (increase liability), no deferred income
            if (paymentType === 'deposit' && remainingAmount > 0) {
              const advanceResult = await this.handleAdvancePayment(
                paymentData.paymentId, studentId, remainingAmount, paymentData, paymentType
              );
              allocationResults.push(advanceResult);
              totalAllocated += remainingAmount;
            }
            // If admin already paid, ignore extra (no advance for once-off income)
            remainingAmount = 0;
            continue; // Skip to next payment type
          }
          
          // If no charges at all, treat as advance payment
          if (totalOutstanding === 0 && totalCharged === 0) {
            console.log(`⚠️ No ${paymentType} charges found. Treating as advance payment.`);
            // If deposit already paid and extra received, post directly to 2020 (increase liability), no deferred income
            if (paymentType === 'deposit' && remainingAmount > 0) {
              const advanceResult = await this.handleAdvancePayment(
                paymentData.paymentId, studentId, remainingAmount, paymentData, paymentType
              );
              allocationResults.push(advanceResult);
              totalAllocated += remainingAmount;
            }
            // If admin already paid, ignore extra (no advance for once-off income)
            remainingAmount = 0;
            continue; // Skip to next payment type
          }
          
          // 🆕 FIX: Admin fees settle in the month they were received, deposits use lease start month
          let monthWithCharge = null;
          
          if (paymentType === 'admin') {
            // Admin fees settle in the month they were received (payment month)
            const paymentDate = new Date(paymentData.date);
            const paymentMonthKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
            
            // Find the payment month for admin fee settlement
            monthWithCharge = outstandingBalances.find(month => month.monthKey === paymentMonthKey);
            
            if (!monthWithCharge) {
              // If no actual month exists for admin fee settlement, treat as advance admin payment
              console.log(`🎯 No actual month found for admin fee settlement in ${paymentMonthKey}. Treating as advance admin payment.`);
              const advanceResult = await this.handleAdvancePayment(
                paymentData.paymentId, studentId, remainingAmount, paymentData, 'advance_admin'
              );
              allocationResults.push(advanceResult);
              totalAllocated += remainingAmount;
              remainingAmount = 0;
              continue; // Skip to next payment type
            }
            
            console.log(`🎯 Admin fee payment will settle in payment month: ${monthWithCharge.monthKey}`);
          } else if (paymentType === 'deposit') {
            // Deposits settle in the month they were received (payment month)
            const paymentDate = new Date(paymentData.date);
            const paymentMonthKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
            
            // Find the payment month for deposit settlement
            monthWithCharge = outstandingBalances.find(month => month.monthKey === paymentMonthKey);
            
            if (!monthWithCharge) {
              // If no actual month exists for deposit settlement, treat as advance payment
              console.log(`🎯 No actual month found for deposit settlement in ${paymentMonthKey}. Treating as advance payment.`);
              const advanceResult = await this.handleAdvancePayment(
                paymentData.paymentId, studentId, remainingAmount, paymentData, paymentType
              );
              allocationResults.push(advanceResult);
              totalAllocated += remainingAmount;
              remainingAmount = 0;
              continue; // Skip to next payment type
            }
            
            console.log(`🎯 Deposit payment will settle in payment month: ${monthWithCharge.monthKey}`);
          } else {
            // For rent payments, use monthAllocated if specified, otherwise find the month with charge
            const paymentWithMonth = paymentsOfType.find(p => p.monthAllocated);
            if (paymentWithMonth && paymentWithMonth.monthAllocated) {
              monthWithCharge = outstandingBalances.find(month => month.monthKey === paymentWithMonth.monthAllocated);
              console.log(`🎯 Using specified monthAllocated: ${paymentWithMonth.monthAllocated} for ${paymentType}`);
            }
            
            // Fallback: find the month that has this charge outstanding
            if (!monthWithCharge) {
              monthWithCharge = outstandingBalances.find(month => {
                if (paymentType === 'rent') return month.rent.outstanding > 0;
                return false;
              });
              console.log(`🎯 Using fallback month: ${monthWithCharge?.monthKey} for ${paymentType}`);
            }
          }
          
          if (monthWithCharge) {
            const amountToAllocate = Math.min(remainingAmount, 
              paymentType === 'admin' ? monthWithCharge.adminFee.outstanding : monthWithCharge.deposit.outstanding
            );
            
            if (amountToAllocate > 0) {
              console.log(`🎯 Allocating $${amountToAllocate} ${paymentType} to ${monthWithCharge.monthKey}`);
              
              // Create payment allocation transaction with proper double-entry accounting
              const paymentTransaction = await this.createPaymentAllocationTransaction(
                paymentData.paymentId,
                studentId,
                amountToAllocate,
                { ...paymentData, paymentType, studentName: paymentData.studentName || 'Student' },
                paymentType,
                monthWithCharge.monthKey,
                monthWithCharge.transactionId
              );
              
              // Update AR transaction status
              await this.updateARTransaction(
                monthWithCharge.transactionId,
                amountToAllocate,
                { ...paymentData, paymentType, monthKey: monthWithCharge.monthKey },
                paymentType === 'admin' ? monthWithCharge.adminFee.outstanding : monthWithCharge.deposit.outstanding
              );
              
              // Update debtor once-off charge flags
              await this.updateDebtorOnceOffCharge(debtor._id, paymentType, amountToAllocate, paymentData.paymentId);
              
              allocationResults.push({
                month: monthWithCharge.monthKey,
                monthName: monthWithCharge.monthKey,
                year: monthWithCharge.year,
                paymentType: paymentType,
                amountAllocated: amountToAllocate,
                originalOutstanding: paymentType === 'admin' ? monthWithCharge.adminFee.outstanding : monthWithCharge.deposit.outstanding,
                newOutstanding: 0, // Once-off charges are fully settled
                allocationType: `${paymentType}_settlement`,
                transactionId: monthWithCharge.transactionId
              });
              
              // Update month outstanding balance
              if (paymentType === 'admin') {
                monthWithCharge.adminFee.outstanding = 0;
                monthWithCharge.adminFee.paid += amountToAllocate;
              } else {
                monthWithCharge.deposit.outstanding = 0;
                monthWithCharge.deposit.paid += amountToAllocate;
              }
              
              remainingAmount -= amountToAllocate;
              totalAllocated += amountToAllocate;
              
              console.log(`✅ Allocated $${amountToAllocate} ${paymentType} to ${monthWithCharge.monthKey}, remaining: $${remainingAmount}`);
            }
          } else {
            // 🛡️ Fallback: For admin and deposit, always use the first month as monthSettled
            if (paymentType === 'admin' || paymentType === 'deposit') {
              // Use the first month in outstanding balances as monthSettled
              const firstMonth = outstandingBalances.length > 0 ? outstandingBalances[0] : null;
              
              if (firstMonth && remainingAmount > 0) {
                console.log(`🎯 Fallback allocating $${remainingAmount} ${paymentType} to first month ${firstMonth.monthKey}`);
                
                // Create payment allocation transaction with proper double-entry accounting
                const paymentTransaction = await this.createPaymentAllocationTransaction(
                  paymentData.paymentId,
                  studentId,
                  remainingAmount,
                  { ...paymentData, paymentType, studentName: paymentData.studentName || 'Student' },
                  paymentType,
                  firstMonth.monthKey, // Always use first month for admin/deposit
                  firstMonth.transactionId
                );
                
                // Update AR transaction status
                await this.updateARTransaction(
                  firstMonth.transactionId,
                  remainingAmount,
                  { ...paymentData, paymentType, monthKey: firstMonth.monthKey },
                  remainingAmount
                );
                
                // Update debtor once-off charge flags
                await this.updateDebtorOnceOffCharge(debtor._id, paymentType, remainingAmount, paymentData.paymentId);
                
                allocationResults.push({
                  month: firstMonth.monthKey,
                  monthName: firstMonth.monthName,
                  year: firstMonth.year,
                  paymentType,
                  amountAllocated: remainingAmount,
                  originalOutstanding: remainingAmount,
                  newOutstanding: 0,
                  allocationType: `${paymentType}_settlement`,
                  transactionId: firstMonth.transactionId
                });
                
                totalAllocated += remainingAmount;
                remainingAmount = 0;
                
                console.log(`✅ Fallback allocated $${remainingAmount} ${paymentType} to ${firstMonth.monthKey}`);
              }
            } else {
              // For rent payments, try lease_start accrual fallback
              try {
                const leaseStartAccrual = await TransactionEntry.findOne({
                  source: 'rental_accrual',
                  'metadata.type': 'lease_start',
                  'metadata.studentId': studentId,
                  'entries.accountCode': { $regex: `^1100-${studentId}` }
                }).sort({ date: 1 });
                if (leaseStartAccrual && remainingAmount > 0) {
                  const lsDate = new Date(leaseStartAccrual.date);
                  const lsMonthKey = `${lsDate.getFullYear()}-${String(lsDate.getMonth() + 1).padStart(2, '0')}`;
                  console.log(`🎯 Fallback allocating $${remainingAmount} ${paymentType} to lease_start month ${lsMonthKey}`);
                  // Create payment allocation transaction with proper double-entry accounting
                  const paymentTransaction = await this.createPaymentAllocationTransaction(
                    paymentData.paymentId,
                    studentId,
                    remainingAmount,
                    { ...paymentData, paymentType, studentName: paymentData.studentName || 'Student' },
                    paymentType,
                    lsMonthKey,
                    leaseStartAccrual._id
                  );
                  
                  // Update AR transaction status
                  await this.updateARTransaction(
                    leaseStartAccrual._id,
                    remainingAmount,
                    { ...paymentData, paymentType, monthKey: lsMonthKey },
                    remainingAmount
                  );
                  allocationResults.push({
                    month: lsMonthKey,
                    monthName: lsDate.toLocaleString('default', { month: 'long' }),
                    year: lsDate.getFullYear(),
                    paymentType,
                    amountAllocated: remainingAmount,
                    originalOutstanding: remainingAmount,
                    newOutstanding: 0,
                    allocationType: `${paymentType}_settlement`,
                    transactionId: leaseStartAccrual._id
                  });
                  totalAllocated += remainingAmount;
                  remainingAmount = 0;
                }
              } catch (e) {
                console.log('⚠️ Fallback settlement for rent failed:', e.message);
              }
            }
            
            // Do NOT create advance for once-off charges
            if (remainingAmount > 0) {
              console.log(`ℹ️ ${paymentType} once-off has no outstanding month. Ignoring extra $${remainingAmount} (not deferred).`);
              remainingAmount = 0;
            }
          }
          
          continue; // Skip to next payment type
        }
        
        // 🆕 BUSINESS RULE: Handle rent payments (monthly accruals)
        if (paymentType === 'rent') {
          console.log(`🏠 Processing rent payment: $${remainingAmount}`);
          
          // Allocate rent to oldest outstanding months first (FIFO)
          for (const month of outstandingBalances) {
            if (remainingAmount <= 0) break;
            
            // Skip months that already have full rent paid
            if (month.rent.outstanding <= 0) {
              console.log(`ℹ️ No outstanding rent for ${month.monthKey}, moving to next month`);
              continue;
            }
            
            // Skip virtual months (they don't have actual AR transactions to allocate to)
            if (month.isVirtualMonth || !month.transactionId) {
              console.log(`ℹ️ Skipping virtual month ${month.monthKey} (no actual AR transaction), moving to next month`);
              continue;
            }
            
            const amountToAllocate = Math.min(remainingAmount, month.rent.outstanding);
            
            if (amountToAllocate > 0) {
              console.log(`🎯 Allocating $${amountToAllocate} rent to ${month.monthKey}`);
              
              // Create payment allocation transaction with proper double-entry accounting
              const paymentTransaction = await this.createPaymentAllocationTransaction(
                paymentData.paymentId,
                studentId,
                amountToAllocate,
                { ...paymentData, paymentType: 'rent', studentName: paymentData.studentName || 'Student' },
                'rent',
                month.monthKey,
                month.transactionId
              );
              
              // Update AR transaction status
              await this.updateARTransaction(
                month.transactionId,
                amountToAllocate,
                { ...paymentData, paymentType: 'rent', monthKey: month.monthKey },
                month.rent.outstanding
              );
              
              // Determine if this is an advance payment (future month) or current settlement
              const paymentDate = new Date(paymentData.date);
              const allocationMonth = new Date(month.year, month.month - 1, 1); // month is 1-based
              const isAdvancePayment = allocationMonth > paymentDate;
              
              allocationResults.push({
                month: month.monthKey,
                monthName: month.monthName,
                year: month.year,
                paymentType: 'rent',
                amountAllocated: amountToAllocate,
                originalOutstanding: month.rent.outstanding,
                newOutstanding: month.rent.outstanding - amountToAllocate,
                allocationType: isAdvancePayment ? 'advance_payment' : 'rent_settlement',
                transactionId: month.transactionId
              });
              
              // Update month outstanding balance
              month.rent.outstanding = Math.max(0, month.rent.outstanding - amountToAllocate);
              month.rent.paid += amountToAllocate;
              month.totalOutstanding = month.rent.outstanding + month.adminFee.outstanding + month.deposit.outstanding;
              
              remainingAmount -= amountToAllocate;
              totalAllocated += amountToAllocate;
              
              console.log(`✅ Allocated $${amountToAllocate} rent to ${month.monthKey}, remaining: $${remainingAmount}`);
            }
          }
          
          // 🆕 BUSINESS RULE: Handle remaining rent as advance payment to Deferred Income
          if (remainingAmount > 0) {
            console.log(`💳 Remaining $${remainingAmount} rent will be treated as advance payment to Deferred Income`);
            const advanceResult = await this.handleAdvancePayment(
              paymentData.paymentId, studentId, remainingAmount, paymentData, 'rent'
            );
            allocationResults.push(advanceResult);
            totalAllocated += remainingAmount;
          }
        }
      }
      
      // 4. Create allocation record
      const allocationRecord = await this.createAllocationRecord(
        paymentData.paymentId,
        studentId,
        allocationResults,
        paymentData
      );
      
      console.log('✅ Enhanced Smart FIFO allocation completed successfully');
      console.log('📊 Final allocation results:', allocationResults);
      
      return {
        success: true,
        allocation: {
          monthlyBreakdown: allocationResults,
          summary: {
            totalAllocated: totalAllocated,
            remainingBalance: totalAmount - totalAllocated,
            monthsCovered: allocationResults.filter(r => r.allocationType !== 'advance_payment').length,
            advancePaymentAmount: allocationResults.filter(r => r.allocationType === 'advance_payment').reduce((sum, r) => sum + r.amountAllocated, 0),
            allocationMethod: 'Enhanced Smart FIFO with Business Rules',
            oldestMonthSettled: allocationResults.filter(r => r.allocationType !== 'advance_payment').length > 0 ? 
              allocationResults.filter(r => r.allocationType !== 'advance_payment')[0].month : null,
            newestMonthSettled: allocationResults.filter(r => r.allocationType !== 'advance_payment').length > 0 ? 
              allocationResults.filter(r => r.allocationType !== 'advance_payment').slice(-1)[0].month : null
          }
        },
        allocationRecord,
        message: `Payment allocated using Enhanced Smart FIFO method: ${allocationResults.filter(r => r.allocationType !== 'advance_payment').length} months settled, $${allocationResults.filter(r => r.allocationType === 'advance_payment').reduce((sum, r) => sum + r.amountAllocated, 0)} advance payment`
      };
      
    } catch (error) {
      console.error('❌ Enhanced Smart FIFO allocation failed:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to allocate payment using Enhanced Smart FIFO method'
      };
    }
  }

  /**
   * 🔍 Get detailed outstanding balances by month and payment type
   * Tracks rent, admin fees, and deposits separately for proper FIFO allocation
   * @param {string} studentId - Student ID
   * @returns {Array} Array of outstanding balance objects sorted by date (oldest first)
   */
  static async getDetailedOutstandingBalances(studentId) {
    try {
      console.log(`🔍 Getting detailed outstanding balances for student: ${studentId}`);
      
      // Get all transactions for this specific student
      const studentIdString = String(studentId);
      // Resolve debtor to get exact AR account code
      const Debtor = require('../models/Debtor');
      const debtorDoc = await Debtor.findOne({ user: studentIdString }).select('accountCode');
      const arAccountCode = debtorDoc?.accountCode || `1100-${studentIdString}`;
      
      // 🆕 FIX: Force fresh data by using lean() and ensuring we get the latest transactions
      const allStudentTransactions = await TransactionEntry.find({
        $or: [
          { 'entries.accountCode': arAccountCode },
          { 'metadata.studentId': studentIdString },
          { 'sourceId': studentIdString }
        ]
      }).lean().sort({ date: 1 });

      console.log(`📊 Found ${allStudentTransactions.length} total transactions for student ${studentId}`);
      
      // If no transactions found, return empty array
      if (allStudentTransactions.length === 0) {
        console.log(`ℹ️ No transactions found for student ${studentId}, returning empty array`);
        return [];
      }
      
      // Separate different types of transactions
      const accruals = allStudentTransactions.filter(tx => {
        // For lease start transactions, also check if they have the correct account code
        if (tx.metadata?.type === 'lease_start' || tx.source === 'lease_start') {
          // Check if any entry has the correct student account code
          const hasStudentAccount = tx.entries.some(entry => 
            entry.accountCode === `1100-${studentIdString}`
          );
          if (hasStudentAccount) {
            return true;
          }
        }
        
        // Include rental accruals (both lease start and monthly) regardless of sourceId
        if (tx.source === 'rental_accrual') {
          return true;
        }
        
        // 🆕 FIX: Also check for accruals by looking for AR debit entries
        const hasARDebit = tx.entries && tx.entries.some(entry => 
          entry.accountCode === arAccountCode && 
          entry.accountType === 'Asset' && 
          entry.debit > 0
        );
        
        if (hasARDebit) {
          console.log(`🔍 Found AR debit transaction: ${tx.transactionId} - ${tx.description}`);
          return true;
        }
        
        return false;
      });
      
      // 🆕 Include payment and allocation transactions linked by studentId, sourceId, or AR account credit
      const payments = allStudentTransactions.filter(tx => {
        const isAllocation = tx.metadata?.allocationType === 'payment_allocation';
        const isPayment = tx.source === 'payment';
        const matchesStudent = tx.metadata?.studentId?.toString() === studentIdString || (tx.sourceId && tx.sourceId.toString() === studentIdString);
        const touchesAR = Array.isArray(tx.entries) && tx.entries.some(e => e.accountCode === arAccountCode && e.accountType === 'Asset' && e.credit > 0);
        return isAllocation || (isPayment && (matchesStudent || touchesAR));
      });
      
      // 🆕 Include manual transactions (negotiations, reversals, etc.) that affect AR
      const manualAdjustments = allStudentTransactions.filter(tx => {
        const isManual = tx.source === 'manual';
        const touchesAR = Array.isArray(tx.entries) && tx.entries.some(e => e.accountCode === arAccountCode && e.accountType === 'Asset');
        const matchesStudent = tx.metadata?.studentId?.toString() === studentIdString;
        return isManual && (touchesAR || matchesStudent);
      });
      
      console.log(`📊 Found ${accruals.length} accrual transactions, ${payments.length} payment transactions, and ${manualAdjustments.length} manual adjustments`);
      
      // Debug: Log the accrual transactions found
      console.log(`🔍 Found ${accruals.length} accrual transactions:`);
      accruals.forEach((accrual, index) => {
        console.log(`📋 Accrual ${index + 1}:`);
        console.log(`   ID: ${accrual._id}`);
        console.log(`   Date: ${accrual.date}`);
        console.log(`   Source: ${accrual.source}`);
        console.log(`   Type: ${accrual.metadata?.type}`);
        console.log(`   Description: ${accrual.description}`);
        
        if (accrual.metadata?.type === 'lease_start') {
          console.log(`  ✅ LEASE START TRANSACTION: ${accrual._id}`);
          accrual.entries.forEach((entry, entryIndex) => {
            console.log(`    Entry ${entryIndex + 1}: ${entry.accountCode} ${entry.accountType} ${entry.debit}/${entry.credit} - ${entry.description}`);
          });
        }
      });
      
      // Track outstanding balances by month and type
      const monthlyOutstanding = {};
      
      // Process accruals to build debt structure
      accruals.forEach(accrual => {
        // Prefer explicit metadata.month if present (YYYY-MM), fallback to date
        const monthKey = accrual.metadata?.month || (() => {
          const d = new Date(accrual.date);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        })();
        const [yearStr, monStr] = monthKey.split('-');
        const accrualDate = new Date(`${monthKey}-01T00:00:00.000Z`);
        
        if (!monthlyOutstanding[monthKey]) {
          monthlyOutstanding[monthKey] = {
            monthKey,
            year: Number(yearStr) || accrualDate.getFullYear(),
            month: Number(monStr) || (accrualDate.getMonth() + 1),
            monthName: accrualDate.toLocaleString('default', { month: 'long' }),
            date: accrualDate,
            rent: { owed: 0, paid: 0, outstanding: 0 },
            adminFee: { owed: 0, paid: 0, outstanding: 0 },
            deposit: { owed: 0, paid: 0, outstanding: 0 },
            totalOutstanding: 0,
            transactionId: accrual._id,
            source: accrual.source,
            metadata: accrual.metadata
          };
          console.log(`📅 Created monthly outstanding for ${monthKey} with transaction ID: ${accrual._id}`);
        } else {
          console.log(`📅 Updating existing monthly outstanding for ${monthKey} (current transaction: ${monthlyOutstanding[monthKey].transactionId}, new transaction: ${accrual._id})`);
        }
        
        // Categorize the debt by type
        accrual.entries.forEach(entry => {
          if (entry.accountCode.startsWith('1100-') && entry.accountType === 'Asset' && entry.debit > 0) {
            const description = (entry.description || '').toLowerCase();
            
            if (description.includes('admin fee') || description.includes('administrative')) {
              monthlyOutstanding[monthKey].adminFee.owed += entry.debit;
            } else if (description.includes('security deposit') || description.includes('deposit')) {
              monthlyOutstanding[monthKey].deposit.owed += entry.debit;
            } else {
              // Default to rent
              monthlyOutstanding[monthKey].rent.owed += entry.debit;
            }
          }
        });
        
        // 🆕 FIX: For lease start transactions, we need to break down the AR debit into components
        // The AR debit entry contains the total amount owed, but we need to categorize it
        if (accrual.metadata?.type === 'lease_start') {
          console.log(`🔍 Processing lease start transaction breakdown: ${accrual._id}`);
          
          // Find the AR debit entry to get the total amount
          const arEntry = accrual.entries.find(entry => 
            entry.accountCode.startsWith('1100-') && entry.accountType === 'Asset' && entry.debit > 0
          );
          
          if (arEntry) {
            const totalAmount = arEntry.debit;
            console.log(`  → Total AR debit amount: $${totalAmount}`);
            
            // Reset the amounts since we'll recalculate them properly
            monthlyOutstanding[monthKey].rent.owed = 0;
            monthlyOutstanding[monthKey].adminFee.owed = 0;
            monthlyOutstanding[monthKey].deposit.owed = 0;
            
            // Now categorize based on the income/liability entries
            accrual.entries.forEach(entry => {
              const description = (entry.description || '').toLowerCase();
              
              // Admin fee entry (account 4002)
              if (entry.accountCode === '4002' && entry.accountType === 'Income' && entry.credit > 0) {
                if (description.includes('admin fee') || description.includes('administrative')) {
                  monthlyOutstanding[monthKey].adminFee.owed += entry.credit;
                  console.log(`  → Found admin fee in lease start: $${entry.credit}`);
                }
              }
              
              // Deposit entry (account 2020)
              if (entry.accountCode === '2020' && entry.accountType === 'Liability' && entry.credit > 0) {
                if (description.includes('security deposit') || description.includes('deposit')) {
                  monthlyOutstanding[monthKey].deposit.owed += entry.credit;
                  console.log(`  → Found deposit in lease start: $${entry.credit}`);
                }
              }
              
              // Rent entry (account 4001) - Income entry creates the charge
              if (entry.accountCode === '4001' && entry.accountType === 'Income' && entry.credit > 0) {
                if (description.includes('rental income') || description.includes('prorated')) {
                  monthlyOutstanding[monthKey].rent.owed += entry.credit;
                  console.log(`  → Found prorated rent in lease start: $${entry.credit}`);
                }
              }
            });
          }
        }
      });
      
             // 🆕 FIXED: Only work with actual accruals that exist for this specific student
       // Do NOT create virtual months as they don't have real AR transactions to allocate to
       console.log(`📊 Working with ${Object.keys(monthlyOutstanding).length} actual accrual months for student ${studentId}`);
      
      // 🆕 Process payments: subtract by monthSettled; fallback to FIFO if missing
      payments.forEach(payment => {
        // Look for monthSettled in metadata for payment allocation transactions
        const monthSettled = payment.metadata?.monthSettled;
        const paymentType = payment.metadata?.paymentType;
        const arEntry = Array.isArray(payment.entries) && payment.entries.find(e => e.accountCode === arAccountCode && e.accountType === 'Asset' && e.credit > 0);
        const amount = arEntry?.credit || 0;
        if (amount <= 0) return;
        
        if (monthSettled && monthlyOutstanding[monthSettled]) {
          console.log(`💰 Applying payment to ${monthSettled}: $${amount} (${paymentType})`);
          if (paymentType === 'admin') {
            monthlyOutstanding[monthSettled].adminFee.paid += amount;
          } else if (paymentType === 'deposit') {
            monthlyOutstanding[monthSettled].deposit.paid += amount;
          } else if (paymentType === 'rent') {
            monthlyOutstanding[monthSettled].rent.paid += amount;
          } else {
            // Fallback by description hint
            const desc = (arEntry?.description || '').toLowerCase();
            if (desc.includes('admin')) monthlyOutstanding[monthSettled].adminFee.paid += amount;
            else if (desc.includes('deposit')) monthlyOutstanding[monthSettled].deposit.paid += amount;
            else monthlyOutstanding[monthSettled].rent.paid += amount;
          }
          return;
        }

        // FIFO fallback: apply to oldest months with outstanding
        let remaining = amount;
        const ordered = Object.keys(monthlyOutstanding).sort();
        for (const mk of ordered) {
          if (remaining <= 0) break;
          const b = monthlyOutstanding[mk];
          const owedRent = Math.max(0, b.rent.owed - b.rent.paid);
          const owedAdmin = Math.max(0, b.adminFee.owed - b.adminFee.paid);
          const owedDep = Math.max(0, b.deposit.owed - b.deposit.paid);
          let need = owedRent + owedAdmin + owedDep;
          if (need <= 0) continue;
          const take = Math.min(remaining, need);
          let toApply = take;
          const takeRent = Math.min(toApply, owedRent); b.rent.paid += takeRent; toApply -= takeRent;
          const takeAdmin = Math.min(toApply, owedAdmin); b.adminFee.paid += takeAdmin; toApply -= takeAdmin;
          const takeDep = Math.min(toApply, owedDep); b.deposit.paid += takeDep; toApply -= takeDep;
          remaining -= take;
        }
      });
      
      // 🆕 Process manual adjustments (negotiations, reversals, etc.)
      manualAdjustments.forEach(adjustment => {
        console.log(`🔧 Processing manual adjustment: ${adjustment.transactionId}`);
        console.log(`   Type: ${adjustment.metadata?.type || 'unknown'}`);
        console.log(`   Description: ${adjustment.description}`);
        
        // Determine which month this adjustment applies to
        let monthKey;
        if (adjustment.metadata?.accrualMonth && adjustment.metadata?.accrualYear) {
          monthKey = `${adjustment.metadata.accrualYear}-${String(adjustment.metadata.accrualMonth).padStart(2, '0')}`;
        } else if (adjustment.metadata?.monthSettled) {
          monthKey = adjustment.metadata.monthSettled;
        } else if (adjustment.metadata?.month) {
          monthKey = adjustment.metadata.month;
        } else {
          // For security deposit reversals, try to find the original transaction
          if (adjustment.metadata?.type === 'security_deposit_reversal' && adjustment.metadata?.originalTransactionId) {
            const originalTransaction = allStudentTransactions.find(t => t.transactionId === adjustment.metadata.originalTransactionId);
            if (originalTransaction && originalTransaction.metadata?.accrualMonth && originalTransaction.metadata?.accrualYear) {
              monthKey = `${originalTransaction.metadata.accrualYear}-${String(originalTransaction.metadata.accrualMonth).padStart(2, '0')}`;
            }
          }
          
          // Fallback to transaction date
          if (!monthKey) {
            const d = new Date(adjustment.date);
            monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          }
        }
        
        if (!monthKey || !monthlyOutstanding[monthKey]) {
          console.log(`   ⚠️ No matching month found for adjustment: ${monthKey}`);
          return;
        }
        
        console.log(`   📅 Applying to month: ${monthKey}`);
        
        // Process AR entries in the adjustment
        adjustment.entries.forEach(entry => {
          if (entry.accountCode === arAccountCode && entry.accountType === 'Asset') {
            const amount = entry.credit || 0;
            const description = (entry.description || '').toLowerCase();
            
            console.log(`   💰 AR adjustment: ${entry.debit > 0 ? 'debit' : 'credit'} $${amount} - ${entry.description}`);
            
            if (adjustment.metadata?.type === 'negotiated_payment_adjustment' || adjustment.metadata?.transactionType === 'negotiated_payment_adjustment') {
              // Negotiated payment reduces rent owed
              monthlyOutstanding[monthKey].rent.owed = Math.max(0, monthlyOutstanding[monthKey].rent.owed - amount);
              console.log(`   📉 Negotiated payment: Reduced rent owed by $${amount}`);
            } else if (adjustment.metadata?.type === 'security_deposit_reversal') {
              // Security deposit reversal reduces deposit owed
              monthlyOutstanding[monthKey].deposit.owed = Math.max(0, monthlyOutstanding[monthKey].deposit.owed - amount);
              console.log(`   📉 Security deposit reversal: Reduced deposit owed by $${amount}`);
            } else {
              // Other manual adjustments
              if (description.includes('admin')) {
                monthlyOutstanding[monthKey].adminFee.owed = Math.max(0, monthlyOutstanding[monthKey].adminFee.owed - amount);
              } else if (description.includes('deposit')) {
                monthlyOutstanding[monthKey].deposit.owed = Math.max(0, monthlyOutstanding[monthKey].deposit.owed - amount);
              } else {
                monthlyOutstanding[monthKey].rent.owed = Math.max(0, monthlyOutstanding[monthKey].rent.owed - amount);
              }
            }
          }
        });
      });
      
      // Calculate outstanding amounts and convert to array
      const outstandingArray = Object.values(monthlyOutstanding).map(month => {
        // Calculate outstanding for each type
        month.rent.outstanding = Math.max(0, month.rent.owed - month.rent.paid);
        month.adminFee.outstanding = Math.max(0, month.adminFee.owed - month.adminFee.paid);
        month.deposit.outstanding = Math.max(0, month.deposit.owed - month.deposit.paid);
        
        // Calculate total outstanding for this month
        month.totalOutstanding = month.rent.outstanding + month.adminFee.outstanding + month.deposit.outstanding;
        
        // 🆕 FIX: Mark months as fully settled if they have no outstanding amounts
        month.fullySettled = month.totalOutstanding === 0;
        
        return month;
      }).filter(month => month.totalOutstanding > 0) // Only show months with outstanding balances
        .sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort by date (oldest first)
      
      console.log(`📅 Detailed outstanding balances for student ${studentId} (FIFO order):`);
      outstandingArray.forEach(month => {
        console.log(`  ${month.monthKey} (${month.monthName}):`);
        console.log(`    Rent: $${month.rent.outstanding.toFixed(2)}`);
        console.log(`    Admin Fee: $${month.adminFee.outstanding.toFixed(2)}`);
        console.log(`    Deposit: $${month.deposit.outstanding.toFixed(2)}`);
        console.log(`    Total Outstanding: $${month.totalOutstanding.toFixed(2)}`);
      });
      
      return outstandingArray;
      
    } catch (error) {
      console.error(`❌ Error getting detailed outstanding balances: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🔄 Update AR transaction with payment allocation
   * Creates a payment transaction to reduce the AR balance
   * @param {string} transactionId - AR transaction ID to update
   * @param {number} amount - Payment amount to allocate
   * @param {Object} paymentData - Payment data
   * @param {number} originalOutstanding - Original outstanding amount
   * @returns {Object} Updated AR transaction
   */
  static async updateARTransaction(transactionId, amount, paymentData, originalOutstanding) {
    try {
      console.log(`🔄 Updating AR transaction ${transactionId} with payment of $${amount}`);
      console.log(`📋 Payment data:`, JSON.stringify(paymentData, null, 2));
      
      // Get the AR transaction
      const arTransaction = await TransactionEntry.findById(transactionId);
      if (!arTransaction) {
        throw new Error(`AR transaction ${transactionId} not found`);
      }
      
      // 🆕 VERIFICATION: Ensure the AR transaction belongs to the correct student
      const hasStudentAccount = arTransaction.entries.some(entry => 
        entry.accountCode === `1100-${paymentData.studentId}`
      );
      
      if (!hasStudentAccount) {
        throw new Error(`AR transaction ${transactionId} does not belong to student ${paymentData.studentId}`);
      }
      
      console.log(`✅ Found AR transaction: ${arTransaction._id}`);
      console.log(`📝 AR transaction description: ${arTransaction.description}`);
      console.log(`✅ Verified AR transaction belongs to student: ${paymentData.studentId}`);
      
      // Determine the correct target month for allocation (prefer explicit monthKey from caller)
      let monthKey = paymentData.monthKey;
      if (!monthKey) {
        const arDate = new Date(arTransaction.date);
        monthKey = `${arDate.getFullYear()}-${String(arDate.getMonth() + 1).padStart(2, '0')}`;
      }
      
      console.log(`🎯 Payment transaction already created by createPaymentAllocationTransaction`);
      console.log(`📋 Month settled: ${monthKey}`);
      console.log(`📋 Payment type: ${paymentData.paymentType}`);
      
      // 🆕 NEW: Update the original AR transaction to mark it as partially/completely paid
      await this.updateARTransactionStatus(arTransaction, amount, originalOutstanding);
      
      return arTransaction;
      
    } catch (error) {
      console.error(`❌ Error updating AR transaction: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🆕 NEW: Update AR transaction status to show payment allocation
   * @param {Object} arTransaction - AR transaction to update
   * @param {number} paymentAmount - Amount paid
   * @param {number} originalOutstanding - Original outstanding amount
   */
  static async updateARTransactionStatus(arTransaction, paymentAmount, originalOutstanding) {
    try {
      // Add payment allocation metadata to AR transaction
      if (!arTransaction.metadata) {
        arTransaction.metadata = {};
      }
      
      // Track payment allocations
      if (!arTransaction.metadata.paymentAllocations) {
        arTransaction.metadata.paymentAllocations = [];
      }
      
      arTransaction.metadata.paymentAllocations.push({
        date: new Date(),
        amount: paymentAmount,
        remainingOutstanding: Math.max(0, originalOutstanding - paymentAmount)
      });
      
      // Update total paid amount
      arTransaction.metadata.totalPaid = (arTransaction.metadata.totalPaid || 0) + paymentAmount;
      arTransaction.metadata.isFullyPaid = arTransaction.metadata.totalPaid >= originalOutstanding;
      
      await arTransaction.save();
      console.log(`✅ Updated AR transaction ${arTransaction._id} with payment allocation`);
      
    } catch (error) {
      console.error(`❌ Error updating AR transaction status: ${error.message}`);
    }
  }

  /**
   * 🆕 NEW: Determine payment type from AR transaction
   * @param {Object} arTransaction - AR transaction
   * @returns {string} Payment type (rent, admin, deposit)
   */
  static getPaymentTypeFromARTransaction(arTransaction) {
    try {
      const description = arTransaction.description.toLowerCase();
      
      if (description.includes('admin fee') || description.includes('administrative')) {
        return 'admin';
      } else if (description.includes('security deposit') || description.includes('deposit')) {
        return 'deposit'; // 🆕 FIXED: Return 'deposit' not 'rent'
      } else {
        return 'rent'; // Default to rent
      }
    } catch (error) {
      return 'rent'; // Default fallback
    }
  }

  /**
   * 💳 Create advance payment transaction for excess amounts
   * @param {string} paymentId - Payment ID
   * @param {string} studentId - Student ID
   * @param {number} amount - Advance payment amount
   * @param {Object} paymentData - Payment data
   * @param {string} paymentType - Type of advance payment
   * @returns {Object} Advance payment transaction
   */
  static async createAdvancePaymentTransaction(paymentId, studentId, amount, paymentData, paymentType) {
    try {
      console.log(`💳 Creating advance payment transaction for $${amount} ${paymentType}`);
      
      // Determine liability account based on type
      const isDeposit = paymentType === 'deposit';
      const liabilityAccountCode = isDeposit ? '2020' : '2200';
      const liabilityAccountName = isDeposit ? 'Tenant Security Deposits' : 'Advance Payment Liability';

      // Determine monthSettled for deposit: use lease_start month if available
      let monthSettled = null;
      if (isDeposit) {
        try {
          const leaseStartAccrual = await TransactionEntry.findOne({
            source: 'rental_accrual',
            'metadata.type': 'lease_start',
            'metadata.studentId': studentId
          }).sort({ date: 1 }).lean();
          if (leaseStartAccrual) {
            const d = new Date(leaseStartAccrual.date);
            monthSettled = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          }
        } catch (_) {
          // ignore lookup errors, fallback to null
        }
      }

      const advanceTransaction = new TransactionEntry({
        transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        date: new Date(),
        description: isDeposit ? 'Deposit received (liability)' : `Advance ${paymentType} payment for future periods`,
        reference: paymentId,
        entries: [
          // Credit: Advance Payment Liability
          {
            accountCode: liabilityAccountCode,
            accountName: liabilityAccountName,
            accountType: 'Liability',
            debit: 0,
            credit: amount,
            description: isDeposit ? `Deposit received from ${paymentId}` : `Advance ${paymentType} payment from ${paymentId}`
          },
          // Debit: Cash/Bank
          {
            accountCode: '1000', // Cash account
            accountName: 'Cash',
            accountType: 'Asset',
            debit: amount,
            credit: 0,
            description: isDeposit ? 'Deposit payment received' : `Advance ${paymentType} payment received`
          }
        ],
        totalDebit: amount,
        totalCredit: amount,
        source: 'advance_payment',
        sourceId: null, // Don't set sourceId if it's not a valid ObjectId
        sourceModel: 'AdvancePayment',
        residence: paymentData.residence || null, // Handle null residence
        createdBy: 'system',
        status: 'posted',
        metadata: {
          paymentId: paymentId,
          studentId: studentId,
          amount: amount,
          paymentType: paymentType,
          advanceType: 'future_payment',
          description: isDeposit ? 'Deposit received (liability)' : `Advance ${paymentType} payment for future periods`,
          monthSettled: monthSettled
        }
      });
      
      await advanceTransaction.save();
      console.log(`✅ Advance payment transaction created: ${advanceTransaction._id}`);
      
      return advanceTransaction;
      
    } catch (error) {
      console.error(`❌ Error creating advance payment transaction: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🆕 NEW: Create payment allocation transaction with proper double-entry accounting
   * @param {string} paymentId - Payment ID
   * @param {string} studentId - Student ID
   * @param {number} amount - Payment amount
   * @param {Object} paymentData - Payment data
   * @param {string} paymentType - Type of payment (rent, admin, deposit)
   * @param {string} monthSettled - Month this payment settles
   * @param {string} arTransactionId - AR transaction being settled
   * @returns {Object} Payment allocation transaction
   */
  static async createPaymentAllocationTransaction(paymentId, studentId, amount, paymentData, paymentType, monthSettled, arTransactionId) {
    try {
      console.log(`💳 Creating payment allocation transaction for $${amount} ${paymentType} to ${monthSettled}`);
      
      // Determine cash account based on payment method
      let cashAccountCode = '1000'; // Default to Cash
      let cashAccountName = 'Cash';
      
      if (paymentData.paymentMethod) {
        const method = paymentData.paymentMethod.toLowerCase();
        if (method.includes('bank') || method.includes('transfer') || method.includes('ecocash')) {
          cashAccountCode = '1001';
          cashAccountName = 'Bank Account';
        }
      }

      // Create payment allocation transaction with proper payment date
      const paymentDate = paymentData.date ? new Date(paymentData.date) : new Date();
      const paymentTransaction = new TransactionEntry({
        transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        date: paymentDate, // Use actual payment date for accurate cashflow
        description: `Payment allocation: ${paymentType} for ${monthSettled}`,
        reference: paymentId,
        entries: [
          // Debit: Cash/Bank (we receive money)
          {
            accountCode: cashAccountCode,
            accountName: cashAccountName,
            accountType: 'Asset',
            debit: amount,
            credit: 0,
            description: `${paymentType} payment received for ${monthSettled}`
          },
          // Credit: Accounts Receivable (reduce student's debt)
          {
            accountCode: `1100-${studentId}`,
            accountName: `Accounts Receivable - ${paymentData.studentName || studentId}`,
            accountType: 'Asset',
            debit: 0,
            credit: amount,
            description: `${paymentType} payment applied to ${monthSettled}`
          }
        ],
        totalDebit: amount,
        totalCredit: amount,
        source: 'payment',
        sourceId: null, // Don't set sourceId if it's not a valid ObjectId
        sourceModel: 'Payment',
        residence: paymentData.residence || null, // Handle null residence
        createdBy: 'system',
        status: 'posted',
        metadata: {
          paymentId: paymentId,
          studentId: studentId,
          amount: amount,
          paymentType: paymentType,
          monthSettled: monthSettled,
          arTransactionId: arTransactionId,
          allocationType: 'payment_allocation',
          description: `${paymentType} payment allocation for ${monthSettled}`
        }
      });
      
      await paymentTransaction.save();
      
      // Log payment allocation transaction creation
      await logSystemOperation('create', 'TransactionEntry', paymentTransaction._id, {
        source: 'Enhanced Payment Allocation Service',
        type: 'payment_allocation',
        paymentId: paymentId,
        studentId: studentId,
        amount: amount,
        paymentType: paymentType,
        monthSettled: monthSettled
      });
      
      console.log(`✅ Payment allocation transaction created: ${paymentTransaction._id}`);
      
      // 🆕 NEW: Automatically sync to debtor
      try {
        const DebtorTransactionSyncService = require('./debtorTransactionSyncService');
        const monthKey = monthSettled; // monthSettled is already in YYYY-MM format
        
        await DebtorTransactionSyncService.updateDebtorFromPayment(
          paymentTransaction,
          studentId,
          amount,
          monthKey,
          {
            paymentId: paymentId,
            studentId: studentId,
            amount: amount,
            paymentType: paymentType,
            monthSettled: monthSettled,
            arTransactionId: arTransactionId,
            allocationType: 'payment_allocation',
            description: `${paymentType} payment allocation for ${monthSettled}`,
            transactionId: paymentTransaction.transactionId
          }
        );
        
        console.log(`✅ Debtor automatically synced for payment allocation: ${studentId} - $${amount} for ${monthSettled}`);
        
      } catch (debtorError) {
        console.error(`❌ Error syncing to debtor: ${debtorError.message}`);
        // Don't fail the payment allocation if debtor sync fails
      }
      
      return paymentTransaction;
      
    } catch (error) {
      console.error(`❌ Error creating payment allocation transaction: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🆕 NEW: Get debtor status for once-off charge tracking
   * @param {string} studentId - Student ID
   * @returns {Object} Debtor document with once-off charge flags
   */
  static async getDebtorStatus(studentId) {
    try {
      const Debtor = require('../models/Debtor');
      const debtor = await Debtor.findOne({ user: studentId });
      return debtor;
    } catch (error) {
      console.error(`❌ Error getting debtor status: ${error.message}`);
      return null;
    }
  }

  /**
   * 🆕 NEW: Update debtor once-off charge flags
   * @param {string} debtorId - Debtor ID
   * @param {string} chargeType - 'admin' or 'deposit'
   * @param {number} amount - Amount paid
   * @param {string} paymentId - Payment ID
   */
  static async updateDebtorOnceOffCharge(debtorId, chargeType, amount, paymentId) {
    try {
      const Debtor = require('../models/Debtor');
      const updateData = {};
      
      if (chargeType === 'admin') {
        updateData['onceOffCharges.adminFee.isPaid'] = true;
        updateData['onceOffCharges.adminFee.paidDate'] = new Date();
        updateData['onceOffCharges.adminFee.paidAmount'] = amount;
        updateData['onceOffCharges.adminFee.paymentId'] = paymentId;
      } else if (chargeType === 'deposit') {
        updateData['onceOffCharges.deposit.isPaid'] = true;
        updateData['onceOffCharges.deposit.paidDate'] = new Date();
        updateData['onceOffCharges.deposit.paidAmount'] = amount;
        updateData['onceOffCharges.deposit.paymentId'] = paymentId;
      }
      
      await Debtor.findByIdAndUpdate(debtorId, { $set: updateData });
      console.log(`✅ Updated debtor ${chargeType} charge flag for payment ${paymentId}`);
      
    } catch (error) {
      console.error(`❌ Error updating debtor once-off charge: ${error.message}`);
    }
  }

  /**
   * 🆕 NEW: Handle advance payments (Deferred Income)
   * @param {string} paymentId - Payment ID
   * @param {string} studentId - Student ID
   * @param {number} amount - Advance payment amount
   * @param {Object} paymentData - Payment data
   * @param {string} paymentType - Type of advance payment
   * @returns {Object} Advance payment result
   */
  static async handleAdvancePayment(paymentId, studentId, amount, paymentData, paymentType) {
    try {
      console.log(`💳 Creating advance payment transaction for $${amount} ${paymentType}`);
      
      // Create advance payment transaction
      const advanceTransaction = await this.createAdvancePaymentTransaction(
        paymentId, studentId, amount, paymentData, paymentType
      );
      
      // Update debtor deferred income only for rent advances
      if (paymentType !== 'deposit' && paymentType !== 'admin') {
        await this.updateDebtorDeferredIncome(studentId, paymentId, amount, paymentType);
      }
      
      return {
        month: 'advance',
        monthName: 'Advance Payment',
        year: new Date().getFullYear(),
        paymentType: paymentType,
        amountAllocated: amount,
        originalOutstanding: 0,
        newOutstanding: 0,
        allocationType: 'advance_payment',
        transactionId: advanceTransaction._id,
        advanceDetails: {
          amount: amount,
          type: paymentType,
          description: `Advance ${paymentType} payment for future periods`
        }
      };
      
    } catch (error) {
      console.error(`❌ Error handling advance payment: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🆕 NEW: Update debtor deferred income
   * @param {string} studentId - Student ID
   * @param {string} paymentId - Payment ID
   * @param {number} amount - Amount to defer
   * @param {string} paymentType - Type of payment
   */
  static async updateDebtorDeferredIncome(studentId, paymentId, amount, paymentType) {
    try {
      const Debtor = require('../models/Debtor');
      
      const prepayment = {
        paymentId: paymentId,
        amount: amount,
        paymentType: paymentType,
        paymentDate: new Date(),
        allocatedMonth: null, // Will be set when monthly accrual is created
        status: 'pending'
      };
      
      await Debtor.findOneAndUpdate(
        { user: studentId },
        { 
          $inc: { 'deferredIncome.totalAmount': amount },
          $push: { 'deferredIncome.prepayments': prepayment }
        }
      );
      
      console.log(`✅ Updated deferred income for student ${studentId}: +$${amount} ${paymentType}`);
      
    } catch (error) {
      console.error(`❌ Error updating deferred income: ${error.message}`);
    }
  }

  /**
   * 🆕 NEW: Calculate prorated amounts for lease start month
   * @param {Date} leaseStartDate - When the lease starts
   * @param {number} monthlyRent - Full monthly rent amount
   * @param {number} monthlyAdminFee - Full monthly admin fee
   * @param {number} monthlyDeposit - Full monthly deposit
   * @param {Object} residence - Residence object with paymentConfiguration (optional)
   * @returns {Object} Prorated amounts for rent, admin fee, and deposit
   */
  static calculateProratedAmounts(leaseStartDate, monthlyRent = 180, monthlyAdminFee = 20, monthlyDeposit = 180, residence = null) {
    try {
      const startDate = new Date(leaseStartDate);
      const year = startDate.getFullYear();
      const month = startDate.getMonth();
      const dayOfMonth = startDate.getDate();
      
      // Get the first day of the month
      const firstDayOfMonth = new Date(year, month, 1);
      // Get the last day of the month
      const lastDayOfMonth = new Date(year, month + 1, 0);
      
      // Calculate days in the month
      const daysInMonth = lastDayOfMonth.getDate();
      // Calculate days from lease start to end of month
      const daysFromStart = lastDayOfMonth.getDate() - startDate.getDate() + 1;
      
      let proratedRent;
      
      // If residence provided and has rentProration config, use shared logic
      if (residence && residence.paymentConfiguration) {
        try {
          const RentalAccrualService = require('./rentalAccrualService');
          const room = { price: monthlyRent };
          proratedRent = RentalAccrualService.calculateProratedRent(residence, room, startDate);
          console.log(`📅 Using residence-specific proration logic: $${proratedRent}`);
        } catch (e) {
          console.warn('⚠️ Proration via shared helper failed, falling back to legacy logic:', e.message);
          // Fall back to legacy logic below
        }
      }
      
      // Legacy logic (fallback or when no residence provided)
      if (proratedRent === undefined) {
        // Business rule: If lease starts from 20th onwards, use $7 per day
        if (dayOfMonth >= 20) {
          proratedRent = daysFromStart * 7; // $7 per day
          console.log(`📅 Lease starts on ${dayOfMonth}th (≥20th): Using $7/day rate`);
          console.log(`   Days from start: ${daysFromStart}, Amount: $${proratedRent}`);
        } else {
          // Use normal prorated calculation
          proratedRent = Math.round((monthlyRent / daysInMonth) * daysFromStart * 100) / 100;
          console.log(`📅 Lease starts on ${dayOfMonth}th (<20th): Using prorated calculation`);
          console.log(`   Monthly rent: $${monthlyRent}, Days in month: ${daysInMonth}, Days from start: ${daysFromStart}`);
          console.log(`   Prorated rent: $${proratedRent} (${monthlyRent} × ${daysFromStart}/${daysInMonth})`);
        }
      }
      
      const proratedAdminFee = monthlyAdminFee; // Admin fee is charged once, not prorated
      const proratedDeposit = monthlyDeposit; // Deposit is charged once, not prorated
      
      console.log(`   Admin fee: $${proratedAdminFee} (charged once)`);
      console.log(`   Deposit: $${proratedDeposit} (charged once)`);
      
      return {
        proratedRent,
        proratedAdminFee,
        proratedDeposit,
        daysInMonth,
        daysFromStart,
        calculationDate: startDate,
        calculationMethod: residence && residence.paymentConfiguration ? 'residence_specific' : (dayOfMonth >= 20 ? 'flat_rate_7_per_day' : 'prorated')
      };
      
    } catch (error) {
      console.error(`❌ Error calculating prorated amounts: ${error.message}`);
      return {
        proratedRent: monthlyRent,
        proratedAdminFee: monthlyAdminFee,
        proratedDeposit: monthlyDeposit,
        daysInMonth: 30,
        daysFromStart: 30,
        calculationDate: new Date(),
        calculationMethod: 'error_fallback'
      };
    }
  }

  /**
   * 📝 Create allocation record for tracking payment distribution
   * @param {string} paymentId - Payment ID
   * @param {string} studentId - Student ID
   * @param {Array} allocationResults - Allocation results
   * @param {Object} paymentData - Payment data
   * @returns {Object} Allocation record
   */
  static async createAllocationRecord(paymentId, studentId, allocationResults, paymentData) {
    try {
      console.log(`📝 Creating allocation record for payment ${paymentId}`);
      
      // For now, we'll return a simple object
      // In a full implementation, this could be saved to a separate collection
      const allocationRecord = {
        paymentId: paymentId,
        studentId: studentId,
        allocationDate: new Date(),
        totalAmount: paymentData.totalAmount,
        allocationResults: allocationResults,
        allocationMethod: 'Smart FIFO',
        status: 'completed'
      };
      
      console.log(`✅ Allocation record created for payment ${paymentId}`);
      return allocationRecord;
      
    } catch (error) {
      console.error(`❌ Error creating allocation record: ${error.message}`);
      return null;
    }
  }

  /**
   * 📊 Get outstanding balance summary for a student
   * @param {string} studentId - Student ID
   * @returns {Object} Summary of outstanding balances
   */
  static async getOutstandingBalanceSummary(studentId) {
    try {
      console.log(`📊 Getting outstanding balance summary for student: ${studentId}`);
      
      const outstandingBalances = await this.getDetailedOutstandingBalances(studentId);
      
      const totalOutstanding = outstandingBalances.reduce((sum, month) => sum + month.totalOutstanding, 0);
      
      return {
        studentId,
        totalOutstanding,
        monthsWithOutstanding: outstandingBalances.length,
        monthlyBreakdown: outstandingBalances.map(month => ({
          monthKey: month.monthKey,
          monthName: month.monthName,
          year: month.year,
          rent: month.rent.outstanding,
          adminFee: month.adminFee.outstanding,
          deposit: month.deposit.outstanding,
          total: month.totalOutstanding
        })),
        summary: {
          totalRent: outstandingBalances.reduce((sum, month) => sum + month.rent.outstanding, 0),
          totalAdminFee: outstandingBalances.reduce((sum, month) => sum + month.adminFee.outstanding, 0),
          totalDeposit: outstandingBalances.reduce((sum, month) => sum + month.deposit.outstanding, 0),
          totalOutstanding
        }
      };
      
    } catch (error) {
      console.error(`❌ Error getting outstanding balance summary: ${error.message}`);
      throw error;
    }
  }
}

module.exports = EnhancedPaymentAllocationService;
