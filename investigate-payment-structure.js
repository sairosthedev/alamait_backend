const mongoose = require('mongoose');

// 🔐 User's actual MongoDB Atlas credentials
const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function investigatePaymentStructure() {
    try {
        console.log('🔍 Investigating Payment Transaction Structure...\n');
        
        // Connect to your MongoDB Atlas cluster
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Connected to your MongoDB Atlas cluster');
        
        // Get the database
        const db = mongoose.connection.db;
        
        // 1. Check payment transactions structure
        console.log('📊 ANALYZING PAYMENT TRANSACTIONS:');
        console.log('='.repeat(60));
        
        const paymentEntries = await db.collection('transactionentries').find({
            source: 'payment',
            status: 'posted'
        }).toArray();
        
        console.log(`Found ${paymentEntries.length} payment entries`);
        
        if (paymentEntries.length > 0) {
            // Show first few payment entries structure
            console.log('\n🔍 FIRST PAYMENT ENTRY STRUCTURE:');
            console.log(JSON.stringify(paymentEntries[0], null, 2));
            
            // Analyze the entries array structure
            console.log('\n📋 ANALYZING ENTRIES ARRAY:');
            if (paymentEntries[0].entries && paymentEntries[0].entries.length > 0) {
                paymentEntries[0].entries.forEach((entry, index) => {
                    console.log(`Entry ${index + 1}:`, {
                        account: entry.account,
                        accountType: entry.accountType,
                        debit: entry.debit,
                        credit: entry.credit,
                        description: entry.description
                    });
                });
            }
            
            // Check account types in payment entries
            console.log('\n🏦 ACCOUNT TYPES IN PAYMENT ENTRIES:');
            const accountTypes = new Set();
            const accountNames = new Set();
            
            paymentEntries.forEach(entry => {
                if (entry.entries) {
                    entry.entries.forEach(subEntry => {
                        if (subEntry.accountType) accountTypes.add(subEntry.accountType);
                        if (subEntry.account) accountNames.add(subEntry.account);
                    });
                }
            });
            
            console.log('Account Types found:', Array.from(accountTypes));
            console.log('Account Names found:', Array.from(accountNames));
            
            // Check for income accounts specifically
            console.log('\n💰 LOOKING FOR INCOME ACCOUNTS:');
            const incomeEntries = paymentEntries.filter(entry => 
                entry.entries && entry.entries.some(subEntry => 
                    subEntry.accountType === 'Income'
                )
            );
            
            console.log(`Entries with Income accounts: ${incomeEntries.length}`);
            
            if (incomeEntries.length > 0) {
                console.log('\n📈 SAMPLE INCOME ENTRY:');
                const sampleIncome = incomeEntries[0];
                console.log('Date:', sampleIncome.date);
                console.log('Amount:', sampleIncome.amount);
                console.log('Entries:', sampleIncome.entries.map(e => ({
                    account: e.account,
                    accountType: e.accountType,
                    debit: e.debit,
                    credit: e.credit
                })));
            }
        }
        
        // 2. Check rental accrual structure for comparison
        console.log('\n\n🔵 COMPARING WITH RENTAL ACCRUALS:');
        console.log('='.repeat(60));
        
        const accrualEntries = await db.collection('transactionentries').find({
            source: 'rental_accrual',
            status: 'posted'
        }).toArray();
        
        console.log(`Found ${accrualEntries.length} rental accrual entries`);
        
        if (accrualEntries.length > 0) {
            console.log('\n🔍 FIRST ACCRUAL ENTRY STRUCTURE:');
            console.log(JSON.stringify(accrualEntries[0], null, 2));
            
            console.log('\n📋 ACCRUAL ENTRIES ARRAY:');
            if (accrualEntries[0].entries && accrualEntries[0].entries.length > 0) {
                accrualEntries[0].entries.forEach((entry, index) => {
                    console.log(`Entry ${index + 1}:`, {
                        account: entry.account,
                        accountType: entry.accountType,
                        debit: entry.debit,
                        credit: entry.credit,
                        description: entry.description
                    });
                });
            }
        }
        
        // 3. Summary and recommendations
        console.log('\n\n🎯 SUMMARY & RECOMMENDATIONS:');
        console.log('='.repeat(60));
        
        if (paymentEntries.length > 0 && paymentEntries[0].entries) {
            const hasIncomeAccounts = paymentEntries.some(entry => 
                entry.entries && entry.entries.some(subEntry => 
                    subEntry.accountType === 'Income'
                )
            );
            
            if (!hasIncomeAccounts) {
                console.log('❌ ISSUE FOUND: Payment entries do not have Income account types');
                console.log('💡 SOLUTION: Payment entries need to include Income accounts in their entries array');
                console.log('   Example structure:');
                console.log('   entries: [');
                console.log('     { account: "Bank", accountType: "Asset", debit: 500, credit: 0 }');
                console.log('     { account: "Rental Income", accountType: "Income", debit: 0, credit: 500 }');
                console.log('   ]');
            } else {
                console.log('✅ Payment entries have Income accounts - checking calculation logic');
            }
        }
        
    } catch (error) {
        console.error('❌ Error investigating payment structure:', error);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

// Run the investigation
investigatePaymentStructure();
