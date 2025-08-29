require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/alamait';
  await mongoose.connect(uri, { autoIndex: false });
  const Account = require('../src/models/Account');

  // List all 2000 accounts
  const apParents = await Account.find({ code: '2000' }).lean();
  console.log(`Found ${apParents.length} Accounts Payable (code=2000) records`);
  for (const ap of apParents) {
    const children = await Account.find({ parentAccount: ap._id }).lean();
    console.log(`- 2000 _id=${ap._id.toString()} name=${ap.name} children=${children.length}`);
    if (children.length) {
      console.log(children.map(c => ({ _id: c._id.toString(), code: c.code, name: c.name, parentAccount: c.parentAccount && c.parentAccount.toString() })));
    }
  }

  // Also show a sample known child by code pattern 2004*
  const sampleChildren = await Account.find({ code: { $regex: '^2004' } }).lean();
  for (const ch of sampleChildren) {
    console.log(`Child ${ch.code} parentAccount=${ch.parentAccount && ch.parentAccount.toString()}`);
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


