const mongoose = require('mongoose');
require('dotenv').config();

async function testMacdonaldPaymentScenario() {
  try {
    console.log('\n🧪 TESTING MACDONALD PAYMENT SCENARIO');
    console.log('=======================================\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const User = require('../src/models/User');
    const Application = require('../src/models/Application');
    const Debtor = require('../src/models/Debtor');
    const Residence = require('../src/models/Residence');
    const Payment = require('../src/models/Payment');
    const TransactionEntry = require('../src/models/TransactionEntry');
    const Account = require('../src/models/Account');
    
    // Step 1: Create test student (Macdonald)
    console.log('🔧 STEP 1: CREATING MACDONALD (TEST STUDENT)');
    console.log('─'.repeat(50));
    
    const macdonald = new User({
      email: `macdonald.test.${Date.now()}@students.uz.ac.zw`,
      firstName: 'Macdonald',
      lastName: 'Sairos',
      phone: '+263 78 603 3933',
      password: 'testpassword123',
      role: 'student',
      isVerified: true
    });
    
    await macdonald.save();
    console.log(`✅ Created Macdonald: ${macdonald.firstName} ${macdonald.lastName}`);
    console.log(`   Email: ${macdonald.email}`);
    console.log(`   ID: ${macdonald._id}`);
    
    // Step 2: Create test application for Macdonald
    console.log('\n🔧 STEP 2: CREATING MACDONALD\'S APPLICATION');
    console.log('─'.repeat(50));
    
    const residences = await Residence.find().lean();
    const testResidence = residences[0];
    const testRoom = testResidence.rooms[0];
    
    console.log(`🏠 Using residence: ${testResidence.name}`);
    console.log(`   Room: ${testRoom.roomNumber} - $${testRoom.price}`);
    
    const macdonaldApplication = new Application({
      student: macdonald._id,
      email: macdonald.email,
      firstName: macdonald.firstName,
      lastName: macdonald.lastName,
      phone: macdonald.phone,
      requestType: 'new',
      status: 'approved',
      paymentStatus: 'unpaid',
      preferredRoom: testRoom.roomNumber,
      allocatedRoom: testRoom.roomNumber,
      residence: testResidence._id,
      startDate: new Date('2025-08-19'), // Aug 19
      endDate: new Date('2025-12-31'),   // Dec 31
      applicationCode: `APP${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`
    });
    
    await macdonaldApplication.save();
    console.log(`✅ Created application: ${macdonaldApplication.applicationCode}`);
    console.log(`   Start Date: ${macdonaldApplication.startDate.toDateString()}`);
    console.log(`   End Date: ${macdonaldApplication.endDate.toDateString()}`);
    console.log(`   Room: ${macdonaldApplication.allocatedRoom}`);
    
    // Step 3: Create debtor for Macdonald
    console.log('\n🔧 STEP 3: CREATING DEBTOR FOR MACDONALD');
    console.log('─'.repeat(45));
    
    const { createDebtorForStudent } = require('../src/services/debtorService');
    
    try {
      const debtor = await createDebtorForStudent(macdonald, {
        createdBy: macdonald._id,
        application: macdonaldApplication._id
      });
      
      console.log(`✅ Debtor created: ${debtor.debtorCode}`);
      console.log(`   Total Owed: $${debtor.totalOwed}`);
      console.log(`   Current Balance: $${debtor.currentBalance}`);
      
    } catch (error) {
      console.error(`❌ Error creating debtor: ${error.message}`);
      return;
    }
    
    // Step 4: Create Macdonald's payment ($476 for September)
    console.log('\n🔧 STEP 4: CREATING MACDONALD\'S PAYMENT');
    console.log('─'.repeat(45));
    
    // Simulate August payment for September rent
    const augustPayment = new Payment({
      paymentId: `PAY${Date.now()}`,
      student: macdonald._id,
      studentName: `${macdonald.firstName} ${macdonald.lastName}`,
      amount: 476,
      method: 'cash',
      date: new Date('2025-08-19'), // Paid in August
      paymentMonth: 'September 2025', // For September
      status: 'confirmed',
      residence: testResidence._id,
      residenceName: testResidence.name,
      // Payment breakdown
      payments: JSON.stringify([
        { type: 'rent', amount: 220, description: 'September Rent' },
        { type: 'admin', amount: 40, description: 'Admin Fee' },
        { type: 'deposit', amount: 216, description: 'Security Deposit' }
      ])
    });
    
    await augustPayment.save();
    console.log(`✅ Payment created: ${augustPayment.paymentId}`);
    console.log(`   Amount: $${augustPayment.amount}`);
    console.log(`   Date: ${augustPayment.date.toDateString()}`);
    console.log(`   Payment Month: ${augustPayment.paymentMonth}`);
    console.log(`   Breakdown: Rent $220 + Admin $40 + Deposit $216`);
    
    // Step 5: Process the payment through the enhanced controller logic
    console.log('\n🔧 STEP 5: PROCESSING PAYMENT THROUGH ENHANCED LOGIC');
    console.log('─'.repeat(55));
    
    // Simulate the payment processing logic
    const currentDate = new Date('2025-08-19'); // August 19
    const currentMonth = currentDate.getMonth(); // 7 (August)
    const currentYear = currentDate.getFullYear(); // 2025
    
    // Parse payment month
    const paymentMonth = 'September 2025';
    const monthNames = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];
    
    const lowerPaymentMonth = paymentMonth.toLowerCase();
    const month = monthNames.findIndex(m => lowerPaymentMonth.includes(m));
    const year = 2025;
    
    if (month !== -1) {
      const paymentMonthDate = new Date(year, month, 1); // September 1, 2025
      const currentMonthDate = new Date(currentYear, currentMonth, 1); // August 1, 2025
      
      if (paymentMonthDate > currentMonthDate) {
        console.log(`✅ ADVANCE PAYMENT DETECTED: ${paymentMonth} is in the future`);
        console.log(`   Payment Month: ${paymentMonthDate.toDateString()}`);
        console.log(`   Current Month: ${currentMonthDate.toDateString()}`);
        console.log(`   This should use Deferred Income account`);
      }
    }
    
    // Step 6: Check what accounts should be used
    console.log('\n🔧 STEP 6: CHECKING REQUIRED ACCOUNTS');
    console.log('─'.repeat(40));
    
    const deferredIncomeAccount = await Account.findOne({ code: '2030' });
    const adminFeeAccount = await Account.findOne({ code: '4100' });
    const depositAccount = await Account.findOne({ code: '2020' });
    const rentAccount = await Account.findOne({ code: '4000' });
    const cashAccount = await Account.findOne({ code: '1002' });
    
    console.log(`📊 Account Status:`);
    console.log(`   Deferred Income (2030): ${deferredIncomeAccount ? '✅ Found' : '❌ Missing'}`);
    console.log(`   Admin Fee (4100): ${adminFeeAccount ? '✅ Found' : '❌ Missing'}`);
    console.log(`   Deposit (2020): ${depositAccount ? '✅ Found' : '❌ Missing'}`);
    console.log(`   Rent Income (4000): ${rentAccount ? '✅ Found' : '❌ Found'}`);
    console.log(`   Cash (1002): ${cashAccount ? '✅ Found' : '❌ Missing'}`);
    
    // Step 7: Show expected journal entries
    console.log('\n🔧 STEP 7: EXPECTED JOURNAL ENTRIES');
    console.log('─'.repeat(40));
    
    console.log(`📝 For Macdonald's $476 payment in August for September:`);
    console.log(`   ┌─────────────────────────────────────────────────────────────┐`);
    console.log(`   │                    JOURNAL ENTRY                           │`);
    console.log(`   ├─────────────────────────────────────────────────────────────┤`);
    console.log(`   │ Date: August 19, 2025                                     │`);
    console.log(`   │ Description: Payment from Macdonald for September         │`);
    console.log(`   ├─────────────────────────────────────────────────────────────┤`);
    console.log(`   │ Account                    │ Debit    │ Credit   │         │`);
    console.log(`   ├─────────────────────────────────────────────────────────────┤`);
    console.log(`   │ Cash                       │ $476     │          │         │`);
    console.log(`   │ Admin Fee Revenue          │          │ $40      │         │`);
    console.log(`   │ Security Deposit Liability │          │ $216     │         │`);
    console.log(`   │ Deferred Income            │          │ $220     │         │`);
    console.log(`   ├─────────────────────────────────────────────────────────────┤`);
    console.log(`   │ Total                      │ $476     │ $476     │         │`);
    console.log(`   └─────────────────────────────────────────────────────────────┘`);
    
    console.log(`\n💡 Key Points:`);
    console.log(`   • Admin Fee ($40): Revenue earned immediately`);
    console.log(`   • Deposit ($216): Liability until lease end`);
    console.log(`   • Rent ($220): Deferred Income (not earned until September)`);
    console.log(`   • Cash increases by $476`);
    
    // Step 8: Check current financial position
    console.log('\n🔧 STEP 8: CURRENT FINANCIAL POSITION');
    console.log('─'.repeat(45));
    
    const currentDebtor = await Debtor.findOne({ user: macdonald._id });
    if (currentDebtor) {
      console.log(`💰 Macdonald's Current Position:`);
      console.log(`   Total Owed: $${currentDebtor.totalOwed}`);
      console.log(`   Total Paid: $${currentDebtor.totalPaid}`);
      console.log(`   Current Balance: $${currentDebtor.currentBalance}`);
    }
    
    // Cleanup
    console.log('\n🧹 CLEANING UP TEST DATA');
    console.log('─'.repeat(40));
    
    await Payment.deleteMany({ _id: augustPayment._id });
    await Debtor.deleteMany({ user: macdonald._id });
    await Application.deleteMany({ _id: macdonaldApplication._id });
    await User.deleteMany({ _id: macdonald._id });
    
    console.log('✅ Test data cleaned up');
    
  } catch (error) {
    console.error('❌ Error testing Macdonald payment scenario:', error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
    }
  }
}

testMacdonaldPaymentScenario();
