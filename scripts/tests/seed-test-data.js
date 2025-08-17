const mongoose = require('mongoose');
const User = require('./src/models/User');
const Maintenance = require('./src/models/Maintenance');
const Residence = require('./src/models/Residence');
const bcrypt = require('bcryptjs');

// Seed test data
async function seedTestData() {
    try {
        // Connect to MongoDB
        await mongoose.connect('mongodb://localhost:27017/alamait', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        console.log('\n=== SEEDING TEST DATA ===');

        // Clear existing data
        console.log('\n1. Clearing existing data...');
        await User.deleteMany({});
        await Maintenance.deleteMany({});
        await Residence.deleteMany({});
        console.log('✅ Existing data cleared');

        // Create test residence
        console.log('\n2. Creating test residence...');
        const testResidence = new Residence({
            name: 'Test Residence',
            address: '123 Test Street',
            description: 'Test residence for development',
            capacity: 50,
            amenities: ['WiFi', 'Kitchen', 'Laundry']
        });
        await testResidence.save();
        console.log('✅ Test residence created:', testResidence.name);

        // Create admin user
        console.log('\n3. Creating admin user...');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const adminUser = new User({
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@alamait.com',
            password: hashedPassword,
            role: 'admin',
            phone: '1234567890',
            status: 'active'
        });
        await adminUser.save();
        console.log('✅ Admin user created:', adminUser.email);

        // Create finance user
        console.log('\n4. Creating finance user...');
        const financeUser = new User({
            firstName: 'Finance',
            lastName: 'User',
            email: 'finance@alamait.com',
            password: hashedPassword,
            role: 'finance_admin',
            phone: '1234567891',
            status: 'active'
        });
        await financeUser.save();
        console.log('✅ Finance user created:', financeUser.email);

        // Create test maintenance requests
        console.log('\n5. Creating test maintenance requests...');
        const maintenanceRequests = [
            {
                issue: 'Leaky Faucet',
                description: 'Kitchen faucet is leaking water',
                room: 'A1',
                category: 'plumbing',
                priority: 'medium',
                status: 'pending',
                financeStatus: 'approved',
                amount: 150,
                paymentMethod: 'Bank Transfer',
                paymentIcon: '🏦',
                residence: testResidence._id,
                requestedBy: adminUser._id
            },
            {
                issue: 'Electrical Outlet Not Working',
                description: 'Electrical outlet in room B2 is not working',
                room: 'B2',
                category: 'electrical',
                priority: 'high',
                status: 'in-progress',
                financeStatus: 'pending',
                amount: 200,
                paymentMethod: 'Cash',
                paymentIcon: '💵',
                residence: testResidence._id,
                requestedBy: adminUser._id
            },
            {
                issue: 'HVAC System Maintenance',
                description: 'Annual HVAC system maintenance required',
                room: 'Common Area',
                category: 'hvac',
                priority: 'low',
                status: 'completed',
                financeStatus: 'approved',
                amount: 300,
                paymentMethod: 'Online Payment',
                paymentIcon: '💻',
                residence: testResidence._id,
                requestedBy: adminUser._id
            }
        ];

        for (const requestData of maintenanceRequests) {
            const maintenance = new Maintenance(requestData);
            await maintenance.save();
            console.log(`✅ Maintenance request created: ${maintenance.issue} (${maintenance.financeStatus})`);
        }

        console.log('\n=== SEEDING COMPLETE ===');
        console.log('✅ Test residence created');
        console.log('✅ Admin user created (email: admin@alamait.com, password: admin123)');
        console.log('✅ Finance user created (email: finance@alamait.com, password: admin123)');
        console.log('✅ 3 maintenance requests created (2 approved, 1 pending)');
        console.log('\nYou can now test the endpoints with these credentials!');

    } catch (error) {
        console.error('Error seeding data:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the seeding
seedTestData(); 