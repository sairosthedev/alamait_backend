require('dotenv').config();
require('../src/config/database')();
const TransactionEntry = require('../src/models/TransactionEntry');
const Account = require('../src/models/Account');

(async () => {
  const accounts = await Account.find();
  const lowerNameToId = Object.fromEntries(accounts.map(a => [a.name.toLowerCase(), a._id]));
  const mapping = {
    'supplies': 'Administrative Expenses',
    'water': 'Utilities - Water',
    'rentals received': 'Rental Income - School Accommodation',
    'rental received': 'Rental Income - School Accommodation',
    'rent received': 'Rental Income - School Accommodation',
    'rent': 'Rental Income - School Accommodation',
    'cleaning supplies': 'Administrative Expenses'
  };
  const entries = await TransactionEntry.find({ account: null });
  for (const entry of entries) {
    const desc = entry.description?.trim().toLowerCase();
    let accountName = mapping[desc];
    if (!accountName) {
      // Try partial match for water, rent, etc.
      if (desc && desc.includes('water')) accountName = 'Utilities - Water';
      if (desc && desc.includes('rent')) accountName = 'Rental Income - School Accommodation';
      if (desc && desc.includes('supply')) accountName = 'Administrative Expenses';
    }
    if (accountName && lowerNameToId[accountName.toLowerCase()]) {
      entry.account = lowerNameToId[accountName.toLowerCase()];
      await entry.save();
      console.log('Updated entry', entry._id, 'with account', accountName);
    } else {
      console.log('No mapping for entry', entry._id, 'description:', entry.description);
    }
  }
  process.exit();
})(); 