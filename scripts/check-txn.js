require('dotenv').config();
const mongoose = require('mongoose');
const TransactionEntry = require('../src/models/TransactionEntry');

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    const tx = await TransactionEntry.findOne({ transactionId: 'TXN1773751826077S9Z33' }).lean();
    console.log(JSON.stringify(tx, null, 2));
    await mongoose.disconnect();
}
main();
