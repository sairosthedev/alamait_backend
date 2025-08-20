const User = require('../models/User');
const Application = require('../models/Application');
const Debtor = require('../models/Debtor');
const Transaction = require('../models/Transaction');
const TransactionEntry = require('../models/TransactionEntry');
const Payment = require('../models/Payment');

/**
 * Service to handle student re-applications and preserve financial history
 */
class ReapplicationService {
    
    /**
     * Check if a student can re-apply and get their financial history
     * @param {string} email - Student's email address
     * @returns {Promise<Object>} Re-application eligibility and financial history
     */
    static async checkReapplicationEligibility(email) {
        try {
            console.log(`🔍 Checking re-application eligibility for: ${email}`);
            
            // Find existing user
            const existingUser = await User.findOne({ email: email.toLowerCase() });
            if (!existingUser) {
                return {
                    canReapply: false,
                    reason: 'No existing student account found',
                    message: 'This email is not associated with any existing student account.'
                };
            }
            
            // Check if user has any active applications
            const activeApplication = await Application.findOne({
                email: email.toLowerCase(),
                status: { $in: ['pending', 'approved', 'waitlisted'] }
            });
            
            if (activeApplication) {
                return {
                    canReapply: false,
                    reason: 'Active application exists',
                    message: 'You already have an active application. Please wait for the current application to be processed.',
                    existingApplication: {
                        id: activeApplication._id,
                        status: activeApplication.status,
                        applicationCode: activeApplication.applicationCode,
                        submittedDate: activeApplication.applicationDate
                    }
                };
            }
            
            // Check if user has previous financial history (debtor account)
            const previousDebtor = await Debtor.findOne({ user: existingUser._id });
            let financialHistory = null;
            
            if (previousDebtor) {
                console.log(`💰 Found previous debtor account: ${previousDebtor.debtorCode}`);
                
                // Get previous financial history from transactions
                const previousTransactions = await Transaction.find({
                    'metadata.applicationId': { $exists: true },
                    $or: [
                        { 'metadata.applicationId': previousDebtor.applicationCode },
                        { 'metadata.applicationId': existingUser._id.toString() }
                    ]
                }).sort({ date: -1 }).limit(20);
                
                financialHistory = {
                    debtorCode: previousDebtor.debtorCode,
                    previousBalance: previousDebtor.currentBalance,
                    totalPaid: previousDebtor.totalPaid,
                    totalOwed: previousDebtor.totalOwed,
                    lastPaymentDate: previousDebtor.lastPaymentDate,
                    lastPaymentAmount: previousDebtor.lastPaymentAmount,
                    transactionCount: previousTransactions.length,
                    recentTransactions: previousTransactions.map(t => ({
                        date: t.date,
                        description: t.description,
                        amount: t.totalDebit || t.totalCredit,
                        type: t.source,
                        transactionId: t.transactionId
                    })),
                    paymentHistory: await this.getPaymentHistory(existingUser._id),
                    leaseHistory: await this.getLeaseHistory(existingUser._id)
                };
                
                console.log(`📊 Financial history summary:`, {
                    totalPaid: financialHistory.totalPaid,
                    totalOwed: financialHistory.totalOwed,
                    transactionCount: financialHistory.transactionCount,
                    paymentCount: financialHistory.paymentHistory.length
                });
            }
            
            return {
                canReapply: true,
                existingUser: {
                    id: existingUser._id,
                    firstName: existingUser.firstName,
                    lastName: existingUser.lastName,
                    email: existingUser.email,
                    phone: existingUser.phone
                },
                previousDebtor: previousDebtor ? {
                    debtorCode: previousDebtor.debtorCode,
                    accountCode: previousDebtor.accountCode,
                    status: previousDebtor.status
                } : null,
                financialHistory: financialHistory,
                message: 'You are eligible to re-apply. Your previous financial history will be preserved.'
            };
            
        } catch (error) {
            console.error('Error checking re-application eligibility:', error);
            throw new Error('Failed to check re-application eligibility');
        }
    }
    
