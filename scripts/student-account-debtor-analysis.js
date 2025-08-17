const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('../src/models/User');
const Debtor = require('../src/models/Debtor');
const Payment = require('../src/models/Payment');
const TransactionEntry = require('../src/models/TransactionEntry');
const Account = require('../src/models/Account');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_backend', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', async () => {
    console.log('✅ Connected to MongoDB');
    await analyzeStudentAccountDebtorSystem();
});

async function analyzeStudentAccountDebtorSystem() {
    console.log('\n🎓 STUDENT ACCOUNT & DEBTOR SYSTEM ANALYSIS');
    console.log('=============================================\n');

    try {
        // 1. Analyze current students and their debtor status
        console.log('📊 1. CURRENT STUDENTS & DEBTOR STATUS');
        console.log('=======================================');
        
        const students = await User.find({ role: 'student' });
        console.log(`Total students in system: ${students.length}`);
        
        const debtors = await Debtor.find({});
        console.log(`Total debtor accounts: ${debtors.length}`);
        
        // Check which students have debtor accounts
        const studentsWithDebtors = [];
        const studentsWithoutDebtors = [];
        
        for (const student of students) {
            const debtor = debtors.find(d => d.user.toString() === student._id.toString());
            if (debtor) {
                studentsWithDebtors.push({
                    student,
                    debtor,
                    hasOutstandingDebt: debtor.currentBalance > 0
                });
            } else {
                studentsWithoutDebtors.push(student);
            }
        }
        
        console.log(`Students with debtor accounts: ${studentsWithDebtors.length}`);
        console.log(`Students without debtor accounts: ${studentsWithoutDebtors.length}`);
        
        // Show students with outstanding debt
        const studentsWithDebt = studentsWithDebtors.filter(s => s.hasOutstandingDebt);
        console.log(`Students with outstanding debt: ${studentsWithDebt.length}`);
        
        console.log('\n📋 STUDENTS WITH OUTSTANDING DEBT:');
        studentsWithDebt.forEach(({ student, debtor }) => {
            console.log(`  ${student.firstName} ${student.lastName} (${student.email})`);
            console.log(`    Debtor Code: ${debtor.debtorCode}`);
            console.log(`    Current Balance: $${debtor.currentBalance.toFixed(2)}`);
            console.log(`    Total Owed: $${debtor.totalOwed.toFixed(2)}`);
            console.log(`    Total Paid: $${debtor.totalPaid.toFixed(2)}`);
            console.log('');
        });

        // 2. Analyze when students become debtors
        console.log('🎯 2. WHEN STUDENTS BECOME DEBTORS');
        console.log('==================================');
        
        console.log('\n📝 SCENARIO 1: STUDENT IS INVOICED (CREATES DEBT)');
        console.log('When a student is invoiced for rent/fees:');
        console.log('  → Student owes money');
        console.log('  → Debtor account is created (if not exists)');
        console.log('  → Double-entry: Dr. Accounts Receivable, Cr. Income');
        console.log('  → Student becomes a debtor');
        
        console.log('\n📝 SCENARIO 2: STUDENT MAKES PAYMENT (REDUCES DEBT)');
        console.log('When a student makes a payment:');
        console.log('  → If student has outstanding debt: settles debt');
        console.log('  → If student has no debt: current period payment');
        console.log('  → Double-entry: Dr. Bank/Cash, Cr. Accounts Receivable');
        
        console.log('\n📝 SCENARIO 3: STUDENT HAS NO DEBT');
        console.log('When a student pays without outstanding debt:');
        console.log('  → Current period payment');
        console.log('  → Double-entry: Dr. Bank/Cash, Cr. Income');
        console.log('  → Student remains debt-free');

        // 3. Analyze payment handling
        console.log('\n💰 3. PAYMENT HANDLING ANALYSIS');
        console.log('===============================');
        
        const payments = await Payment.find({});
        console.log(`Total payments in system: ${payments.length}`);
        
        // Analyze payment types
        let debtSettlementPayments = 0;
        let currentPeriodPayments = 0;
        let paymentsWithoutTransactions = 0;
        
        for (const payment of payments) {
            const debtor = debtors.find(d => d.user.toString() === payment.student.toString());
            
            if (debtor && debtor.currentBalance > 0) {
                debtSettlementPayments++;
            } else {
                currentPeriodPayments++;
            }
            
            // Check if payment has corresponding transaction
            const transaction = await TransactionEntry.findOne({ 
                source: 'payment', 
                sourceId: payment._id 
            });
            
            if (!transaction) {
                paymentsWithoutTransactions++;
            }
        }
        
        console.log(`Debt settlement payments: ${debtSettlementPayments}`);
        console.log(`Current period payments: ${currentPeriodPayments}`);
        console.log(`Payments without transactions: ${paymentsWithoutTransactions}`);

        // 4. Show the proper implementation
        console.log('\n🔧 4. PROPER IMPLEMENTATION GUIDE');
        console.log('==================================');

        console.log('\n🎯 WHEN TO CREATE DEBTOR ACCOUNTS:');
        console.log('===================================');
        console.log('1. When student is first invoiced');
        console.log('2. When student has outstanding balance');
        console.log('3. When student applies for accommodation');
        console.log('4. When student signs lease agreement');

        console.log('\n🎯 WHEN TO CREATE TRANSACTIONS:');
        console.log('================================');
        console.log('1. When student is invoiced (creates debt)');
        console.log('2. When student makes payment (reduces debt or current payment)');
        console.log('3. When student pays late fees');
        console.log('4. When student receives refunds');

        // 5. Show current system issues
        console.log('\n⚠️ 5. CURRENT SYSTEM ISSUES');
        console.log('===========================');
        
        if (studentsWithoutDebtors.length > 0) {
            console.log(`❌ ${studentsWithoutDebtors.length} students without debtor accounts:`);
            studentsWithoutDebtors.forEach(student => {
                console.log(`  - ${student.firstName} ${student.lastName} (${student.email})`);
            });
        }
        
        if (paymentsWithoutTransactions > 0) {
            console.log(`❌ ${paymentsWithoutTransactions} payments without transactions`);
        }
        
        if (studentsWithDebt.length > 0) {
            console.log(`⚠️  ${studentsWithDebt.length} students with outstanding debt`);
        }

        // 6. Provide implementation recommendations
        console.log('\n✅ 6. IMPLEMENTATION RECOMMENDATIONS');
        console.log('====================================');

        console.log('\n🔧 AUTOMATIC DEBTOR CREATION:');
        console.log('==============================');
        console.log('1. Create debtor account when student is first invoiced');
        console.log('2. Create debtor account when student applies for accommodation');
        console.log('3. Create debtor account when student signs lease');
        console.log('4. Update debtor account when student makes payments');

        console.log('\n🔧 PROPER TRANSACTION HANDLING:');
        console.log('===============================');
        console.log('1. Check if student has outstanding debt before creating payment transaction');
        console.log('2. Create debt settlement transaction if student owes money');
        console.log('3. Create current period transaction if student has no debt');
        console.log('4. Update debtor balance after each transaction');

        // 7. Show code examples
        console.log('\n💻 7. CODE IMPLEMENTATION EXAMPLES');
        console.log('==================================');

        console.log('\n📝 EXAMPLE: Creating debtor account for student');
        console.log('```javascript');
        console.log('// When student is first invoiced or applies');
        console.log('async function createDebtorForStudent(student, options = {}) {');
        console.log('  // Check if debtor already exists');
        console.log('  let debtor = await Debtor.findOne({ user: student._id });');
        console.log('  ');
        console.log('  if (!debtor) {');
        console.log('    // Generate codes');
        console.log('    const debtorCode = await Debtor.generateDebtorCode();');
        console.log('    const accountCode = await Debtor.generateAccountCode();');
        console.log('    ');
        console.log('    // Create debtor account');
        console.log('    debtor = new Debtor({');
        console.log('      debtorCode,');
        console.log('      user: student._id,');
        console.log('      accountCode,');
        console.log('      status: "active",');
        console.log('      contactInfo: {');
        console.log('        name: `${student.firstName} ${student.lastName}`,');
        console.log('        email: student.email,');
        console.log('        phone: student.phone');
        console.log('      },');
        console.log('      createdBy: options.createdBy || student._id');
        console.log('    });');
        console.log('    ');
        console.log('    await debtor.save();');
        console.log('    console.log(`✅ Created debtor account for ${student.email}`);');
        console.log('  }');
        console.log('  ');
        console.log('  return debtor;');
        console.log('}');
        console.log('```');

        console.log('\n📝 EXAMPLE: Handling student payment with debt check');
        console.log('```javascript');
        console.log('// When student makes payment');
        console.log('async function handleStudentPayment(payment) {');
        console.log('  // Get debtor account');
        console.log('  const debtor = await Debtor.findOne({ user: payment.student });');
        console.log('  ');
        console.log('  // Check if student has outstanding debt');
        console.log('  const hasOutstandingDebt = debtor && debtor.currentBalance > 0;');
        console.log('  ');
        console.log('  if (hasOutstandingDebt) {');
        console.log('    // Create debt settlement transaction');
        console.log('    await createDebtSettlementTransaction(payment, debtor);');
        console.log('  } else {');
        console.log('    // Create current period payment transaction');
        console.log('    await createCurrentPaymentTransaction(payment);');
        console.log('  }');
        console.log('  ');
        console.log('  // Update debtor account');
        console.log('  if (debtor) {');
        console.log('    await debtor.addPayment(payment.totalAmount, payment.description);');
        console.log('  }');
        console.log('}');
        console.log('```');

        // 8. Final recommendations
        console.log('\n🎯 8. FINAL RECOMMENDATIONS');
        console.log('==========================');

        console.log('\n✅ IMMEDIATE ACTIONS NEEDED:');
        console.log('============================');
        
        if (studentsWithoutDebtors.length > 0) {
            console.log(`1. Create debtor accounts for ${studentsWithoutDebtors.length} students`);
        }
        
        if (paymentsWithoutTransactions > 0) {
            console.log(`2. Create missing transactions for ${paymentsWithoutTransactions} payments`);
        }
        
        console.log('3. Update payment controller to check debt status');
        console.log('4. Implement automatic debtor creation for new students');
        console.log('5. Add debt checking logic to all payment processes');

        console.log('\n✅ LONG-TERM IMPROVEMENTS:');
        console.log('==========================');
        console.log('1. Implement automatic invoice generation');
        console.log('2. Add late fee calculation and tracking');
        console.log('3. Create debt aging reports');
        console.log('4. Implement payment reminders');
        console.log('5. Add debt collection tracking');

    } catch (error) {
        console.error('❌ Error during analysis:', error);
    } finally {
        mongoose.connection.close();
        console.log('\n✅ Student account & debtor analysis completed');
    }
}

// Run the analysis
console.log('🚀 Starting Student Account & Debtor Analysis...'); 