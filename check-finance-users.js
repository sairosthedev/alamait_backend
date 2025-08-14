const mongoose = require('mongoose');
const User = require('./src/models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function checkFinanceUsers() {
    try {
        console.log('Checking finance users...');
        
        const financeUsers = await User.find({
            role: { $in: ['finance', 'finance_admin', 'finance_user'] }
        });

        console.log(`Found ${financeUsers.length} finance users:`);
        
        if (financeUsers.length === 0) {
            console.log('No finance users found!');
            console.log('Creating finance user...');
            
            const User = require('./src/models/User');
            const bcrypt = require('bcryptjs');
            
            const hashedPassword = await bcrypt.hash('12345678', 10);
            
            const newFinanceUser = new User({
                firstName: 'Finance',
                lastName: 'User',
                email: 'macdonaldsairos01@gmail.com',
                password: hashedPassword,
                role: 'finance',
                isActive: true
            });
            
            await newFinanceUser.save();
            console.log('✅ Finance user created: macdonaldsairos01@gmail.com');
        } else {
            financeUsers.forEach(user => {
                console.log(`- ${user.email} (${user.role})`);
            });
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkFinanceUsers(); 