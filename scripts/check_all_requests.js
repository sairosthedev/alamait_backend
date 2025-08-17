const mongoose = require('mongoose');
const MonthlyRequest = require('../src/models/MonthlyRequest');

async function checkAllRequests() {
    try {
        await mongoose.connect('mongodb://localhost:27017/test');
        console.log('Connected to database');
        
        const requests = await MonthlyRequest.find({});
        console.log(`Found ${requests.length} monthly requests`);
        
        if (requests.length > 0) {
            const firstRequest = requests[0];
            const requestObj = firstRequest.toObject();
            console.log('\nFirst request fields:', Object.keys(requestObj));
            console.log('First request ID:', firstRequest._id);
            console.log('Status:', firstRequest.status);
            console.log('ApprovedBy:', firstRequest.approvedBy);
            console.log('ApprovedAt:', firstRequest.approvedAt);
            console.log('ApprovedByEmail:', firstRequest.approvedByEmail);
            
            console.log('\nAll request IDs:');
            requests.forEach((req, index) => {
                console.log(`${index + 1}. ${req._id} - ${req.title} - Status: ${req.status}`);
            });
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

checkAllRequests(); 