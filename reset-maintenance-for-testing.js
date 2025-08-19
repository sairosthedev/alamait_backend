const mongoose = require('mongoose');
require('dotenv').config();

// Import all required models
require('./src/models/User');
require('./src/models/Maintenance');
require('./src/models/Residence');

console.log('🔄 Resetting Maintenance Request for Testing');
console.log('==========================================');

// Database connection
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:12345678@cluster0.qzq1z.mongodb.net/alamait?retryWrites=true&w=majority&appName=Cluster0');
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        process.exit(1);
    }
};

const resetMaintenanceForTesting = async () => {
    try {
        const Maintenance = require('./src/models/Maintenance');
        
        // Find a request that can be reset (approved but not in final state)
        const resettableRequest = await Maintenance.findOne({
            financeStatus: 'approved',
            status: { $in: ['pending', 'in-progress'] }
        }).populate('residence', 'name')
          .populate('requestedBy', 'firstName lastName email');
        
        if (!resettableRequest) {
            console.log('❌ No suitable requests found to reset for testing');
            console.log('All requests are either already in final states or not approved');
            return;
        }
        
        console.log(`📋 Found request to reset:`);
        console.log(`   Issue: ${resettableRequest.issue || 'undefined'}`);
        console.log(`   ID: ${resettableRequest._id}`);
        console.log(`   Current Status: ${resettableRequest.status}`);
        console.log(`   Current Finance Status: ${resettableRequest.financeStatus}`);
        console.log(`   Residence: ${resettableRequest.residence?.name || 'Unknown'}`);
        console.log(`   Requested By: ${resettableRequest.requestedBy?.firstName} ${resettableRequest.requestedBy?.lastName || 'Unknown'}`);
        console.log(`   Created: ${resettableRequest.createdAt?.toLocaleDateString()}`);
        
        // Reset the request to pending status
        const updatedRequest = await Maintenance.findByIdAndUpdate(
            resettableRequest._id,
            {
                $set: {
                    status: 'pending',
                    financeStatus: 'pending',
                    updatedBy: null
                },
                $push: {
                    updates: {
                        date: new Date(),
                        message: 'Reset to pending status for testing new approval workflow',
                        author: null
                    }
                }
            },
            { new: true, runValidators: true }
        ).populate('residence', 'name')
         .populate('requestedBy', 'firstName lastName email');
        
        console.log('\n✅ Request reset successfully!');
        console.log(`   New Status: ${updatedRequest.status}`);
        console.log(`   New Finance Status: ${updatedRequest.financeStatus}`);
        
        console.log('\n🧪 TESTING INSTRUCTIONS:');
        console.log('========================');
        console.log('1. Go to the Finance dashboard');
        console.log('2. Navigate to the "Student Maintenance" tab');
        console.log('3. You should now see an "Approve" button for this request:');
        console.log(`   - Issue: ${updatedRequest.issue || 'undefined'}`);
        console.log(`   - Status: ${updatedRequest.status}`);
        console.log(`   - Finance Status: ${updatedRequest.financeStatus}`);
        console.log('4. Click the "Approve" button');
        console.log('5. Verify that the status changes to "pending-ceo-approval"');
        console.log('6. Check that an expense and transaction are created');
        
        // Also reset a second request for comparison
        const secondRequest = await Maintenance.findOne({
            _id: { $ne: resettableRequest._id },
            financeStatus: 'approved',
            status: { $in: ['pending', 'in-progress'] }
        });
        
        if (secondRequest) {
            await Maintenance.findByIdAndUpdate(
                secondRequest._id,
                {
                    $set: {
                        status: 'pending',
                        financeStatus: 'pending'
                    },
                    $push: {
                        updates: {
                            date: new Date(),
                            message: 'Reset to pending status for testing new approval workflow',
                            author: null
                        }
                    }
                },
                { new: true, runValidators: true }
            );
            
            console.log('\n✅ Second request also reset for testing:');
            console.log(`   Issue: ${secondRequest.issue || 'undefined'}`);
            console.log(`   ID: ${secondRequest._id}`);
        }
        
        console.log('\n🎯 SUMMARY:');
        console.log('===========');
        console.log('Requests have been reset to pending status');
        console.log('You should now see approve buttons in the Finance dashboard');
        console.log('Test the approval workflow and verify the status changes');
        
    } catch (error) {
        console.error('❌ Error resetting maintenance request:', error);
    }
};

// Run the reset
connectDB().then(() => {
    resetMaintenanceForTesting().then(() => {
        console.log('\n✅ Reset completed!');
        process.exit(0);
    }).catch((error) => {
        console.error('❌ Reset failed:', error);
        process.exit(1);
    });
}); 