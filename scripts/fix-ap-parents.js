require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/alamait';
  await mongoose.connect(uri, { autoIndex: false });
  const Account = require('../src/models/Account');

  // Identify the canonical 2000 parent the app is using
  const current2000 = await Account.findOne({ code: '2000' });
  if (!current2000) {
    console.error('No account with code 2000 found. Abort.');
    process.exit(1);
  }
  console.log(`Using 2000 parent _id=${current2000._id.toString()} name=${current2000.name}`);

  // Find all AP children not pointing to this parent
  const filter = {
    type: 'Liability',
    $or: [
      { subcategory: 'Accounts Payable' },
      { name: /Accounts Payable/i }
    ],
    parentAccount: { $ne: current2000._id }
  };

  const mismatched = await Account.find(filter).lean();
  console.log(`Found ${mismatched.length} AP children with mismatched parentAccount`);

  const bulkOps = [];
  for (const acc of mismatched) {
    console.log(`- Fixing ${acc.code} ${acc.name} parent=${acc.parentAccount ? acc.parentAccount.toString() : 'null'} -> ${current2000._id.toString()}`);
    bulkOps.push({
      updateOne: {
        filter: { _id: acc._id },
        update: {
          $set: {
            parentAccount: current2000._id,
            level: 2,
            'metadata.parent': '2000',
            'metadata.hasParent': 'true'
          }
        }
      }
    });
  }

  if (bulkOps.length) {
    const res = await Account.bulkWrite(bulkOps, { ordered: false });
    console.log('Bulk update result:', res.result || res);
  } else {
    console.log('No updates required.');
  }

  // Verify children count now
  // Fix self-parent if present (2000 should not be its own child)
  await Account.updateOne({ _id: current2000._id, parentAccount: current2000._id }, { $set: { parentAccount: null, level: 1 } });

  const children = await Account.find({ parentAccount: current2000._id }).lean();
  console.log(`Now 2000 has ${children.length} children:`);
  console.log(children.map(c => ({ code: c.code, name: c.name })));

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


