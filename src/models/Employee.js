const mongoose = require('mongoose');

const bankDetailsSchema = new mongoose.Schema({
    bankName: { type: String, trim: true },
    accountName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    branch: { type: String, trim: true },
    currency: { type: String, trim: true, default: 'USD' }
}, { _id: false });

const employeeSchema = new mongoose.Schema({
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    jobTitle: { type: String, required: true, trim: true },
    department: { type: String, trim: true },
    salary: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    notes: { type: String, trim: true },
    bankDetails: bankDetailsSchema,
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

employeeSchema.index({ email: 1 });
employeeSchema.index({ lastName: 1, firstName: 1 });
employeeSchema.index({ jobTitle: 1, department: 1, status: 1 });

employeeSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`.trim();
});

module.exports = mongoose.model('Employee', employeeSchema);



