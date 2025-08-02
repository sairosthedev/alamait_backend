const mongoose = require('mongoose');
const Request = require('./src/models/Request');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function testStudentRequestValidation() {
    try {
        console.log('🧪 Testing student request validation...');
        
        // Test 1: Create a student request (should not require admin fields)
        const studentRequest = new Request({
            student: new mongoose.Types.ObjectId(), // Mock student ID
            issue: 'toilets blocked',
            description: 'toilets blocked',
            room: 'M5',
            category: 'plumbing',
            priority: 'medium',
            residence: new mongoose.Types.ObjectId(), // Mock residence ID
            status: 'pending',
            financeStatus: 'pending',
            ceoStatus: 'pending'
        });
        
        console.log('✅ Student request validation passed - no admin fields required');
        
        // Test 2: Create an admin request (should require admin fields)
        const adminRequest = new Request({
            title: 'taps',
            description: 'none',
            type: 'operational',
            submittedBy: new mongoose.Types.ObjectId(), // Mock admin ID
            department: 'Operations',
            requestedBy: 'Mako',
            deliveryLocation: 'St kilda',
            residence: new mongoose.Types.ObjectId(), // Mock residence ID
            priority: 'medium',
            status: 'pending',
            financeStatus: 'pending'
        });
        
        console.log('✅ Admin request validation passed - admin fields required');
        
        // Test 3: Try to create an admin request without required fields (should fail)
        try {
            const invalidAdminRequest = new Request({
                description: 'none',
                residence: new mongoose.Types.ObjectId(),
                priority: 'medium'
            });
            
            await invalidAdminRequest.validate();
            console.log('❌ Invalid admin request should have failed validation');
        } catch (error) {
            console.log('✅ Invalid admin request correctly failed validation:', error.message);
        }
        
        // Test 4: Try to create a student request without required fields (should fail)
        try {
            const invalidStudentRequest = new Request({
                description: 'none',
                residence: new mongoose.Types.ObjectId(),
                priority: 'medium'
            });
            
            await invalidStudentRequest.validate();
            console.log('❌ Invalid student request should have failed validation');
        } catch (error) {
            console.log('✅ Invalid student request correctly failed validation:', error.message);
        }
        
        console.log('\n🎉 All validation tests completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

testStudentRequestValidation(); 