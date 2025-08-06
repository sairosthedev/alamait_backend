console.log('🔍 TESTING PETTY CASH CONTROLLER');
console.log('==================================\n');

try {
    const pettyCashController = require('./src/controllers/finance/pettyCashController');
    
    console.log('📋 Checking controller functions:');
    console.log('================================');
    
    const functions = [
        'initializePettyCash',
        'replenishPettyCash', 
        'recordExpense',
        'getPettyCashStatus',
        'getPettyCashReport'
    ];
    
    functions.forEach(funcName => {
        if (typeof pettyCashController[funcName] === 'function') {
            console.log(`✅ ${funcName}: Function exists`);
        } else {
            console.log(`❌ ${funcName}: ${typeof pettyCashController[funcName]}`);
        }
    });
    
    console.log('\n📋 Controller object keys:');
    console.log('==========================');
    console.log(Object.keys(pettyCashController));
    
} catch (error) {
    console.error('❌ Error loading petty cash controller:', error.message);
    console.error('Stack trace:', error.stack);
}

console.log('\n✅ Petty cash controller test completed'); 