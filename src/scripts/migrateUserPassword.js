/**
 * Script to migrate a user's password from old format (bcrypt(plain)) to new format (bcrypt(SHA256))
 * 
 * Usage:
 * node src/scripts/migrateUserPassword.js <email> <plainTextPassword>
 * 
 * Example:
 * node src/scripts/migrateUserPassword.js cindypemhiwa@gmail.com "your_plain_text_password"
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { hashPasswordSha256 } = require('../utils/clientPasswordHash');

async function migrateUserPassword(email, plainTextPassword) {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB');

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            console.error(`❌ User not found: ${email}`);
            process.exit(1);
        }

        console.log(`📋 Found user: ${user.firstName} ${user.lastName}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Current password hash: ${user.password.substring(0, 20)}...`);

        // Verify the plain text password matches the current hash (old format)
        const isValidPassword = await bcrypt.compare(plainTextPassword, user.password);
        if (!isValidPassword) {
            console.error('❌ Invalid password! The provided password does not match the current password.');
            process.exit(1);
        }

        console.log('✅ Password verified (old format)');

        // Migrate to new format: hash with SHA-256 first
        // The pre-save hook will then hash it with bcrypt
        const sha256Hash = hashPasswordSha256(plainTextPassword);
        console.log(`   SHA-256 hash: ${sha256Hash.substring(0, 20)}...`);

        // Set password to SHA-256 hash - pre-save hook will bcrypt it
        user.password = sha256Hash;
        await user.save();

        console.log('✅ Password migrated successfully!');
        console.log(`   User can now login with SHA-256 hashed password`);
        console.log(`   SHA-256 hash of password: ${sha256Hash}`);

        // Disconnect
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error migrating password:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Get command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
    console.error('Usage: node src/scripts/migrateUserPassword.js <email> <plainTextPassword>');
    console.error('Example: node src/scripts/migrateUserPassword.js cindypemhiwa@gmail.com "password123"');
    process.exit(1);
}

const [email, plainTextPassword] = args;

// Run migration
migrateUserPassword(email, plainTextPassword);

