const mongoose = require('mongoose');
const Request = require('./src/models/Request');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function checkRequestStructure() {
    try {
        console.log('Checking request structure...');
        
        // Find a few requests to examine their structure
        const requests = await Request.find().limit(5);
        
        console.log(`Found ${requests.length} requests to examine`);
        
        requests.forEach((request, index) => {
            console.log(`\n--- Request ${index + 1}: ${request.title} ---`);
            console.log('Request ID:', request._id);
            console.log('Type:', request.type);
            console.log('Total Estimated Cost:', request.totalEstimatedCost);
            console.log('Amount:', request.amount);
            
            if (request.items && request.items.length > 0) {
                console.log('\nItems:');
                request.items.forEach((item, itemIndex) => {
                    console.log(`  Item ${itemIndex + 1}:`);
                    console.log(`    Description: ${item.description}`);
                    console.log(`    Quantity: ${item.quantity}`);
                    console.log(`    Unit Cost: ${item.unitCost}`);
                    console.log(`    Total Cost: ${item.totalCost}`);
                    console.log(`    Estimated Cost: ${item.estimatedCost}`);
                    console.log(`    Purpose: ${item.purpose}`);
                    console.log(`    Item fields:`, Object.keys(item.toObject()));
                });
            } else {
                console.log('No items found');
            }
            
            console.log('\nAll request fields:', Object.keys(request.toObject()));
        });
        
    } catch (error) {
        console.error('Error checking request structure:', error);
    } finally {
        mongoose.connection.close();
    }
}

// Run the check
checkRequestStructure(); 