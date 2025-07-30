const mongoose = require('mongoose');
const Request = require('./src/models/Request');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function checkSpecificRequest() {
    try {
        console.log('Checking specific request...');
        
        // Check the specific request ID from the user's data
        const requestId = '688a92089b9a81868c8a8be2';
        const request = await Request.findById(requestId);
        
        if (!request) {
            console.log('Request not found. Checking if it exists in a different collection...');
            
            // Try to find it in the maintenance collection
            const Maintenance = mongoose.model('Maintenance', mongoose.Schema({}), 'maintenance');
            const maintenanceRequest = await Maintenance.findById(requestId);
            
            if (maintenanceRequest) {
                console.log('Found request in maintenance collection:');
                console.log(JSON.stringify(maintenanceRequest.toObject(), null, 2));
            } else {
                console.log('Request not found in any collection');
            }
        } else {
            console.log('Found request:');
            console.log(JSON.stringify(request.toObject(), null, 2));
        }
        
    } catch (error) {
        console.error('Error checking specific request:', error);
    } finally {
        mongoose.connection.close();
    }
}

// Run the check
checkSpecificRequest(); 