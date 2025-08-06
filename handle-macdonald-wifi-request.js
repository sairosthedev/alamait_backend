const mongoose = require('mongoose');
const Vendor = require('./src/models/Vendor');
const Account = require('./src/models/Account');
const Transaction = require('./src/models/Transaction');
const TransactionEntry = require('./src/models/TransactionEntry');
const Expense = require('./src/models/finance/Expense');
const Request = require('./src/models/Request');

// Configuration
const config = {
    databaseUrl: 'mongodb://localhost:27017/alamait_backend',
    wifiFixingAmount: 2500, // Amount for WiFi fixing
    paymentMethod: 'Bank Transfer',
    residence: 'MacDonald Residence'
};

/**
 * Handle MacDonald WiFi Fixing Request
 * This script demonstrates the complete flow:
 * 1. Create vendor (if not exists)
 * 2. Create maintenance request
 * 3. Record approval transaction
 * 4. Record payment transaction
 * 5. Show system impact
 */
async function handleMacdonaldWifiRequest() {
    try {
        console.log('🔧 Starting MacDonald WiFi Fixing Request Process...\n');

        // Step 1: Create or find MacDonald vendor
        const macdonaldVendor = await createOrFindMacdonaldVendor();
        console.log('✅ Vendor ready:', macdonaldVendor.businessName);

        // Step 2: Create maintenance request
        const maintenanceRequest = await createMaintenanceRequest(macdonaldVendor);
        console.log('✅ Maintenance request created:', maintenanceRequest.title);

        // Step 3: Record approval transaction (when finance approves)
        const approvalTransaction = await recordApprovalTransaction(maintenanceRequest, macdonaldVendor);
        console.log('✅ Approval transaction recorded');

        // Step 4: Record payment transaction (when finance pays)
        const paymentTransaction = await recordPaymentTransaction(maintenanceRequest, macdonaldVendor);
        console.log('✅ Payment transaction recorded');

        // Step 5: Show system impact
        await showSystemImpact(macdonaldVendor, maintenanceRequest, approvalTransaction, paymentTransaction);

        console.log('\n🎉 MacDonald WiFi fixing request completed successfully!');

    } catch (error) {
        console.error('❌ Error handling MacDonald WiFi request:', error);
        throw error;
    }
}

/**
 * Create or find MacDonald vendor
 */
async function createOrFindMacdonaldVendor() {
    console.log('👤 Creating/finding MacDonald vendor...');

    // Check if vendor already exists
    let vendor = await Vendor.findOne({ 
        'contactPerson.email': 'macdonald.wifi@example.com' 
    });

    if (!vendor) {
        // Create new vendor
        const vendorCount = await Vendor.countDocuments();
        const chartOfAccountsCode = `200${(vendorCount + 1).toString().padStart(3, '0')}`;
        const expenseAccountCode = '5000'; // Maintenance expenses

        vendor = new Vendor({
            vendorCode: `V25${(vendorCount + 1).toString().padStart(3, '0')}`,
            businessName: 'MacDonald WiFi Services',
            tradingName: 'MacDonald Tech',
            
            contactPerson: {
                firstName: 'John',
                lastName: 'MacDonald',
                email: 'macdonald.wifi@example.com',
                phone: '+27 11 123 4567',
                mobile: '+27 82 123 4567'
            },
            
            businessAddress: {
                street: '123 Tech Street',
                city: 'Johannesburg',
                state: 'Gauteng',
                postalCode: '2000',
                country: 'South Africa'
            },
            
            chartOfAccountsCode: chartOfAccountsCode,
            expenseAccountCode: expenseAccountCode,
            category: 'maintenance',
            vendorType: 'service_provider',
            businessScope: 'WiFi installation and maintenance services',
            specializations: ['WiFi Installation', 'Network Maintenance', 'IT Support'],
            serviceAreas: ['Johannesburg', 'Pretoria'],
            
            bankDetails: {
                bankName: 'Standard Bank',
                accountNumber: '1234567890',
                accountType: 'Business Current',
                branchCode: '051001',
                swiftCode: 'SBZAZAJJ'
            },
            
            defaultPaymentMethod: 'Bank Transfer',
            paymentTerms: 'Net 30',
            creditLimit: 10000,
            currentBalance: 0,
            status: 'active'
        });

        await vendor.save();
        console.log('✅ New vendor created:', vendor.businessName);
    } else {
        console.log('✅ Existing vendor found:', vendor.businessName);
    }

    return vendor;
}

