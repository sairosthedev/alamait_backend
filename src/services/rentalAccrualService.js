const Transaction = require('../models/Transaction');
const TransactionEntry = require('../models/TransactionEntry');
const Account = require('../models/Account');
const Invoice = require('../models/Invoice');
const mongoose = require('mongoose');

/**
 * Rental Accrual Service
 * 
 * Automatically records rental income when it becomes due (accrual basis)
 * Creates proper double-entry accounting entries for rent accruals
 * Manages student rent invoices and outstanding balances
 */
class RentalAccrualService {
    
    /**
     * Create monthly rent accrual for all active students
     * This records rent as income when it becomes due, not when paid
     */
    static async createMonthlyRentAccrual(month, year) {
        try {
            console.log(`🏠 Creating rent accruals for ${month}/${year}...`);
            
            // Get all active student applications for the month
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);
            
            // Find students with active leases for this month
            const activeStudents = await mongoose.connection.db
                .collection('applications')
                .find({
                    status: 'approved',
                    leaseStartDate: { $lte: endDate },
                    leaseEndDate: { $gte: startDate },
                    paymentStatus: { $ne: 'cancelled' }
                }).toArray();
            
            console.log(`Found ${activeStudents.length} active students for ${month}/${year}`);
            
            let accrualsCreated = 0;
            let errors = [];
            
            for (const student of activeStudents) {
                try {
                    const result = await this.createStudentRentAccrual(student, month, year);
                    if (result.success) {
                        accrualsCreated++;
                    } else {
                        errors.push({ student: student.firstName, error: result.error });
                    }
                } catch (error) {
                    errors.push({ student: student.firstName, error: error.message });
                }
            }
            
            console.log(`✅ Created ${accrualsCreated} rent accruals for ${month}/${year}`);
            if (errors.length > 0) {
                console.log(`⚠️ ${errors.length} errors occurred:`, errors);
            }
            
            return {
                success: true,
                accrualsCreated,
                errors,
                month,
                year
            };
            
        } catch (error) {
            console.error('❌ Error creating monthly rent accruals:', error);
            throw error;
        }
    }
    
    /**
     * Create rent accrual for a specific student
     */
    static async createStudentRentAccrual(student, month, year) {
        try {
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0);
            
            // Check if accrual already exists for this month
            const existingAccrual = await TransactionEntry.findOne({
                'metadata.studentId': student._id,
                'metadata.accrualMonth': month,
                'metadata.accrualYear': year,
                'metadata.type': 'rent_accrual'
            });
            
            if (existingAccrual) {
                return { success: false, error: 'Accrual already exists for this month' };
            }
            
            // Calculate rent amount (assuming $200/month from your data)
            const rentAmount = 200;
            const adminFee = 20; // St Kilda admin fee
            const totalAmount = rentAmount + adminFee;
            
            // Get required accounts
            const accountsReceivable = await Account.findOne({ code: '1100' }); // Accounts Receivable - Tenants
            const rentalIncome = await Account.findOne({ code: '4000' }); // Rental Income - Residential
            const adminIncome = await Account.findOne({ code: '4100' }); // Administrative Income
            
            if (!accountsReceivable || !rentalIncome || !adminIncome) {
                throw new Error('Required accounts not found');
            }
            
            // Create transaction
            const transaction = new Transaction({
                transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
                date: monthStart,
                description: `Rent accrual for ${student.firstName} ${student.lastName} - ${month}/${year}`,
                type: 'rental_accrual',
                status: 'posted',
                createdBy: 'system',
                metadata: {
                    studentId: student._id,
                    studentName: `${student.firstName} ${student.lastName}`,
                    residence: student.residence,
                    room: student.room,
                    accrualMonth: month,
                    accrualYear: year,
                    type: 'rent_accrual'
                }
            });
            
            await transaction.save();
            
            // Create double-entry accounting entries
            const entries = [
                // Debit: Accounts Receivable (Student owes money)
                {
                    accountCode: accountsReceivable.code,
                    accountName: accountsReceivable.name,
                    accountType: accountsReceivable.type,
                    debit: totalAmount,
                    credit: 0,
                    description: `Rent due from ${student.firstName} ${student.lastName} - ${month}/${year}`
                },
                // Credit: Rental Income
                {
                    accountCode: rentalIncome.code,
                    accountName: rentalIncome.name,
                    accountType: rentalIncome.type,
                    debit: 0,
                    credit: rentAmount,
                    description: `Rental income accrued - ${student.firstName} ${student.lastName} - ${month}/${year}`
                },
                // Credit: Administrative Income
                {
                    accountCode: adminIncome.code,
                    accountName: adminIncome.name,
                    accountType: adminIncome.type,
                    debit: 0,
                    credit: adminFee,
                    description: `Admin fee accrued - ${student.firstName} ${student.lastName} - ${month}/${year}`
                }
            ];
            
            // Create transaction entry
            const transactionEntry = new TransactionEntry({
                transactionId: transaction.transactionId,
                date: monthStart,
                description: `Rent accrual: ${student.firstName} ${student.lastName} - ${month}/${year}`,
                reference: student._id.toString(),
                entries,
                totalDebit: totalAmount,
                totalCredit: totalAmount,
                source: 'rental_accrual',
                sourceId: student._id,
                sourceModel: 'Application',
                createdBy: 'system',
                status: 'posted',
                metadata: {
                    studentId: student._id,
                    studentName: `${student.firstName} ${student.lastName}`,
                    residence: student.residence,
                    room: student.room,
                    accrualMonth: month,
                    accrualYear: year,
                    type: 'rent_accrual',
                    rentAmount,
                    adminFee,
                    totalAmount
                }
            });
            
            await transactionEntry.save();
            
            // Update transaction with entry reference
            transaction.entries = [transactionEntry._id];
            await transaction.save();
            
            // Create invoice for the student
            await this.createStudentInvoice(student, month, year, totalAmount, rentAmount, adminFee);
            
            console.log(`✅ Rent accrual created for ${student.firstName} ${student.lastName} - $${totalAmount}`);
            
            return {
                success: true,
                transactionId: transaction.transactionId,
                amount: totalAmount,
                student: `${student.firstName} ${student.lastName}`
            };
            
        } catch (error) {
            console.error(`❌ Error creating rent accrual for ${student.firstName}:`, error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Create invoice for student rent
     */
    static async createStudentInvoice(student, month, year, totalAmount, rentAmount, adminFee) {
        try {
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0);
            
            // Check if invoice already exists
            const existingInvoice = await Invoice.findOne({
                student: student._id,
                billingPeriod: `${year}-${month.toString().padStart(2, '0')}`,
                status: { $ne: 'cancelled' }
            });
            
            if (existingInvoice) {
                return existingInvoice; // Invoice already exists
            }
            
            // Generate invoice number
            const invoiceNumber = await this.generateInvoiceNumber();
            
            // Create invoice
            const invoice = new Invoice({
                invoiceNumber,
                student: student._id,
                residence: student.residence,
                room: student.room,
                billingPeriod: `${year}-${month.toString().padStart(2, '0')}`,
                billingStartDate: monthStart,
                billingEndDate: monthEnd,
                dueDate: new Date(year, month - 1, 5), // Due on 5th of month
                subtotal: totalAmount,
                totalAmount: totalAmount,
                balanceDue: totalAmount,
                charges: [
                    {
                        description: 'Monthly Rent',
                        amount: rentAmount,
                        quantity: 1,
                        total: rentAmount
                    },
                    {
                        description: 'Administrative Fee',
                        amount: adminFee,
                        quantity: 1,
                        total: adminFee
                    }
                ],
                status: 'sent',
                paymentStatus: 'unpaid',
                createdBy: 'system',
                metadata: {
                    type: 'monthly_rent',
                    month,
                    year,
                    rentAmount,
                    adminFee
                }
            });
            
            await invoice.save();
            console.log(`📄 Invoice created for ${student.firstName}: ${invoiceNumber}`);
            
            return invoice;
            
        } catch (error) {
            console.error('❌ Error creating student invoice:', error);
            throw error;
        }
    }
    
    /**
     * Generate unique invoice number
     */
    static async generateInvoiceNumber() {
        const year = new Date().getFullYear();
        const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
        
        // Get count of invoices for this month
        const count = await Invoice.countDocuments({
            billingPeriod: `${year}-${month}`
        });
        
        return `INV-${year}${month}-${(count + 1).toString().padStart(3, '0')}`;
    }
    
    /**
     * Get outstanding rent balances for all students
     */
    static async getOutstandingRentBalances() {
        try {
            // Get all unpaid invoices
            const unpaidInvoices = await Invoice.find({
                paymentStatus: 'unpaid',
                status: { $ne: 'cancelled' }
            }).populate('student', 'firstName lastName email');
            
            // Calculate outstanding balances by student
            const studentBalances = {};
            
            for (const invoice of unpaidInvoices) {
                const studentId = invoice.student._id.toString();
                const studentName = `${invoice.student.firstName} ${invoice.student.lastName}`;
                
                if (!studentBalances[studentId]) {
                    studentBalances[studentId] = {
                        studentId,
                        studentName,
                        email: invoice.student.email,
                        residence: invoice.residence,
                        room: invoice.room,
                        totalOutstanding: 0,
                        invoices: [],
                        oldestInvoice: null,
                        daysOverdue: 0
                    };
                }
                
                studentBalances[studentId].totalOutstanding += invoice.balanceDue;
                studentBalances[studentId].invoices.push({
                    invoiceNumber: invoice.invoiceNumber,
                    billingPeriod: invoice.billingPeriod,
                    amount: invoice.balanceDue,
                    dueDate: invoice.dueDate,
                    daysOverdue: Math.max(0, Math.floor((new Date() - invoice.dueDate) / (1000 * 60 * 60 * 24)))
                });
                
                // Track oldest invoice
                if (!studentBalances[studentId].oldestInvoice || 
                    invoice.dueDate < studentBalances[studentId].oldestInvoice) {
                    studentBalances[studentId].oldestInvoice = invoice.dueDate;
                    studentBalances[studentId].daysOverdue = Math.max(0, Math.floor((new Date() - invoice.dueDate) / (1000 * 60 * 60 * 24)));
                }
            }
            
            return Object.values(studentBalances);
            
        } catch (error) {
            console.error('❌ Error getting outstanding rent balances:', error);
            throw error;
        }
    }
    
    /**
     * Get rent accrual summary for a period
     */
    static async getRentAccrualSummary(month, year) {
        try {
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0);
            
            // Get all rent accruals for the month
            const accruals = await TransactionEntry.find({
                'metadata.type': 'rent_accrual',
                'metadata.accrualMonth': month,
                'metadata.accrualYear': year,
                status: 'posted'
            });
            
            let totalRentAccrued = 0;
            let totalAdminFeesAccrued = 0;
            let totalStudents = 0;
            
            for (const accrual of accruals) {
                totalRentAccrued += accrual.metadata.rentAmount || 0;
                totalAdminFeesAccrued += accrual.metadata.adminFee || 0;
                totalStudents++;
            }
            
            return {
                month,
                year,
                totalStudents,
                totalRentAccrued,
                totalAdminFeesAccrued,
                totalAmountAccrued: totalRentAccrued + totalAdminFeesAccrued,
                accruals: accruals.length
            };
            
        } catch (error) {
            console.error('❌ Error getting rent accrual summary:', error);
            throw error;
        }
    }
    
    /**
     * Reverse a rent accrual (for corrections)
     */
    static async reverseAccrual(transactionEntryId, user) {
        try {
            console.log(`🔄 Reversing rent accrual: ${transactionEntryId}`);
            
            const transactionEntry = await TransactionEntry.findById(transactionEntryId);
            if (!transactionEntry) {
                throw new Error('Transaction entry not found');
            }
            
            if (transactionEntry.metadata?.type !== 'rent_accrual') {
                throw new Error('Transaction entry is not a rent accrual');
            }
            
            // Create reversal transaction
            const transaction = new Transaction({
                transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
                date: new Date(),
                description: `Reversal of rent accrual: ${transactionEntry.description}`,
                type: 'rental_accrual_reversal',
                status: 'posted',
                createdBy: user.email || 'system',
                metadata: {
                    originalTransactionId: transactionEntry._id,
                    reversalType: 'rent_accrual',
                    originalAmount: transactionEntry.totalDebit,
                    studentId: transactionEntry.metadata.studentId,
                    studentName: transactionEntry.metadata.studentName,
                    month: transactionEntry.metadata.accrualMonth,
                    year: transactionEntry.metadata.accrualYear
                }
            });
            
            await transaction.save();
            
            // Create reversal transaction entry
            const reversalEntry = new TransactionEntry({
                transactionId: transaction.transactionId,
                date: new Date(),
                description: `Reversal: ${transactionEntry.description}`,
                reference: transactionEntry._id.toString(),
                entries: [
                    // Reverse the original entries
                    {
                        accountCode: transactionEntry.entries[0].accountCode, // Accounts Receivable
                        accountName: transactionEntry.entries[0].accountName,
                        accountType: transactionEntry.entries[0].accountType,
                        debit: 0, // Reverse: was debit, now credit
                        credit: transactionEntry.entries[0].debit, // Reverse: was debit, now credit
                        description: `Reversal: ${transactionEntry.entries[0].description}`
                    },
                    {
                        accountCode: transactionEntry.entries[1].accountCode, // Rental Income
                        accountName: transactionEntry.entries[0].accountName,
                        accountType: transactionEntry.entries[1].accountType,
                        debit: transactionEntry.entries[1].credit, // Reverse: was credit, now debit
                        credit: 0, // Reverse: was credit, now debit
                        description: `Reversal: ${transactionEntry.entries[1].description}`
                    },
                    {
                        accountCode: transactionEntry.entries[2].accountCode, // Admin Income
                        accountName: transactionEntry.entries[0].accountName,
                        accountType: transactionEntry.entries[2].accountType,
                        debit: transactionEntry.entries[2].credit, // Reverse: was credit, now debit
                        credit: 0, // Reverse: was credit, now debit
                        description: `Reversal: ${transactionEntry.entries[2].description}`
                    }
                ],
                totalDebit: transactionEntry.totalCredit,
                totalCredit: transactionEntry.totalDebit,
                source: 'rental_accrual_reversal',
                sourceId: transactionEntry._id,
                sourceModel: 'TransactionEntry',
                createdBy: user.email || 'system',
                status: 'posted',
                metadata: {
                    originalTransactionId: transactionEntry._id,
                    reversalType: 'rent_accrual',
                    originalAmount: transactionEntry.totalDebit,
                    studentId: transactionEntry.metadata.studentId,
                    studentName: transactionEntry.metadata.studentName,
                    month: transactionEntry.metadata.accrualMonth,
                    year: transactionEntry.metadata.accrualYear
                }
            });
            
            await reversalEntry.save();
            
            // Update transaction with entry reference
            transaction.entries = [reversalEntry._id];
            await transaction.save();
            
            console.log(`✅ Rent accrual reversed successfully`);
            
            return {
                success: true,
                originalTransactionId: transactionEntry._id,
                reversalTransactionId: transaction._id,
                reversedAmount: transactionEntry.totalDebit
            };
            
        } catch (error) {
            console.error('❌ Error reversing rent accrual:', error);
            throw error;
        }
    }
}

module.exports = RentalAccrualService;
