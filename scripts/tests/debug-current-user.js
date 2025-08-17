const mongoose = require('mongoose');
const User = require('./src/models/User');
const jwt = require('jsonwebtoken');

// Debug current user permissions
async function debugCurrentUser() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        console.log('\n=== DEBUGGING CURRENT USER ===');

        // Get the token from the error message (you'll need to provide this)
        const token = process.argv[2]; // Pass token as command line argument
        
        if (!token) {
            console.log('No token provided. Please provide a JWT token as an argument.');
            console.log('Usage: node debug-current-user.js <jwt_token>');
            return;
        }

        try {
            // Decode the token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            console.log('Token decoded successfully');
            console.log('Decoded token:', JSON.stringify(decoded, null, 2));

            // Find the user
            const user = await User.findById(decoded.user?.id || decoded.id);
            if (!user) {
                console.log('User not found in database');
                return;
            }

            console.log('\n=== USER DETAILS ===');
            console.log('User ID:', user._id);
            console.log('Email:', user.email);
            console.log('Name:', user.firstName, user.lastName);
            console.log('Role:', user.role);
            console.log('Status:', user.status);
            console.log('Created:', user.createdAt);

            // Check what roles are allowed for admin expenses
            const allowedRoles = ['admin', 'finance_admin', 'finance_user'];
            const hasAccess = allowedRoles.includes(user.role);
            
            console.log('\n=== ACCESS CHECK ===');
            console.log('Allowed roles for admin expenses:', allowedRoles);
            console.log('User role:', user.role);
            console.log('Has access:', hasAccess);

            if (!hasAccess) {
                console.log('\n=== SOLUTION ===');
                console.log('To fix this, you need to update the user role to one of:', allowedRoles);
                console.log('You can do this by:');
                console.log('1. Using the createFinanceUser script:');
                console.log(`   node src/scripts/createFinanceUser.js ${user.email} finance_admin <password>`);
                console.log('2. Or manually updating the user in the database');
            }

        } catch (jwtError) {
            console.error('Error decoding token:', jwtError.message);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

debugCurrentUser(); 