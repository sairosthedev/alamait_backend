const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  description: { type: String },
  reference: { type: String },
  residence: { type: mongoose.Schema.Types.ObjectId, ref: 'Residence', required: true },
  residenceName: { type: String },
  receipt: {
    fileUrl: String,
    fileName: String,
    uploadDate: Date,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }
});

module.exports = mongoose.model('Transaction', TransactionSchema); 