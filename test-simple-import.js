/**
 * Simple Import Test
 */

console.log('🔍 Testing service import...');

try {
    const service = require('./src/services/doubleEntryAccountingService');
    console.log('✅ Service imported successfully');
    console.log('Service type:', typeof service);
    console.log('Service keys:', Object.keys(service));
    
    if (service.recordStudentRentPaymentWithAdvanceHandling) {
        console.log('✅ New method exists');
    } else {
        console.log('❌ New method NOT found');
    }
    
} catch (error) {
    console.error('❌ Import failed:', error.message);
}
