const mongoose = require('mongoose');
const Message = require('../src/models/Message');

async function updateAllMessagesToRead() {
  await mongoose.connect('mongodb://localhost:27017/alamait_backend'); // update if needed

  const result = await Message.updateMany(
    { status: { $exists: false } }, // only update if status is missing
    { $set: { status: 'read' } }
  );

  console.log(`Updated ${result.modifiedCount} messages to status 'read'`);
  await mongoose.disconnect();
}

updateAllMessagesToRead().catch(err => {
  console.error(err);
  process.exit(1);
}); 