    /**
     * Get payment history for a student
     * @param {string} userId - Student's user ID
     * @returns {Promise<Array>} Payment history
     */
    static async getPaymentHistory(userId) {
        try {
            const payments = await Payment.find({ student: userId })
                .sort({ date: -1 })
                .limit(20)
                .select('amount paymentMethod date status paymentMonth components');
            
            return payments.map(payment => ({
                amount: payment.amount,
                method: payment.paymentMethod,
                date: payment.date,
                status: payment.status,
                month: payment.paymentMonth,
                components: payment.components
            }));
        } catch (error) {
            console.error('Error getting payment history:', error);
            return [];
        }
    }
    
    /**
     * Get lease history for a student
     * @param {string} userId - Student's user ID
     * @returns {Promise<Array>} Lease history
     */
    static async getLeaseHistory(userId) {
        try {
            const applications = await Application.find({ 
                student: userId,
                status: { $in: ['approved', 'expired'] }
            })
            .sort({ applicationDate: -1 })
            .select('applicationCode startDate endDate allocatedRoom residence status');
            
            return applications.map(app => ({
                applicationCode: app.applicationCode,
                startDate: app.startDate,
                endDate: app.endDate,
                room: app.allocatedRoom,
                status: app.status
            }));
        } catch (error) {
            console.error('Error getting lease history:', error);
            return [];
        }
    }
    
