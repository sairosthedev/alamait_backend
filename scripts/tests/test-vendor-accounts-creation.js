const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Import the models
const Vendor = require('./src/models/Vendor');
const Account = require('./src/models/Account');

// Helper function to ensure chart of accounts entries exist (copied from vendorController)
async function ensureChartOfAccountsEntries(vendorCode, expenseCode, vendor) {
    try {
        // Check if vendor account exists
        let vendorAccount = await Account.findOne({ code: vendorCode });
        if (!vendorAccount) {
            vendorAccount = new Account({
                code: vendorCode,
                name: `Accounts Payable - ${vendor.businessName}`,
                type: 'Liability'
            });
            await vendorAccount.save();
            console.log('Created vendor account:', vendorAccount.code, vendorAccount.name);
        } else {
            console.log('Vendor account already exists:', vendorAccount.code, vendorAccount.name);
        }

        // Check if expense account exists
        let expenseAccount = await Account.findOne({ code: expenseCode });
        if (!expenseAccount) {
            expenseAccount = new Account({
                code: expenseCode,
                name: `${vendor.category.charAt(0).toUpperCase() + vendor.category.slice(1)} Expenses`,
                type: 'Expense'
            });
            await expenseAccount.save();
            console.log('Created expense account:', expenseAccount.code, expenseAccount.name);
        } else {
            console.log('Expense account already exists:', expenseAccount.code, expenseAccount.name);
        }

    } catch (error) {
        console.error('Error ensuring chart of accounts entries:', error);
        throw error;
    }
}

async function testVendorAccountsCreation() {
    try {
        console.log('Testing vendor creation with automatic chart of accounts creation...');
        
        // Count existing accounts before vendor creation
        const accountsBefore = await Account.countDocuments();
        console.log('Accounts before vendor creation:', accountsBefore);
        
        // Generate vendor code
        const timestamp = Date.now().toString().substr(-8);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const year = new Date().getFullYear().toString().substr(-2);
        const vendorCode = `V${year}${timestamp}${random}`;
        
        console.log('Generated vendorCode:', vendorCode);
        
        // Create a test vendor
        const testVendor = new Vendor({
            vendorCode,
            businessName: 'Test Vendor for Accounts',
            tradingName: 'Test Trading',
            contactPerson: {
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@testaccounts.com',
                phone: '1234567890'
            },
            businessAddress: {
                street: '123 Test Street',
                city: 'Test City',
                country: 'South Africa'
            },
            category: 'maintenance',
            chartOfAccountsCode: '200001',
            expenseAccountCode: '5000',
            createdBy: new mongoose.Types.ObjectId()
        });
        
        // Save the vendor
        const savedVendor = await testVendor.save();
        console.log('Vendor saved successfully!');
        
        // Call the function to create accounts
        await ensureChartOfAccountsEntries(savedVendor.chartOfAccountsCode, savedVendor.expenseAccountCode, savedVendor);
        console.log('Chart of accounts creation completed');
        
        // Count accounts after vendor creation
        const accountsAfter = await Account.countDocuments();
        console.log('Accounts after vendor creation:', accountsAfter);
        console.log('New accounts created:', accountsAfter - accountsBefore);
        
        // Check if the specific accounts were created
        const vendorAccount = await Account.findOne({ code: savedVendor.chartOfAccountsCode });
        const expenseAccount = await Account.findOne({ code: savedVendor.expenseAccountCode });
        
        console.log('\nCreated accounts:');
        if (vendorAccount) {
            console.log('✅ Vendor Account:', {
                code: vendorAccount.code,
                name: vendorAccount.name,
                type: vendorAccount.type
            });
        } else {
            console.log('❌ Vendor Account not found');
        }
        
        if (expenseAccount) {
            console.log('✅ Expense Account:', {
                code: expenseAccount.code,
                name: expenseAccount.name,
                type: expenseAccount.type
            });
        } else {
            console.log('❌ Expense Account not found');
        }
        
        // Clean up - delete the test vendor and accounts
        await Vendor.findByIdAndDelete(savedVendor._id);
        if (vendorAccount) await Account.findByIdAndDelete(vendorAccount._id);
        if (expenseAccount) await Account.findByIdAndDelete(expenseAccount._id);
        console.log('\nTest vendor and accounts cleaned up');
        
    } catch (error) {
        console.error('Error testing vendor accounts creation:', error);
    } finally {
        mongoose.connection.close();
    }
}

testVendorAccountsCreation(); 