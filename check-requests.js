const { MongoClient } = require('mongodb');
require('dotenv').config();

async function checkRequests() {
    console.log('🔍 Checking Requests in Database');
    console.log('===============================');
    
    if (!process.env.MONGODB_URI) {
        console.log('❌ MONGODB_URI not found in environment variables');
        return;
    }
    
    try {
        console.log('🔌 Connecting to MongoDB...');
        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        console.log('✅ Connected to MongoDB');
        
        const db = client.db();
        const requestsCollection = db.collection('requests');
        
        // Count total requests
        const totalRequests = await requestsCollection.countDocuments();
        console.log(`\n📊 Total requests in database: ${totalRequests}`);
        
        // Find requests with different statuses
        const pendingRequests = await requestsCollection.countDocuments({ status: 'pending' });
        const approvedRequests = await requestsCollection.countDocuments({ status: 'approved' });
        const rejectedRequests = await requestsCollection.countDocuments({ status: 'rejected' });
        
        console.log(`\n📋 Request Status Summary:`);
        console.log(`  - Pending: ${pendingRequests}`);
        console.log(`  - Approved: ${approvedRequests}`);
        console.log(`  - Rejected: ${rejectedRequests}`);
        
        // Find requests with different finance statuses
        const pendingFinance = await requestsCollection.countDocuments({ financeStatus: 'pending' });
        const approvedFinance = await requestsCollection.countDocuments({ financeStatus: 'approved' });
        const rejectedFinance = await requestsCollection.countDocuments({ financeStatus: 'rejected' });
        
        console.log(`\n💰 Finance Status Summary:`);
        console.log(`  - Pending: ${pendingFinance}`);
        console.log(`  - Approved: ${approvedFinance}`);
        console.log(`  - Rejected: ${rejectedFinance}`);
        
        // Find requests that are approved by finance but not converted to expense
        const approvedNotConverted = await requestsCollection.find({
            financeStatus: 'approved',
            convertedToExpense: false
        }).toArray();
        
        console.log(`\n⚠️  Requests approved by finance but not converted to expense: ${approvedNotConverted.length}`);
        
        if (approvedNotConverted.length > 0) {
            console.log('\n📝 Details of approved but not converted requests:');
            approvedNotConverted.forEach((req, index) => {
                console.log(`  ${index + 1}. ID: ${req._id}`);
                console.log(`     Title: ${req.title}`);
                console.log(`     Status: ${req.status}`);
                console.log(`     Finance Status: ${req.financeStatus}`);
                console.log(`     Converted: ${req.convertedToExpense}`);
                console.log(`     Created: ${req.createdAt}`);
                console.log('');
            });
        }
        
        // Find the specific water request by title
        const waterRequests = await requestsCollection.find({
            title: 'water'
        }).toArray();
        
        console.log(`\n💧 Water requests found: ${waterRequests.length}`);
        waterRequests.forEach((req, index) => {
            console.log(`  ${index + 1}. ID: ${req._id}`);
            console.log(`     Title: ${req.title}`);
            console.log(`     Status: ${req.status}`);
            console.log(`     Finance Status: ${req.financeStatus}`);
            console.log(`     Converted: ${req.convertedToExpense}`);
            console.log(`     Created: ${req.createdAt}`);
            console.log('');
        });
        
        await client.close();
        console.log('\n✅ Check completed');
        
    } catch (error) {
        console.error('❌ Check failed:', error);
    }
}

checkRequests();
