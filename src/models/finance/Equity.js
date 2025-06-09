const mongoose = require('mongoose');

const equitySchema = new mongoose.Schema({
    category: {
        type: String,
        required: true
    },
    value: {
        type: Number,
        required: true,
        get: v => parseFloat(v),
        set: v => parseFloat(v)
    },
    description: String,
    type: {
        type: String,
        required: true
    },
    entity: {
        type: String,
        required: true
    }
}, { 
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true }
});

module.exports = mongoose.model('Equity', equitySchema, 'equity'); 