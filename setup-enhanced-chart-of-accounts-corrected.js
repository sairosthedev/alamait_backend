const mongoose = require('mongoose');
const Account = require('./src/models/Account');

/**
 * Enhanced Chart of Accounts Setup Script - CORRECTED VERSION
 * 
 * This script creates the complete chart of accounts structure
 * for your property management business, using the correct enum values
 * from your Account model.
 * 
 * Run with: node setup-enhanced-chart-of-accounts-corrected.js
 */

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';

// Enhanced Chart of Accounts Structure with CORRECT enum values
const enhancedChartOfAccounts = [
    // ASSETS (1000 Series)
    
    // Current Assets (1100-1199)
    {
        code: '1100',
        name: 'Accounts Receivable - Tenants',
        type: 'Asset',
        category: 'Current Assets',
        description: 'Money owed by tenants across all properties',
        isActive: true
    },
    {
        code: '1101',
        name: 'Accounts Receivable - St Kilda',
        type: 'Asset',
        category: 'Current Assets',
        description: 'Money owed by St Kilda tenants',
        isActive: true
    },
    {
        code: '1102',
        name: 'Accounts Receivable - Belvedere',
        type: 'Asset',
        category: 'Current Assets',
        description: 'Money owed by Belvedere tenants',
        isActive: true
    },
    {
        code: '1103',
        name: 'Accounts Receivable - Nyanga',
        type: 'Asset',
        category: 'Current Assets',
        description: 'Money owed by Nyanga tenants',
        isActive: true
    },
    {
        code: '1110',
        name: 'Bank - Main Account',
        type: 'Asset',
        category: 'Current Assets',
        description: 'Primary business bank account',
        isActive: true
    },
    {
        code: '1111',
        name: 'Bank - Secondary Account',
        type: 'Asset',
        category: 'Current Assets',
        description: 'Secondary business bank account',
        isActive: true
    },
    {
        code: '1120',
        name: 'Petty Cash - Admin',
        type: 'Asset',
        category: 'Current Assets',
        description: 'Administrative petty cash fund',
        isActive: true
    },
    {
        code: '1121',
        name: 'Petty Cash - Finance',
        type: 'Asset',
        category: 'Current Assets',
        description: 'Finance petty cash fund',
        isActive: true
    },
    {
        code: '1130',
        name: 'Prepaid Expenses',
        type: 'Asset',
        category: 'Current Assets',
        description: 'Prepaid insurance, licenses, and other expenses',
        isActive: true
    },
    {
        code: '1131',
        name: 'Prepaid Insurance',
        type: 'Asset',
        category: 'Current Assets',
        description: 'Prepaid insurance premiums',
        isActive: true
    },
    {
        code: '1132',
        name: 'Prepaid Licenses',
        type: 'Asset',
        category: 'Current Assets',
        description: 'Prepaid business licenses and permits',
        isActive: true
    },

    // Fixed Assets (1200-1299)
    {
        code: '1200',
        name: 'Land & Buildings - St Kilda',
        type: 'Asset',
        category: 'Fixed Assets',
        description: 'Land and building assets for St Kilda property',
        isActive: true
    },
    {
        code: '1201',
        name: 'Land & Buildings - Belvedere',
        type: 'Asset',
        category: 'Fixed Assets',
        description: 'Land and building assets for Belvedere property',
        isActive: true
    },
    {
        code: '1202',
        name: 'Land & Buildings - Nyanga',
        type: 'Asset',
        category: 'Fixed Assets',
        description: 'Land and building assets for Nyanga property',
        isActive: true
    },
    {
        code: '1210',
        name: 'Furniture & Fixtures - St Kilda',
        type: 'Asset',
        category: 'Fixed Assets',
        description: 'Furniture and fixtures for St Kilda property',
        isActive: true
    },
    {
        code: '1211',
        name: 'Furniture & Fixtures - Belvedere',
        type: 'Asset',
        category: 'Fixed Assets',
        description: 'Furniture and fixtures for Belvedere property',
        isActive: true
    },
    {
        code: '1212',
        name: 'Furniture & Fixtures - Nyanga',
        type: 'Asset',
        category: 'Fixed Assets',
        description: 'Furniture and fixtures for Nyanga property',
        isActive: true
    },
    {
        code: '1220',
        name: 'Office Equipment & Tools',
        type: 'Asset',
        category: 'Fixed Assets',
        description: 'Office equipment, computers, and tools',
        isActive: true
    },
    {
        code: '1230',
        name: 'Vehicles',
        type: 'Asset',
        category: 'Fixed Assets',
        description: 'Company vehicles and transportation assets',
        isActive: true
    },
    {
        code: '1240',
        name: 'Accumulated Depreciation - Buildings',
        type: 'Asset',
        category: 'Fixed Assets',
        description: 'Accumulated depreciation for building assets',
        isActive: true
    },
    {
        code: '1241',
        name: 'Accumulated Depreciation - Furniture',
        type: 'Asset',
        category: 'Fixed Assets',
        description: 'Accumulated depreciation for furniture assets',
        isActive: true
    },
    {
        code: '1242',
        name: 'Accumulated Depreciation - Equipment',
        type: 'Asset',
        category: 'Fixed Assets',
        description: 'Accumulated depreciation for equipment assets',
        isActive: true
    },

    // LIABILITIES (2000 Series)
    
    // Current Liabilities (2100-2199)
    {
        code: '2100',
        name: 'Accounts Payable - Suppliers',
        type: 'Liability',
        category: 'Current Liabilities',
        description: 'Money owed to suppliers and vendors',
        isActive: true
    },
    {
        code: '2101',
        name: 'Accounts Payable - Utilities',
        type: 'Liability',
        category: 'Current Liabilities',
        description: 'Money owed to utility companies',
        isActive: true
    },
    {
        code: '2102',
        name: 'Accounts Payable - Maintenance',
        type: 'Liability',
        category: 'Current Liabilities',
        description: 'Money owed to maintenance contractors',
        isActive: true
    },
    {
        code: '2110',
        name: 'Accrued Expenses',
        type: 'Liability',
        category: 'Current Liabilities',
        description: 'Accrued expenses not yet paid',
        isActive: true
    },
    {
        code: '2111',
        name: 'Accrued Utilities',
        type: 'Liability',
        category: 'Current Liabilities',
        description: 'Accrued utility expenses',
        isActive: true
    },
    {
        code: '2112',
        name: 'Accrued Salaries',
        type: 'Liability',
        category: 'Current Liabilities',
        description: 'Accrued salary and wage expenses',
        isActive: true
    },
    {
        code: '2120',
        name: 'Short-Term Loans',
        type: 'Liability',
        category: 'Current Liabilities',
        description: 'Short-term loans and credit facilities',
        isActive: true
    },
    {
        code: '2130',
        name: 'Taxes Payable',
        type: 'Liability',
        category: 'Current Liabilities',
        description: 'Taxes owed to government authorities',
        isActive: true
    },

    // Long-term Liabilities (2200-2299)
    {
        code: '2200',
        name: 'Long-Term Loans',
        type: 'Liability',
        category: 'Long-term Liabilities',
        description: 'Long-term loans and financing',
        isActive: true
    },
    {
        code: '2201',
        name: 'Mortgage - St Kilda',
        type: 'Liability',
        category: 'Long-term Liabilities',
        description: 'Mortgage on St Kilda property',
        isActive: true
    },
    {
        code: '2202',
        name: 'Mortgage - Belvedere',
        type: 'Liability',
        category: 'Long-term Liabilities',
        description: 'Mortgage on Belvedere property',
        isActive: true
    },

    // EQUITY (3000 Series)
    {
        code: '3000',
        name: 'Owner\'s Capital',
        type: 'Equity',
        category: 'Owner Equity',
        description: 'Owner\'s capital investment in the business',
        isActive: true
    },
    {
        code: '3100',
        name: 'Retained Earnings',
        type: 'Equity',
        category: 'Retained Earnings',
        description: 'Accumulated profits retained in the business',
        isActive: true
    },
    {
        code: '3200',
        name: 'Current Year Earnings',
        type: 'Equity',
        category: 'Retained Earnings',
        description: 'Current year profit or loss',
        isActive: true
    },

    // INCOME (4000 Series)
    
    // Operating Revenue (4000-4099)
    {
        code: '4000',
        name: 'Rental Income - Long-Term Leases',
        type: 'Income',
        category: 'Operating Revenue',
        description: 'Income from long-term rental leases',
        isActive: true
    },
    {
        code: '4001',
        name: 'Rental Income - St Kilda',
        type: 'Income',
        category: 'Operating Revenue',
        description: 'Rental income from St Kilda property',
        isActive: true
    },
    {
        code: '4002',
        name: 'Rental Income - Belvedere',
        type: 'Income',
        category: 'Operating Revenue',
        description: 'Rental income from Belvedere property',
        isActive: true
    },
    {
        code: '4003',
        name: 'Rental Income - Nyanga',
        type: 'Income',
        category: 'Operating Revenue',
        description: 'Rental income from Nyanga property',
        isActive: true
    },
    {
        code: '4100',
        name: 'Rental Income - Short-Term Stays',
        type: 'Income',
        category: 'Operating Revenue',
        description: 'Income from short-term rental stays',
        isActive: true
    },
    {
        code: '4101',
        name: 'Short-Term - St Kilda',
        type: 'Income',
        category: 'Operating Revenue',
        description: 'Short-term rental income from St Kilda',
        isActive: true
    },
    {
        code: '4102',
        name: 'Short-Term - Belvedere',
        type: 'Income',
        category: 'Operating Revenue',
        description: 'Short-term rental income from Belvedere',
        isActive: true
    },
    {
        code: '4103',
        name: 'Short-Term - Nyanga',
        type: 'Income',
        category: 'Operating Revenue',
        description: 'Short-term rental income from Nyanga',
        isActive: true
    },

    // Other Income (4200-4299)
    {
        code: '4200',
        name: 'Other Property Income',
        type: 'Income',
        category: 'Other Income',
        description: 'Other income from property operations',
        isActive: true
    },
    {
        code: '4201',
        name: 'Parking Fees',
        type: 'Income',
        category: 'Other Income',
        description: 'Income from parking fees',
        isActive: true
    },
    {
        code: '4202',
        name: 'Late Payment Fees',
        type: 'Income',
        category: 'Other Income',
        description: 'Late payment penalty fees',
        isActive: true
    },
    {
        code: '4203',
        name: 'Laundry Income',
        type: 'Income',
        category: 'Other Income',
        description: 'Income from laundry services',
        isActive: true
    },
    {
        code: '4204',
        name: 'Penalty Charges',
        type: 'Income',
        category: 'Other Income',
        description: 'Other penalty charges and fees',
        isActive: true
    },

    // EXPENSES (5000 Series)
    
    // Operating Expenses (5000-5099)
    {
        code: '5000',
        name: 'Utilities - Electricity',
        type: 'Expense',
        category: 'Operating Expenses',
        description: 'Electricity utility expenses',
        isActive: true
    },
    {
        code: '5001',
        name: 'Utilities - Water',
        type: 'Expense',
        category: 'Operating Expenses',
        description: 'Water utility expenses',
        isActive: true
    },
    {
        code: '5002',
        name: 'Internet & Wi-Fi',
        type: 'Expense',
        category: 'Operating Expenses',
        description: 'Internet and Wi-Fi service expenses',
        isActive: true
    },
    {
        code: '5003',
        name: 'Utilities - Gas',
        type: 'Expense',
        category: 'Operating Expenses',
        description: 'Gas utility expenses',
        isActive: true
    },
    {
        code: '5100',
        name: 'Repairs & Maintenance',
        type: 'Expense',
        category: 'Operating Expenses',
        description: 'Property repairs and maintenance expenses',
        isActive: true
    },
    {
        code: '5101',
        name: 'Maintenance - St Kilda',
        type: 'Expense',
        category: 'Operating Expenses',
        description: 'Maintenance expenses for St Kilda property',
        isActive: true
    },
    {
        code: '5102',
        name: 'Maintenance - Belvedere',
        type: 'Expense',
        category: 'Operating Expenses',
        description: 'Maintenance expenses for Belvedere property',
        isActive: true
    },
    {
        code: '5103',
        name: 'Maintenance - Nyanga',
        type: 'Expense',
        category: 'Operating Expenses',
        description: 'Maintenance expenses for Nyanga property',
        isActive: true
    },
    {
        code: '5200',
        name: 'Cleaning & Security',
        type: 'Expense',
        category: 'Operating Expenses',
        description: 'Cleaning and security service expenses',
        isActive: true
    },
    {
        code: '5201',
        name: 'Cleaning - St Kilda',
        type: 'Expense',
        category: 'Operating Expenses',
        description: 'Cleaning expenses for St Kilda property',
        isActive: true
    },
    {
        code: '5202',
        name: 'Cleaning - Belvedere',
        type: 'Expense',
        category: 'Operating Expenses',
        description: 'Cleaning expenses for Belvedere property',
        isActive: true
    },
    {
        code: '5203',
        name: 'Cleaning - Nyanga',
        type: 'Expense',
        category: 'Operating Expenses',
        description: 'Cleaning expenses for Nyanga property',
        isActive: true
    },

    // Administrative Expenses (5300-5399)
    {
        code: '5300',
        name: 'Salaries & Wages',
        type: 'Expense',
        category: 'Administrative Expenses',
        description: 'Employee salaries and wages',
        isActive: true
    },
    {
        code: '5301',
        name: 'Admin Staff',
        type: 'Expense',
        category: 'Administrative Expenses',
        description: 'Administrative staff salaries',
        isActive: true
    },
    {
        code: '5302',
        name: 'Maintenance Staff',
        type: 'Expense',
        category: 'Administrative Expenses',
        description: 'Maintenance staff salaries',
        isActive: true
    },
    {
        code: '5303',
        name: 'Security Staff',
        type: 'Expense',
        category: 'Administrative Expenses',
        description: 'Security staff salaries',
        isActive: true
    },
    {
        code: '5400',
        name: 'Marketing & Advertising',
        type: 'Expense',
        category: 'Administrative Expenses',
        description: 'Marketing and advertising expenses',
        isActive: true
    },
    {
        code: '5500',
        name: 'Admin Expenses',
        type: 'Expense',
        category: 'Administrative Expenses',
        description: 'General administrative expenses',
        isActive: true
    },
    {
        code: '5501',
        name: 'Stationery & Printing',
        type: 'Expense',
        category: 'Administrative Expenses',
        description: 'Office stationery and printing costs',
        isActive: true
    },
    {
        code: '5502',
        name: 'Postage & Courier',
        type: 'Expense',
        category: 'Administrative Expenses',
        description: 'Postage and courier service costs',
        isActive: true
    },
    {
        code: '5503',
        name: 'Bank Charges',
        type: 'Expense',
        category: 'Administrative Expenses',
        description: 'Bank service charges and fees',
        isActive: true
    },

    // Financial Expenses (5600-5699)
    {
        code: '5600',
        name: 'Loan Interest',
        type: 'Expense',
        category: 'Financial Expenses',
        description: 'Interest on loans and financing',
        isActive: true
    },
    {
        code: '5700',
        name: 'Depreciation',
        type: 'Expense',
        category: 'Financial Expenses',
        description: 'Depreciation expense for fixed assets',
        isActive: true
    },
    {
        code: '5701',
        name: 'Depreciation - Buildings',
        type: 'Expense',
        category: 'Financial Expenses',
        description: 'Depreciation expense for buildings',
        isActive: true
    },
    {
        code: '5702',
        name: 'Depreciation - Furniture',
        type: 'Expense',
        category: 'Financial Expenses',
        description: 'Depreciation expense for furniture',
        isActive: true
    },
    {
        code: '5703',
        name: 'Depreciation - Equipment',
        type: 'Expense',
        category: 'Financial Expenses',
        description: 'Depreciation expense for equipment',
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
        console.log('=============================================');
        console.log('🏗️  Setting up Enhanced Chart of Accounts');
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
        
        // Show account types
        const types = await Account.aggregate([
            { $group: { _id: '$type', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);
        
        console.log('\n🏷️  Account Types:');
        types.forEach(type => {
            console.log(`   ${type._id}: ${type.count} accounts`);
        });
        
        console.log('\n🎉 Enhanced Chart of Accounts setup completed!');
        console.log('Your property management accounting system is ready for rental accrual!');
        
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
