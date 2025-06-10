const mongoose = require('mongoose');
require('dotenv').config();
const { initializeNewlandsResidence } = require('../controllers/residenceController');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

async function createManagerUser() {
    try {
        // Check if manager already exists
        let manager = await User.findOne({ email: 'manager@alamait.com' });
        
        if (!manager) {
            // Create new manager user
            const hashedPassword = await bcrypt.hash('manager123', 10);
            manager = new User({
                firstName: 'System',
                lastName: 'Manager',
                email: 'manager@alamait.com',
                password: hashedPassword,
                role: 'admin',
                phone: '+27 21 123 4567',
                status: 'active'
            });
            await manager.save();
            console.log('Manager user created successfully');
        }
        
        return manager._id;
    } catch (error) {
        console.error('Error creating manager user:', error);
        throw error;
    }
}

async function initializeResidences() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Create manager user and get ID
        const managerId = await createManagerUser();

        // Initialize Newlands residence with manager ID
        await initializeNewlandsResidence(managerId);

        console.log('Residence initialization completed');
        process.exit(0);
    } catch (error) {
        console.error('Error initializing residences:', error);
        process.exit(1);
    }
}

initializeResidences(); 