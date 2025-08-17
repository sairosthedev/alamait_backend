const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Debtor = require('../models/Debtor');
const User = require('../models/User');
const Residence = require('../models/Residence');

class PaymentService {
    /**
     * Create a payment with automatic user ID mapping
     * This ensures 100% payment-to-debtor mapping success
     */
    static async createPaymentWithUserMapping(paymentData, createdBy) {
        try {
            console.log('🔧 Creating payment with automatic user ID mapping...');
            
            // Validate required fields
            if (!paymentData.student || !paymentData.residence || !paymentData.totalAmount) {
                throw new Error('Missing required fields: student, residence, totalAmount');
            }

            // 🆕 NEW: Automatically fetch user ID for proper debtor mapping
            const { userId, debtor } = await this.getUserIdForPayment(paymentData.student, paymentData.residence);
            
            // Create payment with user ID
            const payment = new Payment({
                ...paymentData,
                user: userId,                    // ← ALWAYS include user ID for proper mapping
                createdBy: createdBy
            });

            await payment.save();
            console.log(`✅ Payment created successfully with user ID: ${userId}`);

            // 🆕 NEW: Validate payment mapping
            await this.validatePaymentMapping(payment);

            return { payment, debtor, userId };
            
        } catch (error) {
            console.error('❌ Error creating payment with user mapping:', error);
            throw error;
        }
    }

    /**
     * Get user ID for payment by checking existing debtor or creating new one
     */
    static async getUserIdForPayment(studentId, residenceId) {
        try {
            console.log(`🔍 Getting user ID for payment - Student: ${studentId}, Residence: ${residenceId}`);
            
            // Check if student exists
            const student = await User.findById(studentId).select('firstName lastName email');
            if (!student) {
                throw new Error(`Student not found with ID: ${studentId}`);
            }

            // Try to find existing debtor first
            let debtor = await Debtor.findOne({ user: studentId });
            
            if (debtor) {
                console.log(`✅ Found existing debtor for student: ${student.firstName} ${student.lastName}`);
                console.log(`   Debtor ID: ${debtor._id}`);
                console.log(`   Debtor Code: ${debtor.debtorCode}`);
                console.log(`   User ID: ${debtor.user}`);
                
                return {
                    userId: debtor.user,
                    debtor: debtor,
                    isNewDebtor: false
                };
            } else {
                console.log(`🏗️  No existing debtor found, will create one`);
                
                // Create new debtor account
                const { createDebtorForStudent } = require('./debtorService');
                
                debtor = await createDebtorForStudent(student, {
                    residenceId: residenceId,
                    createdBy: studentId, // Use student as creator for now
                    startDate: new Date(),
                    roomPrice: 0 // Will be updated when room is assigned
                });
                
                console.log(`✅ Created new debtor account for student: ${student.firstName} ${student.lastName}`);
                console.log(`   Debtor ID: ${debtor._id}`);
                console.log(`   Debtor Code: ${debtor.debtorCode}`);
                console.log(`   User ID: ${debtor.user}`);
                
                return {
                    userId: debtor.user,
                    debtor: debtor,
                    isNewDebtor: true
                };
            }
            
        } catch (error) {
            console.error('❌ Error getting user ID for payment:', error);
            throw error;
        }
    }

    /**
     * Validate that payment is properly mapped to a debtor
     */
    static async validatePaymentMapping(payment) {
        try {
            console.log(`🔍 Validating payment mapping for payment: ${payment.paymentId}`);
            
            if (!payment.user) {
                throw new Error('Payment missing user ID field');
            }

            const debtor = await Debtor.findOne({ user: payment.user });
            if (!debtor) {
                throw new Error(`No debtor found for user ID: ${payment.user}`);
            }

            console.log(`✅ Payment mapping validated successfully`);
            console.log(`   Debtor Code: ${debtor.debtorCode}`);
            console.log(`   Room Number: ${debtor.roomNumber || 'Not assigned'}`);
            console.log(`   Residence: ${debtor.residence || 'Not assigned'}`);
            
            return {
                isValid: true,
                debtor: debtor,
                debtorCode: debtor.debtorCode,
                roomNumber: debtor.roomNumber,
                residence: debtor.residence
            };
            
        } catch (error) {
            console.error('❌ Payment mapping validation failed:', error);
            throw error;
        }
    }

