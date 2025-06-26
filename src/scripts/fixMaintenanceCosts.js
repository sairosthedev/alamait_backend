/**
 * Script to fix maintenance requests with null or undefined cost fields
 * 
 * This script updates any existing maintenance requests in the database
 * that have null or undefined estimatedCost or actualCost fields,
 * setting them to default values of 0.
 * 
 * This ensures that the frontend always receives valid numeric values
 * for the amount and laborCost fields, preventing "N/A" displays.
 */

const mongoose = require('mongoose');
const Maintenance = require('../models/Maintenance');
require('dotenv').config();

async function fixMaintenanceCosts() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to MongoDB');

        // Find all maintenance requests with null or undefined estimatedCost or actualCost
        const requestsToUpdate = await Maintenance.find({
            $or: [
                { estimatedCost: null },
                { estimatedCost: undefined },
                { actualCost: null },
                { actualCost: undefined }
            ]
        });

        console.log(`Found ${requestsToUpdate.length} maintenance requests with null/undefined cost fields`);

        if (requestsToUpdate.length === 0) {
            console.log('No maintenance requests need updating');
            return;
        }

        // Update all requests to have default values
        const updateResult = await Maintenance.updateMany(
            {
                $or: [
                    { estimatedCost: null },
                    { estimatedCost: undefined },
                    { actualCost: null },
                    { actualCost: undefined }
                ]
            },
            {
                $set: {
                    estimatedCost: 0,
                    actualCost: 0
                }
            }
        );

        console.log(`Updated ${updateResult.modifiedCount} maintenance requests`);
        console.log('Maintenance cost fields have been fixed successfully');

    } catch (error) {
        console.error('Error fixing maintenance costs:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the script
fixMaintenanceCosts(); 