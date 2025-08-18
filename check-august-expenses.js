const mongoose = require('mongoose');

// 🔐 User's actual MongoDB Atlas credentials
const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function checkAugustExpenses() {
    try {
        console.log('🔍 Checking August Expenses...\n');
        
        // Connect to your MongoDB Atlas cluster
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Connected to your MongoDB Atlas cluster');
        
        // Get the database
        const db = mongoose.connection.db;
        
        // Check all transaction entries in August 2025
        const augustStart = new Date('2025-08-01');
        const augustEnd = new Date('2025-08-31');
        
        console.log('📅 SEARCHING AUGUST 2025 TRANSACTIONS:');
        console.log('='.repeat(60));
        
        // 1. Check all transaction entries in August
        const augustEntries = await db.collection('transactionentries').find({
            date: { $gte: augustStart, $lte: augustEnd },
            status: 'posted'
        }).toArray();
        
        console.log(`Found ${augustEntries.length} total transaction entries in August 2025`);
        
        // 2. Group by source
        const bySource = {};
        augustEntries.forEach(entry => {
            const source = entry.source || 'unknown';
            if (!bySource[source]) bySource[source] = [];
            bySource[source].push(entry);
        });
        
        console.log('\n📊 BREAKDOWN BY SOURCE:');
        Object.keys(bySource).forEach(source => {
            console.log(`${source}: ${bySource[source].length} entries`);
        });
        
        // 3. Check for expense-related entries
        console.log('\n💸 LOOKING FOR EXPENSE ENTRIES:');
        console.log('='.repeat(60));
        
        // Check for expense_payment source
        const expensePayments = bySource['expense_payment'] || [];
        console.log(`expense_payment source: ${expensePayments.length} entries`);
        
        // Check for any entries with Expense accountType
        const expenseAccountEntries = augustEntries.filter(entry => 
            entry.entries && entry.entries.some(subEntry => 
                subEntry.accountType === 'Expense'
            )
        );
        
        console.log(`Entries with Expense accountType: ${expenseAccountEntries.length}`);
        
        if (expenseAccountEntries.length > 0) {
            console.log('\n🔍 FIRST EXPENSE ENTRY:');
            console.log(JSON.stringify(expenseAccountEntries[0], null, 2));
            
            console.log('\n📋 EXPENSE ENTRY DETAILS:');
            expenseAccountEntries[0].entries.forEach((entry, index) => {
                if (entry.accountType === 'Expense') {
                    console.log(`Expense Entry ${index + 1}:`, {
                        accountCode: entry.accountCode,
                        accountName: entry.accountName,
                        accountType: entry.accountType,
                        debit: entry.debit,
                        credit: entry.credit,
                        description: entry.description
                    });
                }
            });
        }
        
        // 4. Check for other potential expense sources
        console.log('\n🔍 CHECKING OTHER POTENTIAL EXPENSE SOURCES:');
        console.log('='.repeat(60));
        
        // Look for any entries that might be expenses but have different source
        const potentialExpenses = augustEntries.filter(entry => {
            // Check if any entry line item is an expense
            const hasExpense = entry.entries && entry.entries.some(subEntry => 
                subEntry.accountType === 'Expense'
            );
            
            // Check if description suggests it's an expense
            const descriptionSuggestsExpense = entry.description && 
                (entry.description.toLowerCase().includes('expense') || 
                 entry.description.toLowerCase().includes('maintenance') ||
                 entry.description.toLowerCase().includes('utility') ||
                 entry.description.toLowerCase().includes('repair'));
            
            return hasExpense || descriptionSuggestsExpense;
        });
        
        console.log(`Potential expense entries found: ${potentialExpenses.length}`);
        
        if (potentialExpenses.length > 0) {
            console.log('\n📋 POTENTIAL EXPENSE ENTRIES:');
            potentialExpenses.forEach((entry, index) => {
                console.log(`\nEntry ${index + 1}:`);
                console.log(`  Source: ${entry.source}`);
                console.log(`  Description: ${entry.description}`);
                console.log(`  Date: ${entry.date}`);
                console.log(`  Amount: $${entry.totalDebit || entry.totalCredit || 'N/A'}`);
                
                if (entry.entries) {
                    entry.entries.forEach((subEntry, subIndex) => {
                        if (subEntry.accountType === 'Expense') {
                            console.log(`    Expense Line ${subIndex + 1}: ${subEntry.accountName} - $${subEntry.debit || subEntry.credit}`);
                        }
                    });
                }
            });
        }
        
        // 5. Summary
        console.log('\n\n🎯 SUMMARY:');
        console.log('='.repeat(60));
        
        if (expenseAccountEntries.length === 0) {
            console.log('❌ No expense entries found in August 2025');
            console.log('💡 Possible reasons:');
            console.log('   1. Expenses are stored with different source field');
            console.log('   2. Expenses are stored in different collection');
            console.log('   3. Expenses don\'t have accountType: "Expense"');
            console.log('   4. No expenses were recorded in August');
        } else {
            console.log(`✅ Found ${expenseAccountEntries.length} expense entries in August`);
            console.log('💡 These should appear in your income statement');
        }
        
    } catch (error) {
        console.error('❌ Error checking August expenses:', error);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

// Run the check
checkAugustExpenses();
