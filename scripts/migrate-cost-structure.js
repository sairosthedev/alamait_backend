const mongoose = require('mongoose');
const Request = require('../src/models/Request');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function migrateCostStructure() {
    try {
        console.log('Starting cost structure migration...');
        
        // Find all requests with items that have estimatedCost
        const requests = await Request.find({
            'items.estimatedCost': { $exists: true }
        });
        
        console.log(`Found ${requests.length} requests to migrate`);
        
        let migratedCount = 0;
        
        for (const request of requests) {
            let hasChanges = false;
            
            // Update each item in the request
            if (request.items && request.items.length > 0) {
                request.items.forEach(item => {
                    if (item.estimatedCost !== undefined) {
                        // Convert estimatedCost to unitCost
                        item.unitCost = item.estimatedCost;
                        item.totalCost = item.unitCost * item.quantity;
                        
                        // Remove the old estimatedCost field
                        delete item.estimatedCost;
                        hasChanges = true;
                        
                        console.log(`Updated item "${item.description}": unitCost=${item.unitCost}, quantity=${item.quantity}, totalCost=${item.totalCost}`);
                    }
                });
            }
            
            if (hasChanges) {
                // Save the updated request
                await request.save();
                migratedCount++;
                console.log(`Migrated request: ${request.title} (ID: ${request._id})`);
            }
        }
        
        console.log(`Migration completed! ${migratedCount} requests updated.`);
        
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        mongoose.connection.close();
    }
}

// Run the migration
migrateCostStructure(); 