const mongoose = require('mongoose');
const Request = require('../models/Request');

// Connect to database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function findRequestById() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to database');

        // Try different request IDs from the expense accrual transactions
        const requestIds = [
            '68c9c62c1c050dbd96f6e572',
            '68c9cf95d7f4afee7f0ca19d',
            '68c9d6b0069a6bffd9f4d367'
        ];

        for (const requestId of requestIds) {
            console.log(`\n🔍 Looking for request: ${requestId}`);
            
            try {
                const request = await Request.findById(requestId);
                if (request) {
                    console.log('✅ Request found:');
                    console.log(`   Title: ${request.title}`);
                    console.log(`   Month: ${request.month}`);
                    console.log(`   Year: ${request.year}`);
                    console.log(`   Date Requested: ${request.dateRequested}`);
                    console.log(`   Status: ${request.status}`);
                    console.log(`   Finance Status: ${request.financeStatus}`);
                    console.log(`   Items: ${request.items ? request.items.length : 0}`);
                    
                    if (request.items && request.items.length > 0) {
                        console.log('   First item:');
                        console.log(`     Title: ${request.items[0].title}`);
                        console.log(`     Description: ${request.items[0].description}`);
                        console.log(`     Estimated Cost: ${request.items[0].estimatedCost}`);
                    }
                } else {
                    console.log('❌ Request not found');
                }
            } catch (error) {
                console.log(`❌ Error finding request: ${error.message}`);
            }
        }

        // Also try to find any requests with "July" in the title
        console.log('\n🔍 Looking for requests with "July" in title...');
        const julyRequests = await Request.find({
            title: { $regex: 'July', $options: 'i' }
        }).limit(5);
        
        console.log(`Found ${julyRequests.length} requests with "July" in title:`);
        julyRequests.forEach((req, index) => {
            console.log(`${index + 1}. ${req._id} - ${req.title} - Month: ${req.month}, Year: ${req.year}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

findRequestById();


