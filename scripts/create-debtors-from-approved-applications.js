const mongoose = require('mongoose');
const { createDebtorsFromApprovedApplications } = require('../src/services/debtorService');

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';

async function connectToDatabase() {
    try {
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error);
        process.exit(1);
    }
}

async function disconnectFromDatabase() {
    try {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    } catch (error) {
        console.error('❌ Error disconnecting from MongoDB:', error);
    }
}

async function main() {
    try {
        console.log('🚀 Starting debtor creation from approved applications...');
        
        // Create debtors from approved applications
        const results = await createDebtorsFromApprovedApplications();
        
        console.log('\n📊 Final Results:');
        console.log(`Total applications processed: ${results.total}`);
        console.log(`Debtors created: ${results.created}`);
        console.log(`Failed: ${results.failed}`);
        
        if (results.errors.length > 0) {
            console.log('\n❌ Errors encountered:');
            results.errors.forEach((error, index) => {
                console.log(`${index + 1}. Application ${error.applicationId} (${error.studentEmail}): ${error.error}`);
            });
        }
        
        if (results.created > 0) {
            console.log('\n✅ Successfully created debtors from approved applications!');
        } else {
            console.log('\nℹ️  No new debtors were created (all approved applications already have debtors)');
        }
        
    } catch (error) {
        console.error('❌ Error in main function:', error);
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await disconnectFromDatabase();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await disconnectFromDatabase();
    process.exit(0);
});

// Run the script
if (require.main === module) {
    (async () => {
        await connectToDatabase();
        await main();
        await disconnectFromDatabase();
        console.log('🏁 Script completed');
    })();
}

module.exports = { main, connectToDatabase, disconnectFromDatabase };
