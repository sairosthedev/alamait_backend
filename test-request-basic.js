const Request = require('./src/models/Request');

console.log('Testing Request System Components...\n');

// Test 1: Check if Request model is properly defined
console.log('1. Testing Request model structure...');
try {
    const requestSchema = Request.schema;
    console.log('✅ Request model loaded successfully');
    console.log(`   Schema fields: ${Object.keys(requestSchema.paths).length}`);
    
    // Check if required fields exist
    const requiredFields = ['title', 'description', 'type', 'submittedBy', 'status'];
    const missingFields = requiredFields.filter(field => !requestSchema.paths[field]);
    
    if (missingFields.length === 0) {
        console.log('✅ All required fields present');
    } else {
        console.log(`❌ Missing fields: ${missingFields.join(', ')}`);
    }
    
    // Check if approval structure exists
    if (requestSchema.paths['approval.admin'] && 
        requestSchema.paths['approval.finance'] && 
        requestSchema.paths['approval.ceo']) {
        console.log('✅ Approval structure present');
    } else {
        console.log('❌ Approval structure missing');
    }
    
    // Check if quotations array exists
    if (requestSchema.paths['quotations']) {
        console.log('✅ Quotations array present');
    } else {
        console.log('❌ Quotations array missing');
    }
    
} catch (error) {
    console.log('❌ Error loading Request model:', error.message);
}

// Test 2: Check if controller functions exist
console.log('\n2. Testing controller functions...');
try {
    const requestController = require('./src/controllers/requestController');
    const requiredFunctions = [
        'getAllRequests',
        'getRequestById', 
        'createRequest',
        'updateRequestStatus',
        'adminApproval',
        'financeApproval',
        'ceoApproval',
        'uploadQuotation',
        'approveQuotation',
        'addUpdate',
        'deleteRequest'
    ];
    
    const missingFunctions = requiredFunctions.filter(func => !requestController[func]);
    
    if (missingFunctions.length === 0) {
        console.log('✅ All controller functions present');
    } else {
        console.log(`❌ Missing functions: ${missingFunctions.join(', ')}`);
    }
    
} catch (error) {
    console.log('❌ Error loading controller:', error.message);
}

// Test 3: Check if routes are properly defined
console.log('\n3. Testing route definitions...');
try {
    const requestRoutes = require('./src/routes/requestRoutes');
    console.log('✅ Request routes loaded successfully');
    
    // Check if routes have middleware
    if (requestRoutes.stack && requestRoutes.stack.length > 0) {
        console.log(`   Number of routes: ${requestRoutes.stack.length}`);
    } else {
        console.log('   Routes structure needs verification');
    }
    
} catch (error) {
    console.log('❌ Error loading routes:', error.message);
}

// Test 4: Check if middleware is properly exported
console.log('\n4. Testing middleware exports...');
try {
    const { checkRole } = require('./src/middleware/roleMiddleware');
    if (typeof checkRole === 'function') {
        console.log('✅ Role middleware exported correctly');
    } else {
        console.log('❌ Role middleware not properly exported');
    }
} catch (error) {
    console.log('❌ Error loading middleware:', error.message);
}

// Test 5: Check if file storage utility exists
console.log('\n5. Testing file storage utility...');
try {
    const { uploadToS3 } = require('./src/utils/fileStorage');
    if (typeof uploadToS3 === 'function') {
        console.log('✅ File storage utility present');
    } else {
        console.log('❌ File storage utility missing');
    }
} catch (error) {
    console.log('❌ Error loading file storage:', error.message);
}

// Test 6: Check if ID generator exists
console.log('\n6. Testing ID generator...');
try {
    const { generateUniqueId } = require('./src/utils/idGenerator');
    if (typeof generateUniqueId === 'function') {
        console.log('✅ ID generator present');
    } else {
        console.log('❌ ID generator missing');
    }
} catch (error) {
    console.log('❌ Error loading ID generator:', error.message);
}

// Test 7: Check User model for CEO role
console.log('\n7. Testing User model for CEO role...');
try {
    const User = require('./src/models/User');
    const userSchema = User.schema;
    const roleField = userSchema.paths['role'];
    
    if (roleField && roleField.enumValues && roleField.enumValues.includes('ceo')) {
        console.log('✅ CEO role present in User model');
    } else {
        console.log('❌ CEO role missing from User model');
    }
} catch (error) {
    console.log('❌ Error checking User model:', error.message);
}

console.log('\n🎉 Basic component tests completed!');
console.log('\nNext steps:');
console.log('1. Ensure MongoDB is running');
console.log('2. Set up environment variables');
console.log('3. Run: node test-request-system.js');
console.log('4. Test API endpoints with Postman or similar tool');