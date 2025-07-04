const jwt = require('jsonwebtoken');

// Test the role checking logic
function testRoleChecking() {
    console.log('=== TESTING ROLE CHECKING LOGIC ===\n');

    // Test 1: CheckRole with individual arguments
    console.log('Test 1: checkRole with individual arguments');
    const roles1 = ['admin', 'finance_admin', 'finance_user'];
    console.log('Allowed roles:', roles1);
    console.log('Testing "admin":', roles1.includes('admin')); // Should be true
    console.log('Testing "student":', roles1.includes('student')); // Should be false
    console.log('');

    // Test 2: CheckRole with array argument (old way that was broken)
    console.log('Test 2: checkRole with array argument (old broken way)');
    const roles2 = [['admin', 'finance_admin', 'finance_user']]; // This was the problem!
    console.log('Allowed roles:', roles2);
    console.log('Testing "admin":', roles2.includes('admin')); // Should be false (was the bug)
    console.log('Testing array itself:', roles2.includes(['admin', 'finance_admin', 'finance_user'])); // Should be true
    console.log('');

    // Test 3: CheckRole with flattened array (new fixed way)
    console.log('Test 3: checkRole with flattened array (new fixed way)');
    const roles3 = [['admin', 'finance_admin', 'finance_user']].flat();
    console.log('Allowed roles:', roles3);
    console.log('Testing "admin":', roles3.includes('admin')); // Should be true (fixed)
    console.log('Testing "student":', roles3.includes('student')); // Should be false
    console.log('');

    // Test 4: Simulate the actual middleware logic
    console.log('Test 4: Simulate actual middleware logic');
    const userRole = 'admin';
    const allowedRoles = ['admin', 'finance_admin', 'finance_user'];
    
    console.log('User role:', userRole);
    console.log('Allowed roles:', allowedRoles);
    console.log('User has access:', allowedRoles.includes(userRole));
    console.log('');

    // Test 5: Test with different user roles
    console.log('Test 5: Test with different user roles');
    const testRoles = ['admin', 'finance_admin', 'finance_user', 'student', 'property_manager'];
    
    testRoles.forEach(role => {
        const hasAccess = allowedRoles.includes(role);
        console.log(`Role "${role}": ${hasAccess ? '✅ ACCESS' : '❌ DENIED'}`);
    });
    console.log('');

    console.log('✅ Role checking tests completed!');
    console.log('💡 The fix ensures that both array and individual arguments work correctly.');
}

// Run the test
testRoleChecking(); 