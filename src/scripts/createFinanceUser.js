/**
 * Script to create a finance user or update an existing user with finance permissions
 * 
 * Usage:
 * node src/scripts/createFinanceUser.js [email] [role] [password]
 * 
 * Example:
 * node src/scripts/createFinanceUser.js finance@alamait.com finance_admin Password123
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const connectDB = require('../config/database');

console.log('Starting finance user creation script...');

// Parse command line arguments
const [,, email, role, password] = process.argv;

console.log('Arguments received:', {
  email,
  role,
  password: password ? '********' : undefined
});

// Validate arguments
if (!email || !role || !password) {
  console.error('Usage: node src/scripts/createFinanceUser.js [email] [role] [password]');
  console.error('Roles: admin, finance_admin, finance_user');
  process.exit(1);
}

// Validate role
const validRoles = ['admin', 'finance_admin', 'finance_user'];
if (!validRoles.includes(role)) {
  console.error(`Error: Role must be one of ${validRoles.join(', ')}`);
  process.exit(1);
}

async function createFinanceUser() {
  let connection;
  try {
    console.log('Attempting to connect to MongoDB...');
    // Connect to database
    connection = await connectDB();
    console.log('Connected to MongoDB successfully');

    // Check if user already exists
    console.log(`Checking if user with email ${email} already exists...`);
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      console.log(`User ${email} already exists. Current role: ${existingUser.role}`);
      console.log(`Updating role to ${role}...`);
      
      // Update user role
      existingUser.role = role;
      await existingUser.save();
      
      console.log(`✅ Success! User ${email} has been updated with role: ${role}`);
    } else {
      console.log(`Creating new user with email ${email} and role ${role}...`);
      
      // Generate salt and hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create new user with finance role
      const newUser = new User({
        email,
        password: hashedPassword,
        role,
        firstName: 'Finance',
        lastName: 'User',
        phone: '0000000000',
        isVerified: true,
        status: 'active'
      });

      await newUser.save();
      console.log(`✅ Success! New finance user created with email: ${email} and role: ${role}`);
    }

  } catch (error) {
    console.error('Error creating finance user:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    // Disconnect from database
    try {
      if (connection) {
        console.log('Disconnecting from MongoDB...');
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
      }
    } catch (err) {
      console.error('Error disconnecting from MongoDB:', err);
    }
    process.exit(0);
  }
}

// Run the function
createFinanceUser(); 