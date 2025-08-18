const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');
const Account = require('./src/models/Account');
const Transaction = require('./src/models/Transaction');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

/**
 * Create Sample Rental Accruals
 * 
 * This script demonstrates how to create rental accrual entries that will:
 * 1. Show up in ACCRUAL BASIS income statement (when rent is due)
 * 2. NOT show up in CASH BASIS income statement (no cash movement)
 * 3. Create proper double-entry: Dr. AR, Cr. Rental Income
 */

async function createSampleRentalAccruals() {
    try {
        console.log('🏠 Creating Sample Rental Accruals\n');
        
        // Get required accounts
        const accountsReceivable = await Account.findOne({ code: '1100' }); // Accounts Receivable
        const rentalIncome = await Account.findOne({ code: '4001' }); // Rental Income
        
        if (!accountsReceivable || !rentalIncome) {
            console.log('❌ Required accounts not found. Creating them...');
            
            // Create accounts if they don't exist
            if (!accountsReceivable) {
                const arAccount = new Account({
                    code: '1100',
                    name: 'Accounts Receivable - Tenants',
                    type: 'Asset',
                    category: 'Current Assets',
                    description: 'Money owed by tenants for rent and services'
                });
                await arAccount.save();
                console.log('✅ Created Accounts Receivable account');
            }
            
            if (!rentalIncome) {
                const incomeAccount = new Account({
                    code: '4001',
                    name: 'Rental Income - School Accommodation',
                    type: 'Income',
                    category: 'Operating Revenue',
                    description: 'Income from student accommodation rentals'
                });
                await incomeAccount.save();
                console.log('✅ Created Rental Income account');
            }
        }
        
        // Create a sample user ID for createdBy
        const sampleUserId = new mongoose.Types.ObjectId();
        
        // Create sample rental accruals for different months
        const sampleAccruals = [
            {
                month: 'January',
                year: 2025,
                date: new Date('2025-01-01'),
                studentName: 'John Doe',
                room: 'Room 101',
                rentAmount: 300,
                description: 'January 2025 rent due'
            },
            {
                month: 'February',
                year: 2025,
                date: new Date('2025-02-01'),
                studentName: 'Jane Smith',
                room: 'Room 102',
                rentAmount: 300,
                description: 'February 2025 rent due'
            },
            {
                month: 'March',
                year: 2025,
                date: new Date('2025-03-01'),
                studentName: 'Mike Johnson',
                room: 'Room 103',
                rentAmount: 300,
                description: 'March 2025 rent due'
            }
        ];
        
        console.log('📝 Creating rental accrual entries...\n');
        
        for (const accrual of sampleAccruals) {
            // Create transaction entry directly (simpler approach)
            const transactionEntry = new TransactionEntry({
                transactionId: `RENTAL_ACCRUAL_${accrual.month}_${accrual.year}_${Date.now()}`,
                date: accrual.date,
                description: `Rent accrual: ${accrual.studentName} - ${accrual.month} ${accrual.year}`,
                reference: `RENT_${accrual.month}_${accrual.year}`,
                entries: [
                    // Debit: Accounts Receivable (Student owes money)
                    {
                        accountCode: '1100',
                        accountName: 'Accounts Receivable - Tenants',
                        accountType: 'Asset',
                        debit: accrual.rentAmount,
                        credit: 0,
                        description: `Rent due from ${accrual.studentName} - ${accrual.month} ${accrual.year}`
                    },
                    // Credit: Rental Income
                    {
                        accountCode: '4001',
                        accountName: 'Rental Income - School Accommodation',
                        accountType: 'Income',
                        debit: 0,
                        credit: accrual.rentAmount,
                        description: `Rental income accrued - ${accrual.studentName} - ${accrual.month} ${accrual.year}`
                    }
                ],
                totalDebit: accrual.rentAmount,
                totalCredit: accrual.rentAmount,
                source: 'rental_accrual',
                sourceId: new mongoose.Types.ObjectId(),
                sourceModel: 'TransactionEntry',
                createdBy: 'system',
                status: 'posted',
                metadata: {
                    studentName: accrual.studentName,
                    room: accrual.room,
                    accrualMonth: accrual.month,
                    accrualYear: accrual.year,
                    type: 'rent_accrual',
                    rentAmount: accrual.rentAmount
                }
            });
            
            await transactionEntry.save();
            
            console.log(`✅ Created rental accrual for ${accrual.studentName} - ${accrual.month} ${accrual.year}: $${accrual.rentAmount}`);
        }
        
        console.log('\n📊 Summary of created accruals:');
        console.log(`- Total rental accruals created: ${sampleAccruals.length}`);
        console.log(`- Total rental income accrued: $${sampleAccruals.reduce((sum, a) => sum + a.rentAmount, 0)}`);
        console.log(`- These will now show in ACCRUAL BASIS income statement`);
        console.log(`- These will NOT show in CASH BASIS income statement (no cash movement)`);
        
        console.log('\n🧪 Now run the test again to see the difference:');
        console.log('node test-accrual-vs-cash-income-statement.js');
        
    } catch (error) {
        console.error('❌ Error creating rental accruals:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the script
createSampleRentalAccruals();
