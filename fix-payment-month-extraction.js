/**
 * Fix Payment Month Extraction Issue
 * 
 * This script fixes the issue where the payment allocation system is not correctly
 * extracting the payment month from transaction data.
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function fixPaymentMonthExtraction() {
    try {
        console.log('🔧 Fixing Payment Month Extraction Issue');
        console.log('========================================\n');

        // Read the current payment allocation service
        const servicePath = path.join(__dirname, 'src/services/paymentAllocationService.js');
        let serviceContent = fs.readFileSync(servicePath, 'utf8');

        console.log('📖 Reading current payment allocation service...');

        // Add the new extractPaymentMonthFromTransaction method
        const newMethod = `
  /**
   * Extract payment month from transaction data
   * @param {Object} paymentData - Payment data object
   * @param {Array} arBalances - AR balances for the student
   * @returns {string} The correct payment month in YYYY-MM format
   */
  static extractPaymentMonthFromTransaction(paymentData, arBalances) {
    try {
      console.log(\`🔍 Extracting payment month from transaction data...\`);
      
      // Method 1: Check if payment has metadata with paymentMonth
      if (paymentData.metadata?.paymentMonth) {
        console.log(\`✅ Found payment month in metadata: \${paymentData.metadata.paymentMonth}\`);
        return paymentData.metadata.paymentMonth;
      }
      
      // Method 2: Check if payment has a specific paymentMonth field
      if (paymentData.paymentMonth) {
        console.log(\`✅ Found payment month in payment data: \${paymentData.paymentMonth}\`);
        return paymentData.paymentMonth;
      }
      
      // Method 3: Extract from transaction date (fallback)
      if (paymentData.date) {
        const paymentDate = new Date(paymentData.date);
        const extractedMonth = \`\${paymentDate.getFullYear()}-\${String(paymentDate.getMonth() + 1).padStart(2, '0')}\`;
        console.log(\`✅ Extracted payment month from date: \${extractedMonth}\`);
        return extractedMonth;
      }
      
      // Method 4: Use oldest AR month as default (FIFO principle)
      if (arBalances && arBalances.length > 0) {
        const oldestMonth = arBalances[0].monthKey;
        console.log(\`✅ Using oldest AR month as payment month: \${oldestMonth}\`);
        return oldestMonth;
      }
      
      // Method 5: Use current month as last resort
      const currentDate = new Date();
      const currentMonth = \`\${currentDate.getFullYear()}-\${String(currentDate.getMonth() + 1).padStart(2, '0')}\`;
      console.log(\`⚠️  Using current month as fallback: \${currentMonth}\`);
      return currentMonth;
      
    } catch (error) {
      console.error(\`❌ Error extracting payment month:\`, error);
      // Return current month as fallback
      const currentDate = new Date();
      return \`\${currentDate.getFullYear()}-\${String(currentDate.getMonth() + 1).padStart(2, '0')}\`;
    }
  }`;

        // Find the position to insert the new method (before autoAllocatePayment)
        const insertPosition = serviceContent.indexOf('  static async autoAllocatePayment(paymentData) {');
        
        if (insertPosition === -1) {
            throw new Error('Could not find autoAllocatePayment method in service file');
        }

        // Insert the new method
        serviceContent = serviceContent.slice(0, insertPosition) + newMethod + '\n\n' + serviceContent.slice(insertPosition);

        // Update the autoAllocatePayment method to use the new extraction logic
        const oldExtractionLogic = `      // 🆕 NEW: Detect the correct payment month from AR balances
      const oldestARMonth = arBalances[0]?.monthKey;
      const requestedPaymentMonth = paymentData.paymentMonth;
      
      console.log(\`🎯 Payment Month Analysis:\`);
      console.log(\`   Requested Month: \${requestedPaymentMonth}\`);
      console.log(\`   Oldest AR Month: \${oldestARMonth}\`);
      
      // 🆕 NEW: Override payment month if it doesn't match the oldest AR month
      let effectivePaymentMonth = requestedPaymentMonth;
      if (oldestARMonth && requestedPaymentMonth !== oldestARMonth) {
        console.log(\`⚠️  Payment month mismatch detected!\`);
        console.log(\`   Requested: \${requestedPaymentMonth} (current month)\`);
        console.log(\`   Should be: \${oldestARMonth} (oldest AR accrual)\`);
        console.log(\`   🔄 Overriding payment month to \${oldestARMonth}\`);
        effectivePaymentMonth = oldestARMonth;
      }`;

        const newExtractionLogic = `      // 🆕 NEW: Extract the correct payment month from transaction data
      const extractedPaymentMonth = this.extractPaymentMonthFromTransaction(paymentData, arBalances);
      const requestedPaymentMonth = paymentData.paymentMonth || extractedPaymentMonth;
      
      console.log(\`🎯 Payment Month Analysis:\`);
      console.log(\`   Extracted Month: \${extractedPaymentMonth}\`);
      console.log(\`   Requested Month: \${requestedPaymentMonth}\`);
      console.log(\`   Oldest AR Month: \${arBalances[0]?.monthKey}\`);
      
      // 🆕 NEW: Use the extracted month or override if it doesn't match the oldest AR month
      let effectivePaymentMonth = extractedPaymentMonth;
      if (arBalances[0]?.monthKey && extractedPaymentMonth !== arBalances[0].monthKey) {
        console.log(\`⚠️  Payment month mismatch detected!\`);
        console.log(\`   Extracted: \${extractedPaymentMonth}\`);
        console.log(\`   Should be: \${arBalances[0].monthKey} (oldest AR accrual)\`);
        console.log(\`   🔄 Overriding payment month to \${arBalances[0].monthKey}\`);
        effectivePaymentMonth = arBalances[0].monthKey;
      }`;

        // Replace the old logic with new logic
        serviceContent = serviceContent.replace(oldExtractionLogic, newExtractionLogic);

        // Add effectivePaymentMonth to the summary
        const oldSummary = `            newestMonthSettled: allocationResults.filter(r => r.allocationType === 'debt_settlement').length > 0 ? 
              allocationResults.filter(r => r.allocationType === 'debt_settlement').slice(-1)[0].month : null`;

        const newSummary = `            newestMonthSettled: allocationResults.filter(r => r.allocationType === 'debt_settlement').length > 0 ? 
              allocationResults.filter(r => r.allocationType === 'debt_settlement').slice(-1)[0].month : null,
            effectivePaymentMonth: effectivePaymentMonth`;

        serviceContent = serviceContent.replace(oldSummary, newSummary);

        // Write the updated service back to file
        fs.writeFileSync(servicePath, serviceContent, 'utf8');

        console.log('✅ Successfully updated payment allocation service');
        console.log('📝 Changes made:');
        console.log('   1. Added extractPaymentMonthFromTransaction method');
        console.log('   2. Updated autoAllocatePayment to use the new extraction logic');
        console.log('   3. Added effectivePaymentMonth to allocation summary');

        // Create a test script to verify the fix
        const testScript = `
/**
 * Test Payment Month Extraction Fix
 */

const mongoose = require('mongoose');
const PaymentAllocationService = require('./src/services/paymentAllocationService');
const TransactionEntry = require('./src/models/TransactionEntry');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function testPaymentMonthExtraction() {
    try {
        console.log('🧪 Testing Payment Month Extraction Fix');
        console.log('=======================================\\n');

        // Find a recent payment transaction
        const paymentTransaction = await TransactionEntry.findOne({
            source: 'payment'
        }).sort({ createdAt: -1 });

        if (!paymentTransaction) {
            console.log('❌ No payment transaction found for testing');
            return;
        }

        console.log(\`✅ Found payment transaction: \${paymentTransaction.transactionId}\`);
        console.log(\`   Description: \${paymentTransaction.description}\`);
        console.log(\`   Date: \${paymentTransaction.date}\`);
        console.log(\`   Amount: \${paymentTransaction.totalDebit || paymentTransaction.totalCredit}\`);

        // Extract student ID
        const arEntry = paymentTransaction.entries.find(e => e.accountCode.startsWith('1100-'));
        if (!arEntry) {
            console.log('❌ No AR entry found in payment transaction');
            return;
        }

        const studentId = arEntry.accountCode.split('-').pop();
        console.log(\`✅ Student ID: \${studentId}\`);

        // Test the new extraction method
        const paymentData = {
            paymentId: paymentTransaction._id.toString(),
            totalAmount: paymentTransaction.totalDebit || paymentTransaction.totalCredit || 0,
            studentId: studentId,
            residenceId: paymentTransaction.residence || '67d723cf20f89c4ae69804f3',
            date: paymentTransaction.date,
            method: 'Cash',
            rentAmount: 220,
            adminFee: 20,
            deposit: 220
        };

        // Get AR balances
        const arBalances = await PaymentAllocationService.getStudentARBalances(studentId);
        console.log(\`📊 Found \${arBalances.length} AR balances\`);

        // Test extraction
        const extractedMonth = PaymentAllocationService.extractPaymentMonthFromTransaction(paymentData, arBalances);
        console.log(\`🎯 Extracted Payment Month: \${extractedMonth}\`);

        // Test auto-allocation
        console.log('\\n🚀 Testing auto-allocation with extracted month...');
        const allocationResult = await PaymentAllocationService.autoAllocatePayment(paymentData);
        
        if (allocationResult.success) {
            console.log('✅ Auto-allocation successful!');
            console.log(\`   Effective Payment Month: \${allocationResult.allocation.summary.effectivePaymentMonth}\`);
            console.log(\`   Months covered: \${allocationResult.allocation.summary.monthsCovered}\`);
        } else {
            console.log('❌ Auto-allocation failed:', allocationResult.error);
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
}

// Run the test
if (require.main === module) {
    testPaymentMonthExtraction();
}`;

        fs.writeFileSync('test-payment-month-extraction.js', testScript, 'utf8');
        console.log('📝 Created test script: test-payment-month-extraction.js');

        console.log('\n✅ Payment Month Extraction Fix Complete!');
        console.log('🚀 You can now run: node test-payment-month-extraction.js');

    } catch (error) {
        console.error('❌ Fix failed:', error);
        console.error(error.stack);
    } finally {
        mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
}

// Run the fix
if (require.main === module) {
    fixPaymentMonthExtraction();
}

