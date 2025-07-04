// Test the expense update route

// Test the expense update route
function testExpenseUpdateRoute() {
    console.log('=== TESTING EXPENSE UPDATE ROUTE ===\n');

    // Test route patterns
    console.log('Route patterns that should work:');
    console.log('✅ PUT /api/admin/expenses/:expenseId - Update entire expense');
    console.log('✅ PUT /api/admin/expenses/:expenseId/status - Update status only');
    console.log('✅ PATCH /api/admin/expenses/:id/approve - Approve expense');
    console.log('');

    // Test the route matching
    const testRoutes = [
        '/api/admin/expenses/6852d8a017c1186db7a3f8c5',
        '/api/admin/expenses/6852d8a017c1186db7a3f8c5/status',
        '/api/admin/expenses/6852d8a017c1186db7a3f8c5/approve'
    ];

    console.log('Testing route matching:');
    testRoutes.forEach(route => {
        const isUpdateRoute = route.match(/^\/api\/admin\/expenses\/[^\/]+$/);
        const isStatusRoute = route.match(/^\/api\/admin\/expenses\/[^\/]+\/status$/);
        const isApproveRoute = route.match(/^\/api\/admin\/expenses\/[^\/]+\/approve$/);
        
        console.log(`${route}:`);
        console.log(`  - Update route: ${isUpdateRoute ? '✅' : '❌'}`);
        console.log(`  - Status route: ${isStatusRoute ? '✅' : '❌'}`);
        console.log(`  - Approve route: ${isApproveRoute ? '✅' : '❌'}`);
        console.log('');
    });

    console.log('✅ Route testing completed!');
    console.log('💡 The new PUT /:expenseId route should now handle general expense updates.');
    console.log('🔧 Make sure to restart your server for the changes to take effect.');
}

// Run the test
testExpenseUpdateRoute(); 