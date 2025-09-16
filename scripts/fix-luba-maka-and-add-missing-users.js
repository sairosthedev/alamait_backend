/**
 * 🔧 Fix Luba & Maka Status + Add Missing Users
 * 
 * This script:
 * 1. Updates Luba and Maka to "expired" status (leases ended in July)
 * 2. Creates missing User records for orphaned applications (debtors exist)
 */

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/models/User');
const Application = require('../src/models/Application');
const ExpiredStudent = require('../src/models/ExpiredStudent');
const Debtor = require('../src/models/Debtor');

async function fixLubaMakaAndAddMissingUsers() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });
        console.log('✅ Connected to MongoDB');

        console.log('🔧 Fixing Luba & Maka status + Adding missing users...\n');

        // Step 1: Fix Luba and Maka status to "expired"
        console.log('🔧 Step 1: Updating Luba and Maka to "expired" status...');
        
        const lubaUser = await User.findOne({ 
            $or: [
                { firstName: /luba/i, lastName: /ndex/i },
                { email: /luba/i },
                { email: /rdsmensecurity/i }
            ]
        });
        
        const makaUser = await User.findOne({ 
            $or: [
                { firstName: /maka/i, lastName: /security/i },
                { email: /maka/i },
                { email: /guardsmensity/i }
            ]
        });

        if (lubaUser) {
            console.log(`   🔄 Updating Luba: ${lubaUser.firstName} ${lubaUser.lastName} (${lubaUser.email})`);
            console.log(`      Current status: ${lubaUser.status}`);
            lubaUser.status = 'expired';
            await lubaUser.save();
            console.log(`      ✅ Updated to: expired`);
        } else {
            console.log(`   ❌ Luba user not found`);
        }

        if (makaUser) {
            console.log(`   🔄 Updating Maka: ${makaUser.firstName} ${makaUser.lastName} (${makaUser.email})`);
            console.log(`      Current status: ${makaUser.status}`);
            makaUser.status = 'expired';
            await makaUser.save();
            console.log(`      ✅ Updated to: expired`);
        } else {
            console.log(`   ❌ Maka user not found`);
        }

        // Step 2: Find orphaned applications and create missing users
        console.log('\n🔧 Step 2: Creating missing users for orphaned applications...');
        
        const users = await User.find({ role: 'student' });
        const applications = await Application.find({});
        const expiredStudents = await ExpiredStudent.find({});
        const debtors = await Debtor.find({});

        // Find orphaned applications
        const orphanedApplications = [];
        
        for (const app of applications) {
            if (app.student) {
                const isInUsers = users.some(u => u._id.toString() === app.student.toString());
                const isInExpired = expiredStudents.some(e => 
                    e.student && e.student.toString() === app.student.toString()
                );
                
                if (!isInUsers && !isInExpired) {
                    orphanedApplications.push(app);
                }
            }
        }

        console.log(`   📋 Found ${orphanedApplications.length} orphaned applications`);

        let usersCreated = 0;
        for (const app of orphanedApplications) {
            console.log(`\n   👤 Processing: ${app.firstName} ${app.lastName} (${app._id})`);
            console.log(`      Student ID: ${app.student}`);
            console.log(`      Email: ${app.email}`);
            console.log(`      Status: ${app.status}`);
            
            // Check if debtor exists for this student
            const debtor = debtors.find(d => 
                d.user && d.user.toString() === app.student.toString()
            );
            
            if (debtor) {
                console.log(`      💰 Debtor found: ${debtor.debtorCode} (Balance: $${debtor.currentBalance})`);
                
                // Create missing user
                const newUser = new User({
                    _id: app.student,
                    firstName: app.firstName,
                    lastName: app.lastName,
                    email: app.email,
                    password: '$2a$10$defaultpasswordhashforrecreatedusers', // Default password hash
                    phone: app.phone || '',
                    role: 'student',
                    isVerified: true,
                    status: app.status === 'approved' ? 'active' : 'inactive',
                    currentRoom: app.allocatedRoom || null,
                    residence: app.residence || null,
                    roomValidUntil: app.endDate || null,
                    roomApprovalDate: app.applicationDate || null,
                    applicationCode: app.applicationCode,
                    emergencyContact: app.emergencyContact || {},
                    preferences: app.preferences || {},
                    createdAt: app.createdAt || new Date(),
                    updatedAt: new Date()
                });

                try {
                    await newUser.save();
                    console.log(`      ✅ Created user: ${newUser._id}`);
                    usersCreated++;
                } catch (error) {
                    console.log(`      ❌ Failed to create user: ${error.message}`);
                }
            } else {
                console.log(`      ⚠️ No debtor found - skipping user creation`);
            }
        }

        // Step 3: Update application statuses for newly created users
        console.log('\n🔧 Step 3: Updating application statuses...');
        
        const updatedUsers = await User.find({ role: 'student' });
        let appsUpdated = 0;
        
        for (const app of orphanedApplications) {
            const userExists = updatedUsers.some(u => u._id.toString() === app.student.toString());
            
            if (userExists && app.status !== 'approved') {
                // If user now exists and has debtor, application should be approved
                const debtor = debtors.find(d => 
                    d.user && d.user.toString() === app.student.toString()
                );
                
                if (debtor) {
                    app.status = 'approved';
                    app.actionDate = new Date();
                    await app.save();
                    console.log(`   ✅ Updated application ${app.applicationCode} to approved`);
                    appsUpdated++;
                }
            }
        }

        // Final summary
        console.log('\n📊 Summary:');
        console.log(`   👥 Users created: ${usersCreated}`);
        console.log(`   📋 Applications updated: ${appsUpdated}`);
        
        // Check final status
        const finalUsers = await User.find({ role: 'student' });
        const finalApplications = await Application.find({});
        
        const userStatusCounts = {};
        for (const user of finalUsers) {
            const status = user.status || 'unknown';
            userStatusCounts[status] = (userStatusCounts[status] || 0) + 1;
        }
        
        const appStatusCounts = {};
        for (const app of finalApplications) {
            const status = app.status || 'unknown';
            appStatusCounts[status] = (appStatusCounts[status] || 0) + 1;
        }
        
        console.log('\n📊 Final Status:');
        console.log('   👥 User Statuses:');
        for (const [status, count] of Object.entries(userStatusCounts)) {
            console.log(`      ${status}: ${count}`);
        }
        
        console.log('   📋 Application Statuses:');
        for (const [status, count] of Object.entries(appStatusCounts)) {
            console.log(`      ${status}: ${count}`);
        }

        // Check for remaining orphaned applications
        const remainingOrphaned = [];
        for (const app of finalApplications) {
            if (app.student) {
                const isInUsers = finalUsers.some(u => u._id.toString() === app.student.toString());
                const isInExpired = expiredStudents.some(e => 
                    e.student && e.student.toString() === app.student.toString()
                );
                
                if (!isInUsers && !isInExpired) {
                    remainingOrphaned.push(app);
                }
            }
        }

        if (remainingOrphaned.length === 0) {
            console.log('\n✅ All orphaned applications resolved!');
        } else {
            console.log(`\n⚠️ ${remainingOrphaned.length} orphaned applications still remain`);
        }

        console.log('\n✅ Fix completed!');

    } catch (error) {
        console.error('❌ Error in fix:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

// Run the fix
fixLubaMakaAndAddMissingUsers();
