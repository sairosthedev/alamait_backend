const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import User model
const User = require('./src/models/User');

async function connectToDatabase() {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error);
        process.exit(1);
    }
}

async function createUsers() {
    try {
        console.log('\n🚀 Creating Admin and Finance Users...\n');

        // Check if users already exist
        const existingAdmin = await User.findOne({ email: 'macdonaldsairos24@gmail.com' });
        const existingFinance = await User.findOne({ email: 'macdonaldsairos01@gmail.com' });

        if (existingAdmin) {
            console.log('⚠️  Admin user already exists, updating...');
            // Update existing admin user
            const hashedPassword = await bcrypt.hash('12345678', 12);
            await User.updateOne(
                { email: 'macdonaldsairos24@gmail.com' },
                {
                    $set: {
                        firstName: 'Macdonald',
                        lastName: 'Admin',
                        email: 'macdonaldsairos24@gmail.com',
                        password: hashedPassword,
                        role: 'admin',
                        isActive: true,
                        emailVerified: true,
                        phone: '+263771234567',
                        dateOfBirth: new Date('1990-01-01'),
                        gender: 'male',
                        address: 'Harare, Zimbabwe',
                        emergencyContact: {
                            name: 'Emergency Contact',
                            phone: '+263771234568',
                            relationship: 'Family'
                        }
                    }
                }
            );
            console.log('✅ Admin user updated successfully');
        } else {
            // Create new admin user
            const hashedPassword = await bcrypt.hash('12345678', 12);
            const adminUser = new User({
                firstName: 'Macdonald',
                lastName: 'Admin',
                email: 'macdonaldsairos24@gmail.com',
                password: hashedPassword,
                role: 'admin',
                isActive: true,
                emailVerified: true,
                phone: '+263771234567',
                dateOfBirth: new Date('1990-01-01'),
                gender: 'male',
                address: 'Harare, Zimbabwe',
                emergencyContact: {
                    name: 'Emergency Contact',
                    phone: '+263771234568',
                    relationship: 'Family'
                },
                createdAt: new Date(),
                updatedAt: new Date()
            });

            await adminUser.save();
            console.log('✅ Admin user created successfully');
        }

        if (existingFinance) {
            console.log('⚠️  Finance user already exists, updating...');
            // Update existing finance user
            const hashedPassword = await bcrypt.hash('12345678', 12);
            await User.updateOne(
                { email: 'macdonaldsairos01@gmail.com' },
                {
                    $set: {
                        firstName: 'Macdonald',
                        lastName: 'Finance',
                        email: 'macdonaldsairos01@gmail.com',
                        password: hashedPassword,
                        role: 'finance',
                        isActive: true,
                        emailVerified: true,
                        phone: '+263771234569',
                        dateOfBirth: new Date('1990-01-01'),
                        gender: 'male',
                        address: 'Harare, Zimbabwe',
                        emergencyContact: {
                            name: 'Emergency Contact',
                            phone: '+263771234570',
                            relationship: 'Family'
                        }
                    }
                }
            );
            console.log('✅ Finance user updated successfully');
        } else {
            // Create new finance user
            const hashedPassword = await bcrypt.hash('12345678', 12);
            const financeUser = new User({
                firstName: 'Macdonald',
                lastName: 'Finance',
                email: 'macdonaldsairos01@gmail.com',
                password: hashedPassword,
                role: 'finance',
                isActive: true,
                emailVerified: true,
                phone: '+263771234569',
                dateOfBirth: new Date('1990-01-01'),
                gender: 'male',
                address: 'Harare, Zimbabwe',
                emergencyContact: {
                    name: 'Emergency Contact',
                    phone: '+263771234570',
                    relationship: 'Family'
                },
                createdAt: new Date(),
                updatedAt: new Date()
            });

            await financeUser.save();
            console.log('✅ Finance user created successfully');
        }

        // Verify the users were created/updated
        const adminUser = await User.findOne({ email: 'macdonaldsairos24@gmail.com' });
        const financeUser = await User.findOne({ email: 'macdonaldsairos01@gmail.com' });

        console.log('\n📋 User Details:');
        console.log('=====================================');
        console.log('ADMIN USER:');
        console.log(`Email: ${adminUser.email}`);
        console.log(`Name: ${adminUser.firstName} ${adminUser.lastName}`);
        console.log(`Role: ${adminUser.role}`);
        console.log(`Password: 12345678`);
        console.log(`Status: ${adminUser.isActive ? 'Active' : 'Inactive'}`);
        console.log(`Email Verified: ${adminUser.emailVerified ? 'Yes' : 'No'}`);
        
        console.log('\nFINANCE USER:');
        console.log(`Email: ${financeUser.email}`);
        console.log(`Name: ${financeUser.firstName} ${financeUser.lastName}`);
        console.log(`Role: ${financeUser.role}`);
        console.log(`Password: 12345678`);
        console.log(`Status: ${financeUser.isActive ? 'Active' : 'Inactive'}`);
        console.log(`Email Verified: ${financeUser.emailVerified ? 'Yes' : 'No'}`);
        
        console.log('\n=====================================');
        console.log('🎉 Users created/updated successfully!');
        console.log('You can now log in with these credentials.');

    } catch (error) {
        console.error('❌ Error creating users:', error);
    }
}

async function main() {
    await connectToDatabase();
    await createUsers();
    
    console.log('\n🔗 Disconnecting from database...');
    await mongoose.disconnect();
    console.log('✅ Disconnected from database');
    process.exit(0);
}

// Run the script
main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
}); 