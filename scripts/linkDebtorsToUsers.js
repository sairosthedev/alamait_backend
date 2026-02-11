/**
 * Script to link debtors to users when the user field is missing
 * Uses the account code (1100-{userId}) to find and link the correct user
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Debtor = require('../src/models/Debtor');
const User = require('../src/models/User');

async function linkDebtorsToUsers() {
    try {
        // Connect to database with connection options
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            throw new Error('MongoDB URI not found in environment variables');
        }
        
        console.log('🔌 Connecting to database...');
        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 30000, // 30 seconds
            socketTimeoutMS: 45000, // 45 seconds
            connectTimeoutMS: 30000, // 30 seconds
            maxPoolSize: 10,
            retryWrites: true,
            w: 'majority'
        });
        console.log('✅ Connected to database\n');

        console.log('🔍 Finding debtors with missing user links...\n');

        // Find all debtors with query timeout
        // First get IDs only for faster query
        const debtorIds = await Debtor.find({}).select('_id').maxTimeMS(30000).lean();
        console.log(`📊 Found ${debtorIds.length} debtors, checking user links...\n`);
        
        // Then fetch full documents in batches to avoid timeout
        const debtors = [];
        const batchSize = 50;
        for (let i = 0; i < debtorIds.length; i += batchSize) {
            const batch = debtorIds.slice(i, i + batchSize);
            const batchDebtors = await Debtor.find({ 
                _id: { $in: batch.map(d => d._id) } 
            })
            .populate('user', 'email firstName lastName')
            .maxTimeMS(30000);
            debtors.push(...batchDebtors);
        }

        console.log(`📊 Found ${debtors.length} debtors\n`);

        const unlinkedDebtors = [];
        const linkedDebtors = [];

        // Check each debtor
        for (const debtor of debtors) {
            if (!debtor.user) {
                unlinkedDebtors.push(debtor);
            } else {
                linkedDebtors.push(debtor);
            }
        }

        console.log(`✅ Linked debtors: ${linkedDebtors.length}`);
        console.log(`⚠️  Unlinked debtors: ${unlinkedDebtors.length}\n`);

        if (unlinkedDebtors.length === 0) {
            console.log('✅ All debtors are linked to users!');
            await mongoose.disconnect();
            return;
        }

        // Display unlinked debtors
        console.log('📋 Debtors without user links:\n');
        unlinkedDebtors.forEach(debtor => {
            const email = debtor.contactInfo?.email || 'No email';
            const accountCode = debtor.accountCode || 'No account code';
            console.log(`   ${debtor.debtorCode}:`);
            console.log(`      Email: ${email}`);
            console.log(`      Account Code: ${accountCode}`);
            console.log(`      Status: ${debtor.status}`);
            console.log('');
        });

        // Confirm before proceeding
        const shouldFix = process.argv.includes('--fix') || process.argv.includes('--confirm');
        
        if (!shouldFix) {
            console.log('💡 To actually link debtors to users, run: node scripts/linkDebtorsToUsers.js --fix');
            console.log('   This will:');
            console.log('   1. Extract userId from account code (1100-{userId})');
            console.log('   2. Find the user by ID');
            console.log('   3. If not found by ID, try to find by email');
            console.log('   4. Link the debtor to the user');
            await mongoose.disconnect();
            return;
        }

        console.log('\n🔧 Linking debtors to users...\n');

        let linkedCount = 0;
        let errorCount = 0;
        let notFoundCount = 0;

        for (const debtor of unlinkedDebtors) {
            try {
                console.log(`📝 Processing ${debtor.debtorCode}...`);

                let user = null;
                const accountCode = debtor.accountCode;
                const email = debtor.contactInfo?.email;

                // Method 1: Extract userId from account code (1100-{userId})
                if (accountCode && accountCode.startsWith('1100-')) {
                    const userId = accountCode.replace('1100-', '');
                    console.log(`   🔍 Trying to find user by ID from account code: ${userId}`);
                    
                    if (mongoose.Types.ObjectId.isValid(userId)) {
                        user = await User.findById(userId).maxTimeMS(10000).lean();
                        if (user) {
                            console.log(`   ✅ Found user by ID: ${user.firstName} ${user.lastName} (${user.email})`);
                            // Convert lean object back to mongoose document for saving
                            user = await User.findById(userId);
                        }
                    }
                }

                // Method 2: If not found, try to find by email
                if (!user && email) {
                    console.log(`   🔍 Trying to find user by email: ${email}`);
                    const userLean = await User.findOne({ email: email.toLowerCase().trim() }).maxTimeMS(10000).lean();
                    if (userLean) {
                        user = await User.findById(userLean._id);
                        console.log(`   ✅ Found user by email: ${user.firstName} ${user.lastName} (${user._id})`);
                    }
                }

                // Method 3: If still not found, try to find by name (less reliable)
                if (!user && debtor.contactInfo?.name) {
                    const nameParts = debtor.contactInfo.name.split(' ');
                    if (nameParts.length >= 2) {
                        const firstName = nameParts[0];
                        const lastName = nameParts.slice(1).join(' ');
                        console.log(`   🔍 Trying to find user by name: ${firstName} ${lastName}`);
                        const userLean = await User.findOne({ 
                            firstName: { $regex: new RegExp(`^${firstName}$`, 'i') },
                            lastName: { $regex: new RegExp(`^${lastName}$`, 'i') }
                        }).maxTimeMS(10000).lean();
                        if (userLean) {
                            user = await User.findById(userLean._id);
                            console.log(`   ✅ Found user by name: ${user.email} (${user._id})`);
                        }
                    }
                }

                if (user) {
                    // Link the debtor to the user
                    // debtor is already a Mongoose document, so we can save directly
                    debtor.user = user._id;
                    await debtor.save({ maxTimeMS: 10000 });

                    console.log(`   ✅ Linked debtor ${debtor.debtorCode} to user ${user._id} (${user.email})\n`);
                    linkedCount++;
                } else {
                    console.log(`   ⚠️  Could not find user for debtor ${debtor.debtorCode}`);
                    console.log(`      Account Code: ${accountCode}`);
                    console.log(`      Email: ${email || 'N/A'}`);
                    console.log(`      Name: ${debtor.contactInfo?.name || 'N/A'}\n`);
                    notFoundCount++;
                }

            } catch (error) {
                console.error(`   ❌ Error linking ${debtor.debtorCode}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n📊 Summary:');
        console.log(`   ✅ Linked: ${linkedCount} debtor(s)`);
        console.log(`   ⚠️  User not found: ${notFoundCount} debtor(s)`);
        console.log(`   ❌ Errors: ${errorCount}`);
        console.log(`   ✅ Already linked: ${linkedDebtors.length}`);

        if (notFoundCount > 0) {
            console.log('\n💡 For debtors where users were not found:');
            console.log('   - Check if the user exists in the User collection');
            console.log('   - Verify the email address matches');
            console.log('   - Manually link them if needed');
        }

        await mongoose.disconnect();
        console.log('\n✅ Script completed');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        
        if (error.name === 'MongoNetworkError' || error.code === 'ETIMEDOUT') {
            console.error('\n💡 Connection timeout - Possible issues:');
            console.error('   1. MongoDB server may be down or unreachable');
            console.error('   2. Network connectivity issue');
            console.error('   3. Firewall blocking the connection');
            console.error('   4. VPN may be required');
            console.error('\n   Check your MongoDB connection string:');
            const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
            if (mongoUri) {
                // Mask password in connection string
                const maskedUri = mongoUri.replace(/:[^:@]+@/, ':****@');
                console.error(`   ${maskedUri}`);
            }
        }
        
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
        }
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    linkDebtorsToUsers();
}

module.exports = { linkDebtorsToUsers };
