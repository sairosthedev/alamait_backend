const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');
const Payment = require('./src/models/Payment');
const Expense = require('./src/models/finance/Expense');
const Invoice = require('./src/models/Invoice');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/alamait', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function migrateTransactionDates() {
  try {
    console.log('🔄 Starting transaction date migration...');
    
    // Get all transaction entries
    const transactionEntries = await TransactionEntry.find({});
    console.log(`📊 Found ${transactionEntries.length} transaction entries to process`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const entry of transactionEntries) {
      try {
        let sourceDate = null;
        let sourceDocument = null;
        
        // Find the source document based on source and sourceModel
        switch (entry.sourceModel) {
          case 'Payment':
            sourceDocument = await Payment.findById(entry.source);
            if (sourceDocument) {
              sourceDate = sourceDocument.date || sourceDocument.createdAt;
            }
            break;
            
          case 'Expense':
            sourceDocument = await Expense.findById(entry.source);
            if (sourceDocument) {
              sourceDate = sourceDocument.paidDate || sourceDocument.date || sourceDocument.createdAt;
            }
            break;
            
          case 'Invoice':
            sourceDocument = await Invoice.findById(entry.source);
            if (sourceDocument) {
              sourceDate = sourceDocument.date || sourceDocument.createdAt;
            }
            break;
            
          default:
            console.log(`⚠️  Unknown source model: ${entry.sourceModel} for entry ${entry._id}`);
            skippedCount++;
            continue;
        }
        
        if (!sourceDocument) {
          console.log(`⚠️  Source document not found for ${entry.sourceModel} ID: ${entry.source}`);
          skippedCount++;
          continue;
        }
        
        if (!sourceDate) {
          console.log(`⚠️  No date found in source document ${entry.sourceModel} ID: ${entry.source}`);
          skippedCount++;
          continue;
        }
        
        // Check if the date is already correct
        const currentDate = new Date(entry.date);
        const sourceDateObj = new Date(sourceDate);
        
        if (currentDate.getTime() === sourceDateObj.getTime()) {
          console.log(`✅ Date already correct for entry ${entry._id} (${entry.description})`);
          skippedCount++;
          continue;
        }
        
        // Update the transaction entry with the correct date
        await TransactionEntry.findByIdAndUpdate(entry._id, {
          date: sourceDate
        });
        
        console.log(`✅ Updated entry ${entry._id}: ${currentDate.toDateString()} → ${sourceDateObj.toDateString()} (${entry.description})`);
        updatedCount++;
        
      } catch (error) {
        console.error(`❌ Error processing entry ${entry._id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📈 Migration Summary:');
    console.log(`✅ Updated: ${updatedCount} entries`);
    console.log(`⏭️  Skipped: ${skippedCount} entries`);
    console.log(`❌ Errors: ${errorCount} entries`);
    console.log(`📊 Total processed: ${transactionEntries.length} entries`);
    
    if (updatedCount > 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('💡 Your monthly financial reports should now show accurate data based on actual transaction dates.');
    } else {
      console.log('\nℹ️  No updates were needed - all dates are already correct!');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the migration
migrateTransactionDates(); 