/**
 * Create maintenance request
 */
async function createMaintenanceRequest(vendor) {
    console.log('📋 Creating maintenance request...');

    const request = new Request({
        title: 'WiFi System Repair and Maintenance',
        description: 'Urgent WiFi system repair and maintenance required for MacDonald residence. System experiencing connectivity issues and requires professional intervention.',
        category: 'maintenance',
        priority: 'high',
        status: 'approved',
        residence: config.residence,
        
        items: [{
            description: 'WiFi System Repair and Maintenance',
            quantity: 1,
            unitCost: config.wifiFixingAmount,
            totalCost: config.wifiFixingAmount,
            category: 'maintenance',
            status: 'approved'
        }],
        
        quotations: [{
            vendorId: vendor._id,
            vendorCode: vendor.vendorCode,
            provider: vendor.businessName,
            amount: config.wifiFixingAmount,
            description: 'Complete WiFi system repair and maintenance service',
            isSelected: true,
            isApproved: true,
            approvedBy: 'finance@alamait.com',
            approvedAt: new Date()
        }],
        
        totalAmount: config.wifiFixingAmount,
        approvedBy: 'finance@alamait.com',
        approvedAt: new Date(),
        approvedAmount: config.wifiFixingAmount,
        status: 'approved'
    });

    await request.save();
    return request;
}

/**
 * Record approval transaction (when finance approves)
 */
async function recordApprovalTransaction(request, vendor) {
    console.log('💰 Recording approval transaction...');

    // Get expense account
    const expenseAccount = await Account.findOne({ 
        code: vendor.expenseAccountCode,
        type: 'Expense'
    });

    if (!expenseAccount) {
        throw new Error(`Expense account not found: ${vendor.expenseAccountCode}`);
    }

    // Get vendor payable account
    const vendorAccount = await Account.findOne({ 
        code: vendor.chartOfAccountsCode,
        type: 'Liability'
    });

    if (!vendorAccount) {
        throw new Error(`Vendor account not found: ${vendor.chartOfAccountsCode}`);
    }

    // Create transaction
    const transaction = new Transaction({
        date: new Date(),
        description: `WiFi Maintenance - ${vendor.businessName}`,
        reference: `REQ-${request._id}`,
        residence: config.residence,
        type: 'expense_approval'
    });

    await transaction.save();

    // Create transaction entries
    const entries = [];

    // Entry 1: Debit Expense Account (we incurred an expense)
    const expenseEntry = new TransactionEntry({
        transaction: transaction._id,
        account: expenseAccount._id,
        debit: config.wifiFixingAmount,
        credit: 0,
        type: 'expense',
        description: `WiFi maintenance expense - ${vendor.businessName}`,
        reference: `REQ-${request._id}`
    });
    await expenseEntry.save();
    entries.push(expenseEntry._id);

    // Entry 2: Credit Vendor Account (we owe the vendor)
    const vendorEntry = new TransactionEntry({
        transaction: transaction._id,
        account: vendorAccount._id,
        debit: 0,
        credit: config.wifiFixingAmount,
        type: 'liability',
        description: `Accounts payable - ${vendor.businessName}`,
        reference: `REQ-${request._id}`
    });
    await vendorEntry.save();
    entries.push(vendorEntry._id);

    // Update transaction with entries
    transaction.entries = entries;
    await transaction.save();

    // Update vendor balance
    vendor.currentBalance += config.wifiFixingAmount;
    await vendor.save();

    return transaction;
}

