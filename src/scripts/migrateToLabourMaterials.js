/**
 * Migration script to update existing maintenance requests
 * from estimatedCost/actualCost to materials/labour
 * 
 * This script migrates existing data to use the new field names
 * that match the form expectations.
 */

const mongoose = require('mongoose');
const Maintenance = require('../models/Maintenance');
require('dotenv').config();

async function migrateToLabourMaterials() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to MongoDB');

        // Find all maintenance requests that still have the old field names
        const requestsToMigrate = await Maintenance.find({
            $or: [
                { estimatedCost: { $exists: true } },
                { actualCost: { $exists: true } }
            ]
        });

        console.log(`Found ${requestsToMigrate.length} maintenance requests to migrate`);

        if (requestsToMigrate.length === 0) {
            console.log('No maintenance requests need migration');
            return;
        }

        let migratedCount = 0;

        for (const request of requestsToMigrate) {
            const updateData = {};

            // Migrate estimatedCost to materials
            if (request.estimatedCost !== undefined) {
                updateData.materials = request.estimatedCost;
                updateData.$unset = { estimatedCost: 1 };
            }

            // Migrate actualCost to labour
            if (request.actualCost !== undefined) {
                updateData.labour = request.actualCost;
                if (!updateData.$unset) updateData.$unset = {};
                updateData.$unset.actualCost = 1;
            }

            if (Object.keys(updateData).length > 0) {
                await Maintenance.findByIdAndUpdate(request._id, updateData);
                migratedCount++;
                console.log(`Migrated request ${request._id}:`, {
                    oldEstimatedCost: request.estimatedCost,
                    oldActualCost: request.actualCost,
                    newMaterials: updateData.materials,
                    newLabour: updateData.labour
                });
            }
        }

        console.log(`Successfully migrated ${migratedCount} maintenance requests`);
        console.log('Migration completed successfully!');

    } catch (error) {
        console.error('Error during migration:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the migration
migrateToLabourMaterials(); 