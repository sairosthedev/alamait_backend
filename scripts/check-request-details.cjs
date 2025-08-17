const mongoose = require('mongoose');
const MonthlyRequest = require('../src/models/MonthlyRequest');
require('../src/models/Residence');

// MongoDB connection
const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function checkRequestDetails() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const requestId = '68931a5339a684f33cfca331';
        
        console.log(`\n🔍 Checking details for request: ${requestId}`);
        
        const request = await MonthlyRequest.findById(requestId).populate('residence', 'name');
        
        if (!request) {
            console.log('❌ Request not found');
            return;
        }

        console.log('\n📋 Request Details:');
        console.log(`   ID: ${request._id}`);
        console.log(`   Title: ${request.title}`);
        console.log(`   Status: ${request.status}`);
        console.log(`   isTemplate: ${request.isTemplate}`);
        console.log(`   Month: ${request.month}`);
        console.log(`   Year: ${request.year}`);
        console.log(`   Residence: ${request.residence ? request.residence.name : 'N/A'}`);
        console.log(`   Items: ${request.items ? request.items.length : 0}`);
        console.log(`   Created At: ${request.createdAt}`);
        console.log(`   Updated At: ${request.updatedAt}`);

        if (request.items && request.items.length > 0) {
            console.log('\n📦 Request Items:');
            request.items.forEach((item, index) => {
                console.log(`   ${index + 1}. ${item.title} - $${item.estimatedCost} (${item.category})`);
            });
        }

        // Check if this is a template
        if (request.isTemplate) {
            console.log('\n⚠️  This is a TEMPLATE request');
            console.log('   Template requests need month and year parameters for approval');
        } else {
            console.log('\n✅ This is a REGULAR monthly request');
            console.log('   Regular requests should be approved directly');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the script
checkRequestDetails(); 