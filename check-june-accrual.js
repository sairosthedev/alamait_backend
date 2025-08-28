const mongoose = require('mongoose');
require('dotenv').config();

async function checkJuneAccrual() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    const TransactionEntry = require('./src/models/TransactionEntry');
    
    // Find June 2025 accrual for Cindy
    const juneAccrual = await TransactionEntry.findOne({
      'entries.accountCode': { $regex: '^1100-68adf1dc088169424e25c8ab' },
      date: { 
        $gte: new Date('2025-06-01'), 
        $lt: new Date('2025-07-01') 
      },
      source: 'rental_accrual'
    });
    
    if (juneAccrual) {
      console.log('\n📅 June 2025 Accrual Found:');
      console.log('ID:', juneAccrual._id);
      console.log('Date:', juneAccrual.date);
      console.log('Description:', juneAccrual.description);
      console.log('Source:', juneAccrual.source);
      
      // Show AR entry
      const arEntry = juneAccrual.entries.find(e => e.accountCode.startsWith('1100-') && e.debit > 0);
      if (arEntry) {
        console.log('AR Amount:', arEntry.debit);
      }
      
      if (juneAccrual.metadata) {
        console.log('Metadata:', JSON.stringify(juneAccrual.metadata, null, 2));
      }
    } else {
      console.log('\n❌ No June 2025 accrual found');
      
      // Check what accruals exist for Cindy
      const allAccruals = await TransactionEntry.find({
        'entries.accountCode': { $regex: '^1100-68adf1dc088169424e25c8ab' },
        source: 'rental_accrual'
      }).sort({ date: 1 });
      
      console.log('\n📊 All Accruals for Cindy:');
      allAccruals.forEach(acc => {
        const accDate = new Date(acc.date);
        const monthKey = `${accDate.getFullYear()}-${String(accDate.getMonth() + 1).padStart(2, '0')}`;
        const arEntry = acc.entries.find(e => e.accountCode.startsWith('1100-') && e.debit > 0);
        console.log(`  ${monthKey}: $${arEntry?.debit || 0} (ID: ${acc._id})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

checkJuneAccrual();
