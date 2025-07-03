const mongoose = require('mongoose');
const Payment = require('./src/models/Payment');
const Residence = require('./src/models/Residence');

// Test function to simulate payment requirements for different residences
async function testPaymentLogic() {
    try {
        // Connect to database (you'll need to update the connection string)
        await mongoose.connect('mongodb://localhost:27017/alamait_backend', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('Connected to database');

        // Test different residence scenarios
        const testScenarios = [
            {
                name: 'St Kilda Student House',
                expected: {
                    adminFee: 20,
                    deposit: true,
                    description: 'Should require admin fee + deposit'
                }
            },
            {
                name: 'Belvedere Student House',
                expected: {
                    adminFee: 0,
                    deposit: false,
                    description: 'Should require no admin fee and no deposit'
                }
            },
            {
                name: 'Newlands Student House',
                expected: {
                    adminFee: 0,
                    deposit: true,
                    description: 'Should require no admin fee but deposit required'
                }
            }
        ];

        for (const scenario of testScenarios) {
            console.log(`\n=== Testing: ${scenario.name} ===`);
            console.log(`Expected: ${scenario.description}`);
            
            // Find the residence
            const residence = await Residence.findOne({ 
                name: { $regex: new RegExp(scenario.name, 'i') } 
            });
            
            if (residence) {
                const residenceName = residence.name.toLowerCase();
                const isStKilda = residenceName.includes('st kilda');
                const isBelvedere = residenceName.includes('belvedere');
                
                console.log(`Found residence: ${residence.name}`);
                console.log(`Is St Kilda: ${isStKilda}`);
                console.log(`Is Belvedere: ${isBelvedere}`);
                
                // Simulate payment calculation
                const roomPrice = residence.rooms.length > 0 ? residence.rooms[0].price : 0;
                let adminFeeRequired = 0;
                let depositRequired = 0;
                
                if (isStKilda) {
                    adminFeeRequired = 20;
                    depositRequired = roomPrice;
                } else if (!isBelvedere) {
                    depositRequired = roomPrice;
                }
                // Belvedere: both remain 0
                
                console.log(`Room price: $${roomPrice}`);
                console.log(`Admin fee required: $${adminFeeRequired}`);
                console.log(`Deposit required: $${depositRequired}`);
                
                // Validate against expected
                const adminFeeMatch = adminFeeRequired === scenario.expected.adminFee;
                const depositMatch = (depositRequired > 0) === scenario.expected.deposit;
                
                console.log(`Admin fee match: ${adminFeeMatch ? '✓' : '✗'}`);
                console.log(`Deposit match: ${depositMatch ? '✓' : '✗'}`);
                
                if (adminFeeMatch && depositMatch) {
                    console.log('✅ All tests passed for this residence');
                } else {
                    console.log('❌ Some tests failed for this residence');
                }
            } else {
                console.log(`❌ Residence not found: ${scenario.name}`);
            }
        }

    } catch (error) {
        console.error('Error testing payment logic:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from database');
    }
}

// Run the test
testPaymentLogic(); 