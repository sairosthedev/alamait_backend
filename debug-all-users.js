require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

async function debugAllUsers() {
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

        console.log('\n=== ALL USERS IN DATABASE ===');
        
        // Get all users
        const allUsers = await User.find({}).select('_id email firstName lastName role status createdAt');
        console.log(`Found ${allUsers.length} total users:`);
        
        allUsers.forEach((user, index) => {
            console.log(`${index + 1}. ${user.email} (${user.firstName} ${user.lastName})`);
            console.log(`   ID: ${user._id}`);
            console.log(`   Role: ${user.role}`);
            console.log(`   Status: ${user.status}`);
            console.log(`   Created: ${user.createdAt}`);
            console.log('');
        });

        // Check for finance users specifically
        console.log('=== FINANCE USERS ===');
        const financeUsers = allUsers.filter(user => 
            ['finance_admin', 'finance_user', 'finance'].includes(user.role)
        );
        
        if (financeUsers.length > 0) {
            financeUsers.forEach(user => {
                console.log(`- ${user.email} (${user.firstName} ${user.lastName}) - Role: ${user.role}`);
            });
        } else {
            console.log('No finance users found');
        }

        // Check for admin users
        console.log('\n=== ADMIN USERS ===');
        const adminUsers = allUsers.filter(user => user.role === 'admin');
        
        if (adminUsers.length > 0) {
            adminUsers.forEach(user => {
                console.log(`- ${user.email} (${user.firstName} ${user.lastName}) - Role: ${user.role}`);
            });
        } else {
            console.log('No admin users found');
        }

        // Check unique roles
        console.log('\n=== UNIQUE ROLES ===');
        const uniqueRoles = [...new Set(allUsers.map(user => user.role))];
        console.log('Roles found:', uniqueRoles);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

debugAllUsers(); 