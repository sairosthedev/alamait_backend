const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');

// Connect to database
mongoose.connect('mongodb://localhost:27017/alamait', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function createCEOUser() {
  try {
    console.log('Creating CEO user...');
    
    // Check if CEO user already exists
    const existingCEO = await User.findOne({ email: 'ceo@alamait.com' });
    if (existingCEO) {
      console.log('CEO user already exists:', existingCEO.email);
      return;
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    // Create CEO user
    const ceoUser = new User({
      firstName: 'CEO',
      lastName: 'User',
      email: 'ceo@alamait.com',
      password: hashedPassword,
      phone: '1234567890',
      role: 'ceo',
      isVerified: true,
      isActive: true
    });
    
    await ceoUser.save();
    console.log('✅ CEO user created successfully:', ceoUser.email);
    console.log('Login credentials:');
    console.log('Email: ceo@alamait.com');
    console.log('Password: password123');
    
  } catch (error) {
    console.error('❌ Error creating CEO user:', error.message);
  } finally {
    mongoose.connection.close();
  }
}

createCEOUser(); 