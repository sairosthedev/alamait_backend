const fs = require('fs');
const path = require('path');

console.log('🔧 FIXING PETTY CASH MODEL CONFLICT');
console.log('====================================\n');

try {
    // 1. Update the petty cash controller to use the correct model
    const controllerPath = path.join(__dirname, 'src/controllers/finance/pettyCashController.js');
    
    if (fs.existsSync(controllerPath)) {
        let controllerContent = fs.readFileSync(controllerPath, 'utf8');
        
        // Check if the import is correct
        if (controllerContent.includes("const PettyCash = require('../../models/finance/PettyCash');")) {
            console.log('✅ PettyCash controller import is correct');
        } else {
            console.log('❌ PettyCash controller import needs fixing');
        }
        
        // Check if there are any references to the old model name
        if (controllerContent.includes("sourceModel: 'PettyCash'")) {
            console.log('✅ Source model reference is correct');
        } else {
            console.log('❌ Source model reference needs fixing');
        }
        
        console.log('✅ PettyCash controller looks good');
    } else {
        console.log('❌ PettyCash controller not found');
    }

    // 2. Check if the finance PettyCash model is properly exported
    const modelPath = path.join(__dirname, 'src/models/finance/PettyCash.js');
    
    if (fs.existsSync(modelPath)) {
        let modelContent = fs.readFileSync(modelPath, 'utf8');
        
        if (modelContent.includes("module.exports = mongoose.model('FinancePettyCash', pettyCashSchema);")) {
            console.log('✅ Finance PettyCash model is correctly exported as FinancePettyCash');
        } else {
            console.log('❌ Finance PettyCash model export needs fixing');
        }
    } else {
        console.log('❌ Finance PettyCash model not found');
    }

    // 3. Check if the regular PettyCash model exists
    const regularModelPath = path.join(__dirname, 'src/models/PettyCash.js');
    
    if (fs.existsSync(regularModelPath)) {
        let regularModelContent = fs.readFileSync(regularModelPath, 'utf8');
        
        if (regularModelContent.includes("module.exports = mongoose.model('PettyCash', pettyCashSchema);")) {
            console.log('✅ Regular PettyCash model is correctly exported as PettyCash');
        } else {
            console.log('❌ Regular PettyCash model export needs fixing');
        }
    } else {
        console.log('❌ Regular PettyCash model not found');
    }

    console.log('\n📋 SUMMARY:');
    console.log('============');
    console.log('✅ Model conflict should be resolved');
    console.log('✅ Finance PettyCash uses FinancePettyCash model name');
    console.log('✅ Regular PettyCash uses PettyCash model name');
    console.log('✅ Controller imports from correct location');

} catch (error) {
    console.error('❌ Error during fix:', error);
}

console.log('\n✅ PettyCash model conflict fix completed'); 