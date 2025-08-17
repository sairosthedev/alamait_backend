require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function findFinanceUser() {
    try {
        // Connect to MongoDB using environment variable
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }
        
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');
        console.log('Database name:', mongoose.connection.name);

        // Find the finance user by email
        const financeUser = await User.findOne({ email: 'finance@alamait.com' });
        
        if (financeUser) {
            console.log('\n=== FINANCE USER FOUND ===');
            console.log('ID:', financeUser._id);
            console.log('Email:', financeUser.email);
            console.log('Name:', financeUser.firstName, financeUser.lastName);
            console.log('Role:', financeUser.role);
            console.log('Status:', financeUser.status);
            console.log('Created:', financeUser.createdAt);
        } else {
            console.log('\n❌ Finance user not found');
        }

        // Also check if there's a user with the ID you mentioned
        const specificUser = await User.findById('67f4ef0fcb87ffa3fb7e2d73');
        if (specificUser) {
            console.log('\n=== USER WITH SPECIFIC ID FOUND ===');
            console.log('ID:', specificUser._id);
            console.log('Email:', specificUser.email);
            console.log('Name:', specificUser.firstName, specificUser.lastName);
            console.log('Role:', specificUser.role);
            console.log('Status:', specificUser.status);
        } else {
            console.log('\n❌ User with ID 67f4ef0fcb87ffa3fb7e2d73 not found');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

findFinanceUser(); 