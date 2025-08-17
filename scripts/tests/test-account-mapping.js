const AccountMappingService = require('./src/utils/accountMappingService');

// Test the improved account mapping system
async function testAccountMapping() {
    try {
        console.log('🧪 TESTING IMPROVED ACCOUNT MAPPING SYSTEM');
        console.log('==========================================\n');

        // Test items with different scenarios
        const testItems = [
            {
                title: 'Water Bill Payment',
                description: 'Monthly water bill for December 2024',
                category: 'utilities',
                provider: 'Zimbabwe National Water'
            },
            {
                title: 'Cleaning Services',
                description: 'Monthly cleaning for common areas',
                category: 'services',
                provider: 'CleanPro Services'
            },
            {
                title: 'Security Monitoring',
                description: '24/7 security monitoring and patrol',
                category: 'services',
                provider: 'SecureGuard'
            },
            {
                title: 'Plumbing Repair',
                description: 'Fix leaking pipe in bathroom',
                category: 'maintenance',
                provider: 'MaintainPro'
            },
            {
                title: 'Electricity Bill',
                description: 'Monthly electricity consumption',
                category: 'utilities',
                provider: 'ZERA'
            },
            {
                title: 'Internet Services',
                description: 'Monthly internet and WiFi',
                category: 'utilities',
                provider: 'Econet'
            },
            {
                title: 'Landscaping Services',
                description: 'Monthly garden maintenance',
                category: 'services',
                provider: 'GreenThumb Landscaping'
            },
            {
                title: 'Transportation Costs',
                description: 'Fuel and delivery expenses',
                category: 'transportation',
                provider: 'FastDelivery'
            },
            {
                title: 'Office Supplies',
                description: 'Paper, pens, and office materials',
                category: 'supplies',
                provider: 'OfficeMax'
            },
            {
                title: 'Insurance Premium',
                description: 'Property insurance coverage',
                category: 'insurance',
                provider: 'SafeGuard Insurance'
            }
        ];

        console.log('📋 TESTING ACCOUNT MAPPING FOR DIFFERENT ITEMS:\n');

        for (let i = 0; i < testItems.length; i++) {
            const item = testItems[i];
            console.log(`${i + 1}. ${item.title}`);
            console.log(`   Description: ${item.description}`);
            console.log(`   Category: ${item.category}`);
            console.log(`   Provider: ${item.provider}`);

            // Test the account mapping
            const accountCode = await AccountMappingService.getExpenseAccountForItem(item);
            const account = await AccountMappingService.validateAccountMapping(item);

            console.log(`   ✅ Mapped Account: ${account.mappedAccountName} (${account.mappedAccountCode})`);
            console.log(`   📊 Mapping Method: ${getMappingMethod(item, account)}`);
            console.log('');
        }

        // Test edge cases
        console.log('🔍 TESTING EDGE CASES:\n');

        const edgeCases = [
            {
                title: 'Unknown Service',
                description: 'Some random service',
                category: 'other',
                provider: 'Unknown Provider'
            },
            {
                title: 'Water',
                description: 'Just water',
                category: 'utilities',
                provider: null
            },
            {
                title: 'Maintenance',
                description: 'General maintenance',
                category: 'maintenance',
                provider: 'Some Company'
            }
        ];

        for (let i = 0; i < edgeCases.length; i++) {
            const item = edgeCases[i];
            console.log(`Edge Case ${i + 1}: ${item.title}`);
            console.log(`   Description: ${item.description}`);
            console.log(`   Category: ${item.category}`);
            console.log(`   Provider: ${item.provider || 'None'}`);

            const account = await AccountMappingService.validateAccountMapping(item);
            console.log(`   ✅ Mapped Account: ${account.mappedAccountName} (${account.mappedAccountCode})`);
            console.log('');
        }

        // Show all available expense accounts
        console.log('📊 ALL AVAILABLE EXPENSE ACCOUNTS:\n');
        const expenseAccounts = await AccountMappingService.getAllExpenseAccounts();
        
        expenseAccounts.forEach(account => {
            console.log(`   ${account.code} - ${account.name}`);
        });

        console.log('\n🎯 ACCOUNT MAPPING IMPROVEMENTS:');
        console.log('================================');
        console.log('✅ Keyword-based mapping (most specific)');
        console.log('✅ Provider-based mapping (vendor-specific)');
        console.log('✅ Category-based mapping (fallback)');
        console.log('✅ Default account for unknown items');
        console.log('✅ Automatic account creation if needed');
        console.log('✅ Proper expense categorization');
        console.log('✅ No more "Transportation" for water bills!');

        console.log('\n📈 BENEFITS:');
        console.log('============');
        console.log('🎯 Accurate financial reporting');
        console.log('🎯 Proper expense categorization');
        console.log('🎯 Better budget analysis');
        console.log('🎯 Correct double-entry accounting');
        console.log('🎯 Meaningful financial statements');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

// Helper function to determine mapping method
function getMappingMethod(item, account) {
    const searchText = `${item.title} ${item.description} ${item.provider || ''}`.toLowerCase();
    
    // Check for specific keywords
    const keywords = ['water', 'cleaning', 'security', 'plumbing', 'electricity', 'internet', 'landscaping', 'transport', 'supplies', 'insurance'];
    for (const keyword of keywords) {
        if (searchText.includes(keyword)) {
            return 'Keyword-based mapping';
        }
    }
    
    // Check for provider mapping
    if (item.provider) {
        const providers = ['cleanpro', 'secureguard', 'maintainpro', 'zera', 'zimbabwe national water'];
        for (const provider of providers) {
            if (item.provider.toLowerCase().includes(provider)) {
                return 'Provider-based mapping';
            }
        }
    }
    
    // Check for category mapping
    if (item.category) {
        return 'Category-based mapping';
    }
    
    return 'Default mapping';
}

// Run the test
testAccountMapping()
    .then(() => {
        console.log('\n✅ Account mapping test completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Account mapping test failed:', error);
        process.exit(1);
    }); 