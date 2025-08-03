const mongoose = require('mongoose');
const MonthlyRequest = require('./src/models/MonthlyRequest');

async function checkRequestFields() {
    try {
        await mongoose.connect('mongodb://localhost:27017/test');
        console.log('Connected to database');
        
        const request = await MonthlyRequest.findById('688fe7ee54effffa6732c4f9');
        
        if (!request) {
            console.log('Request not found');
            return;
        }
        
        const requestObj = request.toObject();
        console.log('Current request fields:', Object.keys(requestObj));
        console.log('Status:', request.status);
        console.log('ApprovedBy:', request.approvedBy);
        console.log('ApprovedAt:', request.approvedAt);
        console.log('ApprovedByEmail:', request.approvedByEmail);
        
        console.log('\nFull request object:');
        console.log(JSON.stringify(requestObj, null, 2));
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

checkRequestFields(); 