    /**
     * Create payment from invoice (with automatic user ID mapping)
     */
    static async createPaymentFromInvoice(invoiceId, paymentDetails, createdBy) {
        try {
            console.log(`🔧 Creating payment from invoice: ${invoiceId}`);
            
            // Get invoice and debtor information
            const Invoice = require('../models/Invoice');
            const invoice = await Invoice.findById(invoiceId).populate('debtor');
            
            if (!invoice) {
                throw new Error(`Invoice not found: ${invoiceId}`);
            }

            if (!invoice.debtor) {
                throw new Error(`Invoice has no debtor information: ${invoiceId}`);
            }

            // Create payment with user ID from debtor
            const paymentData = {
                paymentId: `INV-${invoice.invoiceNumber}-${Date.now()}`,
                student: invoice.debtor.user,
                residence: invoice.residence,
                room: invoice.room,
                totalAmount: paymentDetails.amount,
                paymentMonth: this.getCurrentPaymentMonth(),
                date: new Date(),
                method: paymentDetails.method || 'Bank Transfer',
                status: 'Confirmed',
                description: `Payment for invoice ${invoice.invoiceNumber}`,
                rentAmount: paymentDetails.rentAmount || 0,
                adminFee: paymentDetails.adminFee || 0,
                deposit: paymentDetails.deposit || 0
            };

            return await this.createPaymentWithUserMapping(paymentData, createdBy);
            
        } catch (error) {
            console.error('❌ Error creating payment from invoice:', error);
            throw error;
        }
    }

    /**
     * Create payment for existing debtor (with automatic user ID mapping)
     */
    static async createPaymentForDebtor(debtorId, paymentDetails, createdBy) {
        try {
            console.log(`🔧 Creating payment for debtor: ${debtorId}`);
            
            // Get debtor information
            const debtor = await Debtor.findById(debtorId);
            if (!debtor) {
                throw new Error(`Debtor not found: ${debtorId}`);
            }

            // Create payment with user ID from debtor
            const paymentData = {
                paymentId: `DEBTOR-${debtor.debtorCode}-${Date.now()}`,
                student: debtor.user,
                residence: debtor.residence,
                room: debtor.roomNumber,
                totalAmount: paymentDetails.amount,
                paymentMonth: this.getCurrentPaymentMonth(),
                date: new Date(),
                method: paymentDetails.method || 'Bank Transfer',
                status: 'Confirmed',
                description: paymentDetails.description || `Payment for debtor ${debtor.debtorCode}`,
                rentAmount: paymentDetails.rentAmount || 0,
                adminFee: paymentDetails.adminFee || 0,
                deposit: paymentDetails.deposit || 0
            };

            return await this.createPaymentWithUserMapping(paymentData, createdBy);
            
        } catch (error) {
            console.error('❌ Error creating payment for debtor:', error);
            throw error;
        }
    }

    /**
     * Get current payment month in YYYY-MM format
     */
    static getCurrentPaymentMonth() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }

    /**
     * Update existing payment with user ID (for legacy payments)
     */
    static async updatePaymentWithUserId(paymentId, userId) {
        try {
            console.log(`🔧 Updating payment ${paymentId} with user ID: ${userId}`);
            
            const payment = await Payment.findById(paymentId);
            if (!payment) {
                throw new Error(`Payment not found: ${paymentId}`);
            }

            // Validate that user ID corresponds to a debtor
            const debtor = await Debtor.findOne({ user: userId });
            if (!debtor) {
                throw new Error(`No debtor found for user ID: ${userId}`);
            }

            // Update payment with user ID
            payment.user = userId;
            payment.updatedAt = new Date();
            await payment.save();

            console.log(`✅ Payment ${paymentId} updated with user ID: ${userId}`);
            
            // Validate mapping
            await this.validatePaymentMapping(payment);
            
            return payment;
            
        } catch (error) {
            console.error('❌ Error updating payment with user ID:', error);
            throw error;
        }
    }

    /**
     * Get all payments for a specific debtor
     */
    static async getPaymentsByDebtor(debtorId) {
        try {
            const debtor = await Debtor.findById(debtorId);
            if (!debtor) {
                throw new Error(`Debtor not found: ${debtorId}`);
            }

            return await Payment.find({ user: debtor.user })
                .sort({ date: -1 })
                .populate('residence', 'name')
                .populate('student', 'firstName lastName email');
                
        } catch (error) {
            console.error('❌ Error getting payments by debtor:', error);
            throw error;
        }
    }

    /**
     * Get payment statistics for a debtor
     */
    static async getDebtorPaymentStats(debtorId) {
        try {
            const debtor = await Debtor.findById(debtorId);
            if (!debtor) {
                throw new Error(`Debtor not found: ${debtorId}`);
            }

            const payments = await Payment.find({ user: debtor.user });
            
            const stats = {
                totalPayments: payments.length,
                totalAmount: payments.reduce((sum, p) => sum + p.totalAmount, 0),
                totalRent: payments.reduce((sum, p) => sum + (p.rentAmount || 0), 0),
                totalAdminFees: payments.reduce((sum, p) => sum + (p.adminFee || 0), 0),
                totalDeposits: payments.reduce((sum, p) => sum + (p.deposit || 0), 0),
                lastPaymentDate: payments.length > 0 ? Math.max(...payments.map(p => p.date)) : null,
                paymentMethods: payments.reduce((acc, p) => {
                    acc[p.method] = (acc[p.method] || 0) + 1;
                    return acc;
                }, {})
            };

            return stats;
            
        } catch (error) {
            console.error('❌ Error getting debtor payment stats:', error);
            throw error;
        }
    }
}

module.exports = PaymentService;
