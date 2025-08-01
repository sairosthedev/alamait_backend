console.log('🧪 Simple Route Structure Check...\n');

// Check if the vendor routes file exists and can be loaded
try {
    const vendorRoutes = require('./src/routes/finance/vendorRoutes');
    console.log('✅ Vendor routes file loaded successfully');
    
    // Check if it's a router
    if (vendorRoutes && typeof vendorRoutes === 'function') {
        console.log('✅ Vendor routes is a valid Express router');
    } else {
        console.log('❌ Vendor routes is not a valid Express router');
    }
} catch (error) {
    console.error('❌ Error loading vendor routes:', error.message);
}

// Check if the finance index file can load the vendor routes
try {
    const financeIndex = require('./src/routes/finance/index');
    console.log('✅ Finance index file loaded successfully');
} catch (error) {
    console.error('❌ Error loading finance index:', error.message);
}

// Check if the main app can load the finance routes
try {
    const app = require('./src/app');
    console.log('✅ Main app file loaded successfully');
} catch (error) {
    console.error('❌ Error loading main app:', error.message);
}

console.log('\n📋 Expected Route Structure:');
console.log('  GET  /api/finance/vendors/search');
console.log('  GET  /api/finance/vendors/for-quotations');
console.log('  GET  /api/finance/vendors');
console.log('  GET  /api/finance/vendors/:id');
console.log('  POST /api/finance/vendors');
console.log('  PUT  /api/finance/vendors/:id');
console.log('  DELETE /api/finance/vendors/:id');

console.log('\n🔍 Next Steps:');
console.log('1. Deploy changes to production server');
console.log('2. Restart the server if needed');
console.log('3. Test the routes with authentication'); 