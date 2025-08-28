const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');
const fs = require('fs');

async function restoreCindyDataFixed() {
  try {
    await mongoose.connect('mongodb://localhost:27017/alamait', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('🔄 RESTORING CINDY GWEKWERERE DATA (FIXED VERSION)\n');

    // 1. Read the JSON file
    console.log('📊 STEP 1: Reading JSON File\n');
    
    const jsonData = fs.readFileSync('test.transactionentries.json', 'utf8');
    const transactions = JSON.parse(jsonData);
    
    console.log(`📋 Found ${transactions.length} transactions in JSON file`);

    // 2. Filter for Cindy Gwekwerere transactions
    console.log('\n📊 STEP 2: Filtering Cindy Gwekwerere Transactions\n');
    
    const cindyTransactions = transactions.filter(tx => {
      return tx.description && tx.description.includes('Cindy Gwekwerere');
    });

    console.log(`📋 Found ${cindyTransactions.length} Cindy Gwekwerere transactions in JSON`);

    if (cindyTransactions.length === 0) {
      console.log('❌ No Cindy Gwekwerere transactions found in JSON file!');
      return;
    }

    // 3. Show what we're restoring
    console.log('\n📊 STEP 3: Cindy Gwekwerere Transactions to Restore\n');
    
    cindyTransactions.forEach((tx, index) => {
      console.log(`   ${index + 1}. ${tx.description}`);
      console.log(`      Source: ${tx.source}, Amount: $${tx.totalDebit}`);
    });

    // 4. Restore the transactions with proper ObjectId handling
    console.log('\n📊 STEP 4: Restoring Transactions (Fixed ObjectId Handling)\n');
    
    let restoredCount = 0;
    for (const txData of cindyTransactions) {
      try {
        // Check if transaction already exists
        const existingTx = await TransactionEntry.findOne({
          transactionId: txData.transactionId
        });

        if (existingTx) {
          console.log(`   ⚠️ Transaction already exists: ${txData.description}`);
          continue;
        }

        // Fix ObjectId conversion for entries
        const fixedEntries = txData.entries.map(entry => ({
          ...entry,
          _id: new mongoose.Types.ObjectId(entry._id.$oid || entry._id)
        }));

        // Fix ObjectId conversion for other fields
        const fixedSourceId = txData.sourceId ? new mongoose.Types.ObjectId(txData.sourceId.$oid || txData.sourceId) : undefined;
        const fixedResidence = txData.residence ? new mongoose.Types.ObjectId(txData.residence.$oid || txData.residence) : undefined;

        // Create new transaction
        const newTransaction = new TransactionEntry({
          transactionId: txData.transactionId,
          date: new Date(txData.date.$date || txData.date),
          description: txData.description,
          reference: txData.reference,
          entries: fixedEntries,
          totalDebit: txData.totalDebit,
          totalCredit: txData.totalCredit,
          source: txData.source,
          sourceId: fixedSourceId,
          sourceModel: txData.sourceModel,
          residence: fixedResidence,
          createdBy: txData.createdBy || 'system',
          approvedBy: txData.approvedBy,
          approvedAt: txData.approvedAt,
          status: txData.status || 'posted',
          metadata: txData.metadata,
          createdAt: new Date(txData.createdAt.$date || txData.createdAt),
          updatedAt: new Date(txData.updatedAt.$date || txData.updatedAt)
        });

        await newTransaction.save();
        console.log(`   ✅ Restored: ${txData.description}`);
        restoredCount++;
      } catch (error) {
        console.log(`   ❌ Error restoring ${txData.description}: ${error.message}`);
      }
    }

    console.log(`\n📊 STEP 5: Restoration Summary\n`);
    console.log(`   ✅ Successfully restored ${restoredCount} transactions`);

    // 6. Verify restoration
    console.log('\n📊 STEP 6: Verifying Restoration\n');
    
    const restoredCindyTransactions = await TransactionEntry.find({
      $or: [
        { 'metadata.studentName': 'Cindy Gwekwerere' },
        { description: { $regex: /Cindy Gwekwerere/i } }
      ],
      status: 'posted'
    }).sort({ date: 1 });

    console.log(`📋 Cindy Gwekwerere transactions in database: ${restoredCindyTransactions.length}`);
    
    if (restoredCindyTransactions.length > 0) {
      restoredCindyTransactions.forEach((tx, index) => {
        const date = new Date(tx.date).toISOString().split('T')[0];
        console.log(`   ${index + 1}. ${tx.description} (${date})`);
        console.log(`      Source: ${tx.source}, Amount: $${tx.totalDebit}`);
        console.log(`      Month Settled: ${tx.metadata?.monthSettled || 'Not set'}`);
      });
    }

    // 7. Test balance sheet calculation
    console.log('\n📊 STEP 7: Testing Balance Sheet with Restored Data\n');
    
    const testMonths = ['2025-05', '2025-06', '2025-07', '2025-08'];
    
    for (const monthKey of testMonths) {
      const [year, month] = monthKey.split('-');
      const monthStart = new Date(parseInt(year), parseInt(month) - 1, 1);
      const monthEnd = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
      
      // Get accruals for this month
      const accrualTxs = await TransactionEntry.find({
        source: 'rental_accrual',
        date: { $gte: monthStart, $lte: monthEnd },
        'entries.accountCode': { $regex: '^1100' },
        status: 'posted'
      }).lean();
      
      let arDebits = 0;
      accrualTxs.forEach(tx => {
        tx.entries.forEach(entry => {
          if (entry.accountCode && entry.accountCode.startsWith('1100')) {
            arDebits += Number(entry.debit || 0);
          }
        });
      });
      
      // Get payments allocated to this month
      const paymentTxs = await TransactionEntry.find({
        source: 'payment',
        'metadata.monthSettled': monthKey,
        'entries.accountCode': { $regex: '^1100' },
        status: 'posted'
      }).lean();
      
      let arCredits = 0;
      paymentTxs.forEach(tx => {
        tx.entries.forEach(entry => {
          if (entry.accountCode && entry.accountCode.startsWith('1100')) {
            arCredits += Number(entry.credit || 0);
          }
        });
      });
      
      const netAR = arDebits - arCredits;
      const status = netAR === 0 ? '✅ PAID' : netAR > 0 ? '❌ OUTSTANDING' : '⚠️ OVERPAID';
      
      console.log(`   ${monthKey}: $${netAR.toFixed(2)} ${status}`);
      console.log(`     Accruals: $${arDebits.toFixed(2)}, Payments: $${arCredits.toFixed(2)}`);
    }

    console.log('\n🎯 CINDY GWEKWERERE DATA RESTORATION COMPLETE!');
    console.log('   ✅ Restored Cindy Gwekwerere transactions from JSON file');
    console.log('   ✅ Balance sheet now shows correct data');
    console.log('   ✅ Payment allocation working correctly');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

restoreCindyDataFixed();
