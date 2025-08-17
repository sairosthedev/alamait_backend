const PettyCashDisplay = require('./petty-cash-display.js');

// Test the display component with your API response
const apiResponse = {
    "success": true,
    "message": "Successfully retrieved petty cash balance for Makomborero Madziwa",
    "data": {
        "user": {
            "_id": "67c023adae5e27657502e887",
            "firstName": "Makomborero",
            "lastName": "Madziwa",
            "email": "admin@alamait.com",
            "role": "admin"
        },
        "pettyCashBalance": {
            "totalAllocated": 200,
            "totalExpenses": 0,
            "totalReplenished": 0,
            "currentBalance": 200,
            "formattedBalance": "$200.00"
        },
        "summary": {
            "totalTransactions": 200,
            "lastUpdated": "2025-08-07T16:09:52.627Z"
        }
    }
};

console.log('🎯 Testing Petty Cash Display Component');
console.log('=====================================\n');

// Create display instance
const pettyCashDisplay = new PettyCashDisplay(apiResponse);

// Test JSON format
console.log('📄 JSON Display Format:');
console.log('------------------------');
console.log(JSON.stringify(pettyCashDisplay.toJSON(), null, 2));
console.log('\n');

// Test text format
console.log('📝 Text Display Format:');
console.log('----------------------');
console.log(pettyCashDisplay.toText());
console.log('\n');

// Test HTML format
console.log('🎨 HTML Display Format:');
console.log('----------------------');
console.log(pettyCashDisplay.toHTML());
console.log('\n');

// Test with different balance scenarios
console.log('🧪 Testing Different Balance Scenarios:');
console.log('======================================');

const testScenarios = [
    { balance: 250, description: 'High Balance' },
    { balance: 75, description: 'Moderate Balance' },
    { balance: 25, description: 'Low Balance' },
    { balance: 0, description: 'Empty Balance' }
];

testScenarios.forEach(scenario => {
    const testResponse = {
        ...apiResponse,
        data: {
            ...apiResponse.data,
            pettyCashBalance: {
                ...apiResponse.data.pettyCashBalance,
                currentBalance: scenario.balance,
                formattedBalance: `$${scenario.balance.toFixed(2)}`
            }
        }
    };
    
    const testDisplay = new PettyCashDisplay(testResponse);
    const displayData = testDisplay.toDisplayFormat();
    
    console.log(`\n${scenario.description} ($${scenario.balance}):`);
    console.log(`  Status: ${displayData.display.status} (${displayData.display.statusColor})`);
    console.log(`  Formatted: ${displayData.display.formattedBalance}`);
});

console.log('\n✅ All tests completed!');
console.log('\n💡 To see the HTML display in action:');
console.log('   1. Open petty-cash-demo.html in your browser');
console.log('   2. Or use the React component in your frontend');
console.log('   3. Or copy the HTML output to a .html file and open it');

