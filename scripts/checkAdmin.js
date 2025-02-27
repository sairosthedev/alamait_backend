require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

const checkAdmin = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find admin user
        const admin = await User.findOne({ role: 'admin' });
        
        if (admin) {
            console.log('Admin user found:');
            console.log({
                id: admin._id,
                email: admin.email,
                firstName: admin.firstName,
                lastName: admin.lastName,
                role: admin.role,
                isVerified: admin.isVerified
            });
        } else {
            console.log('No admin user found');
        }

    } catch (error) {
        console.error('Error checking admin:', error);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
};

checkAdmin(); 