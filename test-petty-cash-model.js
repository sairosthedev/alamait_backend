console.log('🔍 TESTING PETTY CASH MODEL');
console.log('============================\n');

try {
    console.log('📋 Testing PettyCash model import...');
    const PettyCash = require('./src/models/finance/PettyCash');
    console.log('✅ PettyCash model imported successfully');
    console.log('Model name:', PettyCash.modelName);
    console.log('Collection name:', PettyCash.collection.name);
    
} catch (error) {
    console.error('❌ Error importing PettyCash model:', error.message);
    console.error('Stack trace:', error.stack);
}

console.log('\n✅ Petty cash model test completed'); 