const mongoose = require('mongoose');
const Payment = require('./src/models/Payment');
const User = require('./src/models/User');
const Application = require('./src/models/Application');

// Test function to demonstrate advance payment scenarios
async function testAdvancePaymentScenarios() {
    try {
        // Connect to database (you'll need to update the connection string)
        await mongoose.connect('mongodb://localhost:27017/alamait_backend', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('Connected to database');

        // Test scenarios with strict chronological priority
        const testScenarios = [
            {
                name: 'Scenario 1: Strict Chronological Priority',
                description: 'Student must pay previous months before current, current before future',
                steps: [
                    {
                        month: '2024-06',
                        rentAmount: 160,
                        expected: 'Payment for previous month accepted'
                    },
                    {
                        month: '2024-07',
                        rentAmount: 160,
                        expected: 'Payment for current month accepted'
                    },
                    {
                        month: '2024-08',
                        rentAmount: 160,
                        expected: 'Payment for future month accepted'
                    }
                ]
            },
            {
                name: 'Scenario 2: Cannot Skip Previous Months',
                description: 'Student tries to pay current month when previous month is unpaid',
                steps: [
                    {
                        month: '2024-07',
                        rentAmount: 160,
                        expected: 'Should be rejected - must pay previous month first'
                    }
                ]
            },
            {
                name: 'Scenario 3: Cannot Pay Future Before Previous',
                description: 'Student tries to pay future month when previous months are unpaid',
                steps: [
                    {
                        month: '2024-08',
                        rentAmount: 160,
                        expected: 'Should be rejected - must pay all previous months first'
                    }
                ]
            },
            {
                name: 'Scenario 4: Partial Payment Chronological Order',
                description: 'Student pays partial amounts in chronological order',
                steps: [
                    {
                        month: '2024-06',
                        rentAmount: 60,
                        expected: 'Partial payment for previous month accepted'
                    },
                    {
                        month: '2024-06',
                        rentAmount: 100,
                        expected: 'Remaining balance for previous month accepted'
                    },
                    {
                        month: '2024-07',
                        rentAmount: 160,
                        expected: 'Payment for current month accepted'
                    }
                ]
            },
            {
                name: 'Scenario 5: Advance Payment Only After All Previous Paid',
                description: 'Student can only pay future months after all previous months are paid',
                steps: [
                    {
                        month: '2024-06',
                        rentAmount: 160,
                        expected: 'Previous month payment accepted'
                    },
                    {
                        month: '2024-07',
                        rentAmount: 160,
                        expected: 'Current month payment accepted'
                    },
                    {
                        month: '2024-09',
                        rentAmount: 160,
                        expected: 'Future month payment accepted (all previous paid)'
                    }
                ]
            }
        ];

        for (const scenario of testScenarios) {
            console.log(`\n=== ${scenario.name} ===`);
            console.log(`Description: ${scenario.description}`);
            
            for (let i = 0; i < scenario.steps.length; i++) {
                const step = scenario.steps[i];
                console.log(`\nStep ${i + 1}: Pay $${step.rentAmount} for ${step.month}`);
                console.log(`Expected: ${step.expected}`);
                
                // Simulate payment validation logic
                const result = await simulatePaymentValidation(step.month, step.rentAmount);
                console.log(`Result: ${result.success ? '✅ PASS' : '❌ FAIL'}`);
                if (!result.success) {
                    console.log(`Error: ${result.error}`);
                }
            }
        }

    } catch (error) {
        console.error('Error testing advance payment scenarios:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from database');
    }
}

// Simulate payment validation logic with strict chronological priority
async function simulatePaymentValidation(requestedMonth, rentAmount) {
    try {
        const currentDate = new Date();
        const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        
        // Simulate existing payments (in a real scenario, this would come from database)
        const existingPayments = [
            // Example: Student has already paid $60 for July
            // { paymentMonth: '2024-07', rentAmount: 60, status: 'Confirmed' }
        ];
        
        const roomPrice = 160; // Simulated room price
        
        // Generate all months in lease period (simplified for testing)
        const leaseMonths = ['2024-06', '2024-07', '2024-08', '2024-09', '2024-10'];
        
        // Find paid and unpaid months
        const paidMonths = existingPayments
            .filter(p => p.status === 'Confirmed')
            .map(p => p.paymentMonth);
        
        const unpaidMonths = leaseMonths.filter(m => !paidMonths.includes(m));
        
        // Priority: Previous months → Current month → Future months
        if (unpaidMonths.length > 0) {
            const oldestUnpaidMonth = unpaidMonths[0];
            
            // Check if requested month is before the oldest unpaid month
            if (requestedMonth < oldestUnpaidMonth) {
                return {
                    success: false,
                    error: `You must pay for the oldest unpaid month first: ${oldestUnpaidMonth}`
                };
            }
            
            // Check if requested month is a future month when there are unpaid months
            if (requestedMonth > currentMonth) {
                return {
                    success: false,
                    error: `You must pay for all unpaid months before paying for future months. Oldest unpaid month: ${oldestUnpaidMonth}`
                };
            }
        } else {
            // All months up to current are paid - can pay for future months
            if (requestedMonth <= currentMonth) {
                return {
                    success: false,
                    error: `All months up to ${currentMonth} are already paid. You can only pay for future months.`
                };
            }
        }
        
        // Check for overpayment for the specific month
        const monthPayments = existingPayments.filter(p => p.paymentMonth === requestedMonth);
        const alreadyPaid = monthPayments.reduce((sum, p) => sum + p.rentAmount, 0);
        const remaining = roomPrice - alreadyPaid;
        
        if (rentAmount > remaining) {
            return {
                success: false,
                error: `Overpayment for ${requestedMonth}. Only $${remaining} remaining`
            };
        }
        
        return { success: true };
        
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Run the test
testAdvancePaymentScenarios(); 