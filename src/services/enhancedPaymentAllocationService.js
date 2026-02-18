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
      
      const { studentId: userId, totalAmount, payments, accountCode } = paymentData;
      
      // 🆕 FIX: Clear any potential caching issues by adding a small delay
      // This ensures we get the latest data from the database
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!userId || !totalAmount || !payments || !payments.length) {
        throw new Error('Missing required payment data: userId, totalAmount, or payments array');
      }
      
      console.log(`🎯 Processing payment for user: ${userId}, total amount: $${totalAmount}`);
      console.log(`📊 Account Code from payload: ${accountCode || 'Not provided'}`);
      
      // 🆕 CRITICAL: Use accountCode from payload if provided (most reliable)
      let finalAccountCode = accountCode;
      let actualUserId = userId;
      let debtorDoc = null;
      
      // STEP 1: If accountCode provided, extract debtor ID and find debtor
      if (accountCode && accountCode.startsWith('1100-')) {
        const Debtor = require('../models/Debtor');
        const mongoose = require('mongoose');
        const debtorIdFromCode = accountCode.replace('1100-', '');
        
        if (mongoose.Types.ObjectId.isValid(debtorIdFromCode)) {
          debtorDoc = await Debtor.findById(debtorIdFromCode).select('accountCode _id user debtorCode application').lean();
          if (debtorDoc) {
            actualUserId = debtorDoc.user?.toString() || userId;
            finalAccountCode = debtorDoc.accountCode || accountCode; // Use debtor's account code if different
            console.log(`✅ Found debtor by account code from payload: ${debtorDoc.debtorCode}`);
            console.log(`   Account Code: ${finalAccountCode}`);
            console.log(`   User ID: ${actualUserId}`);
          } else {
            console.log(`⚠️ Account code provided but debtor not found: ${accountCode}`);
            console.log(`   Will try to find debtor by user ID as fallback`);
          }
        }
      }
      
      // STEP 2: If debtor not found by account code, find by user ID
      if (!debtorDoc) {
      const Debtor = require('../models/Debtor');
      const Application = require('../models/Application');
      const mongoose = require('mongoose');
      
      if (mongoose.Types.ObjectId.isValid(userId)) {
        debtorDoc = await Debtor.findById(userId).select('accountCode _id user debtorCode application').lean();
        if (debtorDoc) {
          actualUserId = debtorDoc.user?.toString() || userId;
            if (!finalAccountCode) {
              finalAccountCode = debtorDoc.accountCode;
            }
        }
      }
      
      if (!debtorDoc) {
        const application = await Application.findById(userId).select('student').lean();
        if (application && application.student) {
          actualUserId = application.student.toString();
          debtorDoc = await Debtor.findOne({ user: actualUserId }).select('accountCode _id user debtorCode application').lean();
          if (!debtorDoc) {
            debtorDoc = await Debtor.findOne({ application: userId }).select('accountCode _id user debtorCode application').lean();
          }
            if (debtorDoc && !finalAccountCode) {
              finalAccountCode = debtorDoc.accountCode;
            }
        } else {
          debtorDoc = await Debtor.findOne({ user: userId }).select('accountCode _id user debtorCode application').lean();
            if (debtorDoc && !finalAccountCode) {
              finalAccountCode = debtorDoc.accountCode;
            }
          }
        }
      }
      
      if (debtorDoc) {
        actualUserId = debtorDoc.user.toString();
        if (!finalAccountCode) {
          finalAccountCode = debtorDoc.accountCode;
        }
        console.log(`✅ Using debtor: ${debtorDoc.debtorCode}, Account Code: ${finalAccountCode}`);
      } else {
        console.log(`⚠️ No debtor found - will use accountCode from payload: ${finalAccountCode || 'N/A'}`);
      }
      
      // STEP 2: Get AR balances using same method as AR balances API
      let outstandingBalances = await this.getDetailedOutstandingBalances(actualUserId);
      console.log(`📊 Found ${outstandingBalances?.length || 0} months with outstanding balances`);
      
      // STEP 3: Determine payment month
      const paymentDate = new Date(paymentData.date);
      const paymentMonthKey = paymentData.paymentMonth || `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
      console.log(`📅 Payment month: ${paymentMonthKey}`);
      console.log(`📅 Payment date: ${paymentDate.toISOString().split('T')[0]}`);
      
      // 🆕 CRITICAL: Check if payment date is before payment month (advance payment detection)
      // If payment is made before the month it's allocated to, it's ALWAYS an advance payment
      let isAdvancePaymentByDate = false;
      if (paymentData.paymentMonth) {
        const paymentMonthDate = new Date(paymentData.paymentMonth + '-01');
        const paymentDateMonth = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), 1);
        
        if (paymentDateMonth < paymentMonthDate) {
          isAdvancePaymentByDate = true;
          console.log(`⚠️ ADVANCE PAYMENT DETECTED: Payment date (${paymentDate.toISOString().split('T')[0]}) is before payment month (${paymentData.paymentMonth})`);
          console.log(`   Payment Date Month: ${paymentDateMonth.toISOString().split('T')[0]}`);
          console.log(`   Payment Month: ${paymentMonthDate.toISOString().split('T')[0]}`);
          console.log(`   ✅ This will be treated as an ADVANCE PAYMENT - routing to deferred income`);
        }
      }
      
      // 🆕 CRITICAL: If payment date is before payment month, skip all accrual checks and treat as advance
      // This must happen BEFORE checking for accruals to prevent override
      if (isAdvancePaymentByDate) {
        console.log(`⚠️ Payment date is before payment month - SKIPPING accrual checks and treating as ADVANCE PAYMENT`);
        // Skip to advance payment handling (will be handled in the section below)
      } else {
      // STEP 4: Check if payment month has balance - with DIRECT FALLBACK if not found
      let paymentMonthBalance = outstandingBalances?.find(b => b.monthKey === paymentMonthKey);
      let hasPaymentMonthBalance = paymentMonthBalance && paymentMonthBalance.rent?.outstanding > 0;
      
      // 🆕 CRITICAL FALLBACK: If balance not found, directly query for accrual for payment month
        // Use accountCode from payload if available, otherwise use debtor account code
        const accountCodeForQuery = finalAccountCode || (debtorDoc && debtorDoc.accountCode);
        if (!hasPaymentMonthBalance && accountCodeForQuery) {
        console.log(`🔍 Balance not found in getDetailedOutstandingBalances - directly checking for accrual...`);
          console.log(`   Using account code: ${accountCodeForQuery}`);
        const TransactionEntry = require('../models/TransactionEntry');
          const debtorAccountCode = accountCodeForQuery;
        
          // Query for accrual for payment month (not payment date month)
          const paymentMonthDate = new Date(paymentData.paymentMonth + '-01');
          const paymentMonthStart = new Date(paymentMonthDate.getFullYear(), paymentMonthDate.getMonth(), 1);
          const paymentMonthEnd = new Date(paymentMonthDate.getFullYear(), paymentMonthDate.getMonth() + 1, 0, 23, 59, 59, 999);
        
        const accrualForMonth = await TransactionEntry.findOne({
          'entries.accountCode': debtorAccountCode,
          source: { $in: ['rental_accrual', 'lease_start'] },
          status: { $ne: 'reversed' },
          date: {
            $gte: paymentMonthStart,
            $lte: paymentMonthEnd
          }
        }).lean();
        
        if (accrualForMonth) {
          console.log(`✅ Found accrual for payment month ${paymentMonthKey}: ${accrualForMonth.transactionId}`);
          
          // Calculate outstanding balance
          const accrualEntry = accrualForMonth.entries.find(e => 
            e.accountCode === debtorAccountCode && e.debit > 0
          );
          const accrualAmount = accrualEntry?.debit || 0;
          
          // Find all payment allocations for this month
          const paymentAllocations = await TransactionEntry.find({
            'entries.accountCode': debtorAccountCode,
            source: 'payment',
            status: { $ne: 'reversed' },
            'metadata.monthSettled': paymentMonthKey
          }).lean();
          
          let totalPaid = 0;
          paymentAllocations.forEach(tx => {
            const creditEntry = tx.entries.find(e => 
              e.accountCode === debtorAccountCode && e.credit > 0
            );
            if (creditEntry) totalPaid += creditEntry.credit;
          });
          
          // 🆕 CRITICAL: Find negotiated payment adjustments for this month and subtract from accrual
          const [yearStr, monStr] = paymentMonthKey.split('-');
          const negotiatedAdjustments = await TransactionEntry.find({
            'entries.accountCode': debtorAccountCode,
            source: 'manual',
            status: { $ne: 'reversed' },
            $and: [
              {
                $or: [
                  { 'metadata.type': 'negotiated_payment_adjustment' },
                  { 'metadata.transactionType': 'negotiated_payment_adjustment' },
                  { description: { $regex: /negotiated|discount/i } }
                ]
              },
              {
                $or: [
                  { 'metadata.accrualMonth': parseInt(monStr), 'metadata.accrualYear': parseInt(yearStr) },
                  { 'metadata.monthSettled': paymentMonthKey },
                  { 'metadata.month': paymentMonthKey }
                ]
              }
            ]
          }).lean();
          
          let totalNegotiatedDiscount = 0;
          negotiatedAdjustments.forEach(adj => {
            const creditEntry = adj.entries.find(e => 
              e.accountCode === debtorAccountCode && e.credit > 0
            );
            if (creditEntry) {
              totalNegotiatedDiscount += creditEntry.credit;
              console.log(`   📉 Found negotiated discount for ${paymentMonthKey}: $${creditEntry.credit}`);
            }
          });
          
          // Calculate net accrual after negotiated adjustments
          const netAccrualAmount = Math.max(0, accrualAmount - totalNegotiatedDiscount);
          const outstanding = netAccrualAmount - totalPaid;
          
          console.log(`   📊 Accrual calculation for ${paymentMonthKey}:`);
          console.log(`      Original Accrual: $${accrualAmount}`);
          console.log(`      Negotiated Discounts: $${totalNegotiatedDiscount}`);
          console.log(`      Net Accrual (after discounts): $${netAccrualAmount}`);
          console.log(`      Payments Received: $${totalPaid}`);
          console.log(`      Outstanding Balance: $${outstanding}`);
          
          if (outstanding > 0) {
              console.log(`✅ Payment month ${paymentMonthKey} has outstanding balance: $${outstanding} (net accrual: $${netAccrualAmount}, paid: $${totalPaid}${totalNegotiatedDiscount > 0 ? `, negotiated discounts: $${totalNegotiatedDiscount}` : ''})`);
            hasPaymentMonthBalance = true;
            
            // Add to outstandingBalances
            if (!outstandingBalances) outstandingBalances = [];
            paymentMonthBalance = {
              monthKey: paymentMonthKey,
                year: paymentMonthDate.getFullYear(),
                month: paymentMonthDate.getMonth() + 1,
                monthName: paymentMonthDate.toLocaleString('default', { month: 'long' }),
                rent: { owed: netAccrualAmount, paid: totalPaid, outstanding: outstanding }, // Use net accrual after negotiated discounts
              adminFee: { owed: 0, paid: 0, outstanding: 0 },
              deposit: { owed: 0, paid: 0, outstanding: 0 },
              totalOutstanding: outstanding,
              transactionId: accrualForMonth._id,
              date: accrualForMonth.date
            };
            outstandingBalances.push(paymentMonthBalance);
          } else {
              console.log(`ℹ️ Payment month ${paymentMonthKey} is fully paid (net accrual: $${netAccrualAmount}, paid: $${totalPaid}${totalNegotiatedDiscount > 0 ? `, negotiated discounts: $${totalNegotiatedDiscount}` : ''})`);
          }
        } else {
          console.log(`ℹ️ No accrual found for payment month ${paymentMonthKey}`);
          }
        }
      }
      
      // 🆕 CRITICAL FIX: If payment date is before payment month, treat as advance payment
      // This takes priority over accrual checks - if payment is made before the month, it's advance
      if (isAdvancePaymentByDate) {
        console.log(`⚠️ Payment date is before payment month - treating as ADVANCE PAYMENT regardless of accrual status`);
        console.log(`   Payment will be routed to deferred income (account 2200)`);
        
        // Handle all payments as advance payments when payment date is before payment month
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
          console.log(`💳 Processing ${paymentType} payment as advance (payment date before payment month): $${totalAmount}`);
          
          const advanceResult = await this.handleAdvancePayment(
            paymentData.paymentId, userId, totalAmount, paymentData, paymentType
          );
          allocationResults.push(advanceResult);
          totalAllocated += totalAmount;
        }
        
        // Create allocation record
        const allocationRecord = await this.createAllocationRecord(
          paymentData.paymentId,
          userId,
          allocationResults,
          paymentData
        );
        
        console.log('✅ All payments processed as advance payments (payment date before payment month)');
        
        return {
          success: true,
          allocation: {
            monthlyBreakdown: allocationResults,
            summary: {
              totalAllocated,
              remainingBalance: totalAmount - totalAllocated,
              isAdvancePayment: true,
              reason: 'Payment date is before payment month'
            }
          },
          allocationRecord
        };
      }
      
      // 🆕 CRITICAL FIX: Before treating as advance payment, check if accrual exists for payment month
      // Even if getDetailedOutstandingBalances returns empty, we should check directly for accruals
      if ((!outstandingBalances || outstandingBalances.length === 0) && finalAccountCode && paymentData.paymentMonth) {
        console.log(`🔍 Double-checking for accruals for payment month: ${paymentData.paymentMonth}`);
        console.log(`   Using account code: ${finalAccountCode}`);
        
        try {
          const paymentMonthDate = new Date(paymentData.paymentMonth + '-01'); // Parse YYYY-MM format
          const paymentMonthStart = new Date(paymentMonthDate.getFullYear(), paymentMonthDate.getMonth(), 1);
          const paymentMonthEnd = new Date(paymentMonthDate.getFullYear(), paymentMonthDate.getMonth() + 1, 0, 23, 59, 59, 999);
          
          const directAccrualCheck = await TransactionEntry.findOne({
            'entries.accountCode': finalAccountCode,
            source: { $in: ['rental_accrual', 'lease_start'] },
            status: { $ne: 'reversed' },
            voided: { $ne: true },
            date: {
              $gte: paymentMonthStart,
              $lte: paymentMonthEnd
            }
          }).lean();
          
          if (directAccrualCheck) {
            console.warn(`⚠️  CRITICAL: Found accrual for payment month ${paymentData.paymentMonth}!`);
            console.warn(`   Accrual ID: ${directAccrualCheck._id}`);
            console.warn(`   This payment should NOT be an advance payment - it should settle the accrual!`);
            console.warn(`   Re-checking outstanding balances with direct accrual...`);
            
            // Re-check outstanding balances now that we know accrual exists
            outstandingBalances = await this.getDetailedOutstandingBalances(actualUserId);
            if (outstandingBalances && outstandingBalances.length > 0) {
              console.log(`✅ Found outstanding balances after direct accrual check - processing as regular payment`);
              // Continue with normal allocation flow below
            } else {
              console.error(`❌ Accrual exists but getDetailedOutstandingBalances returned empty - this is a bug!`);
              console.error(`   Accrual: ${directAccrualCheck._id}, Account Code: ${finalAccountCode}`);
            }
          } else {
            console.log(`✅ Confirmed: No accrual found for payment month ${paymentData.paymentMonth} - can proceed as advance payment`);
          }
        } catch (directCheckError) {
          console.error(`❌ Error in direct accrual check: ${directCheckError.message}`);
        }
      }
      
      if (!outstandingBalances || outstandingBalances.length === 0) {
        console.log('ℹ️ No outstanding balances found for student');
        
        // 🆕 CRITICAL FIX: Check if payment is for current month before treating as advance
        // If payment has paymentMonth or monthAllocated matching payment date, wait for accrual
        const paymentDate = new Date(paymentData.date);
        const paymentMonthKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
        
        // Check if any payment has monthAllocated matching payment month
        const hasCurrentMonthPayment = payments.some(p => {
          if (p.monthAllocated === paymentMonthKey) {
            return true;
          }
          // Also check paymentMonth from paymentData
          if (paymentData.paymentMonth === paymentMonthKey) {
            return true;
          }
          return false;
        });
        
        if (hasCurrentMonthPayment) {
          console.log(`⚠️ Payment is for current month (${paymentMonthKey}) but no accrual found yet`);
          console.log(`   ⏳ Waiting briefly to check if accrual is being created...`);
          
          // Wait a bit and check again for accruals (in case accrual is being created concurrently)
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
          
          // Re-check for outstanding balances
          const recheckBalances = await this.getDetailedOutstandingBalances(actualUserId);
          if (recheckBalances && recheckBalances.length > 0) {
            console.log(`✅ Found accruals after waiting - processing as regular payment allocation`);
            // Continue with normal allocation flow (will fall through to next section)
            outstandingBalances = recheckBalances;
          } else {
            console.log(`⚠️ Still no accruals found - treating as advance payment`);
            console.log(`   ⚠️ Note: This may create both advance_payment and payment_allocation if accrual is created later`);
            console.log(`   ⚠️ Consider creating accrual before processing payment for current month`);
            
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
                paymentData.paymentId, userId, totalAmount, paymentData, paymentType
              );
              allocationResults.push(advanceResult);
              totalAllocated += totalAmount;
            }
            
            // Create allocation record
            const allocationRecord = await this.createAllocationRecord(
              paymentData.paymentId,
              userId,
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
        } else {
          console.log('ℹ️ No outstanding balances and payment is not for current month - treating all payments as advance payments');
          
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
              paymentData.paymentId, userId, totalAmount, paymentData, paymentType
            );
            allocationResults.push(advanceResult);
            totalAllocated += totalAmount;
          }
        
        // Create allocation record
        const allocationRecord = await this.createAllocationRecord(
          paymentData.paymentId,
          userId,
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
                paymentData.paymentId, userId, remainingAmount, paymentData, paymentType
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
                paymentData.paymentId, userId, remainingAmount, paymentData, paymentType
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
                paymentData.paymentId, userId, remainingAmount, paymentData, 'advance_admin'
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
                paymentData.paymentId, userId, remainingAmount, paymentData, paymentType
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
                userId,
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
                  userId,
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
                  'metadata.studentId': userId,
                  'entries.accountCode': { $regex: `^1100-${userId}` }
                }).sort({ date: 1 });
                if (leaseStartAccrual && remainingAmount > 0) {
                  const lsDate = new Date(leaseStartAccrual.date);
                  const lsMonthKey = `${lsDate.getFullYear()}-${String(lsDate.getMonth() + 1).padStart(2, '0')}`;
                  console.log(`🎯 Fallback allocating $${remainingAmount} ${paymentType} to lease_start month ${lsMonthKey}`);
                  // Create payment allocation transaction with proper double-entry accounting
                  const paymentTransaction = await this.createPaymentAllocationTransaction(
                    paymentData.paymentId,
                    userId,
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
                userId,
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
              paymentData.paymentId, userId, remainingAmount, paymentData, 'rent'
            );
            allocationResults.push(advanceResult);
            totalAllocated += remainingAmount;
          }
        }
      }
      
      // 4. Create allocation record
      const allocationRecord = await this.createAllocationRecord(
        paymentData.paymentId,
        userId,
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
   * @param {string} userId - User ID (should be the actual User._id)
   * @returns {Array} Array of outstanding balance objects sorted by date (oldest first)
   */
  static async getDetailedOutstandingBalances(userId) {
    try {
      console.log(`🔍 Getting detailed outstanding balances for user: ${userId}`);
      
      // Get all transactions for this specific user
      const userIdString = String(userId);
      console.log(`🔍 Processing user ID: ${userIdString} (type: ${typeof userId})`);
      
      // Resolve debtor to get exact AR account code - use User ID consistently
      const Debtor = require('../models/Debtor');
      let debtorDoc = await Debtor.findOne({ user: userIdString }).select('accountCode _id user');
      
      // 🆕 CRITICAL FIX: If not found by exact match, try fuzzy matching for common ID typos
      if (!debtorDoc) {
        console.log(`⚠️ Debtor not found by exact user ID match, trying fuzzy match...`);
        
        // Try finding debtors with similar user IDs using similarity percentage
        const allDebtors = await Debtor.find({}).select('accountCode _id user debtorCode').lean();
        let bestMatch = null;
        let bestSimilarity = 0;
        
        for (const d of allDebtors) {
          if (d.user) {
            const dUserId = d.user.toString();
            // Check if IDs are same length
            if (dUserId.length === userIdString.length) {
              // Calculate similarity percentage
              let matches = 0;
              for (let i = 0; i < dUserId.length; i++) {
                if (dUserId[i] === userIdString[i]) matches++;
              }
              const similarity = matches / dUserId.length;
              
              // If similarity is high enough (90%+), consider it a match
              if (similarity > 0.9 && similarity > bestSimilarity) {
                bestMatch = d;
                bestSimilarity = similarity;
              }
            }
          }
        }
        
        if (bestMatch) {
          console.log(`✅ Found debtor via fuzzy user ID match (${(bestSimilarity * 100).toFixed(1)}% similar):`);
          console.log(`   Query ID: ${userIdString}`);
          console.log(`   Debtor User ID: ${bestMatch.user.toString()}`);
          console.log(`   Debtor Code: ${bestMatch.debtorCode || bestMatch._id}`);
          console.log(`   Account Code: ${bestMatch.accountCode}`);
          debtorDoc = bestMatch;
        } else {
          console.log(`⚠️ No debtor found via fuzzy matching (tried ${allDebtors.length} debtors)`);
        }
      }
      
      // 🆕 CRITICAL: If debtor not found by user ID, try to find by transactions' sourceId or metadata.debtorId
      if (!debtorDoc) {
        console.log(`⚠️ Debtor not found by user ID, trying to find via transactions...`);
        
        // Try multiple approaches to find the debtor
        // 1. Try to find a transaction with this studentId in metadata
        let sampleTx = await TransactionEntry.findOne({
          $or: [
            { 'metadata.studentId': userIdString },
            { 'metadata.userId': userIdString }
          ]
        }).select('sourceId metadata.debtorId entries.accountCode').lean();
        
        // 2. If not found, try to find by any transaction that might reference this user
        if (!sampleTx) {
          sampleTx = await TransactionEntry.findOne({
            $or: [
              { 'description': { $regex: userIdString, $options: 'i' }},
              { 'entries.description': { $regex: userIdString, $options: 'i' }}
            ]
          }).select('sourceId metadata.debtorId entries.accountCode sourceModel').lean();
        }
        
        // 2b. If still not found, try to find transactions with AR account codes and extract debtor IDs
        // Then check if any of those debtors have a user that matches (with similarity matching)
        if (!sampleTx) {
          // Find transactions with AR account codes (debtor ID format: 1100-{debtorId})
          const arTransactions = await TransactionEntry.find({
            'entries.accountCode': { $regex: /^1100-[a-f0-9]{24}$/i },
            source: 'rental_accrual',
            status: { $ne: 'reversed' }
          })
          .select('sourceId metadata.debtorId entries.accountCode description')
          .limit(100)
          .lean();
          
          console.log(`🔍 Checking ${arTransactions.length} accrual transactions for matching debtor...`);
          
          // Check each transaction's debtor to see if user matches (with similarity matching)
          let bestTxMatch = null;
          let bestTxSimilarity = 0;
          
          for (const tx of arTransactions) {
            // Extract debtor ID from account code
            const arCode = tx.entries?.find(e => e.accountCode?.startsWith('1100-'))?.accountCode;
            if (!arCode) continue;
            
            const txDebtorId = arCode.replace('1100-', '');
            if (!mongoose.Types.ObjectId.isValid(txDebtorId)) continue;
            
            const txDebtor = await Debtor.findById(txDebtorId).select('user accountCode').lean();
            if (txDebtor && txDebtor.user) {
              const txUserId = txDebtor.user.toString();
              // Calculate similarity percentage
              if (txUserId.length === userIdString.length) {
                let matches = 0;
                for (let i = 0; i < txUserId.length; i++) {
                  if (txUserId[i] === userIdString[i]) matches++;
                }
                const similarity = matches / txUserId.length;
                
                if (similarity > 0.9 && similarity > bestTxSimilarity) {
                  bestTxMatch = { tx, debtor: txDebtor, debtorId: txDebtorId };
                  bestTxSimilarity = similarity;
                }
              }
            }
          }
          
          if (bestTxMatch) {
            console.log(`✅ Found matching debtor via transaction lookup (${(bestTxSimilarity * 100).toFixed(1)}% similar):`);
            console.log(`   Transaction: ${bestTxMatch.tx._id}`);
            console.log(`   Description: ${bestTxMatch.tx.description}`);
            console.log(`   Debtor ID: ${bestTxMatch.debtorId}`);
            console.log(`   Account Code: ${bestTxMatch.debtor.accountCode}`);
            sampleTx = bestTxMatch.tx;
            // Also set debtorDoc directly from the match
            debtorDoc = await Debtor.findById(bestTxMatch.debtorId).select('accountCode _id user').lean();
            if (debtorDoc) {
              console.log(`✅ Set debtorDoc from transaction match: ${debtorDoc.debtorCode || debtorDoc._id}`);
            }
          }
        }
        
        // 3. Try to extract debtor ID from transaction's sourceId (if sourceModel is Debtor)
        if (sampleTx?.sourceId) {
          debtorDoc = await Debtor.findById(sampleTx.sourceId).select('accountCode _id user');
          if (debtorDoc) {
            console.log(`✅ Found debtor via transaction sourceId: ${debtorDoc.debtorCode}`);
            // Verify the user matches (or is close)
            if (debtorDoc.user && debtorDoc.user.toString() !== userIdString) {
              console.log(`⚠️ User ID mismatch: Expected ${userIdString}, Found ${debtorDoc.user.toString()}`);
            }
          }
        }
        
        // 4. Try metadata.debtorId
        if (!debtorDoc && sampleTx?.metadata?.debtorId) {
          debtorDoc = await Debtor.findById(sampleTx.metadata.debtorId).select('accountCode _id user');
          if (debtorDoc) {
            console.log(`✅ Found debtor via transaction metadata.debtorId: ${debtorDoc.debtorCode}`);
          }
        }
        
        // 5. Try to extract from AR account code in transaction entries
        if (!debtorDoc && sampleTx?.entries) {
          const arAccountCode = sampleTx.entries.find(e => 
            e.accountCode && e.accountCode.startsWith('1100-') && e.accountCode !== '1100'
          )?.accountCode;
          
          if (arAccountCode) {
            const debtorIdFromCode = arAccountCode.replace('1100-', '');
            if (mongoose.Types.ObjectId.isValid(debtorIdFromCode)) {
              debtorDoc = await Debtor.findById(debtorIdFromCode).select('accountCode _id user');
              if (debtorDoc) {
                console.log(`✅ Found debtor via AR account code in transaction: ${debtorDoc.debtorCode}`);
              }
            }
          }
        }
      }
      
      // 🆕 CRITICAL FIX: Always prioritize debtor account code over user ID format
      // Accruals use debtor.accountCode (1100-{debtorId}), so we MUST use that format
      let arAccountCode;
      if (debtorDoc?.accountCode) {
        // Use debtor's account code (this is what accruals use)
        arAccountCode = debtorDoc.accountCode;
        console.log(`✅ Using debtor account code: ${arAccountCode} (from debtor record)`);
      } else {
        // 🆕 CRITICAL: If no debtor found, try to create one or find via transactions
        // Don't fall back to user ID format - accruals use debtor ID format!
        console.warn(`⚠️ No debtor found for user ${userIdString}`);
        console.warn(`   Attempting to find debtor via accrual transactions...`);
        
        // Try to find accrual transactions and extract debtor ID from account codes
        const accrualTx = await TransactionEntry.findOne({
          source: 'rental_accrual',
          status: { $ne: 'reversed' },
          $or: [
            { 'metadata.studentId': userIdString },
            { 'metadata.userId': userIdString },
            { 'sourceId': userIdString }
          ]
        }).select('entries.accountCode').lean();
        
        if (accrualTx?.entries) {
          const arCode = accrualTx.entries.find(e => e.accountCode?.startsWith('1100-') && e.accountCode !== '1100');
          if (arCode) {
            const debtorIdFromCode = arCode.accountCode.replace('1100-', '');
            if (mongoose.Types.ObjectId.isValid(debtorIdFromCode)) {
              debtorDoc = await Debtor.findById(debtorIdFromCode).select('accountCode _id user').lean();
              if (debtorDoc?.accountCode) {
                arAccountCode = debtorDoc.accountCode;
                console.log(`✅ Found debtor via accrual transaction: ${debtorDoc.debtorCode || debtorDoc._id}`);
                console.log(`✅ Using debtor account code from accrual: ${arAccountCode}`);
              }
            }
          }
        }
        
        // If still no debtor found, try to create one
        if (!arAccountCode) {
          console.warn(`⚠️ No debtor found and no accruals found for user ${userIdString}`);
          console.warn(`   Attempting to create debtor account...`);
          
          try {
            const User = require('../models/User');
            const user = await User.findById(userIdString);
            if (user && user.role === 'student') {
              const { createDebtorForStudent } = require('../services/debtorService');
              const newDebtor = await createDebtorForStudent(user, {
                createdBy: userIdString,
                notes: 'Debtor created automatically when checking outstanding balances'
              });
              
              if (newDebtor?.accountCode) {
                arAccountCode = newDebtor.accountCode;
                debtorDoc = newDebtor;
                console.log(`✅ Created debtor account: ${newDebtor.debtorCode}`);
                console.log(`✅ Using newly created debtor account code: ${arAccountCode}`);
              }
            }
          } catch (createError) {
            console.error(`❌ Error creating debtor account:`, createError.message);
          }
        }
        
        // Last resort: use user ID format (but warn that this may not match accruals)
        if (!arAccountCode) {
          arAccountCode = `1100-${userIdString}`;
          console.error(`❌ CRITICAL: No debtor found and could not create one`);
          console.error(`   Using fallback account code: ${arAccountCode}`);
          console.error(`   This may not match accruals which use debtor ID format!`);
          console.error(`   Please ensure debtor account exists for this student`);
        }
      }
      
      const debtorId = debtorDoc?._id?.toString();
      const actualUserId = debtorDoc?.user?.toString() || userIdString; // Use actual user ID from debtor if found
      
      console.log(`🔍 Debtor found: ${!!debtorDoc}, AR Account Code: ${arAccountCode}, Debtor ID: ${debtorId || 'N/A'}`);
      console.log(`🔍 Query User ID: ${userIdString}, Actual User ID: ${actualUserId}`);
      if (actualUserId !== userIdString) {
        console.log(`⚠️ User ID mismatch detected - using actual user ID for queries`);
      }
      
      // 🆕 CRITICAL FIX: Always search by debtor account code FIRST (this is what accruals use)
      // Accruals use debtor.accountCode format (1100-{debtorId}), not user ID format
      const queryConditions = [
        { 'entries.accountCode': arAccountCode } // PRIMARY: Use debtor account code (what accruals use)
      ];
      
      // Add debtor ID checks if available (accruals may reference debtor ID)
      if (debtorId) {
        queryConditions.push(
          { 'sourceId': debtorId }, // Accruals may have sourceId = debtor._id
          { 'metadata.debtorId': debtorId },
          { 'entries.accountCode': { $regex: `^1100-${debtorId}` }} // Also check debtor ID format explicitly
        );
      }
      
      // Add user ID checks (for legacy transactions and metadata) - use BOTH query ID and actual ID
      queryConditions.push(
        { 'metadata.userId': actualUserId }, // Use actual user ID from debtor
        { 'metadata.studentId': actualUserId }, // Keep for backward compatibility
        { 'metadata.userId': userIdString }, // Also check query user ID in case of typos
        { 'metadata.studentId': userIdString },
        { 'sourceId': actualUserId },
        { 'sourceId': userIdString },
        { 'entries.accountCode': { $regex: `^1100-${actualUserId}` }}, // Legacy user ID format (actual)
        { 'entries.accountCode': { $regex: `^1100-${userIdString}` }}, // Query user ID format (fallback)
        { 'reference': { $regex: actualUserId }},
        { 'reference': { $regex: userIdString }},
        { 'description': { $regex: actualUserId, $options: 'i' }},
        { 'description': { $regex: userIdString, $options: 'i' }}
      );
      
      const allUserTransactions = await TransactionEntry.find({
        $or: queryConditions
      }).lean().sort({ date: 1 });

      console.log(`📊 Found ${allUserTransactions.length} total transactions for user ${userId}`);
      console.log(`🔍 AR Account Code: ${arAccountCode}`);
      console.log(`🔍 User ID String: ${userIdString}`);
      
      // Debug: Show first few transactions if any found
      if (allUserTransactions.length > 0) {
        console.log(`🔍 Sample transactions:`);
        allUserTransactions.slice(0, 3).forEach((tx, index) => {
          console.log(`  ${index + 1}. ${tx.transactionId} - ${tx.description}`);
          if (tx.entries && tx.entries.length > 0) {
            tx.entries.forEach(entry => {
              if (entry.accountCode && entry.accountCode.includes(userIdString)) {
                console.log(`     Entry: ${entry.accountCode} ${entry.accountType} ${entry.debit}/${entry.credit}`);
              }
            });
          }
        });
      }
      
      // If no transactions found, try alternative approaches
      if (allUserTransactions.length === 0) {
        console.log(`ℹ️ No transactions found with primary query, trying alternative approaches...`);
        
        // 🆕 CRITICAL: If we found a debtor via transaction lookup, use its account code
        if (debtorDoc && debtorDoc.accountCode && debtorDoc.accountCode !== arAccountCode) {
          console.log(`🔍 Trying to find transactions using debtor account code: ${debtorDoc.accountCode}`);
          const txByDebtorAccount = await TransactionEntry.find({
            'entries.accountCode': debtorDoc.accountCode
          }).lean().sort({ date: 1 });
          
          if (txByDebtorAccount.length > 0) {
            console.log(`✅ Found ${txByDebtorAccount.length} transactions using debtor account code`);
            allUserTransactions.push(...txByDebtorAccount);
          }
        }
        
        // Try finding transactions by student ID in different fields
        if (allUserTransactions.length === 0) {
          const alternativeQuery = await TransactionEntry.find({
            $or: [
              { 'metadata.studentId': userIdString },
              { 'metadata.userId': userIdString },
              { 'sourceId': userIdString },
              { 'reference': userIdString },
              { 'description': { $regex: userIdString, $options: 'i' }},
              { 'entries.description': { $regex: userIdString, $options: 'i' }}
            ]
          }).lean().sort({ date: 1 });
          
          console.log(`🔍 Alternative query found ${alternativeQuery.length} transactions`);
          
          if (alternativeQuery.length === 0) {
            console.log(`ℹ️ No transactions found for user ${userId} with any approach`);
            
            // 🆕 CRITICAL FIX: Check if this is a new student with no accruals yet
            // If they have a debtor record but no transactions, return empty array gracefully
            if (debtorDoc) {
              console.log(`✅ Debtor exists (${debtorDoc.debtorCode}) but no transactions yet - student may be new`);
              console.log(`   This is normal for new students before accruals are created`);
            } else {
              console.log(`⚠️ No debtor found for user ${userId} - student may need debtor creation`);
            }
            
            return [];
          } else {
            console.log(`✅ Found ${alternativeQuery.length} transactions with alternative query`);
            // Use the alternative results
            allUserTransactions.push(...alternativeQuery);
          }
        }
      }
      
      // Separate different types of transactions
      const accruals = allUserTransactions.filter(tx => {
        // 🆕 CRITICAL: Always use the debtor's accountCode (could be debtor ID or user ID format)
        // Check if transaction has AR debit entry matching the debtor's account code
        const hasARDebit = tx.entries && tx.entries.some(entry => 
          entry.accountCode === arAccountCode && 
          entry.accountType === 'Asset' && 
          entry.debit > 0
        );
        
        if (hasARDebit) {
          console.log(`🔍 Found AR debit transaction: ${tx.transactionId} - ${tx.description} (AR: ${arAccountCode})`);
          return true;
        }
        
        // Include rental accruals that match the account code
        if (tx.source === 'rental_accrual') {
          const hasMatchingAccount = tx.entries && tx.entries.some(entry => 
            entry.accountCode === arAccountCode
          );
          if (hasMatchingAccount) {
            return true;
          }
        }
        
        // For lease start transactions, check if they have the correct account code
        if (tx.metadata?.type === 'lease_start' || tx.source === 'lease_start') {
          const hasMatchingAccount = tx.entries && tx.entries.some(entry => 
            entry.accountCode === arAccountCode
          );
          if (hasMatchingAccount) {
            return true;
          }
        }
        
        return false;
      });
      
      // 🆕 Include payment and allocation transactions linked by studentId, sourceId, or AR account credit
      // 🆕 CRITICAL: Exclude advance_payment transactions - they net to zero in AR and should not affect outstanding balances
      const payments = allUserTransactions.filter(tx => {
        // 🆕 EXCLUDE advance payment transactions - they have AR entries that net to zero
        // Advance payments: DR Cash, CR AR, DR AR, CR Deferred Income (AR nets to zero)
        if (tx.source === 'advance_payment') {
          console.log(`⏭️ Skipping advance payment transaction: ${tx.transactionId} - AR entries net to zero`);
          return false;
        }
        
        const isAllocation = tx.metadata?.allocationType === 'payment_allocation';
        const isPayment = tx.source === 'payment';
        const matchesStudent = tx.metadata?.studentId?.toString() === userIdString || tx.metadata?.userId?.toString() === userIdString || (tx.sourceId && tx.sourceId.toString() === userIdString);
        const touchesAR = Array.isArray(tx.entries) && tx.entries.some(e => e.accountCode === arAccountCode && e.accountType === 'Asset' && e.credit > 0);
        // Include if it's a payment allocation, or if it's a payment (NOT advance_payment) that matches student or touches AR
        return isAllocation || (isPayment && (matchesStudent || touchesAR));
      });
      
      // 🆕 Include manual transactions (negotiations, reversals, etc.) that affect AR
      // 🆕 CRITICAL: Negotiated payments must use the correct debtor account code
      const manualAdjustments = allUserTransactions.filter(tx => {
        const isManual = tx.source === 'manual';
        // Check if transaction touches the debtor's AR account code (exact match required)
        const touchesAR = Array.isArray(tx.entries) && tx.entries.some(e => 
          e.accountCode === arAccountCode && e.accountType === 'Asset'
        );
        const matchesStudent = tx.metadata?.studentId?.toString() === userIdString || 
                             tx.metadata?.studentId?.toString() === actualUserId ||
                             tx.metadata?.userId?.toString() === userIdString ||
                             tx.metadata?.userId?.toString() === actualUserId;
        const isNegotiated = tx.metadata?.type === 'negotiated_payment_adjustment' || 
                            tx.metadata?.transactionType === 'negotiated_payment_adjustment' ||
                            (tx.description && /negotiated|discount/i.test(tx.description));
        
        // Include if it's manual and (touches AR with correct account code, matches student, or is a negotiated payment)
        return isManual && (touchesAR || matchesStudent || isNegotiated);
      });
      
      console.log(`📊 Found ${accruals.length} accrual transactions, ${payments.length} payment transactions, and ${manualAdjustments.length} manual adjustments`);
      
      // 🆕 DEBUG: Log manual adjustments found
      if (manualAdjustments.length > 0) {
        console.log(`🔧 Manual adjustments found:`);
        manualAdjustments.forEach(adj => {
          console.log(`   - ${adj.transactionId}: ${adj.description}`);
          console.log(`     Type: ${adj.metadata?.type || adj.metadata?.transactionType || 'unknown'}`);
          console.log(`     AR Account Code: ${adj.entries?.find(e => e.accountCode?.startsWith('1100-'))?.accountCode || 'N/A'}`);
          console.log(`     Expected AR Code: ${arAccountCode}`);
        });
      }
      
      // Debug: Log payment transactions found
      if (payments.length > 0) {
        console.log(`🔍 Payment transactions found:`);
        payments.forEach((payment, index) => {
          const arEntry = Array.isArray(payment.entries) && payment.entries.find(e => e.accountCode === arAccountCode && e.accountType === 'Asset' && e.credit > 0);
          const amount = arEntry?.credit || 0;
          console.log(`  Payment ${index + 1}: ${payment.transactionId}`);
          console.log(`    Date: ${payment.date}`);
          console.log(`    Source: ${payment.source}`);
          console.log(`    Amount: $${amount}`);
          console.log(`    monthSettled: ${payment.metadata?.monthSettled || 'NOT SET'}`);
          console.log(`    paymentMonth: ${payment.metadata?.paymentMonth || 'NOT SET'}`);
          console.log(`    arTransactionId: ${payment.metadata?.arTransactionId || 'NOT SET'}`);
          console.log(`    Description: ${payment.description || 'N/A'}`);
        });
      }
      
      // Debug: Log the accrual transactions found
      console.log(`🔍 Found ${accruals.length} accrual transactions:`);
      accruals.forEach((accrual, index) => {
        const monthKey = accrual.metadata?.month || (() => {
          const d = new Date(accrual.date);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        })();
        console.log(`📋 Accrual ${index + 1}:`);
        console.log(`   ID: ${accrual._id}`);
        console.log(`   Transaction ID: ${accrual.transactionId}`);
        console.log(`   Date: ${accrual.date}`);
        console.log(`   Month Key: ${monthKey}`);
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
            rent: { owed: 0, paid: 0, outstanding: 0, originalOwed: 0, negotiatedDiscount: 0 }, // 🆕 Track original and negotiated separately
            adminFee: { owed: 0, paid: 0, outstanding: 0, originalOwed: 0 }, // 🆕 Track original admin fee from accrual
            deposit: { owed: 0, paid: 0, outstanding: 0, originalOwed: 0 }, // 🆕 Track original deposit from accrual
            totalOutstanding: 0,
            transactionId: accrual._id,
            source: accrual.source,
            metadata: accrual.metadata
          };
          console.log(`📅 Created monthly outstanding for ${monthKey} with transaction ID: ${accrual._id} (type: ${accrual.metadata?.type || accrual.source})`);
        } else {
          console.log(`⚠️ WARNING: Multiple accruals found for ${monthKey}!`);
          console.log(`   Existing transaction: ${monthlyOutstanding[monthKey].transactionId} (type: ${monthlyOutstanding[monthKey].metadata?.type || monthlyOutstanding[monthKey].source})`);
          console.log(`   New transaction: ${accrual._id} (type: ${accrual.metadata?.type || accrual.source})`);
          console.log(`   This may indicate duplicate accruals for the same month.`);
        }
        
        // 🆕 FIX: For lease_start transactions, ONLY use income/liability entries to determine breakdown
        // Do NOT process AR debit entries for lease_start as they may contain totals that need to be broken down
        if (accrual.metadata?.type === 'lease_start') {
          console.log(`🔍 Processing lease start transaction breakdown: ${accrual._id}`);
          console.log(`   Transaction totalDebit: ${accrual.totalDebit}, totalCredit: ${accrual.totalCredit}`);
          console.log(`   Metadata proratedRent: ${accrual.metadata?.proratedRent}, adminFee: ${accrual.metadata?.adminFee}, securityDeposit: ${accrual.metadata?.securityDeposit}`);
          
          // For lease_start, categorize based ONLY on the income/liability entries (not AR debit entries)
          // This ensures we get the correct breakdown: rent from 4001, admin fee from 4002, deposit from 2020
          // 🆕 CRITICAL: Skip AR debit entries entirely for lease_start transactions
          accrual.entries.forEach(entry => {
            const description = (entry.description || '').toLowerCase();
            
            // 🆕 SKIP AR debit entries for lease_start - they are totals, not individual components
            if (entry.accountCode.startsWith('1100-') && entry.accountType === 'Asset' && entry.debit > 0) {
              console.log(`  ⏭️ Skipping AR debit entry: $${entry.debit} (this is a total, not a component)`);
              return;
            }
            
            // Admin fee entry (account 4002) - Income account
            if (entry.accountCode === '4002' && entry.accountType === 'Income' && entry.credit > 0) {
              monthlyOutstanding[monthKey].adminFee.owed += entry.credit;
              monthlyOutstanding[monthKey].adminFee.originalOwed = (monthlyOutstanding[monthKey].adminFee.originalOwed || 0) + entry.credit; // 🆕 Track original admin fee
              console.log(`  → Found admin fee in lease start: $${entry.credit}`);
            }
            
            // Deposit entry (account 2020) - Liability account
            if (entry.accountCode === '2020' && entry.accountType === 'Liability' && entry.credit > 0) {
              monthlyOutstanding[monthKey].deposit.owed += entry.credit;
              monthlyOutstanding[monthKey].deposit.originalOwed = (monthlyOutstanding[monthKey].deposit.originalOwed || 0) + entry.credit; // 🆕 Track original deposit
              console.log(`  → Found deposit in lease start: $${entry.credit}`);
            }
            
            // Rent entry (account 4001) - Income account (prorated or full month)
            if (entry.accountCode === '4001' && entry.accountType === 'Income' && entry.credit > 0) {
              monthlyOutstanding[monthKey].rent.owed += entry.credit;
              monthlyOutstanding[monthKey].rent.originalOwed = (monthlyOutstanding[monthKey].rent.originalOwed || 0) + entry.credit; // 🆕 Track original accrual amount
              console.log(`  → Found rent in lease start: $${entry.credit} (${description.includes('prorated') ? 'prorated' : 'full month'})`);
            }
          });
          
          console.log(`  ✅ Lease start breakdown: Rent=$${monthlyOutstanding[monthKey].rent.originalOwed || monthlyOutstanding[monthKey].rent.owed}, AdminFee=$${monthlyOutstanding[monthKey].adminFee.originalOwed || monthlyOutstanding[monthKey].adminFee.owed}, Deposit=$${monthlyOutstanding[monthKey].deposit.originalOwed || monthlyOutstanding[monthKey].deposit.owed}`);
          console.log(`  ✅ Original Owed: Rent=$${monthlyOutstanding[monthKey].rent.originalOwed}, AdminFee=$${monthlyOutstanding[monthKey].adminFee.originalOwed}, Deposit=$${monthlyOutstanding[monthKey].deposit.originalOwed}`);
        } else {
          // For monthly_rent_accrual and other accrual types, categorize by AR debit entry description
          accrual.entries.forEach(entry => {
            if (entry.accountCode.startsWith('1100-') && entry.accountType === 'Asset' && entry.debit > 0) {
              const description = (entry.description || '').toLowerCase();
              
              if (description.includes('admin fee') || description.includes('administrative')) {
                monthlyOutstanding[monthKey].adminFee.owed += entry.debit;
                monthlyOutstanding[monthKey].adminFee.originalOwed = (monthlyOutstanding[monthKey].adminFee.originalOwed || 0) + entry.debit; // 🆕 Track original admin fee
              } else if (description.includes('security deposit') || description.includes('deposit')) {
                monthlyOutstanding[monthKey].deposit.owed += entry.debit;
                monthlyOutstanding[monthKey].deposit.originalOwed = (monthlyOutstanding[monthKey].deposit.originalOwed || 0) + entry.debit; // 🆕 Track original deposit
              } else {
                // Default to rent for monthly accruals
                monthlyOutstanding[monthKey].rent.owed += entry.debit;
                monthlyOutstanding[monthKey].rent.originalOwed = (monthlyOutstanding[monthKey].rent.originalOwed || 0) + entry.debit; // 🆕 Track original accrual amount
              }
            }
          });
        }
      });
      
             // 🆕 FIXED: Only work with actual accruals that exist for this specific student
       // Do NOT create virtual months as they don't have real AR transactions to allocate to
       console.log(`📊 Working with ${Object.keys(monthlyOutstanding).length} actual accrual months for user ${userId}`);
      
      // 🆕 Process payments: subtract by monthSettled; fallback to allocation metadata, description, or FIFO if missing
      payments.forEach(payment => {
        // Look for monthSettled in metadata for payment allocation transactions
        let monthSettled = payment.metadata?.monthSettled;
        const paymentType = payment.metadata?.paymentType;
        const arEntry = Array.isArray(payment.entries) && payment.entries.find(e => e.accountCode === arAccountCode && e.accountType === 'Asset' && e.credit > 0);
        const amount = arEntry?.credit || 0;
        if (amount <= 0) return;
        
        // 🆕 IMPROVED: Try multiple methods to determine which month this payment applies to
        if (!monthSettled) {
          // Method 1: Check payment allocation metadata
          if (payment.metadata?.paymentAllocation?.month) {
            monthSettled = payment.metadata.paymentAllocation.month;
            console.log(`🔍 Found month from paymentAllocation.month: ${monthSettled}`);
          }
          // Method 2: Check paymentMonth metadata
          else if (payment.metadata?.paymentMonth) {
            monthSettled = payment.metadata.paymentMonth;
            console.log(`🔍 Found month from paymentMonth: ${monthSettled}`);
          }
          // Method 3: Check arTransactionId and find the accrual month
          else if (payment.metadata?.arTransactionId) {
            const arTxId = payment.metadata.arTransactionId;
            const matchingAccrual = accruals.find(acc => acc._id?.toString() === arTxId.toString() || acc.transactionId === arTxId);
            if (matchingAccrual) {
              monthSettled = matchingAccrual.metadata?.month || (() => {
                const d = new Date(matchingAccrual.date);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
              })();
              console.log(`🔍 Found month from arTransactionId ${arTxId}: ${monthSettled}`);
            }
          }
          // Method 4: Parse description for month (e.g., "Payment allocation: rent for 2025-12")
          else if (payment.description) {
            const monthMatch = payment.description.match(/for\s+(\d{4})-(\d{1,2})/i);
            if (monthMatch) {
              monthSettled = `${monthMatch[1]}-${String(monthMatch[2]).padStart(2, '0')}`;
              console.log(`🔍 Found month from description: ${monthSettled}`);
            }
          }
          // Method 5: Check entry description for month
          else if (arEntry?.description) {
            const monthMatch = arEntry.description.match(/for\s+(\d{4})-(\d{1,2})/i) || arEntry.description.match(/(\d{4})-(\d{1,2})/);
            if (monthMatch) {
              monthSettled = `${monthMatch[1]}-${String(monthMatch[2]).padStart(2, '0')}`;
              console.log(`🔍 Found month from entry description: ${monthSettled}`);
            }
          }
        }
        
        if (monthSettled && monthlyOutstanding[monthSettled]) {
          console.log(`💰 Applying payment to ${monthSettled}: $${amount} (${paymentType || 'unknown'})`);
          if (paymentType === 'admin') {
            monthlyOutstanding[monthSettled].adminFee.paid += amount;
          } else if (paymentType === 'deposit') {
            monthlyOutstanding[monthSettled].deposit.paid += amount;
          } else if (paymentType === 'rent') {
            monthlyOutstanding[monthSettled].rent.paid += amount;
          } else {
            // Fallback by description hint
            const desc = (arEntry?.description || payment.description || '').toLowerCase();
            if (desc.includes('admin')) monthlyOutstanding[monthSettled].adminFee.paid += amount;
            else if (desc.includes('deposit')) monthlyOutstanding[monthSettled].deposit.paid += amount;
            else monthlyOutstanding[monthSettled].rent.paid += amount;
          }
          return;
        }

        // FIFO fallback: apply to oldest months with outstanding
        if (!monthSettled) {
          console.log(`⚠️ No monthSettled found for payment ${payment.transactionId}, using FIFO allocation`);
        } else {
          console.log(`⚠️ Month ${monthSettled} not found in outstanding balances, using FIFO allocation`);
        }
        
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
            const originalTransaction = allUserTransactions.find(t => t.transactionId === adjustment.metadata.originalTransactionId);
            if (originalTransaction && originalTransaction.metadata?.accrualMonth && originalTransaction.metadata?.accrualYear) {
              monthKey = `${originalTransaction.metadata.accrualYear}-${String(originalTransaction.metadata.accrualMonth).padStart(2, '0')}`;
            }
          }
          
          // 🆕 For negotiated payments, try to find matching accrual by date
          if (!monthKey && (adjustment.metadata?.type === 'negotiated_payment_adjustment' || adjustment.metadata?.transactionType === 'negotiated_payment_adjustment')) {
            // Look for accruals that might match this adjustment by date
            const adjDate = new Date(adjustment.date);
            const matchingAccrual = accruals.find(acc => {
              const accDate = new Date(acc.date);
              // Check if adjustment date is in the same month as accrual
              return adjDate.getFullYear() === accDate.getFullYear() && 
                     adjDate.getMonth() === accDate.getMonth();
            });
            if (matchingAccrual) {
              monthKey = matchingAccrual.metadata?.month || (() => {
                const d = new Date(matchingAccrual.date);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
              })();
              console.log(`   ✅ Found matching accrual month by date: ${monthKey}`);
            }
          }
          
          // Fallback to transaction date
          if (!monthKey) {
            const d = new Date(adjustment.date);
            monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          }
        }
        
        if (!monthKey || !monthlyOutstanding[monthKey]) {
          console.log(`   ⚠️ No matching month found for adjustment: ${monthKey || 'unknown'}`);
          console.log(`      Available months: ${Object.keys(monthlyOutstanding).join(', ')}`);
          // 🆕 Try to apply to closest month if exact match not found
          if (monthKey && !monthlyOutstanding[monthKey]) {
            // Find the closest month
            const availableMonths = Object.keys(monthlyOutstanding).sort();
            const closestMonth = availableMonths.find(m => m >= monthKey) || availableMonths[availableMonths.length - 1];
            if (closestMonth) {
              console.log(`   🔄 Applying to closest month: ${closestMonth} (requested: ${monthKey})`);
              monthKey = closestMonth;
            } else {
              return; // No months available
            }
          } else if (!monthKey) {
            return; // Could not determine month
          }
        }
        
        console.log(`   📅 Applying to month: ${monthKey}`);
        
        // Process AR entries in the adjustment
        adjustment.entries.forEach(entry => {
          // 🆕 CRITICAL: Check if entry matches the debtor's AR account code (exact match required)
          // Negotiated payments must use the correct debtor account code
          const matchesAR = entry.accountCode === arAccountCode;
          
          if (matchesAR && entry.accountType === 'Asset') {
            const amount = entry.credit || 0;
            const description = (entry.description || '').toLowerCase();
            
            console.log(`   💰 AR adjustment: ${entry.debit > 0 ? 'debit' : 'credit'} $${amount} - ${entry.description}`);
            console.log(`      Entry AR Code: ${entry.accountCode}, Expected: ${arAccountCode}`);
            
            if (adjustment.metadata?.type === 'negotiated_payment_adjustment' || adjustment.metadata?.transactionType === 'negotiated_payment_adjustment') {
              // Negotiated payment reduces rent owed
              monthlyOutstanding[monthKey].rent.owed = Math.max(0, monthlyOutstanding[monthKey].rent.owed - amount);
              monthlyOutstanding[monthKey].rent.negotiatedDiscount = (monthlyOutstanding[monthKey].rent.negotiatedDiscount || 0) + amount; // 🆕 Track negotiated discount separately
              console.log(`   📉 Negotiated payment: Reduced rent owed by $${amount} (total negotiated: $${monthlyOutstanding[monthKey].rent.negotiatedDiscount})`);
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
      
      console.log(`📅 Detailed outstanding balances for user ${userId} (FIFO order):`);
      outstandingArray.forEach(month => {
        const originalRentOwed = month.rent.originalOwed || month.rent.owed;
        const negotiatedDiscount = month.rent.negotiatedDiscount || 0;
        console.log(`  ${month.monthKey} (${month.monthName}):`);
        console.log(`    Rent: Original=$${originalRentOwed.toFixed(2)}, Negotiated Discount=$${negotiatedDiscount.toFixed(2)}, Net Owed=$${month.rent.owed.toFixed(2)}, Paid=$${month.rent.paid.toFixed(2)}, Outstanding=$${month.rent.outstanding.toFixed(2)}`);
        console.log(`    Admin Fee: Owed=$${month.adminFee.owed.toFixed(2)}, Paid=$${month.adminFee.paid.toFixed(2)}, Outstanding=$${month.adminFee.outstanding.toFixed(2)}`);
        console.log(`    Deposit: Owed=$${month.deposit.owed.toFixed(2)}, Paid=$${month.deposit.paid.toFixed(2)}, Outstanding=$${month.deposit.outstanding.toFixed(2)}`);
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
      const userId = paymentData.studentId || paymentData.userId;
      const hasStudentAccount = arTransaction.entries.some(entry => 
        entry.accountCode === `1100-${userId}`
      );
      
      if (!hasStudentAccount) {
        throw new Error(`AR transaction ${transactionId} does not belong to user ${userId}`);
      }
      
      console.log(`✅ Found AR transaction: ${arTransaction._id}`);
      console.log(`📝 AR transaction description: ${arTransaction.description}`);
      console.log(`✅ Verified AR transaction belongs to user: ${userId}`);
      
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
  static async createAdvancePaymentTransaction(paymentId, userId, amount, paymentData, paymentType) {
    try {
      console.log(`💳 Creating advance payment transaction for $${amount} ${paymentType}`);
      
      const mongoose = require('mongoose');
      const TransactionEntry = require('../models/TransactionEntry');
      const Account = require('../models/Account');
      const User = require('../models/User');
      
      // Convert paymentId to ObjectId if it's a string
      let paymentObjectId = paymentId;
      if (typeof paymentId === 'string' && mongoose.Types.ObjectId.isValid(paymentId)) {
        paymentObjectId = new mongoose.Types.ObjectId(paymentId);
      }
      
      // 🆕 CRITICAL FIX: Check if advance payment transaction already exists
      // This prevents duplicate transactions if called multiple times
      // Check with multiple query patterns to catch all possible matches
      const paymentIdStr = paymentId?.toString ? paymentId.toString() : String(paymentId);
      const paymentDate = paymentData.date ? new Date(paymentData.date) : new Date();
      
      // Check 1: By payment ID (primary check)
      const existingAdvanceTx = await TransactionEntry.findOne({
        $or: [
          { sourceId: paymentObjectId },
          { sourceId: paymentIdStr },
          { 'metadata.paymentId': paymentIdStr },
          { 'metadata.paymentId': paymentId },
          { reference: paymentIdStr },
          { reference: paymentId }
        ],
        source: 'advance_payment',
        status: { $ne: 'reversed' }
      });
      
      if (existingAdvanceTx) {
        console.log(`⚠️ Advance payment transaction already exists for payment ${paymentId}: ${existingAdvanceTx.transactionId}`);
        console.log(`   Skipping duplicate creation - returning existing transaction`);
        console.log(`   🚨 Creating duplicate would overstate cash received`);
        return existingAdvanceTx;
      }
      
      // 🆕 Check 2: By student + amount + date (catches potential duplicates with different payment IDs)
      // This prevents creating multiple advance payments for the same student/amount/date combination
      const existingByStudentAmountDate = await TransactionEntry.findOne({
        $or: [
          { 'metadata.studentId': userIdStr },
          { 'metadata.debtorId': debtor?._id?.toString() }
        ],
        'entries.accountCode': { $regex: '^100' }, // Has cash entry
        'entries.debit': amount, // Same amount
        date: {
          $gte: new Date(paymentDate.getFullYear(), paymentDate.getMonth(), paymentDate.getDate()),
          $lt: new Date(paymentDate.getFullYear(), paymentDate.getMonth(), paymentDate.getDate() + 1)
        },
        source: 'advance_payment',
        status: { $ne: 'reversed' }
      });
      
      if (existingByStudentAmountDate) {
        console.log(`⚠️ Advance payment transaction already exists for student ${userIdStr} with amount $${amount} on ${paymentDate.toISOString().split('T')[0]}`);
        console.log(`   Existing transaction: ${existingByStudentAmountDate.transactionId}`);
        console.log(`   Skipping duplicate creation - returning existing transaction`);
        console.log(`   🚨 Creating duplicate would overstate cash received`);
        return existingByStudentAmountDate;
      }
      
      // Get student name for AR account
      let studentName = 'Student';
      try {
        const student = await User.findById(userId).select('firstName lastName').lean();
        if (student) {
          studentName = `${student.firstName} ${student.lastName}`;
        }
      } catch (error) {
        console.log('⚠️ Could not fetch student details, using default name');
      }
      
      // CRITICAL: Ensure userId is converted to string to prevent wrong AR codes
      let userIdStr = userId;
      if (userId && typeof userId === 'object') {
        userIdStr = userId.toString();
      } else {
        userIdStr = String(userId);
      }
      
      // CRITICAL: Verify this is a student ID, not an application ID
      // First check if it's an Application ID
      const Application = require('../models/Application');
      const application = await Application.findById(userIdStr);
      if (application) {
        // This is an Application ID - get the student ID from the application
        if (application.student) {
          const correctStudentId = application.student.toString ? application.student.toString() : String(application.student);
          console.log(`⚠️  userId ${userIdStr} is an Application ID (${application.applicationCode || 'N/A'}), using student from application: ${correctStudentId}`);
          userIdStr = correctStudentId;
        } else {
          throw new Error(`Application ${userIdStr} has no student field`);
        }
      }
      
      // Verify this is a student ID
      const student = await User.findById(userIdStr);
      if (!student) {
        // If userId doesn't match a student, try to get student from payment
        const Payment = require('../models/Payment');
        const payment = await Payment.findById(paymentId);
        if (payment && payment.student) {
          const correctStudentId = payment.student.toString ? payment.student.toString() : String(payment.student);
          console.log(`⚠️  userId ${userIdStr} is not a valid student ID, using student from payment: ${correctStudentId}`);
          userIdStr = correctStudentId;
        } else {
          throw new Error(`Invalid userId: ${userIdStr} - not a valid student ID and cannot find student from payment ${paymentId}`);
        }
      }
      
      // 🆕 CRITICAL FIX: ALWAYS use debtor's account code (not payload)
      // Accruals use debtor account codes (1100-{debtorId}), so payments must match
      // Get Debtor first to use correct AR code (use userIdStr which is the corrected student ID)
      const Debtor = require('../models/Debtor');
      const debtor = await Debtor.findOne({ user: userIdStr }).select('accountCode _id').lean();
      
      let studentARCode = null;
      
      if (debtor?.accountCode) {
        // ✅ CORRECT: Use debtor's account code (this is what accruals use)
        studentARCode = debtor.accountCode;
        console.log(`✅ Using debtor account code for advance payment: ${studentARCode}`);
        
        // Warn if payload account code doesn't match debtor account code
        if (paymentData.accountCode && paymentData.accountCode !== debtor.accountCode) {
          console.warn(`⚠️ Payload account code (${paymentData.accountCode}) doesn't match debtor account code (${debtor.accountCode})`);
          console.warn(`   Using debtor account code to ensure it matches accruals`);
        }
      } else if (debtor?._id) {
        // Fallback: use debtor ID format if accountCode not set
        studentARCode = `1100-${debtor._id.toString()}`;
        console.log(`⚠️ Debtor exists but no accountCode, using debtor ID: ${studentARCode}`);
      } else if (paymentData.accountCode && paymentData.accountCode.startsWith('1100-')) {
        // Last resort: use payload account code if debtor not found
        studentARCode = paymentData.accountCode;
        console.warn(`⚠️ No debtor found, using account code from payload: ${studentARCode} (this should be fixed)`);
      } else {
        // Absolute last resort: use user ID (should not happen)
        studentARCode = `1100-${userIdStr}`;
        console.warn(`⚠️ No debtor found and no accountCode in payload, using user ID format: ${studentARCode} (this should be fixed)`);
      }
      
      // Ensure student AR account exists
      let studentARAccount = await Account.findOne({ code: studentARCode });
      if (!studentARAccount) {
        const mainAR = await Account.findOne({ code: '1100' });
        if (!mainAR) {
          throw new Error('Main AR account (1100) not found');
        }
        studentARAccount = new Account({
          code: studentARCode,
          name: `Accounts Receivable - ${studentName}`,
          type: 'Asset',
          category: 'Current Assets',
          subcategory: 'Accounts Receivable',
          description: 'Student-specific AR control account (uses Debtor ID for persistence)',
          isActive: true,
          parentAccount: mainAR._id,
          level: 2,
          sortOrder: 0,
          metadata: new Map([
            ['parent', '1100'],
            ['hasParent', 'true'],
            ['studentId', String(userId)],
            ['debtorId', debtor?._id?.toString() || ''],
            ['accountCodeFormat', debtor?._id ? 'debtor_id' : 'user_id']
          ])
        });
        await studentARAccount.save();
        console.log(`✅ Created student AR account: ${studentARCode} (${debtor?._id ? 'debtor ID format' : 'user ID format'})`);
      }
      
      // Determine liability account based on type
      const isDeposit = paymentType === 'deposit';
      const liabilityAccountCode = isDeposit ? '2020' : '2200';
      const liabilityAccountName = isDeposit ? 'Tenant Security Deposits' : 'Advance Payment Liability';

      // Determine monthSettled for deposit: use lease_start month if available
      // Also determine intendedLeaseStartMonth from application if available
      let monthSettled = null;
      let intendedLeaseStartMonth = paymentData.intendedLeaseStartMonth || null;
      
      if (isDeposit) {
        try {
          const leaseStartAccrual = await TransactionEntry.findOne({
            source: 'rental_accrual',
            'metadata.type': 'lease_start',
            'metadata.studentId': userIdStr
          }).sort({ date: 1 }).lean();
          if (leaseStartAccrual) {
            const d = new Date(leaseStartAccrual.date);
            monthSettled = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          }
        } catch (_) {
          // ignore lookup errors, fallback to null
        }
      }
      
      // 🆕 If no intendedLeaseStartMonth from paymentData, try to get it from application
      if (!intendedLeaseStartMonth) {
        try {
          const Application = require('../models/Application');
          const application = await Application.findOne({
            student: userIdStr,
            status: 'approved'
          }).sort({ applicationDate: -1 }).lean();
          
          if (application && application.startDate) {
            const startDate = new Date(application.startDate);
            intendedLeaseStartMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
            console.log(`📅 Found intended lease start month from application: ${intendedLeaseStartMonth}`);
          }
        } catch (_) {
          // ignore lookup errors, fallback to null
        }
      }

      // Create transaction with 4 entries to show advance payment in student AR
      // 1. DR Cash (money received)
      // 2. CR Student AR (shows student paid, creating credit/advance balance)
      // 3. DR Student AR (transfers the credit to deferred income)
      // 4. CR Deferred Income (liability for future periods)
      // Net effect: Cash +300, AR 0 (but transaction history shows advance), Deferred Income +300
      const advanceTransaction = new TransactionEntry({
        transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        date: paymentData.date ? new Date(paymentData.date) : new Date(),
        description: isDeposit ? 'Deposit received (liability)' : `Advance ${paymentType} payment for future periods`,
        reference: paymentId,
        entries: [
          // Entry 1: Debit Cash (money received)
          {
            accountCode: '1000', // Cash account
            accountName: 'Cash',
            accountType: 'Asset',
            debit: amount,
            credit: 0,
            description: isDeposit ? 'Deposit payment received' : `Advance ${paymentType} payment received`
          },
          // Entry 2: Credit Student AR (shows student paid, creating credit/advance)
          {
            accountCode: studentARCode,
            accountName: `Accounts Receivable - ${studentName}`,
            accountType: 'Asset',
            debit: 0,
            credit: amount,
            description: isDeposit ? `Deposit received from ${studentName} (${paymentId})` : `Advance ${paymentType} payment from ${studentName} (${paymentId}) - shows as credit/advance`
          },
          // Entry 3: Debit Student AR (transfers credit to deferred income)
          {
            accountCode: studentARCode,
            accountName: `Accounts Receivable - ${studentName}`,
            accountType: 'Asset',
            debit: amount,
            credit: 0,
            description: isDeposit ? `Transfer deposit to liability account` : `Transfer advance payment to deferred income for future periods`
          },
          // Entry 4: Credit Deferred Income (liability for future periods)
          {
            accountCode: liabilityAccountCode,
            accountName: liabilityAccountName,
            accountType: 'Liability',
            debit: 0,
            credit: amount,
            description: isDeposit ? `Deposit received from ${studentName} (${paymentId})` : `Advance ${paymentType} payment from ${studentName} (${paymentId})`
          }
        ],
        totalDebit: amount * 2, // Cash debit + AR debit
        totalCredit: amount * 2, // AR credit + Deferred Income credit
        source: 'advance_payment',
        sourceId: paymentObjectId, // Link to Payment model
        sourceModel: 'Payment',
        residence: paymentData.residence || null, // Handle null residence
        createdBy: 'system',
        status: 'posted',
        metadata: {
          paymentId: paymentId,
          studentId: userIdStr, // Use verified student ID (for reference)
          debtorId: debtor?._id?.toString() || null, // CRITICAL: Store Debtor ID (stable, persists after User deletion)
          amount: amount,
          paymentType: paymentType,
          advanceType: 'future_payment',
          allocationType: 'advance_payment',
          description: isDeposit ? 'Deposit received (liability)' : `Advance ${paymentType} payment for future periods`,
          monthSettled: monthSettled,
          // 🆕 Store paymentMonth if provided (indicates intended month for advance payment)
          paymentMonth: paymentData.paymentMonth || null,
          // 🆕 Store lease start date if available (helps match advance payments to lease starts)
          intendedLeaseStartMonth: paymentData.intendedLeaseStartMonth || null
        }
      });
      
      await advanceTransaction.save();
      console.log(`✅ Advance payment transaction created: ${advanceTransaction._id}`);
      
      // Log advance payment transaction creation to audit log
      await logSystemOperation('create', 'TransactionEntry', advanceTransaction._id, {
        source: 'Enhanced Payment Allocation Service',
        type: 'advance_payment',
        paymentId: paymentId,
        studentId: userIdStr,
        amount: amount,
        paymentType: paymentType,
        isAdvancePayment: true,
        description: isDeposit ? 'Deposit received (liability)' : `Advance ${paymentType} payment for future periods`
      });
      
      // 🆕 CRITICAL: Update debtor deferred income for advance payments (except deposits)
      // This ensures advance payments are reflected in the debtor account
      if (paymentType !== 'deposit' && paymentType !== 'admin') {
        try {
          await this.updateDebtorDeferredIncome(userIdStr, paymentId, amount, paymentType);
          console.log(`✅ Updated debtor deferred income for advance payment: ${userIdStr} - $${amount} ${paymentType}`);
        } catch (debtorError) {
          console.error(`❌ Error updating debtor deferred income: ${debtorError.message}`);
          // Don't fail the transaction if debtor update fails, but log it
        }
      }
      
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
  static async createPaymentAllocationTransaction(paymentId, userId, amount, paymentData, paymentType, monthSettled, arTransactionId) {
    try {
      console.log(`💳 Creating payment allocation transaction for $${amount} ${paymentType} to ${monthSettled}`);
      
      // 🆕 CRITICAL FIX: Check if payment allocation transaction already exists
      // This prevents duplicate transactions if called multiple times
      const mongoose = require('mongoose');
      const TransactionEntry = require('../models/TransactionEntry');
      const paymentIdStr = paymentId?.toString ? paymentId.toString() : String(paymentId);
      const paymentIdObj = mongoose.Types.ObjectId.isValid(paymentIdStr) ? new mongoose.Types.ObjectId(paymentIdStr) : null;
      
      // Check for existing payment allocation transaction
      const existingPaymentAllocation = await TransactionEntry.findOne({
        $or: [
          { sourceId: paymentIdObj },
          { sourceId: paymentIdStr },
          { 'metadata.paymentId': paymentIdStr },
          { 'metadata.paymentId': paymentId },
          { reference: paymentIdStr },
          { reference: paymentId }
        ],
        $or: [
          { source: 'payment' },
          { source: 'payment_allocation' },
          { 'metadata.allocationType': 'payment_allocation' }
        ],
        'metadata.monthSettled': monthSettled,
        'metadata.paymentType': paymentType,
        status: { $ne: 'reversed' }
      });
      
      if (existingPaymentAllocation) {
        console.log(`⚠️ Payment allocation transaction already exists for payment ${paymentId} to ${monthSettled}: ${existingPaymentAllocation.transactionId}`);
        console.log(`   Skipping duplicate creation - returning existing transaction`);
        console.log(`   🚨 Creating duplicate would overstate cash received`);
        return existingPaymentAllocation;
      }
      
      // 🆕 CRITICAL FIX: Check if there's an advance payment transaction for this payment/month
      // If an advance payment exists and we're now creating a payment allocation (accrual found),
      // we should NOT create a duplicate - the advance payment should be converted or reversed
      const existingAdvancePayment = await TransactionEntry.findOne({
        $or: [
          { sourceId: paymentIdObj },
          { sourceId: paymentIdStr },
          { 'metadata.paymentId': paymentIdStr },
          { 'metadata.paymentId': paymentId },
          { reference: paymentIdStr },
          { reference: paymentId }
        ],
        source: 'advance_payment',
        'metadata.monthSettled': monthSettled,
        'metadata.paymentType': paymentType,
        status: { $ne: 'reversed' }
      });
      
      if (existingAdvancePayment) {
        console.log(`⚠️ Advance payment transaction already exists for payment ${paymentId} to ${monthSettled}: ${existingAdvancePayment.transactionId}`);
        console.log(`   ⚠️ This payment was previously treated as advance payment, but accrual now exists`);
        console.log(`   ⚠️ NOT creating duplicate payment allocation - advance payment should be reversed/converted`);
        console.log(`   🚨 Creating both would overstate cash received`);
        // Return the advance payment transaction but log a warning
        // TODO: Consider reversing the advance payment and creating payment allocation instead
        return existingAdvancePayment;
      }
      
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

      // 🆕 CRITICAL: Check if the month being paid for had an accrual AT THE TIME OF PAYMENT
      // Use payment date to determine if accrual existed when payment was made
      // If no accrual existed at payment time, treat as advance payment and route to deferred income
      const paymentDate = paymentData.date ? new Date(paymentData.date) : new Date();
      
      let hasAccrual = false;
      if (arTransactionId) {
        // If arTransactionId is provided, check if it exists AND was created before/on payment date
        const existingAR = await TransactionEntry.findOne({
          _id: arTransactionId,
          date: { $lte: paymentDate }, // Accrual must exist on or before payment date
          status: 'posted'
        });
        hasAccrual = !!existingAR;
      } else if (monthSettled) {
        // Check if any accrual exists for this month that was created ON OR BEFORE the payment date
        // This ensures we check if accrual existed at the time of payment, not now
        const [year, month] = monthSettled.split('-').map(Number);
        const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
        const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
        
        // If payment date is before the month starts, it's definitely an advance payment
        if (paymentDate < monthStart) {
          console.log(`⚠️ Payment date ${paymentDate.toISOString()} is before month start ${monthStart.toISOString()} - treating as advance payment`);
          hasAccrual = false;
        } else {
          // Check if accrual exists for this month that was created on or before payment date
          // The accrual date must be within the month AND <= payment date
          const accrualExists = await TransactionEntry.findOne({
            source: 'rental_accrual',
            'metadata.studentId': userId,
            date: { 
              $gte: monthStart,
              $lte: paymentDate < monthEnd ? paymentDate : monthEnd // Use earlier of paymentDate or monthEnd
            },
            status: 'posted',
            $or: [
              { 'metadata.type': 'monthly_rent_accrual', 'metadata.accrualMonth': month, 'metadata.accrualYear': year },
              { 'metadata.type': 'lease_start' }
            ]
          }).sort({ date: -1 }); // Get most recent accrual if multiple exist
          
          hasAccrual = !!accrualExists;
          if (accrualExists) {
            arTransactionId = accrualExists._id;
            console.log(`✅ Found accrual created on ${accrualExists.date.toISOString()} (payment date: ${paymentDate.toISOString()})`);
          } else {
            console.log(`⚠️ No accrual found for ${monthSettled} that existed on or before payment date ${paymentDate.toISOString()}`);
          }
        }
      }

      // Get student name for AR account
      const Account = require('../models/Account');
      const User = require('../models/User');
      let studentName = paymentData.studentName || 'Student';
      try {
        const student = await User.findById(userId).select('firstName lastName').lean();
        if (student) {
          studentName = `${student.firstName} ${student.lastName}`;
        }
      } catch (error) {
        console.log('⚠️ Could not fetch student details, using default name');
      }

      // CRITICAL: Ensure userId is converted to string to prevent wrong AR codes
      let userIdStr = userId;
      if (userId && typeof userId === 'object') {
        userIdStr = userId.toString();
      } else {
        userIdStr = String(userId);
      }
      
      // CRITICAL: Verify this is a student ID, not an application ID
      // First check if it's an Application ID
      const Application = require('../models/Application');
      const application = await Application.findById(userIdStr);
      if (application) {
        // This is an Application ID - get the student ID from the application
        if (application.student) {
          const correctStudentId = application.student.toString ? application.student.toString() : String(application.student);
          console.log(`⚠️  userId ${userIdStr} is an Application ID (${application.applicationCode || 'N/A'}), using student from application: ${correctStudentId}`);
          userIdStr = correctStudentId;
        } else {
          throw new Error(`Application ${userIdStr} has no student field`);
        }
      }
      
      // Verify this is a student ID
      const student = await User.findById(userIdStr);
      if (!student) {
        // If userId doesn't match a student, try to get student from payment
        const Payment = require('../models/Payment');
        const payment = await Payment.findById(paymentId);
        if (payment && payment.student) {
          const correctStudentId = payment.student.toString ? payment.student.toString() : String(payment.student);
          console.log(`⚠️  userId ${userIdStr} is not a valid student ID, using student from payment: ${correctStudentId}`);
          userIdStr = correctStudentId;
        } else {
          throw new Error(`Invalid userId: ${userIdStr} - not a valid student ID and cannot find student from payment ${paymentId}`);
        }
      }
      
      // CRITICAL: Get Debtor to use Debtor ID for AR code (persists after User deletion)
      const Debtor = require('../models/Debtor');
      const debtor = await Debtor.findOne({ user: userIdStr }).lean();
      if (!debtor) {
        throw new Error(`Debtor not found for user: ${userIdStr}. Please create debtor account first.`);
      }
      
      // Use Debtor's accountCode (uses Debtor ID, stable and persistent)
      const studentARCode = debtor.accountCode || `1100-${debtor._id.toString()}`;
      const debtorId = debtor._id.toString();
      
      console.log(`✅ Using Debtor ID AR code: ${studentARCode} (Debtor: ${debtor.debtorCode})`);
      
      // Ensure AR account exists (should already exist from debtor creation)
      let studentARAccount = await Account.findOne({ code: studentARCode });
      if (!studentARAccount) {
        // Account should exist, but create it if missing
        const mainAR = await Account.findOne({ code: '1100' });
        if (!mainAR) {
          throw new Error('Main AR account (1100) not found');
        }
        studentARAccount = new Account({
          code: studentARCode,
          name: `Accounts Receivable - ${studentName}`,
          type: 'Asset',
          category: 'Current Assets',
          subcategory: 'Accounts Receivable',
          description: 'Student-specific AR control account (uses Debtor ID for persistence)',
          isActive: true,
          parentAccount: mainAR._id,
          level: 2,
          sortOrder: 0,
          metadata: new Map([
            ['parent', '1100'],
            ['hasParent', 'true'],
            ['debtorId', debtorId],
            ['originalUserId', userIdStr]
          ])
        });
        await studentARAccount.save();
        console.log(`✅ Created student AR account: ${studentARCode}`);
      }

      // Payment date already set above - use it for transaction
      let entries = [];
      let totalDebit = 0;
      let totalCredit = 0;
      let description = '';
      let source = 'payment';
      
      if (!hasAccrual) {
        // 🆕 NO ACCRUAL: Treat as advance payment - route to deferred income
        // Use same 4-entry structure as advance payments to show in AR transaction history
        console.log(`⚠️ No accrual found for ${monthSettled} - treating as advance payment`);
        
        const deferredIncomeAccountCode = '2200';
        const deferredIncomeAccountName = 'Advance Payment Liability';
        
        entries = [
          // Entry 1: Debit Cash (money received)
          {
            accountCode: cashAccountCode,
            accountName: cashAccountName,
            accountType: 'Asset',
            debit: amount,
            credit: 0,
            description: `${paymentType} payment received for ${monthSettled}`
          },
          // Entry 2: Credit Student AR (shows student paid, creating credit/advance)
          {
            accountCode: studentARCode,
            accountName: `Accounts Receivable - ${studentName}`,
            accountType: 'Asset',
            debit: 0,
            credit: amount,
            description: `${paymentType} payment from ${studentName} for ${monthSettled} - shows as credit/advance`
          },
          // Entry 3: Debit Student AR (transfers credit to deferred income)
          {
            accountCode: studentARCode,
            accountName: `Accounts Receivable - ${studentName}`,
            accountType: 'Asset',
            debit: amount,
            credit: 0,
            description: `Transfer advance payment to deferred income for ${monthSettled}`
          },
          // Entry 4: Credit Deferred Income (liability for future periods)
          {
            accountCode: deferredIncomeAccountCode,
            accountName: deferredIncomeAccountName,
            accountType: 'Liability',
            debit: 0,
            credit: amount,
            description: `Advance ${paymentType} payment from ${studentName} for ${monthSettled}`
          }
        ];
        
        totalDebit = amount * 2;
        totalCredit = amount * 2;
        description = `Advance ${paymentType} payment for ${monthSettled} (no accrual yet)`;
        source = 'advance_payment'; // Mark as advance payment
        
      } else {
        // ✅ ACCRUAL EXISTS: Normal payment allocation - credit AR directly
        console.log(`✅ Accrual found for ${monthSettled} - normal payment allocation`);
        
        entries = [
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
            accountCode: studentARCode,
            accountName: `Accounts Receivable - ${studentName}`,
            accountType: 'Asset',
            debit: 0,
            credit: amount,
            description: `${paymentType} payment applied to ${monthSettled}`
          }
        ];
        
        totalDebit = amount;
        totalCredit = amount;
        description = `Payment allocation: ${paymentType} for ${monthSettled}`;
        source = 'payment';
      }

      const paymentTransaction = new TransactionEntry({
        transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        date: paymentDate, // Use actual payment date for accurate cashflow
        description: description,
        reference: paymentId,
        entries: entries,
        totalDebit: totalDebit,
        totalCredit: totalCredit,
        source: source,
        sourceId: null, // Don't set sourceId if it's not a valid ObjectId
        sourceModel: 'Payment',
        residence: paymentData.residence || null, // Handle null residence
        createdBy: 'system',
        status: 'posted',
        metadata: {
          paymentId: paymentId,
          studentId: userIdStr, // Use verified student ID (for reference)
          debtorId: debtorId, // CRITICAL: Store Debtor ID (stable, persists after User deletion)
          amount: amount,
          paymentType: paymentType,
          monthSettled: monthSettled,
          arTransactionId: arTransactionId,
          allocationType: hasAccrual ? 'payment_allocation' : 'advance_payment',
          isAdvancePayment: !hasAccrual, // Flag to indicate this is an advance
          description: description
        }
      });
      
      await paymentTransaction.save();
      
      // Log payment allocation transaction creation
      await logSystemOperation('create', 'TransactionEntry', paymentTransaction._id, {
        source: 'Enhanced Payment Allocation Service',
        type: hasAccrual ? 'payment_allocation' : 'advance_payment',
        paymentId: paymentId,
        studentId: userId,
        amount: amount,
        paymentType: paymentType,
        monthSettled: monthSettled,
        isAdvancePayment: !hasAccrual
      });
      
      console.log(`✅ ${hasAccrual ? 'Payment allocation' : 'Advance payment'} transaction created: ${paymentTransaction._id}`);
      
      // 🆕 NEW: If no accrual (advance payment), update debtor deferred income
      if (!hasAccrual) {
        try {
          await this.updateDebtorDeferredIncome(userId, paymentId, amount, paymentType);
          console.log(`✅ Updated debtor deferred income for advance payment: ${userId} - $${amount} for ${monthSettled}`);
        } catch (debtorError) {
          console.error(`❌ Error updating debtor deferred income: ${debtorError.message}`);
          // Don't fail the transaction if debtor update fails
        }
      }
      
      // 🆕 NEW: Automatically sync to debtor
      try {
        const DebtorTransactionSyncService = require('./debtorTransactionSyncService');
        const monthKey = monthSettled; // monthSettled is already in YYYY-MM format
        
        await DebtorTransactionSyncService.updateDebtorFromPayment(
          paymentTransaction,
          userId,
          amount,
          monthKey,
          {
            paymentId: paymentId,
            studentId: userIdStr, // Use verified student ID
            amount: amount,
            paymentType: paymentType,
            monthSettled: monthSettled,
            arTransactionId: arTransactionId,
            allocationType: hasAccrual ? 'payment_allocation' : 'advance_payment',
            isAdvancePayment: !hasAccrual,
            description: description,
            transactionId: paymentTransaction.transactionId
          }
        );
        
        console.log(`✅ Debtor automatically synced for ${hasAccrual ? 'payment allocation' : 'advance payment'}: ${userId} - $${amount} for ${monthSettled}`);
        
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
  static async getDebtorStatus(userId) {
    try {
      const Debtor = require('../models/Debtor');
      const debtor = await Debtor.findOne({ user: userId });
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
  static async handleAdvancePayment(paymentId, userId, amount, paymentData, paymentType) {
    try {
      console.log(`💳 Creating advance payment transaction for $${amount} ${paymentType}`);
      
      // Create advance payment transaction
      const advanceTransaction = await this.createAdvancePaymentTransaction(
        paymentId, userId, amount, paymentData, paymentType
      );
      
      // Update debtor deferred income only for rent advances
      if (paymentType !== 'deposit' && paymentType !== 'admin') {
        await this.updateDebtorDeferredIncome(userId, paymentId, amount, paymentType);
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
  static async updateDebtorDeferredIncome(userId, paymentId, amount, paymentType) {
    try {
      const Debtor = require('../models/Debtor');
      
      // Convert paymentId to string if it's an ObjectId
      const paymentIdStr = paymentId?.toString ? paymentId.toString() : String(paymentId);
      
      const prepayment = {
        paymentId: paymentIdStr,
        amount: amount,
        paymentType: paymentType,
        paymentDate: new Date(),
        allocatedMonth: null, // Will be set when monthly accrual is created
        status: 'pending'
      };
      
      // Check if debtor exists first
      const debtor = await Debtor.findOne({ user: userId });
      if (!debtor) {
        console.error(`⚠️ Debtor not found for user ${userId} - cannot update deferred income`);
        console.error(`   Payment ID: ${paymentIdStr}, Amount: $${amount}, Type: ${paymentType}`);
        return; // Don't throw, just log and return
      }
      
      // Check if prepayment already exists to prevent duplicates
      const existingPrepayment = debtor.deferredIncome?.prepayments?.find(
        p => p.paymentId?.toString() === paymentIdStr
      );
      
      if (existingPrepayment) {
        console.log(`⚠️ Prepayment already exists for payment ${paymentIdStr} - skipping duplicate`);
        console.log(`   Existing prepayment: Amount $${existingPrepayment.amount}, Status: ${existingPrepayment.status}`);
        return; // Don't add duplicate
      }
      
      // Update debtor: increment deferred income AND totalPaid
      // This ensures the advance payment shows in the debtor account even though there's no debt
      const updateResult = await Debtor.findOneAndUpdate(
        { user: userId },
        { 
          $inc: { 
            'deferredIncome.totalAmount': amount,
            'totalPaid': amount  // Track that payment was made (even if advance)
          },
          $push: { 'deferredIncome.prepayments': prepayment },
          $set: { 'lastPaymentDate': new Date(), 'lastPaymentAmount': amount }
        },
        { new: true } // Return updated document
      );
      
      if (updateResult) {
        console.log(`✅ Updated deferred income for user ${userId} (Debtor: ${debtor.debtorCode || debtor._id}): +$${amount} ${paymentType}`);
        console.log(`   Payment ID: ${paymentIdStr}`);
        console.log(`   Also updated totalPaid: +$${amount} (shows as advance payment in debtor account)`);
        console.log(`   New deferred income total: $${updateResult.deferredIncome?.totalAmount || 0}`);
      } else {
        console.error(`⚠️ Failed to update debtor for user ${userId} - update returned null`);
      }
      
    } catch (error) {
      console.error(`❌ Error updating deferred income for user ${userId}: ${error.message}`);
      console.error(`   Payment ID: ${paymentId}, Amount: $${amount}, Type: ${paymentType}`);
      console.error(`   Stack: ${error.stack}`);
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
  static async createAllocationRecord(paymentId, userId, allocationResults, paymentData) {
    try {
      console.log(`📝 Creating allocation record for payment ${paymentId}`);
      
      // For now, we'll return a simple object
      // In a full implementation, this could be saved to a separate collection
      const allocationRecord = {
        paymentId: paymentId,
        studentId: userId,
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
  static async getOutstandingBalanceSummary(userId) {
    try {
      console.log(`📊 Getting outstanding balance summary for user: ${userId}`);
      
      const outstandingBalances = await this.getDetailedOutstandingBalances(userId);
      
      const totalOutstanding = outstandingBalances.reduce((sum, month) => sum + month.totalOutstanding, 0);
      
      return {
        userId,
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