/**
 * Record payment transaction (when finance pays)
 */
async function recordPaymentTransaction(request, vendor) {
    console.log('💳 Recording payment transaction...');

    // Get vendor payable account
    const vendorAccount = await Account.findOne({ 
        code: vendor.chartOfAccountsCode,
        type: 'Liability'
    });

    // Get bank account (source of payment)
    const bankAccount = await Account.findOne({ 
        code: '1001', // Bank account code
        type: 'Asset'
    });

    if (!bankAccount) {
        throw new Error('Bank account not found');
    }

    // Create transaction
    const transaction = new Transaction({
        date: new Date(),
        description: `Payment to ${vendor.businessName}`,
        reference: `PAY-${request._id}`,
        residence: config.residence,
        type: 'vendor_payment'
    });

    await transaction.save();

    // Create transaction entries
    const entries = [];

    // Entry 1: Debit Vendor Account (reduce what we owe)
    const vendorEntry = new TransactionEntry({
        transaction: transaction._id,
        account: vendorAccount._id,
        debit: config.wifiFixingAmount,
        credit: 0,
        type: 'liability',
        description: `Payment to ${vendor.businessName}`,
        reference: `PAY-${request._id}`
    });
    await vendorEntry.save();
    entries.push(vendorEntry._id);

    // Entry 2: Credit Bank Account (reduce cash)
    const bankEntry = new TransactionEntry({
        transaction: transaction._id,
        account: bankAccount._id,
        debit: 0,
        credit: config.wifiFixingAmount,
        type: 'asset',
        description: `Payment via ${config.paymentMethod}`,
        reference: `PAY-${request._id}`
    });
    await bankEntry.save();
    entries.push(bankEntry._id);

    // Update transaction with entries
    transaction.entries = entries;
    await transaction.save();

    // Update vendor balance
    vendor.currentBalance -= config.wifiFixingAmount;
    await vendor.save();

    return transaction;
}

/**
 * Show system impact and account balances
 */
