const mongoose = require('mongoose');
const MonthlyRequest = require('./src/models/MonthlyRequest');
const Residence = require('./src/models/Residence');
const User = require('./src/models/User');

// MongoDB connection
mongoose.connect('mongodb+srv://cluster0.ulvve.mongodb.net/test', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function debugMonthlyRequestIssues() {
    try {
        console.log('🔍 Debugging Monthly Request 400 Error...\n');

        // 1. Check if residences exist
        console.log('1. Checking residences...');
        const residences = await Residence.find({});
        console.log(`Found ${residences.length} residences:`);
        residences.forEach(res => {
            console.log(`  - ${res.name} (ID: ${res._id})`);
        });

        if (residences.length === 0) {
            console.log('❌ No residences found - this could cause 400 error');
        }

        // 2. Check if admin users exist
        console.log('\n2. Checking admin users...');
        const adminUsers = await User.find({ role: 'admin' });
        console.log(`Found ${adminUsers.length} admin users:`);
        adminUsers.forEach(user => {
            console.log(`  - ${user.firstName} ${user.lastName} (${user.email})`);
        });

        if (adminUsers.length === 0) {
            console.log('❌ No admin users found - this could cause issues');
        }

        // 3. Check existing monthly requests for current month
        console.log('\n3. Checking existing monthly requests...');
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        
        const existingRequests = await MonthlyRequest.find({
            month: currentMonth,
            year: currentYear
        });
        
        console.log(`Found ${existingRequests.length} existing requests for ${currentMonth}/${currentYear}:`);
        existingRequests.forEach(req => {
            console.log(`  - ${req.title} (${req.residence}) - Status: ${req.status}`);
        });

        // 4. Test validation scenarios
        console.log('\n4. Testing validation scenarios...');
        
        // Test data with potential issues
        const testScenarios = [
            {
                name: 'Missing title',
                data: {
                    description: 'Test description',
                    residence: residences[0]?._id,
                    month: currentMonth,
                    year: currentYear
                }
            },
            {
                name: 'Missing description',
                data: {
                    title: 'Test Title',
                    residence: residences[0]?._id,
                    month: currentMonth,
                    year: currentYear
                }
            },
            {
                name: 'Missing residence',
                data: {
                    title: 'Test Title',
                    description: 'Test description',
                    month: currentMonth,
                    year: currentYear
                }
            },
            {
                name: 'Missing month',
                data: {
                    title: 'Test Title',
                    description: 'Test description',
                    residence: residences[0]?._id,
                    year: currentYear
                }
            },
            {
                name: 'Missing year',
                data: {
                    title: 'Test Title',
                    description: 'Test description',
                    residence: residences[0]?._id,
                    month: currentMonth
                }
            },
            {
                name: 'Invalid month (13)',
                data: {
                    title: 'Test Title',
                    description: 'Test description',
                    residence: residences[0]?._id,
                    month: 13,
                    year: currentYear
                }
            },
            {
                name: 'Invalid year (2019)',
                data: {
                    title: 'Test Title',
                    description: 'Test description',
                    residence: residences[0]?._id,
                    month: currentMonth,
                    year: 2019
                }
            },
            {
                name: 'Invalid residence ID',
                data: {
                    title: 'Test Title',
                    description: 'Test description',
                    residence: '507f1f77bcf86cd799439011', // Fake ID
                    month: currentMonth,
                    year: currentYear
                }
            }
        ];

        for (const scenario of testScenarios) {
            console.log(`\nTesting: ${scenario.name}`);
            try {
                const monthlyRequest = new MonthlyRequest(scenario.data);
                await monthlyRequest.validate();
                console.log(`  ✅ ${scenario.name} - Validation passed`);
            } catch (error) {
                console.log(`  ❌ ${scenario.name} - Validation failed:`, error.message);
            }
        }

        // 5. Check for duplicate requests
        console.log('\n5. Checking for potential duplicates...');
        if (residences.length > 0 && existingRequests.length > 0) {
            const firstRequest = existingRequests[0];
            const duplicateCheck = await MonthlyRequest.findOne({
                residence: firstRequest.residence,
                month: firstRequest.month,
                year: firstRequest.year,
                title: firstRequest.title,
                isTemplate: false
            });
            
            if (duplicateCheck) {
                console.log(`❌ Found duplicate request: ${firstRequest.title}`);
            } else {
                console.log('✅ No duplicate requests found');
            }
        }

        // 6. Test actual request creation
        console.log('\n6. Testing actual request creation...');
        if (residences.length > 0 && adminUsers.length > 0) {
            const testRequest = new MonthlyRequest({
                title: `Debug Test Request ${Date.now()}`,
                description: 'Debug test description',
                residence: residences[0]._id,
                month: currentMonth,
                year: currentYear,
                items: [
                    {
                        description: 'Test Item',
                        quantity: 1,
                        estimatedCost: 100,
                        category: 'utilities',
                        isRecurring: true
                    }
                ],
                priority: 'medium',
                submittedBy: adminUsers[0]._id,
                status: 'draft'
            });

            try {
                await testRequest.save();
                console.log('✅ Test request created successfully');
                
                // Clean up
                await MonthlyRequest.findByIdAndDelete(testRequest._id);
                console.log('✅ Test request cleaned up');
            } catch (error) {
                console.log('❌ Test request creation failed:', error.message);
            }
        }

        console.log('\n🔍 Debug complete!');

    } catch (error) {
        console.error('Error during debug:', error);
    } finally {
        mongoose.connection.close();
        console.log('\nDatabase connection closed.');
    }
}

// Run the debug script
debugMonthlyRequestIssues(); 