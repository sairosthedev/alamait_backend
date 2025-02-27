require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');

const createAdmin = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Admin details
        const adminData = {
            email: 'admin@alamait.com',
            password: 'Admin@123',
            firstName: 'System',
            lastName: 'Administrator',
            phone: '+263771234567',
            role: 'admin',
            isVerified: true
        };

        // Check if admin already exists
        const existingAdmin = await User.findOne({ email: adminData.email });
        if (existingAdmin) {
            console.log('Admin user already exists');
            process.exit(0);
        }

        // Create new admin user
        const admin = new User(adminData);
        await admin.save();

        console.log('Admin user created successfully:');
        console.log({
            email: admin.email,
            firstName: admin.firstName,
            lastName: admin.lastName,
            role: admin.role
        });

    } catch (error) {
        console.error('Error creating admin:', error);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
};

createAdmin(); 