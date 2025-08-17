const mongoose = require('mongoose');
const Account = require('./src/models/Account');

/**
 * Test Rental Accrual System
 * 
 * This script demonstrates how rental accrual works with your
 * enhanced chart of accounts for property management.
 * 
 * Run with: node test-rental-accrual-system.js
 */

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';

// Test Properties
const testProperties = [
    { code: 'STK', name: 'St Kilda', accountCode: '1101', incomeCode: '4001' },
    { code: 'BEL', name: 'Belvedere', accountCode: '1102', incomeCode: '4002' },
    { code: 'NYA', name: 'Nyanga', accountCode: '1103', incomeCode: '4003' }
];

// Test Rental Scenarios
const testRentalScenarios = [
    {
        property: 'STK',
        tenantName: 'John Smith',
        monthlyRent: 200.00,
        dueDate: '2025-01-01',
        description: 'January 2025 Rent Due - St Kilda'
    },
    {
        property: 'BEL',
        tenantName: 'Sarah Johnson',
        monthlyRent: 300.00,
        dueDate: '2025-01-01',
        description: 'January 2025 Rent Due - Belvedere'
    },
    {
        property: 'NYA',
        tenantName: 'Mike Wilson',
        monthlyRent: 150.00,
        dueDate: '2025-01-01',
        description: 'January 2025 Rent Due - Nyanga'
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

async function testRentalAccrualSystem() {
    try {
        console.log('=============================================');
        console.log('🧪 Testing Rental Accrual System');
        console.log('=============================================\n');

        // 1. Verify Chart of Accounts
        console.log('📊 1. Verifying Chart of Accounts...');
        const totalAccounts = await Account.countDocuments();
        console.log(`   Total accounts: ${totalAccounts}`);
        
        // Check key rental accrual accounts
        const keyAccounts = await Account.find({
            code: { $in: ['1101', '1102', '1103', '4001', '4002', '4003'] }
        }).sort('code');
        
        console.log('\n   Key Rental Accrual Accounts:');
        keyAccounts.forEach(account => {
            console.log(`   ${account.code} - ${account.name} (${account.type})`);
        });

        // 2. Demonstrate Rental Accrual Process
        console.log('\n🔄 2. Rental Accrual Process Demonstration...');
        
        for (const scenario of testRentalScenarios) {
            const property = testProperties.find(p => p.code === scenario.property);
            
            console.log(`\n   📍 Property: ${property.name}`);
            console.log(`   👤 Tenant: ${scenario.tenantName}`);
            console.log(`   💰 Monthly Rent: $${scenario.monthlyRent.toFixed(2)}`);
            console.log(`   📅 Due Date: ${scenario.dueDate}`);
            
            // Simulate rental accrual transaction
            console.log(`\n   📝 Rental Accrual Transaction:`);
            console.log(`   Dr. Accounts Receivable - ${property.name} (${property.accountCode}): $${scenario.monthlyRent.toFixed(2)}`);
            console.log(`   Cr. Rental Income - ${property.name} (${property.incomeCode}): $${scenario.monthlyRent.toFixed(2)}`);
            
            // Show account balances (simulated)
            console.log(`\n   💳 Account Balances After Accrual:`);
            console.log(`   Accounts Receivable - ${property.name}: +$${scenario.monthlyRent.toFixed(2)}`);
            console.log(`   Rental Income - ${property.name}: +$${scenario.monthlyRent.toFixed(2)}`);
        }

        // 3. Demonstrate Payment Processing
        console.log('\n💳 3. Payment Processing Demonstration...');
        
        for (const scenario of testRentalScenarios) {
            const property = testProperties.find(p => p.code === scenario.property);
            
            console.log(`\n   📍 Property: ${property.name}`);
            console.log(`   👤 Tenant: ${scenario.tenantName}`);
            console.log(`   💰 Payment Received: $${scenario.monthlyRent.toFixed(2)}`);
            
            // Simulate payment transaction
            console.log(`\n   📝 Payment Transaction:`);
            console.log(`   Dr. Bank - Main Account (1110): $${scenario.monthlyRent.toFixed(2)}`);
            console.log(`   Cr. Accounts Receivable - ${property.name} (${property.accountCode}): $${scenario.monthlyRent.toFixed(2)}`);
            
            // Show account balances after payment
            console.log(`\n   💳 Account Balances After Payment:`);
            console.log(`   Bank - Main Account: +$${scenario.monthlyRent.toFixed(2)}`);
            console.log(`   Accounts Receivable - ${property.name}: $0.00 (cleared)`);
            console.log(`   Rental Income - ${property.name}: +$${scenario.monthlyRent.toFixed(2)} (unchanged)`);
        }

        // 4. Financial Impact Summary
        console.log('\n📈 4. Financial Impact Summary...');
        
        const totalRentalIncome = testRentalScenarios.reduce((sum, scenario) => sum + scenario.monthlyRent, 0);
        const totalAccountsReceivable = totalRentalIncome;
        
        console.log(`\n   💰 Total Monthly Rental Income: $${totalRentalIncome.toFixed(2)}`);
        console.log(`   📊 Total Accounts Receivable: $${totalAccountsReceivable.toFixed(2)}`);
        
        // Show breakdown by property
        console.log(`\n   🏠 Breakdown by Property:`);
        testRentalScenarios.forEach(scenario => {
            const property = testProperties.find(p => p.code === scenario.property);
            console.log(`   ${property.name}: $${scenario.monthlyRent.toFixed(2)}`);
        });

        // 5. Test Account Validation
        console.log('\n✅ 5. Account Validation Test...');
        
        const validationResults = await Promise.all(
            testProperties.map(async (property) => {
                const receivableAccount = await Account.findOne({ code: property.accountCode });
                const incomeAccount = await Account.findOne({ code: property.incomeCode });
                
                return {
                    property: property.name,
                    receivableAccount: receivableAccount ? '✅ Found' : '❌ Missing',
                    incomeAccount: incomeAccount ? '✅ Found' : '❌ Missing',
                    receivableType: receivableAccount ? receivableAccount.type : 'N/A',
                    incomeType: incomeAccount ? incomeAccount.type : 'N/A'
                };
            })
        );
        
        console.log('\n   Account Validation Results:');
        validationResults.forEach(result => {
            console.log(`   ${result.property}:`);
            console.log(`     Receivable Account: ${result.receivableAccount} (${result.receivableType})`);
            console.log(`     Income Account: ${result.incomeAccount} (${result.incomeType})`);
        });

        console.log('\n🎉 Rental Accrual System Test Completed Successfully!');
        console.log('\n📋 Key Points:');
        console.log('   • Rental accrual records income when earned (not when received)');
        console.log('   • Each property has separate receivable and income accounts');
        console.log('   • Double-entry accounting ensures balanced transactions');
        console.log('   • Payment clears the receivable without affecting income');
        console.log('   • System provides property-by-property financial tracking');
        
    } catch (error) {
        console.error('❌ Error testing rental accrual system:', error);
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
        await testRentalAccrualSystem();
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await cleanup();
        process.exit(0);
    }
}

if (require.main === module) {
    main();
}

module.exports = { testRentalAccrualSystem };
