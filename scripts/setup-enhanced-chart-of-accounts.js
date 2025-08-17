const mongoose = require('mongoose');
const Account = require('../src/models/Account');

/**
 * Enhanced Chart of Accounts Setup Script
 * 
 * This script creates the complete chart of accounts structure
 * for your property management business, building on your existing
 * rental accrual system.
 * 
 * Run with: node setup-enhanced-chart-of-accounts.js
 */

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';

// Enhanced Chart of Accounts Structure
const enhancedChartOfAccounts = [
    // ASSETS (1000 Series)
    
    // Current Assets (1100-1199)
    {
        code: '1100',
        name: 'Accounts Receivable - Tenants',
        type: 'asset',
        category: 'Current Assets',
        description: 'Money owed by tenants across all properties',
        isActive: true
    },
    {
        code: '1101',
        name: 'Accounts Receivable - St Kilda',
        type: 'asset',
        category: 'Current Assets',
        description: 'Money owed by St Kilda tenants',
        isActive: true
    },
    {
        code: '1102',
        name: 'Accounts Receivable - Belvedere',
        type: 'asset',
        category: 'Current Assets',
        description: 'Money owed by Belvedere tenants',
        isActive: true
    },
    {
        code: '1103',
        name: 'Accounts Receivable - Nyanga',
        type: 'asset',
        category: 'Current Assets',
        description: 'Money owed by Nyanga tenants',
        isActive: true
    },
    {
        code: '1110',
        name: 'Bank - Main Account',
        type: 'asset',
        category: 'Current Assets',
        description: 'Primary business bank account',
        isActive: true
    },
    {
        code: '1111',
        name: 'Bank - Secondary Account',
        type: 'asset',
        category: 'Current Assets',
        description: 'Secondary business bank account',
        isActive: true
    },
    {
        code: '1120',
        name: 'Petty Cash - Admin',
        type: 'asset',
        category: 'Current Assets',
        description: 'Administrative petty cash fund',
        isActive: true
    },
    {
        code: '1121',
        name: 'Petty Cash - Finance',
        type: 'asset',
        category: 'Current Assets',
        description: 'Finance petty cash fund',
        isActive: true
    },
    {
        code: '1130',
        name: 'Prepaid Expenses',
        type: 'asset',
        category: 'Current Assets',
        description: 'Prepaid insurance, licenses, and other expenses',
        isActive: true
    },
    {
        code: '1131',
        name: 'Prepaid Insurance',
        type: 'asset',
        category: 'Current Assets',
        description: 'Prepaid insurance premiums',
        isActive: true
    },
    {
        code: '1132',
        name: 'Prepaid Licenses',
        type: 'asset',
        category: 'Current Assets',
        description: 'Prepaid business licenses and permits',
        isActive: true
    },

    // Non-Current Assets (1200-1299)
    {
        code: '1200',
        name: 'Land & Buildings - St Kilda',
        type: 'asset',
        category: 'Non-Current Assets',
        description: 'St Kilda property land and buildings',
        isActive: true
    },
    {
        code: '1201',
        name: 'Land & Buildings - Belvedere',
        type: 'asset',
        category: 'Non-Current Assets',
        description: 'Belvedere property land and buildings',
        isActive: true
    },
    {
        code: '1202',
        name: 'Land & Buildings - Nyanga',
        type: 'asset',
        category: 'Non-Current Assets',
        description: 'Nyanga property land and buildings',
        isActive: true
    },
    {
        code: '1210',
        name: 'Furniture & Fixtures - St Kilda',
        type: 'asset',
        category: 'Non-Current Assets',
        description: 'St Kilda property furniture and fixtures',
        isActive: true
    },
    {
        code: '1211',
        name: 'Furniture & Fixtures - Belvedere',
        type: 'asset',
        category: 'Non-Current Assets',
        description: 'Belvedere property furniture and fixtures',
        isActive: true
    },
    {
        code: '1212',
        name: 'Furniture & Fixtures - Nyanga',
        type: 'asset',
        category: 'Non-Current Assets',
        description: 'Nyanga property furniture and fixtures',
        isActive: true
    },
    {
        code: '1220',
        name: 'Office Equipment & Tools',
        type: 'asset',
        category: 'Non-Current Assets',
        description: 'Office equipment, computers, and tools',
        isActive: true
    },
    {
        code: '1230',
        name: 'Vehicles',
        type: 'asset',
        category: 'Non-Current Assets',
        description: 'Business vehicles',
        isActive: true
    },
    {
        code: '1240',
        name: 'Accumulated Depreciation - Buildings',
        type: 'asset',
        category: 'Non-Current Assets',
        description: 'Accumulated depreciation on buildings (contra account)',
        isActive: true
    },
    {
        code: '1241',
        name: 'Accumulated Depreciation - Furniture',
        type: 'asset',
        category: 'Non-Current Assets',
        description: 'Accumulated depreciation on furniture (contra account)',
        isActive: true
    },
    {
        code: '1242',
        name: 'Accumulated Depreciation - Equipment',
        type: 'asset',
        category: 'Non-Current Assets',
        description: 'Accumulated depreciation on equipment (contra account)',
        isActive: true
    },

    // LIABILITIES (2000 Series)
    
    // Current Liabilities (2100-2199)
    {
        code: '2100',
        name: 'Accounts Payable - Suppliers',
        type: 'liability',
        category: 'Current Liabilities',
        description: 'Money owed to suppliers',
        isActive: true
    },
    {
        code: '2101',
        name: 'Accounts Payable - Utilities',
        type: 'liability',
        category: 'Current Liabilities',
        description: 'Money owed to utility companies',
        isActive: true
    },
    {
        code: '2102',
        name: 'Accounts Payable - Maintenance',
        type: 'liability',
        category: 'Current Liabilities',
        description: 'Money owed to maintenance contractors',
        isActive: true
    },
    {
        code: '2110',
        name: 'Accrued Expenses',
        type: 'liability',
        category: 'Current Liabilities',
        description: 'Expenses incurred but not yet paid',
        isActive: true
    },
    {
        code: '2111',
        name: 'Accrued Utilities',
        type: 'liability',
        category: 'Current Liabilities',
        description: 'Utilities used but not yet billed',
        isActive: true
    },
    {
        code: '2112',
        name: 'Accrued Salaries',
        type: 'liability',
        category: 'Current Liabilities',
        description: 'Salaries earned but not yet paid',
        isActive: true
    },
    {
        code: '2120',
        name: 'Short-Term Loans',
        type: 'liability',
        category: 'Current Liabilities',
        description: 'Short-term loans due within one year',
        isActive: true
    },
    {
        code: '2130',
        name: 'Taxes Payable',
        type: 'liability',
        category: 'Current Liabilities',
        description: 'Taxes owed to government',
        isActive: true
    },

    // Non-Current Liabilities (2200-2299)
    {
        code: '2200',
        name: 'Long-Term Loans',
        type: 'liability',
        category: 'Non-Current Liabilities',
        description: 'Long-term loans and mortgages',
        isActive: true
    },
    {
        code: '2201',
        name: 'Mortgage - St Kilda',
        type: 'liability',
        category: 'Non-Current Liabilities',
        description: 'Mortgage on St Kilda property',
        isActive: true
    },
    {
        code: '2202',
        name: 'Mortgage - Belvedere',
        type: 'liability',
        category: 'Non-Current Liabilities',
        description: 'Mortgage on Belvedere property',
        isActive: true
    },

    // EQUITY (3000 Series)
    {
        code: '3000',
        name: 'Owner\'s Capital',
        type: 'equity',
        category: 'Equity',
        description: 'Owner\'s initial investment and capital contributions',
        isActive: true
    },
    {
        code: '3100',
        name: 'Retained Earnings',
        type: 'equity',
        category: 'Equity',
        description: 'Accumulated profits retained in the business',
        isActive: true
    },
    {
        code: '3200',
        name: 'Current Year Earnings',
        type: 'equity',
        category: 'Equity',
        description: 'Current year profit or loss',
        isActive: true
    },

    // INCOME (4000 Series)
    {
        code: '4000',
        name: 'Rental Income - Long-Term Leases',
        type: 'income',
        category: 'Operating Revenue',
        description: 'Income from long-term rental leases',
        isActive: true
    },
    {
        code: '4001',
        name: 'Rental Income - St Kilda',
        type: 'income',
        category: 'Operating Revenue',
        description: 'Long-term rental income from St Kilda property',
        isActive: true
    },
    {
        code: '4002',
        name: 'Rental Income - Belvedere',
        type: 'income',
        category: 'Operating Revenue',
        description: 'Long-term rental income from Belvedere property',
        isActive: true
    },
    {
        code: '4003',
        name: 'Rental Income - Nyanga',
        type: 'income',
        category: 'Operating Revenue',
        description: 'Long-term rental income from Nyanga property',
        isActive: true
    },
    {
        code: '4100',
        name: 'Rental Income - Short-Term Stays',
        type: 'income',
        category: 'Operating Revenue',
        description: 'Income from short-term accommodation stays',
        isActive: true
    },
    {
        code: '4101',
        name: 'Short-Term - St Kilda',
        type: 'income',
        category: 'Operating Revenue',
        description: 'Short-term rental income from St Kilda property',
        isActive: true
    },
    {
        code: '4102',
        name: 'Short-Term - Belvedere',
        type: 'income',
        category: 'Operating Revenue',
        description: 'Short-term rental income from Belvedere property',
        isActive: true
    },
    {
        code: '4103',
        name: 'Short-Term - Nyanga',
        type: 'income',
        category: 'Operating Revenue',
        description: 'Short-term rental income from Nyanga property',
        isActive: true
    },
    {
        code: '4200',
        name: 'Other Property Income',
        type: 'income',
        category: 'Operating Revenue',
        description: 'Other income from property operations',
        isActive: true
    },
    {
        code: '4201',
        name: 'Parking Fees',
        type: 'income',
        category: 'Operating Revenue',
        description: 'Income from parking fees',
        isActive: true
    },
    {
        code: '4202',
        name: 'Late Payment Fees',
        type: 'income',
        category: 'Operating Revenue',
        description: 'Fees charged for late rent payments',
        isActive: true
    },
    {
        code: '4203',
        name: 'Laundry Income',
        type: 'income',
        category: 'Operating Revenue',
        description: 'Income from laundry services',
        isActive: true
    },
    {
        code: '4204',
        name: 'Penalty Charges',
        type: 'income',
        category: 'Operating Revenue',
        description: 'Penalty charges for rule violations',
        isActive: true
    },

    // EXPENSES (5000 Series)
    {
        code: '5000',
        name: 'Utilities - Electricity',
        type: 'expense',
        category: 'Operating Expenses',
        description: 'Electricity expenses',
        isActive: true
    },
    {
        code: '5001',
        name: 'Utilities - Water',
        type: 'expense',
        category: 'Operating Expenses',
        description: 'Water expenses',
        isActive: true
    },
    {
        code: '5002',
        name: 'Internet & Wi-Fi',
        type: 'expense',
        category: 'Operating Expenses',
        description: 'Internet and Wi-Fi expenses',
        isActive: true
    },
    {
        code: '5003',
        name: 'Utilities - Gas',
        type: 'expense',
        category: 'Operating Expenses',
        description: 'Gas expenses',
        isActive: true
    },
    {
        code: '5100',
        name: 'Repairs & Maintenance',
        type: 'expense',
        category: 'Operating Expenses',
        description: 'General repairs and maintenance expenses',
        isActive: true
    },
    {
        code: '5101',
        name: 'Maintenance - St Kilda',
        type: 'expense',
        category: 'Operating Expenses',
        description: 'Maintenance expenses for St Kilda property',
        isActive: true
    },
    {
        code: '5102',
        name: 'Maintenance - Belvedere',
        type: 'expense',
        category: 'Operating Expenses',
        description: 'Maintenance expenses for Belvedere property',
        isActive: true
    },
    {
        code: '5103',
        name: 'Maintenance - Nyanga',
        type: 'expense',
        category: 'Operating Expenses',
        description: 'Maintenance expenses for Nyanga property',
        isActive: true
    },
    {
        code: '5200',
        name: 'Cleaning & Security',
        type: 'expense',
        category: 'Operating Expenses',
        description: 'Cleaning and security service expenses',
        isActive: true
    },
    {
        code: '5201',
        name: 'Cleaning - St Kilda',
        type: 'expense',
        category: 'Operating Expenses',
        description: 'Cleaning expenses for St Kilda property',
        isActive: true
    },
    {
        code: '5202',
        name: 'Cleaning - Belvedere',
        type: 'expense',
        category: 'Operating Expenses',
        description: 'Cleaning expenses for Belvedere property',
        isActive: true
    },
    {
        code: '5203',
        name: 'Cleaning - Nyanga',
        type: 'expense',
        category: 'Operating Expenses',
        description: 'Cleaning expenses for Nyanga property',
        isActive: true
    },
    {
        code: '5300',
        name: 'Salaries & Wages',
        type: 'expense',
        category: 'Operating Expenses',
        description: 'Employee salaries and wages',
        isActive: true
    },
    {
        code: '5301',
        name: 'Admin Staff',
        type: 'expense',
        category: 'Operating Expenses',
        description: 'Administrative staff salaries',
        isActive: true
    },
    {
        code: '5302',
        name: 'Maintenance Staff',
        type: 'expense',
        category: 'Operating Expenses',
        description: 'Maintenance staff salaries',
        isActive: true
    },
    {
        code: '5303',
        name: 'Security Staff',
        type: 'expense',
        category: 'Operating Expenses',
        description: 'Security staff salaries',
        isActive: true
    },
    {
        code: '5400',
        name: 'Marketing & Advertising',
        type: 'expense',
        category: 'Operating Expenses',
        description: 'Marketing and advertising expenses',
        isActive: true
    },
    {
        code: '5500',
        name: 'Admin Expenses',
        type: 'expense',
        category: 'Operating Expenses',
        description: 'General administrative expenses',
        isActive: true
    },
    {
        code: '5501',
        name: 'Stationery & Printing',
        type: 'expense',
        category: 'Operating Expenses',
        description: 'Office stationery and printing expenses',
        isActive: true
    },
    {
        code: '5502',
        name: 'Postage & Courier',
        type: 'expense',
        category: 'Operating Expenses',
        description: 'Postage and courier expenses',
        isActive: true
    },
    {
        code: '5503',
        name: 'Bank Charges',
        type: 'expense',
        category: 'Operating Expenses',
        description: 'Bank fees and charges',
        isActive: true
    },
    {
        code: '5600',
        name: 'Loan Interest',
        type: 'expense',
        category: 'Operating Expenses',
        description: 'Interest on loans and mortgages',
        isActive: true
    },
    {
        code: '5700',
        name: 'Depreciation',
        type: 'expense',
        category: 'Operating Expenses',
        description: 'Depreciation on fixed assets',
        isActive: true
    },
    {
        code: '5701',
        name: 'Depreciation - Buildings',
        type: 'expense',
        category: 'Operating Expenses',
        description: 'Depreciation on buildings',
        isActive: true
    },
    {
        code: '5702',
        name: 'Depreciation - Furniture',
        type: 'expense',
        category: 'Operating Expenses',
        description: 'Depreciation on furniture and fixtures',
        isActive: true
    },
    {
        code: '5703',
        name: 'Depreciation - Equipment',
        type: 'expense',
        category: 'Operating Expenses',
        description: 'Depreciation on office equipment',
        isActive: true
    }
];

