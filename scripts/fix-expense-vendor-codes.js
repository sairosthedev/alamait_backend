const mongoose = require('mongoose');
const Account = require('../src/models/Account');
const TransactionEntry = require('../src/models/TransactionEntry');
const Vendor = require('../src/models/Vendor');
const Expense = require('../src/models/finance/Expense');

async function fixExpenseVendorCodes() {
    try {
        console.log('🔧 Fixing Expense Vendor Code Mismatches...\n');
        
        // Connect to MongoDB (try local first, then Atlas)
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB\n');

        // Step 1: Find all vendors and their account codes
        const vendors = await Vendor.find({}).sort({ businessName: 1 });
        console.log(`📋 Found ${vendors.length} vendors:`);
        for (const vendor of vendors) {
            console.log(`   ${vendor.vendorCode} - ${vendor.businessName} (AP Code: ${vendor.chartOfAccountsCode})`);
        }

        // Step 2: Find all accounts payable accounts
        const apAccounts = await Account.find({
            type: 'Liability',
            isActive: true,
            $or: [
                { code: { $regex: '^2000' } },
                { name: { $regex: /accounts payable/i } }
            ]
        }).sort({ code: 1 });

        console.log(`\n📋 Found ${apAccounts.length} Accounts Payable accounts:`);
        for (const account of apAccounts) {
            console.log(`   ${account.code} - ${account.name} (ID: ${account._id})`);
        }

        // Step 3: Create a mapping of vendor names to correct account codes
        const vendorNameToCodeMap = {};
        apAccounts.forEach(account => {
            // Extract vendor name from account name (e.g., "Accounts Payable - Gift Plumber Services" -> "Gift Plumber Services")
            const vendorName = account.name.replace(/^Accounts Payable - /i, '').toLowerCase();
            vendorNameToCodeMap[vendorName] = account.code;
        });

        console.log(`\n📋 Vendor Name to Account Code Mapping:`);
        Object.entries(vendorNameToCodeMap).forEach(([name, code]) => {
            console.log(`   "${name}" -> ${code}`);
        });

        // Step 4: Find all expenses with vendor information
        const expenses = await Expense.find({
            $or: [
                { vendorCode: { $exists: true } },
                { vendorSpecificAccount: { $exists: true } },
                { vendorName: { $exists: true } }
            ]
        }).sort({ createdAt: -1 });

        console.log(`\n📊 Found ${expenses.length} expenses with vendor information`);

        let fixedCount = 0;
        const mismatches = [];

        for (const expense of expenses) {
            let expenseUpdated = false;
            const updates = {};

            // Check vendorCode field
            if (expense.vendorCode) {
                const correctCode = vendorNameToCodeMap[expense.vendorName?.toLowerCase()];
                if (correctCode && correctCode !== expense.vendorCode) {
                    console.log(`🔧 Fixing expense ${expense.expenseId}:`);
                    console.log(`   Vendor: ${expense.vendorName}`);
                    console.log(`   Wrong vendorCode: ${expense.vendorCode} -> Correct: ${correctCode}`);
                    
                    updates.vendorCode = correctCode;
                    expenseUpdated = true;
                    fixedCount++;
                    
                    mismatches.push({
                        expenseId: expense.expenseId,
                        vendorName: expense.vendorName,
                        wrongCode: expense.vendorCode,
                        correctCode: correctCode,
                        date: expense.createdAt
                    });
                }
            }

            // Check vendorSpecificAccount field
            if (expense.vendorSpecificAccount) {
                const correctCode = vendorNameToCodeMap[expense.vendorName?.toLowerCase()];
                if (correctCode && correctCode !== expense.vendorSpecificAccount) {
                    console.log(`🔧 Fixing expense ${expense.expenseId}:`);
                    console.log(`   Vendor: ${expense.vendorName}`);
                    console.log(`   Wrong vendorSpecificAccount: ${expense.vendorSpecificAccount} -> Correct: ${correctCode}`);
                    
                    updates.vendorSpecificAccount = correctCode;
                    expenseUpdated = true;
                    fixedCount++;
                    
                    mismatches.push({
                        expenseId: expense.expenseId,
                        vendorName: expense.vendorName,
                        wrongCode: expense.vendorSpecificAccount,
                        correctCode: correctCode,
                        date: expense.createdAt,
                        field: 'vendorSpecificAccount'
                    });
                }
            }

            // Update the expense if changes were made
            if (expenseUpdated) {
                await Expense.findByIdAndUpdate(expense._id, updates);
                console.log(`   ✅ Updated expense: ${expense.expenseId}`);
            }
        }

        console.log(`\n📊 Summary:`);
        console.log(`   Total expenses with vendor info: ${expenses.length}`);
        console.log(`   Fixed mismatches: ${fixedCount}`);

        if (mismatches.length > 0) {
            console.log(`\n📋 Detailed Mismatch Report:`);
            mismatches.forEach(mismatch => {
                console.log(`   Expense: ${mismatch.expenseId}`);
                console.log(`   Vendor: ${mismatch.vendorName}`);
                console.log(`   Wrong Code: ${mismatch.wrongCode} -> Correct Code: ${mismatch.correctCode}`);
                console.log(`   Field: ${mismatch.field || 'vendorCode'}`);
                console.log(`   Date: ${mismatch.date}`);
                console.log('   ---');
            });
        }

        // Step 5: Also fix any transactions that might have the wrong account codes
        console.log(`\n🔍 Checking for transaction entry mismatches...`);
        
        const allAPTransactions = await TransactionEntry.find({
            'entries.accountCode': { $regex: '^200' }
        });

        let transactionFixedCount = 0;

        for (const transaction of allAPTransactions) {
            let transactionUpdated = false;
            
            for (const entry of transaction.entries) {
                if (entry.accountCode && entry.accountCode.startsWith('200')) {
                    // Check if this account code exists in our accounts
                    const accountExists = apAccounts.find(acc => acc.code === entry.accountCode);
                    
                    if (!accountExists) {
                        // Try to find the correct account by name
                        const correctCode = vendorNameToCodeMap[entry.accountName?.toLowerCase()];
                        
                        if (correctCode && correctCode !== entry.accountCode) {
                            console.log(`🔧 Fixing transaction entry:`);
                            console.log(`   Transaction: ${transaction.transactionId}`);
                            console.log(`   Entry: ${entry.accountCode} -> ${correctCode}`);
                            console.log(`   Account: ${entry.accountName}`);
                            
                            // Update the account code in the entry
                            entry.accountCode = correctCode;
                            transactionUpdated = true;
                            transactionFixedCount++;
                        }
                    }
                }
            }
            
            // Save the transaction if it was updated
            if (transactionUpdated) {
                await transaction.save();
                console.log(`   ✅ Updated transaction: ${transaction.transactionId}`);
            }
        }

        console.log(`\n📊 Transaction Fix Summary:`);
        console.log(`   Fixed transaction entries: ${transactionFixedCount}`);

        if (fixedCount > 0 || transactionFixedCount > 0) {
            console.log(`\n✅ Successfully fixed ${fixedCount} expense mismatches and ${transactionFixedCount} transaction mismatches!`);
        } else {
            console.log(`\n✅ No mismatches found - all vendor codes are correct`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
        
        // If it's a connection error, provide helpful information
        if (error.message.includes('authentication') || error.message.includes('credentials')) {
            console.log('\n💡 Connection Error: The MongoDB Atlas cluster requires authentication credentials.');
            console.log('   Please set the MONGODB_URI environment variable with the full connection string including username and password.');
            console.log('   Example: mongodb+srv://username:password@cluster0.ulvve.mongodb.net/test');
        }
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the fix
fixExpenseVendorCodes();
