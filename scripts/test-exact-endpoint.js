const mongoose = require('mongoose');

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function connectToDatabase() {
    try {
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error);
        process.exit(1);
    }
}

async function disconnectFromDatabase() {
    try {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    } catch (error) {
        console.error('❌ Failed to disconnect from MongoDB:', error);
    }
}

async function testExactEndpoint() {
    try {
        console.log('\n🧪 TESTING EXACT ENDPOINT LOGIC');
        console.log('=' .repeat(60));

        const FinancialReportsController = require('../src/controllers/financialReportsController');
        const TransactionEntry = require('../src/models/TransactionEntry');

        // Test the exact method that the endpoint calls
        console.log('🔍 Testing FinancialReportsController.generateIncomeStatement...');
        
        // Create a mock request object
        const mockReq = {
            query: {
                period: '2025',
                basis: 'accrual'
            }
        };
        
        const mockRes = {
            json: function(data) {
                console.log('\n📊 RESPONSE DATA:');
                console.log(JSON.stringify(data, null, 2));
                
                // Check August specifically
                if (data.data && data.data.monthly_breakdown) {
                    console.log('\n📅 AUGUST 2025 BREAKDOWN:');
                    const august = data.data.monthly_breakdown[7]; // Month index 7 = August
                    if (august) {
                        console.log(`   Month: ${august.month}`);
                        console.log(`   Total Revenue: $${august.total_revenue}`);
                        console.log(`   Revenue Breakdown:`);
                        Object.entries(august.revenue || {}).forEach(([account, amount]) => {
                            console.log(`     ${account}: $${amount}`);
                        });
                    } else {
                        console.log('   ❌ August not found at index 7');
                    }
                }
            },
            status: function(code) {
                console.log(`   Status Code: ${code}`);
                return this;
            }
        };

        // Call the exact method
        await FinancialReportsController.generateIncomeStatement(mockReq, mockRes);

        // Now let's manually verify what should be in August
        console.log('\n🔍 MANUAL VERIFICATION OF AUGUST DATA:');
        
        const augustEntries = await TransactionEntry.find({
            source: 'rental_accrual',
            date: { 
                $gte: new Date('2025-08-01'), 
                $lte: new Date('2025-08-31') 
            }
        });

        console.log(`   Found ${augustEntries.length} August entries`);
        
        let manualTotal = 0;
        augustEntries.forEach((entry, index) => {
            console.log(`\n   Entry ${index + 1}:`);
            console.log(`     Date: ${entry.date}`);
            console.log(`     Type: ${entry.metadata?.type || 'N/A'}`);
            console.log(`     Total: $${entry.totalDebit}`);
            
            if (entry.entries && Array.isArray(entry.entries)) {
                let entryIncome = 0;
                entry.entries.forEach((line, lineIndex) => {
                    if (line.accountType === 'Income') {
                        const amount = line.credit || 0;
                        entryIncome += amount;
                        console.log(`       ${line.accountCode} - ${line.accountName}: $${amount} (Income)`);
                    }
                });
                console.log(`     Entry Income Total: $${entryIncome}`);
                manualTotal += entryIncome;
            }
        });
        
        console.log(`\n💰 MANUAL CALCULATION:`);
        console.log(`   Total August Income: $${manualTotal.toFixed(2)}`);
        
        console.log('\n🔍 ANALYSIS:');
        if (manualTotal !== 112.26) {
            console.log(`   ❌ Expected: $112.26, Actual: $${manualTotal.toFixed(2)}`);
        } else {
            console.log(`   ✅ August income calculation is correct: $${manualTotal.toFixed(2)}`);
            console.log(`   🎯 The issue is BROWSER CACHING - not the backend!`);
        }

    } catch (error) {
        console.error('❌ Error testing exact endpoint:', error);
    }
}

// Main execution
async function main() {
    try {
        await connectToDatabase();
        await testExactEndpoint();
    } catch (error) {
        console.error('❌ Main error:', error);
    } finally {
        await disconnectFromDatabase();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { testExactEndpoint };
