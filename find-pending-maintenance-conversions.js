const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function findPendingMaintenanceConversions() {
    try {
        console.log('🔍 Finding maintenance requests that need expense conversion...');
        
        const Maintenance = require('./src/models/Maintenance');
        
        // Find all maintenance requests with financeStatus approved but not converted to expense
        const pendingConversions = await Maintenance.find({
            financeStatus: 'approved',
            $or: [
                { convertedToExpense: { $exists: false } },
                { convertedToExpense: false }
            ]
        }).populate('residence', 'name');
        
        console.log(`📊 Found ${pendingConversions.length} maintenance requests needing conversion:`);
        
        if (pendingConversions.length === 0) {
            console.log('✅ All approved maintenance requests are already converted to expenses');
            return;
        }
        
        pendingConversions.forEach((maintenance, index) => {
            console.log(`\n${index + 1}. Maintenance Request:`);
            console.log(`   - ID: ${maintenance._id}`);
            console.log(`   - Issue: ${maintenance.issue}`);
            console.log(`   - Description: ${maintenance.description}`);
            console.log(`   - Finance Status: ${maintenance.financeStatus}`);
            console.log(`   - Converted to Expense: ${maintenance.convertedToExpense || false}`);
            console.log(`   - Amount: $${maintenance.amount || 0}`);
            console.log(`   - Total Estimated Cost: $${maintenance.totalEstimatedCost || 0}`);
            console.log(`   - Residence: ${maintenance.residence?.name || 'Unknown'}`);
            console.log(`   - Request Date: ${maintenance.requestDate}`);
        });
        
        // Also check for any maintenance requests with the specific ID you mentioned
        const specificMaintenance = await Maintenance.findById('6894115a8fd1f872eed4a8d8');
        if (specificMaintenance) {
            console.log('\n🎯 Found the specific maintenance request you mentioned:');
            console.log(`   - ID: ${specificMaintenance._id}`);
            console.log(`   - Issue: ${specificMaintenance.issue}`);
            console.log(`   - Finance Status: ${specificMaintenance.financeStatus}`);
            console.log(`   - Converted to Expense: ${specificMaintenance.convertedToExpense || false}`);
            console.log(`   - Amount: $${specificMaintenance.amount || 0}`);
        } else {
            console.log('\n❌ The specific maintenance request (6894115a8fd1f872eed4a8d8) was not found');
        }
        
        // Show all maintenance requests for reference
        console.log('\n📋 All maintenance requests in database:');
        const allMaintenance = await Maintenance.find({}).select('_id issue financeStatus convertedToExpense amount').limit(10);
        allMaintenance.forEach((maintenance, index) => {
            console.log(`   ${index + 1}. ${maintenance._id} - ${maintenance.issue} (${maintenance.financeStatus}, converted: ${maintenance.convertedToExpense || false})`);
        });
        
    } catch (error) {
        console.error('❌ Error finding pending maintenance conversions:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the search
findPendingMaintenanceConversions();
