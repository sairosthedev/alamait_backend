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

async function migrateAddResidenceToTransactions() {
  try {
    console.log('🔄 Starting residence migration for TransactionEntries...');
    
    // First, let's add the residence field to the TransactionEntry schema
    console.log('📝 Adding residence field to TransactionEntry schema...');
    
    // Get all transaction entries
    const transactionEntries = await TransactionEntry.find({});
    console.log(`📊 Found ${transactionEntries.length} transaction entries to process`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const entry of transactionEntries) {
      try {
        let residenceId = null;
        
        // Get residence from source document
        switch (entry.sourceModel) {
          case 'Payment':
            const payment = await Payment.findById(entry.sourceId);
            if (payment && payment.residence) {
              residenceId = payment.residence;
            }
            break;
            
          case 'Expense':
            const expense = await Expense.findById(entry.sourceId);
            if (expense && expense.residence) {
              residenceId = expense.residence;
            }
            break;
            
          case 'Invoice':
            const invoice = await Invoice.findById(entry.sourceId);
            if (invoice && invoice.residence) {
              residenceId = invoice.residence;
            }
            break;
            
          default:
            console.log(`⚠️ Unknown source model: ${entry.sourceModel} for entry ${entry._id}`);
            skippedCount++;
            continue;
        }
        
        if (residenceId) {
          // Update the transaction entry with residence field
          await TransactionEntry.findByIdAndUpdate(entry._id, {
            residence: residenceId
          });
          console.log(`✅ Updated entry ${entry._id} with residence ${residenceId}`);
          updatedCount++;
        } else {
          console.log(`⚠️ No residence found for entry ${entry._id} (${entry.description})`);
          skippedCount++;
        }
        
      } catch (error) {
        console.error(`❌ Error processing entry ${entry._id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📈 Migration Summary:');
    console.log(`✅ Updated: ${updatedCount} entries`);
    console.log(`⏭️ Skipped: ${skippedCount} entries`);
    console.log(`❌ Errors: ${errorCount} entries`);
    console.log(`📊 Total processed: ${transactionEntries.length} entries`);
    
    if (updatedCount > 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('💡 TransactionEntries now have residence information for better filtering.');
    } else {
      console.log('\nℹ️ No updates were needed - all entries already have residence info or no residence found.');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the migration
migrateAddResidenceToTransactions(); 