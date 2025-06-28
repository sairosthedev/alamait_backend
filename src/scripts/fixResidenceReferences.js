const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Application = require('../models/Application');
const Payment = require('../models/Payment');
const Student = require('../models/Student');
const Event = require('../models/Event');
const Maintenance = require('../models/Maintenance');
const Message = require('../models/Message');
const Lease = require('../models/Lease');
const Residence = require('../models/Residence');
const User = require('../models/User');

async function connectToDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
}

async function fixResidenceReferences() {
    try {
        console.log('Starting residence reference fix...');

        // Get the first available residence as default
        const defaultResidence = await Residence.findOne();
        if (!defaultResidence) {
            console.error('No residences found in database. Please create at least one residence first.');
            return;
        }

        console.log(`Using default residence: ${defaultResidence.name} (${defaultResidence._id})`);

        // Fix Applications without residence
        const applicationsWithoutResidence = await Application.find({ residence: { $exists: false } });
        if (applicationsWithoutResidence.length > 0) {
            console.log(`Found ${applicationsWithoutResidence.length} applications without residence`);
            await Application.updateMany(
                { residence: { $exists: false } },
                { residence: defaultResidence._id }
            );
            console.log('Fixed applications without residence');
        }

        // Fix Payments without residence
        const paymentsWithoutResidence = await Payment.find({ residence: { $exists: false } });
        if (paymentsWithoutResidence.length > 0) {
            console.log(`Found ${paymentsWithoutResidence.length} payments without residence`);
            await Payment.updateMany(
                { residence: { $exists: false } },
                { residence: defaultResidence._id }
            );
            console.log('Fixed payments without residence');
        }

        // Fix Students without residence
        const studentsWithoutResidence = await Student.find({ residence: { $exists: false } });
        if (studentsWithoutResidence.length > 0) {
            console.log(`Found ${studentsWithoutResidence.length} students without residence`);
            await Student.updateMany(
                { residence: { $exists: false } },
                { residence: defaultResidence._id }
            );
            console.log('Fixed students without residence');
        }

        // Fix Events without residence
        const eventsWithoutResidence = await Event.find({ residence: { $exists: false } });
        if (eventsWithoutResidence.length > 0) {
            console.log(`Found ${eventsWithoutResidence.length} events without residence`);
            await Event.updateMany(
                { residence: { $exists: false } },
                { residence: defaultResidence._id }
            );
            console.log('Fixed events without residence');
        }

        // Fix Maintenance requests without residence
        const maintenanceWithoutResidence = await Maintenance.find({ residence: { $exists: false } });
        if (maintenanceWithoutResidence.length > 0) {
            console.log(`Found ${maintenanceWithoutResidence.length} maintenance requests without residence`);
            await Maintenance.updateMany(
                { residence: { $exists: false } },
                { residence: defaultResidence._id }
            );
            console.log('Fixed maintenance requests without residence');
        }

        // Fix Messages without residence
        const messagesWithoutResidence = await Message.find({ residence: { $exists: false } });
        if (messagesWithoutResidence.length > 0) {
            console.log(`Found ${messagesWithoutResidence.length} messages without residence`);
            await Message.updateMany(
                { residence: { $exists: false } },
                { residence: defaultResidence._id }
            );
            console.log('Fixed messages without residence');
        }

        // Fix Leases without residence
        const leasesWithoutResidence = await Lease.find({ residence: { $exists: false } });
        if (leasesWithoutResidence.length > 0) {
            console.log(`Found ${leasesWithoutResidence.length} leases without residence`);
            await Lease.updateMany(
                { residence: { $exists: false } },
                { residence: defaultResidence._id }
            );
            console.log('Fixed leases without residence');
        }

        console.log('Residence reference fix completed successfully!');
    } catch (error) {
        console.error('Error fixing residence references:', error);
    }
}

async function main() {
    await connectToDatabase();
    await fixResidenceReferences();
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { fixResidenceReferences }; 