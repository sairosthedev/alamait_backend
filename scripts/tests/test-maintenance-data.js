require('dotenv').config();
const mongoose = require('mongoose');
const Maintenance = require('./src/models/Maintenance');

// Test maintenance data in the actual database
async function testMaintenanceData() {
    try {
        console.log('=== TESTING MAINTENANCE DATA ===');
        
        // Connect using the same URI as your backend
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ Connected to MongoDB');
        console.log('Database name:', conn.connection.name);

        // Check all maintenance requests
        console.log('\nChecking all maintenance requests...');
        const allMaintenance = await Maintenance.find({}).select('_id issue description financeStatus amount paymentMethod');
        console.log(`Found ${allMaintenance.length} maintenance requests:`);
        
        allMaintenance.forEach(maintenance => {
            console.log(`  - ${maintenance.issue}: ${maintenance.description} (Status: ${maintenance.financeStatus}, Amount: $${maintenance.amount || 0})`);
        });

        // Check maintenance requests with financeStatus=approved
        console.log('\nChecking maintenance requests with financeStatus=approved...');
        const approvedMaintenance = await Maintenance.find({ financeStatus: 'approved' });
        console.log(`Found ${approvedMaintenance.length} approved maintenance requests`);

        // Check maintenance requests with financeStatus=pending
        console.log('\nChecking maintenance requests with financeStatus=pending...');
        const pendingMaintenance = await Maintenance.find({ financeStatus: 'pending' });
        console.log(`Found ${pendingMaintenance.length} pending maintenance requests`);

        // Check all unique finance statuses
        console.log('\nChecking all unique finance statuses...');
        const uniqueStatuses = await Maintenance.distinct('financeStatus');
        console.log('Unique finance statuses:', uniqueStatuses);

        console.log('\n=== SUMMARY ===');
        console.log('Total maintenance requests:', allMaintenance.length);
        console.log('Approved requests:', approvedMaintenance.length);
        console.log('Pending requests:', pendingMaintenance.length);
        
        if (allMaintenance.length === 0) {
            console.log('⚠️  No maintenance requests found - this explains the empty results');
        } else if (approvedMaintenance.length === 0) {
            console.log('⚠️  No approved maintenance requests found - this explains the empty results for financeStatus=approved');
        } else {
            console.log('✅ Maintenance data exists - the backend should work');
        }

    } catch (error) {
        console.error('Error testing maintenance data:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the test
testMaintenanceData(); 