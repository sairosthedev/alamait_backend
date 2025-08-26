require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/alamait';
  await mongoose.connect(uri, { autoIndex: false });
  const Account = require('../src/models/Account');
  const Debtor = require('../src/models/Debtor');
  const User = require('../src/models/User');

  const mainAR = await Account.findOne({ code: '1100' });
  if (!mainAR) throw new Error('Main AR account 1100 not found');

  const debtors = await Debtor.find({}).populate('user', 'firstName lastName');
  let created = 0, existing = 0;

  for (const d of debtors) {
    const code = `1100-${d.user}`;
    let acc = await Account.findOne({ code });
    if (acc) { existing++; continue; }
    acc = new Account({
      code,
      name: `Accounts Receivable - ${d.user?.firstName || ''} ${d.user?.lastName || ''}`.trim() || `Accounts Receivable - ${d.user}`,
      type: 'Asset',
      category: 'Current Assets',
      subcategory: 'Accounts Receivable',
      description: 'Student-specific AR control account',
      isActive: true,
      parentAccount: mainAR._id,
      level: 2,
      sortOrder: 0,
      metadata: new Map([
        ['parent', '1100'],
        ['hasParent', 'true'],
        ['studentId', String(d.user)]
      ])
    });
    await acc.save();
    created++;
  }

  console.log({ created, existing });
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });


