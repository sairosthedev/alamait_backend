const mongoose = require('mongoose');
const TransactionEntry = require('../src/models/TransactionEntry');
const Payment = require('../src/models/Payment');
const Expense = require('../src/models/finance/Expense');
const Invoice = require('../src/models/Invoice');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/alamait', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function migrateTransactionDatesEnhanced() {
  try {
    console.log('🔄 Starting enhanced transaction date migration...');
    
    // Get all transaction entries
    const transactionEntries = await TransactionEntry.find({});
    console.log(`📊 Found ${transactionEntries.length} transaction entries to process`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let sampleDataCount = 0;
    
    for (const entry of transactionEntries) {
      try {
        // Check if this is sample data (string source instead of ObjectId)
        if (typeof entry.source === 'string' && !mongoose.Types.ObjectId.isValid(entry.source)) {
          console.log(`📝 Sample data entry ${entry._id}: ${entry.description} (date: ${entry.date.toDateString()})`);
          sampleDataCount++;
          
          // For sample data, check if the date is reasonable (not current date)
          const currentDate = new Date();
          const entryDate = new Date(entry.date);
          const daysDifference = Math.abs((currentDate - entryDate) / (1000 * 60 * 60 * 24));
          
          if (daysDifference < 1) {
            console.log(`⚠️  Sample data has current date - this might need manual review`);
          } else {
            console.log(`✅ Sample data has reasonable date`);
          }
          
          skippedCount++;
          continue;
        }
        
        // Handle real transaction entries with ObjectId sources
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
    
    console.log('\n📈 Enhanced Migration Summary:');
    console.log(`✅ Updated: ${updatedCount} entries`);
    console.log(`⏭️  Skipped: ${skippedCount} entries`);
    console.log(`📝 Sample data: ${sampleDataCount} entries`);
    console.log(`❌ Errors: ${errorCount} entries`);
    console.log(`📊 Total processed: ${transactionEntries.length} entries`);
    
    if (updatedCount > 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('💡 Your monthly financial reports should now show accurate data based on actual transaction dates.');
    } else if (sampleDataCount > 0) {
      console.log('\nℹ️  No real transaction updates needed!');
      console.log('📝 Found sample data entries that already have proper dates for testing.');
      console.log('💡 When you create real transactions through your application, they will automatically use correct dates.');
    } else {
      console.log('\nℹ️  No updates were needed - all dates are already correct!');
    }
    
    // Provide recommendations
    console.log('\n💡 Recommendations:');
    console.log('1. Test your monthly financial reports to ensure they show data correctly');
    console.log('2. When creating new transactions, ensure they reference real Payment/Expense/Invoice documents');
    console.log('3. The DoubleEntryAccountingService has been updated to use correct dates for new transactions');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the enhanced migration
migrateTransactionDatesEnhanced(); 