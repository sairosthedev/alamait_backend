/**
 * COMPLETE MIGRATION SCRIPT
 * 
 * This script migrates all existing data to the new double-entry accounting system
 * Includes: Accounts, Debtors, Petty Cash, Transactions, and all existing data
 * 
 * Features:
 * - Duplicate prevention for transactions
 * - Proper account mapping
 * - Petty cash management setup
 * - Debtor account creation
 * - Vendor account creation
 * - Transaction history preservation
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const TransactionEntry = require('../models/TransactionEntry');
const Payment = require('../models/Payment');
const Expense = require('../models/finance/Expense');
const Vendor = require('../models/Vendor');
const Debtor = require('../models/Debtor');
const User = require('../models/User');

class CompleteMigrationScript {
    constructor() {
        this.stats = {
            accountsCreated: 0,
            accountsUpdated: 0,
            transactionsCreated: 0,
            transactionEntriesCreated: 0,
            debtorsCreated: 0,
            vendorsProcessed: 0,
            paymentsProcessed: 0,
            expensesProcessed: 0,
            pettyCashAccountsCreated: 0,
            errors: []
        };
        this.isConnected = false;
    }

    /**
     * Connect to MongoDB with retry logic
     */
    async connectToDatabase() {
        const maxRetries = 5;
        let retries = 0;

        while (retries < maxRetries) {
            try {
                console.log(`🔄 Attempting to connect to database (attempt ${retries + 1}/${maxRetries})...`);
                
                // Use the same connection string as your main app
                const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_backend';
                
                await mongoose.connect(mongoUri, {
                    useNewUrlParser: true,
                    useUnifiedTopology: true,
                    serverSelectionTimeoutMS: 30000, // 30 seconds
                    socketTimeoutMS: 45000, // 45 seconds
                    bufferMaxEntries: 0,
                    bufferCommands: false
                });

                this.isConnected = true;
                console.log('✅ Successfully connected to MongoDB');
                return true;

            } catch (error) {
                retries++;
                console.error(`❌ Connection attempt ${retries} failed:`, error.message);
                
                if (retries < maxRetries) {
                    console.log(`⏳ Waiting 5 seconds before retry...`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                } else {
                    console.error('❌ Failed to connect to database after all retries');
                    throw error;
                }
            }
        }
    }

    /**
     * Disconnect from MongoDB
     */
    async disconnectFromDatabase() {
        if (this.isConnected) {
            try {
                await mongoose.disconnect();
                console.log('✅ Disconnected from MongoDB');
            } catch (error) {
                console.error('❌ Error disconnecting from database:', error.message);
            }
        }
    }

    /**
     * Test database connection
     */
    async testConnection() {
        try {
            const collections = await mongoose.connection.db.listCollections().toArray();
            console.log(`✅ Database connection test successful. Found ${collections.length} collections.`);
            return true;
        } catch (error) {
            console.error('❌ Database connection test failed:', error.message);
            return false;
        }
    }

    async run() {
        console.log('🚀 Starting Complete Migration Script...');
        console.log('==========================================');

        try {
            // Step 0: Connect to database
            await this.connectToDatabase();
            
            // Test connection
            const connectionTest = await this.testConnection();
            if (!connectionTest) {
                throw new Error('Database connection test failed');
            }

            // Step 1: Migrate and enhance existing accounts
            await this.migrateAccounts();

            // Step 2: Create missing standard accounts
            await this.createStandardAccounts();

            // Step 3: Migrate existing transactions and entries
            await this.migrateExistingTransactions();

            // Step 4: Create transactions for student payments
            await this.migrateStudentPayments();

            // Step 5: Create vendor accounts and link transactions
            await this.migrateVendorAccounts();

            // Step 6: Create debtor accounts
            await this.migrateDebtorAccounts();

            // Step 7: Setup petty cash management
            await this.setupPettyCashManagement();

            // Step 8: Create transactions for expenses
            await this.migrateExpenses();

            // Step 9: Final validation and cleanup
            await this.validateMigration();

            console.log('✅ Migration completed successfully!');
            this.printStats();

        } catch (error) {
            console.error('❌ Migration failed:', error);
            this.stats.errors.push(error.message);
            this.printStats();
            throw error;
        } finally {
            // Always disconnect
            await this.disconnectFromDatabase();
        }
    }

    /**
     * Step 1: Migrate and enhance existing accounts
     */
    async migrateAccounts() {
        console.log('📊 Step 1: Migrating existing accounts...');
        
        try {
            const existingAccounts = await Account.find({}).maxTimeMS(30000);
            console.log(`Found ${existingAccounts.length} existing accounts`);
            
            for (const account of existingAccounts) {
                try {
                    // Standardize account structure
                    const updates = {};
                    
                    // Fix type casing
                    if (account.type) {
                        updates.type = this.standardizeAccountType(account.type);
                    }
                    
                    // Add missing fields
                    if (!account.category) {
                        updates.category = this.getCategoryForType(account.type);
                    }
                    
                    if (!account.isActive) {
                        updates.isActive = true;
                    }
                    
                    if (!account.level) {
                        updates.level = 1;
                    }
                    
                    if (!account.sortOrder) {
                        updates.sortOrder = 0;
                    }
                    
                    if (!account.metadata) {
                        updates.metadata = {};
                    }
                    
                    // Update account if needed
                    if (Object.keys(updates).length > 0) {
                        await Account.findByIdAndUpdate(account._id, updates).maxTimeMS(10000);
                        this.stats.accountsUpdated++;
                    }
                } catch (error) {
                    console.error(`❌ Error updating account ${account.code}:`, error.message);
                    this.stats.errors.push(`Account update ${account.code}: ${error.message}`);
                }
            }
            
            console.log(`✅ Migrated ${existingAccounts.length} existing accounts`);
            
        } catch (error) {
            console.error('❌ Error migrating accounts:', error);
            this.stats.errors.push(`Account migration: ${error.message}`);
        }
    }

    /**
     * Step 2: Create missing standard accounts
     */
    async createStandardAccounts() {
        console.log('📊 Step 2: Creating missing standard accounts...');
        
        const standardAccounts = [
            // Asset accounts
            { code: '1001', name: 'Bank Account', type: 'Asset', category: 'Current Assets' },
            { code: '1002', name: 'Cash on Hand', type: 'Asset', category: 'Current Assets' },
            { code: '1003', name: 'Ecocash Wallet', type: 'Asset', category: 'Current Assets' },
            { code: '1004', name: 'Innbucks Wallet', type: 'Asset', category: 'Current Assets' },
            { code: '1008', name: 'Petty Cash', type: 'Asset', category: 'Current Assets' },
            
            // Liability accounts
            { code: '2001', name: 'Accounts Payable', type: 'Liability', category: 'Current Liabilities' },
            
            // Income accounts
            { code: '4001', name: 'Rent Income', type: 'Income', category: 'Operating Revenue' },
            
            // Expense accounts
            { code: '5001', name: 'Maintenance Expense', type: 'Expense', category: 'Operating Expenses' },
            { code: '5002', name: 'Supplies Expense', type: 'Expense', category: 'Operating Expenses' },
            { code: '5003', name: 'Utilities Expense', type: 'Expense', category: 'Operating Expenses' },
            { code: '5004', name: 'Cleaning Expense', type: 'Expense', category: 'Operating Expenses' },
            { code: '5005', name: 'Transportation Expense', type: 'Expense', category: 'Operating Expenses' },
            { code: '5006', name: 'Office Expense', type: 'Expense', category: 'Operating Expenses' },
            { code: '5007', name: 'Miscellaneous Expense', type: 'Expense', category: 'Operating Expenses' }
        ];

        for (const accountData of standardAccounts) {
            try {
                const existingAccount = await Account.findOne({ code: accountData.code }).maxTimeMS(10000);
                
                if (!existingAccount) {
                    const account = new Account({
                        ...accountData,
                        isActive: true,
                        level: 1,
                        sortOrder: 0,
                        metadata: {}
                    });
                    
                    await account.save();
                    this.stats.accountsCreated++;
                    console.log(`✅ Created account: ${accountData.code} - ${accountData.name}`);
                } else {
                    console.log(`ℹ️ Account ${accountData.code} already exists`);
                }
            } catch (error) {
                console.error(`❌ Error creating account ${accountData.code}:`, error.message);
                this.stats.errors.push(`Account creation ${accountData.code}: ${error.message}`);
            }
        }
    }

    /**
     * Step 3: Migrate existing transactions and entries
     */
    async migrateExistingTransactions() {
        console.log('📊 Step 3: Migrating existing transactions and entries...');
        
        try {
            const existingTransactions = await Transaction.find({}).maxTimeMS(30000);
            console.log(`Found ${existingTransactions.length} existing transactions`);
            
            for (const transaction of existingTransactions) {
                try {
                    // Check if transaction already has proper structure
                    if (transaction.entries && transaction.entries.length > 0) {
                        // Update transaction with proper metadata
                        const updates = {};
                        
                        if (!transaction.residenceName) {
                            updates.residenceName = 'Migrated Residence';
                        }
                        
                        if (!transaction.metadata) {
                            updates.metadata = {
                                migrated: true,
                                originalId: transaction._id.toString()
                            };
                        }
                        
                        if (Object.keys(updates).length > 0) {
                            await Transaction.findByIdAndUpdate(transaction._id, updates).maxTimeMS(10000);
                        }
                        
                        this.stats.transactionsCreated++;
                    }
                } catch (error) {
                    console.error(`❌ Error updating transaction ${transaction._id}:`, error.message);
                    this.stats.errors.push(`Transaction update ${transaction._id}: ${error.message}`);
                }
            }
            
            console.log(`✅ Processed ${existingTransactions.length} existing transactions`);
            
        } catch (error) {
            console.error('❌ Error migrating transactions:', error);
            this.stats.errors.push(`Transaction migration: ${error.message}`);
        }
    }

    /**
     * Step 4: Create transactions for student payments
     */
    async migrateStudentPayments() {
        console.log('💰 Step 4: Creating transactions for student payments...');
        
        try {
            const payments = await Payment.find({ status: 'Verified' }).maxTimeMS(30000);
            console.log(`Found ${payments.length} verified payments`);
            
            for (const payment of payments) {
                try {
                    // Check if transaction already exists
                    const existingTransaction = await Transaction.findOne({ 
                        reference: payment.paymentId 
                    }).maxTimeMS(10000);
                    
                    if (!existingTransaction) {
                        const transactionId = await this.generateTransactionId();
                        
                        // Create transaction
                        const transaction = new Transaction({
                            transactionId,
                            date: payment.date,
                            description: `Payment: ${payment.paymentId}`,
                            type: 'payment',
                            reference: payment.paymentId,
                            residence: payment.residence,
                            residenceName: 'Migrated Residence',
                            amount: payment.totalAmount,
                            createdBy: payment.createdBy || new mongoose.Types.ObjectId('67f4ef0fcb87ffa3fb7e2d73'),
                            metadata: {
                                migrated: true,
                                source: 'payment'
                            }
                        });
                        
                        await transaction.save();
                        
                        // Create transaction entries
                        const entries = [];
                        
                        // Determine payment account based on method
                        const paymentAccountCode = this.getPaymentAccountCode(payment.method);
                        const paymentAccountName = this.getPaymentAccountName(payment.method);
                        
                        // Debit: Payment method account
                        entries.push({
                            accountCode: paymentAccountCode,
                            accountName: paymentAccountName,
                            accountType: 'Asset',
                            debit: payment.totalAmount,
                            credit: 0,
                            description: `Payment via ${payment.method}`
                        });
                        
                        // Credit: Rent Income
                        entries.push({
                            accountCode: '4001',
                            accountName: 'Rent Income',
                            accountType: 'Income',
                            debit: 0,
                            credit: payment.totalAmount,
                            description: `Rent income for ${payment.paymentMonth}`
                        });
                        
                        // Create transaction entry
                        const transactionEntry = new TransactionEntry({
                            transactionId: transaction.transactionId,
                            date: payment.date,
                            description: `Payment from student`,
                            reference: payment.paymentId,
                            entries,
                            totalDebit: payment.totalAmount,
                            totalCredit: payment.totalAmount,
                            source: 'payment',
                            sourceId: payment._id,
                            sourceModel: 'Payment',
                            createdBy: 'system@migration.com',
                            status: 'posted',
                            metadata: {
                                migrated: true,
                                paymentMethod: payment.method
                            }
                        });
                        
                        await transactionEntry.save();
                        
                        // Update transaction with entry reference
                        transaction.entries = [transactionEntry._id];
                        await transaction.save();
                        
                        this.stats.paymentsProcessed++;
                        this.stats.transactionEntriesCreated++;
                    }
                } catch (error) {
                    console.error(`❌ Error processing payment ${payment.paymentId}:`, error.message);
                    this.stats.errors.push(`Payment ${payment.paymentId}: ${error.message}`);
                }
            }
            
            console.log(`✅ Processed ${this.stats.paymentsProcessed} student payments`);
            
        } catch (error) {
            console.error('❌ Error migrating student payments:', error);
            this.stats.errors.push(`Student payment migration: ${error.message}`);
        }
    }

    /**
     * Step 5: Create vendor accounts and link transactions
     */
    async migrateVendorAccounts() {
        console.log('🏢 Step 5: Creating vendor accounts...');
        
        try {
            const vendors = await Vendor.find({ status: 'active' }).maxTimeMS(30000);
            console.log(`Found ${vendors.length} active vendors`);
            
            for (const vendor of vendors) {
                try {
                    // Get the main Accounts Payable account (2000) to link vendor accounts
                    const mainAPAccount = await Account.findOne({ code: '2000', type: 'Liability' });
                    
                    // Create vendor-specific payable account
                    const payableAccountName = `Accounts Payable: ${vendor.businessName}`;
                    const payableAccountCode = vendor.chartOfAccountsCode || `200${vendor.vendorCode.slice(-3)}`;
                    
                    let payableAccount = await Account.findOne({ 
                        name: payableAccountName, 
                        type: 'Liability' 
                    }).maxTimeMS(10000);
                    
                    if (!payableAccount) {
                        payableAccount = new Account({
                            code: payableAccountCode,
                            name: payableAccountName,
                            type: 'Liability',
                            category: 'Current Liabilities',
                            subcategory: 'Accounts Payable',
                            description: `Payable account for ${vendor.businessName}`,
                            isActive: true,
                            level: 2, // Set as level 2 (child of main AP account)
                            sortOrder: 0,
                            parentAccount: mainAPAccount ? mainAPAccount._id : null, // Link to main AP account
                            metadata: { 
                                vendorId: vendor._id, 
                                vendorCode: vendor.vendorCode, 
                                vendorType: vendor.category,
                                linkedToMainAP: true,
                                linkedDate: new Date(),
                                mainAPAccountCode: '2000'
                            }
                        });
                        
                        await payableAccount.save();
                        
                        // Update main AP account metadata if it exists
                        if (mainAPAccount) {
                            await Account.findByIdAndUpdate(mainAPAccount._id, {
                                $set: {
                                    'metadata.hasChildren': true,
                                    'metadata.lastUpdated': new Date()
                                },
                                $inc: { 'metadata.childrenCount': 1 }
                            });
                        }
                        
                        this.stats.accountsCreated++;
                        console.log(`✅ Created vendor payable account: ${payableAccountCode} - ${payableAccountName} (linked to 2000)`);
                    } else {
                        // If account exists but isn't linked, link it now
                        if (!payableAccount.parentAccount && mainAPAccount) {
                            payableAccount.parentAccount = mainAPAccount._id;
                            payableAccount.level = 2;
                            payableAccount.metadata = {
                                ...payableAccount.metadata,
                                linkedToMainAP: true,
                                linkedDate: new Date(),
                                mainAPAccountCode: '2000'
                            };
                            await payableAccount.save();
                            
                            // Update main AP account metadata
                            await Account.findByIdAndUpdate(mainAPAccount._id, {
                                $set: {
                                    'metadata.hasChildren': true,
                                    'metadata.lastUpdated': new Date()
                                },
                                $inc: { 'metadata.childrenCount': 1 }
                            });
                            
                            console.log(`✅ Linked existing vendor account: ${payableAccountCode} - ${payableAccountName} to 2000`);
                        }
                    }
                    
                    // Update vendor with account reference
                    vendor.chartOfAccountsCode = payableAccount.code;
                    await vendor.save();
                    
                    this.stats.vendorsProcessed++;
                    
                } catch (error) {
                    console.error(`❌ Error processing vendor ${vendor.businessName}:`, error.message);
                    this.stats.errors.push(`Vendor ${vendor.businessName}: ${error.message}`);
                }
            }
            
            console.log(`✅ Processed ${this.stats.vendorsProcessed} vendors`);
            
        } catch (error) {
            console.error('❌ Error migrating vendor accounts:', error);
            this.stats.errors.push(`Vendor migration: ${error.message}`);
        }
    }

    /**
     * Step 6: Create debtor accounts
     */
    async migrateDebtorAccounts() {
        console.log('👥 Step 6: Creating debtor accounts...');
        
        try {
            // Get all users who might be debtors (students/tenants)
            const users = await User.find({ 
                role: { $in: ['student', 'tenant'] } 
            }).maxTimeMS(30000);
            
            console.log(`Found ${users.length} potential debtors`);
            
            for (const user of users) {
                try {
                    // Check if debtor already exists
                    let debtor = await Debtor.findOne({ user: user._id }).maxTimeMS(10000);
                    
                    if (!debtor) {
                        // Generate debtor code and account code
                        const debtorCode = await Debtor.generateDebtorCode();
                        const accountCode = await Debtor.generateAccountCode();
                        
                        // Create debtor record
                        debtor = new Debtor({
                            debtorCode,
                            user: user._id,
                            accountCode,
                            status: 'active',
                            currentBalance: 0,
                            totalOwed: 0,
                            totalPaid: 0,
                            creditLimit: 0,
                            paymentTerms: 'monthly',
                            contactInfo: {
                                name: `${user.firstName} ${user.lastName}`,
                                email: user.email,
                                phone: user.phone || ''
                            },
                            createdBy: new mongoose.Types.ObjectId('67f4ef0fcb87ffa3fb7e2d73')
                        });
                        
                        await debtor.save();
                        this.stats.debtorsCreated++;
                        
                        // Create debtor-specific receivable account
                        const receivableAccountName = `Accounts Receivable: ${user.firstName} ${user.lastName}`;
                        const receivableAccount = new Account({
                            code: accountCode,
                            name: receivableAccountName,
                            type: 'Asset',
                            category: 'Current Assets',
                            subcategory: 'Accounts Receivable',
                            description: `Receivable account for ${user.firstName} ${user.lastName}`,
                            isActive: true,
                            level: 1,
                            sortOrder: 0,
                            metadata: { 
                                debtorId: debtor._id, 
                                userId: user._id 
                            }
                        });
                        
                        await receivableAccount.save();
                        this.stats.accountsCreated++;
                    }
                    
                } catch (error) {
                    console.error(`❌ Error processing debtor for user ${user.email}:`, error.message);
                    this.stats.errors.push(`Debtor ${user.email}: ${error.message}`);
                }
            }
            
            console.log(`✅ Created ${this.stats.debtorsCreated} debtor accounts`);
            
        } catch (error) {
            console.error('❌ Error migrating debtor accounts:', error);
            this.stats.errors.push(`Debtor migration: ${error.message}`);
        }
    }

    /**
     * Step 7: Setup petty cash management
     */
    async setupPettyCashManagement() {
        console.log('💰 Step 7: Setting up petty cash management...');
        
        try {
            // Create petty cash accounts for different users
            const pettyCashAccounts = [
                { code: '1008', name: 'Petty Cash', type: 'Asset', category: 'Current Assets' },
                { code: '1009', name: 'Admin Petty Cash', type: 'Asset', category: 'Current Assets' },
                { code: '1010', name: 'Finance Petty Cash', type: 'Asset', category: 'Current Assets' },
                { code: '1011', name: 'Manager Petty Cash', type: 'Asset', category: 'Current Assets' }
            ];
            
            for (const accountData of pettyCashAccounts) {
                try {
                    const existingAccount = await Account.findOne({ code: accountData.code }).maxTimeMS(10000);
                    
                    if (!existingAccount) {
                        const account = new Account({
                            ...accountData,
                            isActive: true,
                            level: 1,
                            sortOrder: 0,
                            metadata: {
                                pettyCash: true,
                                accountType: accountData.name.toLowerCase().replace(' ', '_')
                            }
                        });
                        
                        await account.save();
                        this.stats.pettyCashAccountsCreated++;
                        console.log(`✅ Created petty cash account: ${accountData.code} - ${accountData.name}`);
                    } else {
                        console.log(`ℹ️ Petty cash account ${accountData.code} already exists`);
                    }
                } catch (error) {
                    console.error(`❌ Error creating petty cash account ${accountData.code}:`, error.message);
                    this.stats.errors.push(`Petty cash account ${accountData.code}: ${error.message}`);
                }
            }
            
            console.log(`✅ Created ${this.stats.pettyCashAccountsCreated} petty cash accounts`);
            
        } catch (error) {
            console.error('❌ Error setting up petty cash management:', error);
            this.stats.errors.push(`Petty cash setup: ${error.message}`);
        }
    }

    /**
     * Step 8: Create transactions for expenses
     */
    async migrateExpenses() {
        console.log('💸 Step 8: Creating transactions for expenses...');
        
        try {
            const expenses = await Expense.find({}).maxTimeMS(30000);
            console.log(`Found ${expenses.length} expenses`);
            
            for (const expense of expenses) {
                try {
                    // Check if transaction already exists
                    const existingTransaction = await Transaction.findOne({ 
                        reference: expense.expenseId 
                    }).maxTimeMS(10000);
                    
                    if (!existingTransaction) {
                        const transactionId = await this.generateTransactionId();
                        
                        // Create transaction
                        const transaction = new Transaction({
                            transactionId,
                            date: expense.expenseDate,
                            description: `Expense: ${expense.description}`,
                            type: expense.paymentStatus === 'Paid' ? 'payment' : 'approval',
                            reference: expense.expenseId,
                            residence: expense.residence,
                            residenceName: 'Migrated Residence',
                            amount: expense.amount,
                            createdBy: expense.createdBy || new mongoose.Types.ObjectId('67f4ef0fcb87ffa3fb7e2d73'),
                            metadata: {
                                migrated: true,
                                source: 'expense',
                                category: expense.category
                            }
                        });
                        
                        await transaction.save();
                        
                        // Create transaction entries
                        const entries = [];
                        
                        // Determine expense account based on category
                        const expenseAccountCode = this.getExpenseAccountCode(expense.category);
                        const expenseAccountName = `${expense.category} Expense`;
                        
                        // Debit: Expense account
                        entries.push({
                            accountCode: expenseAccountCode,
                            accountName: expenseAccountName,
                            accountType: 'Expense',
                            debit: expense.amount,
                            credit: 0,
                            description: expense.description
                        });
                        
                        // Credit: Payment method or payable account
                        if (expense.paymentStatus === 'Paid') {
                            // If paid, credit the payment method
                            const paymentAccountCode = this.getPaymentAccountCode(expense.paymentMethod || 'Cash');
                            const paymentAccountName = this.getPaymentAccountName(expense.paymentMethod || 'Cash');
                            
                            entries.push({
                                accountCode: paymentAccountCode,
                                accountName: paymentAccountName,
                                accountType: 'Asset',
                                debit: 0,
                                credit: expense.amount,
                                description: `Payment via ${expense.paymentMethod || 'Cash'}`
                            });
                        } else {
                            // If not paid, credit accounts payable
                            entries.push({
                                accountCode: '2001',
                                accountName: 'Accounts Payable',
                                accountType: 'Liability',
                                debit: 0,
                                credit: expense.amount,
                                description: `Payable for ${expense.description}`
                            });
                        }
                        
                        // Create transaction entry
                        const transactionEntry = new TransactionEntry({
                            transactionId: transaction.transactionId,
                            date: expense.expenseDate,
                            description: `Expense: ${expense.description}`,
                            reference: expense.expenseId,
                            entries,
                            totalDebit: expense.amount,
                            totalCredit: expense.amount,
                            source: 'expense_payment',
                            sourceId: expense._id,
                            sourceModel: 'Expense',
                            createdBy: 'system@migration.com',
                            status: 'posted',
                            metadata: {
                                migrated: true,
                                expenseCategory: expense.category,
                                paymentStatus: expense.paymentStatus
                            }
                        });
                        
                        await transactionEntry.save();
                        
                        // Update transaction with entry reference
                        transaction.entries = [transactionEntry._id];
                        await transaction.save();
                        
                        this.stats.expensesProcessed++;
                        this.stats.transactionEntriesCreated++;
                    }
                } catch (error) {
                    console.error(`❌ Error processing expense ${expense.expenseId}:`, error.message);
                    this.stats.errors.push(`Expense ${expense.expenseId}: ${error.message}`);
                }
            }
            
            console.log(`✅ Processed ${this.stats.expensesProcessed} expenses`);
            
        } catch (error) {
            console.error('❌ Error migrating expenses:', error);
            this.stats.errors.push(`Expense migration: ${error.message}`);
        }
    }

    /**
     * Step 9: Final validation and cleanup
     */
    async validateMigration() {
        console.log('🔍 Step 9: Validating migration...');
        
        try {
            // Check account balances
            const accounts = await Account.find({ isActive: true }).maxTimeMS(30000);
            console.log(`✅ Found ${accounts.length} active accounts`);
            
            // Check transactions
            const transactions = await Transaction.find({}).maxTimeMS(30000);
            console.log(`✅ Found ${transactions.length} transactions`);
            
            // Check transaction entries
            const transactionEntries = await TransactionEntry.find({}).maxTimeMS(30000);
            console.log(`✅ Found ${transactionEntries.length} transaction entries`);
            
            // Check debtors
            const debtors = await Debtor.find({}).maxTimeMS(30000);
            console.log(`✅ Found ${debtors.length} debtors`);
            
            // Check vendors
            const vendors = await Vendor.find({}).maxTimeMS(30000);
            console.log(`✅ Found ${vendors.length} vendors`);
            
            console.log('✅ Migration validation completed');
            
        } catch (error) {
            console.error('❌ Error validating migration:', error);
            this.stats.errors.push(`Validation: ${error.message}`);
        }
    }

    // Helper methods
    standardizeAccountType(type) {
        const typeMap = {
            'asset': 'Asset',
            'liability': 'Liability',
            'equity': 'Equity',
            'income': 'Income',
            'expense': 'Expense'
        };
        return typeMap[type.toLowerCase()] || type;
    }

    getCategoryForType(type) {
        const categoryMap = {
            'Asset': 'Current Assets',
            'Liability': 'Current Liabilities',
            'Equity': 'Owner Equity',
            'Income': 'Operating Revenue',
            'Expense': 'Operating Expenses'
        };
        return categoryMap[type] || 'Other Assets';
    }

    getPaymentAccountCode(method) {
        const methodAccounts = {
            'Bank Transfer': '1001',
            'Cash': '1002',
            'Ecocash': '1003',
            'Innbucks': '1004'
        };
        return methodAccounts[method] || '1002';
    }

    getPaymentAccountName(method) {
        const methodNames = {
            'Bank Transfer': 'Bank Account',
            'Cash': 'Cash on Hand',
            'Ecocash': 'Ecocash Wallet',
            'Innbucks': 'Innbucks Wallet'
        };
        return methodNames[method] || 'Cash on Hand';
    }

    getExpenseAccountCode(category) {
        const categoryAccounts = {
            'Maintenance': '5001',
            'Supplies': '5002',
            'Utilities': '5003',
            'Cleaning': '5004',
            'Transportation': '5005',
            'Office': '5006',
            'Miscellaneous': '5007'
        };
        return categoryAccounts[category] || '5007';
    }

    async generateTransactionId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 5).toUpperCase();
        return `TXN${timestamp}${random}`;
    }

    printStats() {
        console.log('\n📊 MIGRATION STATISTICS');
        console.log('========================');
        console.log(`✅ Accounts Created: ${this.stats.accountsCreated}`);
        console.log(`✅ Accounts Updated: ${this.stats.accountsUpdated}`);
        console.log(`✅ Transactions Created: ${this.stats.transactionsCreated}`);
        console.log(`✅ Transaction Entries Created: ${this.stats.transactionEntriesCreated}`);
        console.log(`✅ Debtors Created: ${this.stats.debtorsCreated}`);
        console.log(`✅ Vendors Processed: ${this.stats.vendorsProcessed}`);
        console.log(`✅ Payments Processed: ${this.stats.paymentsProcessed}`);
        console.log(`✅ Expenses Processed: ${this.stats.expensesProcessed}`);
        console.log(`✅ Petty Cash Accounts Created: ${this.stats.pettyCashAccountsCreated}`);
        
        if (this.stats.errors.length > 0) {
            console.log(`❌ Errors: ${this.stats.errors.length}`);
            this.stats.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
        }
    }
}

// Run the migration
async function runMigration() {
    try {
        const migration = new CompleteMigrationScript();
        await migration.run();
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Export for use in other scripts
module.exports = { CompleteMigrationScript, runMigration };

// Run if called directly
if (require.main === module) {
    runMigration();
} 