    /**
     * Create a re-application for an existing student
     * @param {Object} reapplicationData - Re-application data
     * @param {string} reapplicationData.email - Student's email
     * @param {string} reapplicationData.firstName - First name
     * @param {string} reapplicationData.lastName - Last name
     * @param {string} reapplicationData.phone - Phone number
     * @param {string} reapplicationData.preferredRoom - Preferred room
     * @param {Date} reapplicationData.startDate - Lease start date
     * @param {Date} reapplicationData.endDate - Lease end date
     * @param {string} reapplicationData.residence - Residence ID
     * @returns {Promise<Object>} Created re-application
     */
    static async createReapplication(reapplicationData) {
        try {
            console.log(`🔄 Creating re-application for: ${reapplicationData.email}`);
            
            // Check eligibility first
            const eligibility = await this.checkReapplicationEligibility(reapplicationData.email);
            if (!eligibility.canReapply) {
                throw new Error(eligibility.reason);
            }
            
            // Generate unique application code
            const applicationCode = `APP${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
            
            // Create re-application with metadata
            const reapplication = new Application({
                ...reapplicationData,
                email: reapplicationData.email.toLowerCase(),
                applicationCode: applicationCode,
                status: 'pending',
                applicationDate: new Date(),
                requestType: 'renewal',
                isReapplication: true,
                previousStudentId: eligibility.existingUser.id,
                previousDebtorCode: eligibility.previousDebtor?.debtorCode || null,
                previousFinancialSummary: eligibility.financialHistory ? {
                    debtorCode: eligibility.financialHistory.debtorCode,
                    previousBalance: eligibility.financialHistory.previousBalance,
                    totalPaid: eligibility.financialHistory.totalPaid,
                    totalOwed: eligibility.financialHistory.totalOwed,
                    lastPaymentDate: eligibility.financialHistory.lastPaymentDate,
                    lastPaymentAmount: eligibility.financialHistory.lastPaymentAmount,
                    transactionCount: eligibility.financialHistory.transactionCount,
                    recentTransactions: eligibility.financialHistory.recentTransactions.slice(0, 10)
                } : null
            });
            
            await reapplication.save();
            
            console.log(`✅ Re-application created successfully:`, {
                applicationCode: reapplication.applicationCode,
                email: reapplication.email,
                isReapplication: reapplication.isReapplication,
                previousDebtorCode: reapplication.previousDebtorCode
            });
            
            return {
                success: true,
                reapplication: reapplication,
                eligibility: eligibility,
                message: 'Re-application created successfully. Your previous financial history will be preserved.'
            };
            
        } catch (error) {
            console.error('Error creating re-application:', error);
            throw new Error(`Failed to create re-application: ${error.message}`);
        }
    }
    
    /**
     * Link re-application to existing financial records
     * @param {string} applicationId - Re-application ID
     * @returns {Promise<Object>} Linking result
     */
    static async linkToFinancialHistory(applicationId) {
        try {
            console.log(`🔗 Linking re-application to financial history: ${applicationId}`);
            
            const application = await Application.findById(applicationId);
            if (!application) {
                throw new Error('Application not found');
            }
            
            if (!application.isReapplication) {
                throw new Error('This is not a re-application');
            }
            
            // Find existing debtor account
            const existingDebtor = await Debtor.findOne({ 
                debtorCode: application.previousDebtorCode 
            });
            
            if (!existingDebtor) {
                throw new Error('Previous debtor account not found');
            }
            
            // Update debtor account to link to new application
            await Debtor.findByIdAndUpdate(existingDebtor._id, {
                application: application._id,
                applicationCode: application.applicationCode,
                status: 'active',
                updatedAt: new Date()
            });
            
            console.log(`✅ Linked re-application ${application.applicationCode} to debtor ${existingDebtor.debtorCode}`);
            
            return {
                success: true,
                debtorCode: existingDebtor.debtorCode,
                message: 'Re-application successfully linked to existing financial history'
            };
            
        } catch (error) {
            console.error('Error linking re-application to financial history:', error);
            throw new Error(`Failed to link re-application: ${error.message}`);
        }
    }
    
    /**
     * Get comprehensive re-application summary
     * @param {string} applicationId - Application ID
     * @returns {Promise<Object>} Re-application summary
     */
    static async getReapplicationSummary(applicationId) {
        try {
            const application = await Application.findById(applicationId);
            if (!application) {
                throw new Error('Application not found');
            }
            
            if (!application.isReapplication) {
                throw new Error('This is not a re-application');
            }
            
            // Get previous financial history
            let financialSummary = null;
            if (application.previousDebtorCode) {
                const previousDebtor = await Debtor.findOne({ 
                    debtorCode: application.previousDebtorCode 
                });
                
                if (previousDebtor) {
                    const previousTransactions = await Transaction.find({
                        'metadata.applicationId': { $exists: true },
                        $or: [
                            { 'metadata.applicationId': previousDebtor.applicationCode },
                            { 'metadata.applicationId': application.previousStudentId }
                        ]
                    }).sort({ date: -1 }).limit(10);
                    
                    financialSummary = {
                        debtorCode: previousDebtor.debtorCode,
                        previousBalance: previousDebtor.currentBalance,
                        totalPaid: previousDebtor.totalPaid,
                        totalOwed: previousDebtor.totalOwed,
                        lastPaymentDate: previousDebtor.lastPaymentDate,
                        lastPaymentAmount: previousDebtor.lastPaymentAmount,
                        transactionCount: previousTransactions.length,
                        recentTransactions: previousTransactions.map(t => ({
                            date: t.date,
                            description: t.description,
                            amount: t.totalDebit || t.totalCredit,
                            type: t.source
                        }))
                    };
                }
            }
            
            return {
                application: {
                    id: application._id,
                    applicationCode: application.applicationCode,
                    status: application.status,
                    isReapplication: application.isReapplication,
                    previousStudentId: application.previousStudentId,
                    previousDebtorCode: application.previousDebtorCode
                },
                financialSummary: financialSummary,
                message: 'Re-application summary retrieved successfully'
            };
            
        } catch (error) {
            console.error('Error getting re-application summary:', error);
            throw new Error(`Failed to get re-application summary: ${error.message}`);
        }
    }
}

module.exports = ReapplicationService;
