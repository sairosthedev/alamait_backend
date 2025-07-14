const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');

// Update with your actual username and password
const MONGODB_URI = 'mongodb+srv://<username>:<password>@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority';
const RESIDENCE_ID = '67d723cf20f89c4ae69804f3'; // St Kilda Student House

console.log('Connecting to MongoDB URI:', MONGODB_URI);

async function updateTransactions() {
  try {
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const result = await Transaction.updateMany(
      { residence: { $exists: false } },
      { $set: { residence: RESIDENCE_ID } }
    );
    console.log(`Updated ${result.modifiedCount} transactions to have residence ${RESIDENCE_ID}`);
  } catch (err) {
    console.error('Update failed:', err);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

updateTransactions(); 