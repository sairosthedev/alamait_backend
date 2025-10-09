const mongoose = require('mongoose');
const Request = require('../models/Request');

// Connect to database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function debugRequestStructure() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to database');

        // Find the specific request that's causing issues
        const requestId = '68c9c62c1c050dbd96f6e572';
        const request = await Request.findById(requestId);
        
        if (request) {
            console.log('Request found:');
            console.log(JSON.stringify(request, null, 2));
        } else {
            console.log('Request not found');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

debugRequestStructure();










