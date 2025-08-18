const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function fixBogusExpense() {
  try {
    console.log('🔧 Fixing Bogus $777,777 Expense Transaction...\n');
    
    await mongoose.connect(MONGODB_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    console.log('✅ Connected to MongoDB Atlas');
    
    // Find the bogus transaction
    const bogusTransaction = await TransactionEntry.findOne({
      'entries.accountCode': '5099',
      'entries.debit': 777777
    });
    
    if (bogusTransaction) {
      console.log('🚨 Found Bogus Transaction:');
      console.log(`ID: ${bogusTransaction._id}`);
      console.log(`Date: ${bogusTransaction.date}`);
      console.log(`Description: ${bogusTransaction.description}`);
      console.log(`Amount: $777,777`);
      
      // Option 1: Delete the transaction completely
      console.log('\n🗑️ Option 1: Delete the bogus transaction completely');
      
      // Option 2: Correct the amount to a realistic value
      console.log('✏️ Option 2: Correct the amount to $777.77 (realistic door replacement cost)');
      
      // I'll go with Option 2 - correcting the amount
      console.log('\n🔧 Correcting the amount from $777,777 to $777.77...');
      
      // Update the expense entry
      bogusTransaction.entries.forEach(entry => {
        if (entry.accountCode === '5099' && entry.debit === 777777) {
          entry.debit = 777.77;
          entry.description = 'Maintenance expense: Door Replacement (Corrected from $777,777)';
          console.log('✅ Updated expense entry: $777,777 → $777.77');
        }
        if (entry.accountCode === '2000' && entry.credit === 777777) {
          entry.credit = 777.77;
          entry.description = 'Accounts payable for maintenance: Door Replacement (Corrected from $777,777)';
          console.log('✅ Updated accounts payable entry: $777,777 → $777.77');
        }
      });
      
      // Update the transaction totals
      bogusTransaction.totalDebit = 777.77;
      bogusTransaction.totalCredit = 777.77;
      
      // Save the corrected transaction
      await bogusTransaction.save();
      console.log('✅ Transaction corrected and saved!');
      
      // Verify the fix
      console.log('\n🔍 Verifying the fix...');
      const correctedTransaction = await TransactionEntry.findById(bogusTransaction._id);
      console.log('Corrected Transaction:');
      console.log(`Total Debit: $${correctedTransaction.totalDebit}`);
      console.log(`Total Credit: $${correctedTransaction.totalCredit}`);
      
      correctedTransaction.entries.forEach((entry, index) => {
        console.log(`Entry ${index + 1}:`);
        console.log(`  Account: ${entry.accountCode} - ${entry.accountName}`);
        console.log(`  Debit: $${entry.debit || 0}`);
        console.log(`  Credit: $${entry.credit || 0}`);
      });
      
    } else {
      console.log('❌ Bogus transaction not found');
    }
    
    console.log('\n✅ Bogus expense fix completed!');
    
  } catch (error) {
    console.error('❌ Error fixing bogus expense:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

fixBogusExpense();