async function connectToDatabase() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB successfully!');
        console.log('Database:', mongoose.connection.name);
        console.log('');
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error.message);
        throw error;
    }
}

async function setupEnhancedChartOfAccounts() {
    try {
        console.log('🏗️ Setting up Enhanced Chart of Accounts...');
        console.log('=============================================\n');
        
        // Check existing accounts
        const existingAccounts = await Account.countDocuments();
        console.log(`📊 Found ${existingAccounts} existing accounts`);
        
        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        
        for (const accountData of enhancedChartOfAccounts) {
            try {
                // Check if account already exists
                const existingAccount = await Account.findOne({ code: accountData.code });
                
                if (existingAccount) {
                    // Update existing account
                    await Account.updateOne(
                        { code: accountData.code },
                        { 
                            $set: {
                                name: accountData.name,
                                type: accountData.type,
                                category: accountData.category,
                                description: accountData.description,
                                isActive: accountData.isActive
                            }
                        }
                    );
                    updatedCount++;
                    console.log(`🔄 Updated: ${accountData.code} - ${accountData.name}`);
                } else {
                    // Create new account
                    const newAccount = new Account(accountData);
                    await newAccount.save();
                    createdCount++;
                    console.log(`✅ Created: ${accountData.code} - ${accountData.name}`);
                }
            } catch (error) {
                console.error(`❌ Error processing account ${accountData.code}:`, error.message);
                skippedCount++;
            }
        }
        
        console.log('\n📋 Summary:');
        console.log(`   ✅ Created: ${createdCount} new accounts`);
        console.log(`   🔄 Updated: ${updatedCount} existing accounts`);
        console.log(`   ⏭️  Skipped: ${skippedCount} accounts`);
        console.log(`   📊 Total: ${createdCount + updatedCount} accounts processed`);
        
        // Verify setup
        const totalAccounts = await Account.countDocuments();
        console.log(`\n🎯 Total accounts in database: ${totalAccounts}`);
        
        // Show account categories
        const categories = await Account.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);
        
        console.log('\n📂 Account Categories:');
        categories.forEach(cat => {
            console.log(`   ${cat._id}: ${cat.count} accounts`);
        });
        
        console.log('\n🎉 Enhanced Chart of Accounts setup completed!');
        console.log('Your property management accounting system is ready for the next phase.');
        
    } catch (error) {
        console.error('❌ Error setting up chart of accounts:', error);
    }
}

async function cleanup() {
    try {
        await mongoose.connection.close();
        console.log('✅ Database connection closed');
    } catch (error) {
        console.error('❌ Error closing database connection:', error);
    }
}

async function main() {
    try {
        await connectToDatabase();
        await setupEnhancedChartOfAccounts();
    } catch (error) {
        console.error('❌ Setup failed:', error);
    } finally {
        await cleanup();
        process.exit(0);
    }
}

if (require.main === module) {
    main();
}

module.exports = { setupEnhancedChartOfAccounts };
