const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Database connection
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        process.exit(1);
    }
};

// Create test users
const createTestUsers = async () => {
    try {
        const User = require('./src/models/User');
        
        // Test user credentials
        const testUsers = [
            {
                email: 'test.student@alamait.com',
                password: 'test123',
                role: 'student',
                firstName: 'Test',
                lastName: 'Student',
                phone: '+263771234567',
                residence: '67d723cf20f89c4ae69804f3'
            },
            {
                email: 'test.admin@alamait.com',
                password: 'test123',
                role: 'admin',
                firstName: 'Test',
                lastName: 'Admin',
                phone: '+263771234568'
            },
            {
                email: 'test.finance@alamait.com',
                password: 'test123',
                role: 'finance_admin',
                firstName: 'Test',
                lastName: 'Finance',
                phone: '+263771234569'
            },
            {
                email: 'test.ceo@alamait.com',
                password: 'test123',
                role: 'ceo',
                firstName: 'Test',
                lastName: 'CEO',
                phone: '+263771234570'
            }
        ];
        
        console.log('\n🔧 Creating Test Users...');
        console.log('==========================');
        
        for (const userData of testUsers) {
            try {
                // Check if user already exists
                const existingUser = await User.findOne({ email: userData.email });
                
                if (existingUser) {
                    console.log(`⚠️  User ${userData.email} already exists`);
                    continue;
                }
                
                // Hash password
                const saltRounds = 10;
                const hashedPassword = await bcrypt.hash(userData.password, saltRounds);
                
                // Create user
                const newUser = new User({
                    email: userData.email,
                    password: hashedPassword,
                    role: userData.role,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    phone: userData.phone,
                    residence: userData.residence,
                    isActive: true
                });
                
                await newUser.save();
                console.log(`✅ Created ${userData.role} user: ${userData.email} (password: ${userData.password})`);
                
            } catch (error) {
                console.error(`❌ Failed to create user ${userData.email}:`, error.message);
            }
        }
        
        console.log('\n📋 Test User Credentials:');
        console.log('==========================');
        testUsers.forEach(user => {
            console.log(`${user.role.toUpperCase()}: ${user.email} / ${user.password}`);
        });
        
        console.log('\n🎯 Ready for Testing!');
        console.log('=====================');
        console.log('You can now use these credentials to test the maintenance workflow:');
        console.log('1. Login as test.student@alamait.com to create maintenance requests');
        console.log('2. Login as test.admin@alamait.com to assign requests');
        console.log('3. Login as test.finance@alamait.com to approve requests');
        console.log('4. Login as test.ceo@alamait.com to view approved requests');
        
    } catch (error) {
        console.error('❌ Error creating test users:', error.message);
    }
};

// Main function
const runCreateTestUsers = async () => {
    console.log('🚀 Creating Test Users for Maintenance Workflow Testing');
    console.log('=======================================================');
    
    try {
        // Connect to database
        await connectDB();
        
        // Create test users
        await createTestUsers();
        
        console.log('\n✅ Test users creation completed!');
        
    } catch (error) {
        console.error('❌ Test users creation failed:', error.message);
    } finally {
        mongoose.connection.close();
    }
};

// Run the script
if (require.main === module) {
    runCreateTestUsers()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Script failed:', error.message);
            process.exit(1);
        });
}

module.exports = {
    runCreateTestUsers
}; 