async function showSystemImpact(vendor, request, approvalTransaction, paymentTransaction) {
    console.log('\n📊 SYSTEM IMPACT ANALYSIS');
    console.log('=' .repeat(50));

    // Show vendor information
    console.log('\n👤 VENDOR INFORMATION:');
    console.log(`Business Name: ${vendor.businessName}`);
    console.log(`Vendor Code: ${vendor.vendorCode}`);
    console.log(`Chart of Accounts Code: ${vendor.chartOfAccountsCode}`);
    console.log(`Expense Account Code: ${vendor.expenseAccountCode}`);
    console.log(`Current Balance: R${vendor.currentBalance.toFixed(2)}`);
    console.log(`Category: ${vendor.category}`);

    // Show request information
    console.log('\n📋 REQUEST INFORMATION:');
    console.log(`Title: ${request.title}`);
    console.log(`Status: ${request.status}`);
    console.log(`Total Amount: R${request.totalAmount.toFixed(2)}`);
    console.log(`Approved Amount: R${request.approvedAmount.toFixed(2)}`);

    // Show transactions
    console.log('\n💰 TRANSACTIONS CREATED:');
    console.log(`1. Approval Transaction: ${approvalTransaction._id}`);
    console.log(`   - Type: ${approvalTransaction.type}`);
    console.log(`   - Amount: R${config.wifiFixingAmount.toFixed(2)}`);
    console.log(`   - Description: ${approvalTransaction.description}`);

    console.log(`2. Payment Transaction: ${paymentTransaction._id}`);
    console.log(`   - Type: ${paymentTransaction.type}`);
    console.log(`   - Amount: R${config.wifiFixingAmount.toFixed(2)}`);
    console.log(`   - Description: ${paymentTransaction.description}`);

    // Show account balances
    console.log('\n🏦 ACCOUNT BALANCES:');

    // Get vendor account balance
    const vendorAccount = await Account.findOne({ code: vendor.chartOfAccountsCode });
    if (vendorAccount) {
        const vendorBalance = await getAccountBalance(vendorAccount._id);
        console.log(`${vendorAccount.name} (${vendorAccount.code}): R${vendorBalance.toFixed(2)}`);
    }

    // Get expense account balance
    const expenseAccount = await Account.findOne({ code: vendor.expenseAccountCode });
    if (expenseAccount) {
        const expenseBalance = await getAccountBalance(expenseAccount._id);
        console.log(`${expenseAccount.name} (${expenseAccount.code}): R${expenseBalance.toFixed(2)}`);
    }

    // Get bank account balance
    const bankAccount = await Account.findOne({ code: '1001' });
    if (bankAccount) {
        const bankBalance = await getAccountBalance(bankAccount._id);
        console.log(`${bankAccount.name} (${bankAccount.code}): R${bankBalance.toFixed(2)}`);
    }

    // Show what appears in financial reports
    console.log('\n📈 FINANCIAL REPORTS IMPACT:');
    console.log('1. Income Statement:');
    console.log(`   - Maintenance Expenses: +R${config.wifiFixingAmount.toFixed(2)}`);
    console.log(`   - Net Income: -R${config.wifiFixingAmount.toFixed(2)}`);

    console.log('2. Balance Sheet:');
    console.log(`   - Bank Account: -R${config.wifiFixingAmount.toFixed(2)}`);
    console.log(`   - Accounts Payable: No change (paid off)`);

    console.log('3. Cash Flow Statement:');
    console.log(`   - Operating Activities: -R${config.wifiFixingAmount.toFixed(2)} (expense payment)`);

    console.log('\n✅ ACCOUNTING ENTRIES SUMMARY:');
    console.log('When Approved:');
    console.log(`   Dr. Maintenance Expenses (${vendor.expenseAccountCode})    R${config.wifiFixingAmount.toFixed(2)}`);
    console.log(`   Cr. Accounts Payable - ${vendor.businessName} (${vendor.chartOfAccountsCode})    R${config.wifiFixingAmount.toFixed(2)}`);

    console.log('When Paid:');
    console.log(`   Dr. Accounts Payable - ${vendor.businessName} (${vendor.chartOfAccountsCode})    R${config.wifiFixingAmount.toFixed(2)}`);
    console.log(`   Cr. Bank Account (1001)    R${config.wifiFixingAmount.toFixed(2)}`);
}

/**
 * Get account balance
 */
async function getAccountBalance(accountId) {
    const debitEntries = await TransactionEntry.aggregate([
        { $match: { account: accountId, debit: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$debit' } } }
    ]);

    const creditEntries = await TransactionEntry.aggregate([
        { $match: { account: accountId, credit: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$credit' } } }
    ]);

    const totalDebits = debitEntries[0]?.total || 0;
    const totalCredits = creditEntries[0]?.total || 0;

    // For assets and expenses: debit - credit
    // For liabilities, equity, and income: credit - debit
    const account = await Account.findById(accountId);
    if (account.type === 'Asset' || account.type === 'Expense') {
        return totalDebits - totalCredits;
    } else {
        return totalCredits - totalDebits;
    }
}

/**
 * Main execution
 */
async function main() {
    try {
        // Connect to database
        await mongoose.connect(config.databaseUrl, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to database');

        // Execute the process
        await handleMacdonaldWifiRequest();

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        // Close database connection
        await mongoose.connection.close();
        console.log('✅ Database connection closed');
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = {
    handleMacdonaldWifiRequest,
    createOrFindMacdonaldVendor,
    createMaintenanceRequest,
    recordApprovalTransaction,
    recordPaymentTransaction,
    showSystemImpact
}; 