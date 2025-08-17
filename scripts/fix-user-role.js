const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');

// Fix user role script
async function fixUserRole() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        console.log('\n=== FIXING USER ROLES ===');

        // Check if there are any users
        const allUsers = await User.find({}).select('_id email firstName lastName role status');
        console.log(`Found ${allUsers.length} users in database`);

        if (allUsers.length === 0) {
            console.log('\nNo users found. Creating a default admin user...');
            
            // Create a default admin user
            const hashedPassword = await bcrypt.hash('admin123', 10);
            const adminUser = new User({
                email: 'admin@alamait.com',
                password: hashedPassword,
                firstName: 'Admin',
                lastName: 'User',
                phone: '1234567890',
                role: 'admin',
                isVerified: true,
                status: 'active'
            });

            await adminUser.save();
            console.log('✅ Default admin user created:');
            console.log('   Email: admin@alamait.com');
            console.log('   Password: admin123');
            console.log('   Role: admin');
        } else {
            console.log('\nExisting users:');
            allUsers.forEach(user => {
                console.log(`  - ${user.email} (${user.firstName} ${user.lastName}) - Role: ${user.role} - Status: ${user.status}`);
            });

            // Check if any user has admin role
            const adminUsers = await User.find({ role: 'admin' });
            if (adminUsers.length === 0) {
                console.log('\n⚠️  No users with admin role found!');
                console.log('To fix this, you can:');
                console.log('1. Update an existing user to admin role');
                console.log('2. Create a new admin user');
                
                // Ask user what they want to do
                const readline = require('readline');
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });

                rl.question('\nDo you want to update an existing user to admin role? (y/n): ', async (answer) => {
                    if (answer.toLowerCase() === 'y') {
                        rl.question('Enter the email of the user to update: ', async (email) => {
                            try {
                                const user = await User.findOne({ email });
                                if (!user) {
                                    console.log('❌ User not found');
                                    rl.close();
                                    return;
                                }

                                user.role = 'admin';
                                await user.save();
                                console.log(`✅ Updated ${user.email} to admin role`);
                            } catch (error) {
                                console.error('Error updating user:', error);
                            }
                            rl.close();
                        });
                    } else {
                        console.log('\nTo create a new admin user, run:');
                        console.log('node src/scripts/createFinanceUser.js admin@example.com admin <password>');
                        rl.close();
                    }
                });
            } else {
                console.log('\n✅ Admin users found:');
                adminUsers.forEach(user => {
                    console.log(`  - ${user.email} (${user.firstName} ${user.lastName})`);
                });
            }
        }

        // Show available roles
        console.log('\n=== AVAILABLE ROLES ===');
        console.log('Valid roles in the system:');
        console.log('  - admin: Full system access');
        console.log('  - finance_admin: Finance management access');
        console.log('  - finance_user: Basic finance access');
        console.log('  - student: Student access (default)');

        console.log('\n=== ROLE PERMISSIONS ===');
        console.log('Admin expenses endpoint requires: admin, finance_admin, or finance_user');
        console.log('Finance endpoints require: admin, finance_admin, or finance_user');

    } catch (error) {
        console.error('Error fixing user roles:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

fixUserRole(); 