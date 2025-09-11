const mongoose = require('mongoose');
const TransactionEntry = require('../models/TransactionEntry');
const Debtor = require('../models/Debtor');
const Account = require('../models/Account');
const { createAuditLog } = require('../utils/auditLogger');
const { getStudentInfo, getStudentName } = require('../utils/studentUtils');

class SecurityDepositReversalService {
    /**
     * Handle unpaid security deposit reversal when student leaves
     * This reverses the liability that was created at lease start but never paid
     * 
     * @param {string} studentId - The student's ID
     * @param {string} studentName - The student's name
     * @param {Object} adminUser - The admin user performing the reversal
     * @param {string} reason - Reason for the reversal (e.g., "Student left without paying")
     * @returns {Object} - Reversal summary
     */
    static async reverseUnpaidSecurityDeposit(studentId, studentName, adminUser, reason = 'Student left without paying deposit') {
        const session = await mongoose.startSession();
        
        // Get student information (including expired students) if name not provided
        let actualStudentName = studentName;
        if (!actualStudentName) {
            actualStudentName = await getStudentName(studentId);
            console.log(`📝 Retrieved student name: ${actualStudentName} for student ID: ${studentId}`);
        }
        
        let reversalSummary = {
            studentId,
            studentName: actualStudentName,
            success: false,
            transactionId: null,
            depositAmount: 0,
            entries: [],
            errors: []
        };

        try {
            const result = await session.withTransaction(async () => {
                console.log(`🔄 Starting security deposit reversal for ${actualStudentName} (${studentId})`);
                
                // 1. Check if a reversal has already been created for this student (FIRST CHECK)
                const existingReversal = await TransactionEntry.findOne({
                    'metadata.studentId': studentId,
                    'metadata.type': 'security_deposit_reversal',
                    status: 'posted'
                }).session(session);

                if (existingReversal) {
                    throw new Error(`Security deposit reversal already exists for ${studentName}. Transaction ID: ${existingReversal.transactionId}`);
                }
                
                // 2. Find the lease start transaction that created the deposit liability
                const leaseStartTransaction = await TransactionEntry.findOne({
                    'metadata.studentId': studentId,
                    'metadata.type': 'lease_start',
                    status: 'posted'
                }).session(session);

                if (!leaseStartTransaction) {
                    throw new Error(`No lease start transaction found for student ${studentName}`);
                }

                console.log(`✅ Found lease start transaction: ${leaseStartTransaction.transactionId}`);

                // 2. Find the security deposit entry in the lease start transaction
                const depositEntry = leaseStartTransaction.entries.find(entry => 
                    entry.accountCode === '2020' && 
                    entry.accountName.toLowerCase().includes('deposit') &&
                    entry.accountType === 'Liability' &&
                    entry.credit > 0
                );

                if (!depositEntry) {
                    throw new Error(`No security deposit liability found in lease start transaction for ${studentName}`);
                }

                const depositAmount = depositEntry.credit;
                console.log(`💰 Found security deposit liability: $${depositAmount}`);

                // 3. Check if the deposit was actually paid
                const depositPayments = await TransactionEntry.find({
                    'metadata.studentId': studentId,
                    'entries.accountCode': { $regex: `^1100-${studentId}` },
                    'entries.description': { $regex: /deposit.*payment/i },
                    status: 'posted'
                }).session(session);

                let totalDepositPaid = 0;
                depositPayments.forEach(payment => {
                    payment.entries.forEach(entry => {
                        if (entry.accountCode === `1100-${studentId}` && 
                            entry.description.toLowerCase().includes('deposit') &&
                            entry.credit > 0) {
                            totalDepositPaid += entry.credit;
                        }
                    });
                });

                console.log(`💳 Total deposit paid: $${totalDepositPaid}`);

                if (totalDepositPaid >= depositAmount) {
                    throw new Error(`Deposit was already paid ($${totalDepositPaid} >= $${depositAmount}). No reversal needed.`);
                }

                // 4. Create reversal transaction
                const reversalAmount = depositAmount - totalDepositPaid;
                console.log(`🔄 Creating reversal for unpaid amount: $${reversalAmount}`);

                const reversalTransactionId = `DEPOSIT_REVERSAL_${Date.now()}`;
                
                const reversalEntries = [
                    {
                        accountCode: '2020',
                        accountName: 'Tenant Security Deposits',
                        accountType: 'Liability',
                        debit: reversalAmount,
                        credit: 0,
                        description: `Security deposit liability reversal - ${studentName} (unpaid deposit)`
                    },
                    {
                        accountCode: `1100-${studentId}`,
                        accountName: `Accounts Receivable - ${studentName}`,
                        accountType: 'Asset',
                        debit: 0,
                        credit: reversalAmount,
                        description: `AR reversal for unpaid security deposit - ${studentName}`
                    }
                ];

                const reversalTransaction = new TransactionEntry({
                    transactionId: reversalTransactionId,
                    date: new Date(),
                    description: `Security deposit reversal - ${studentName} (${reason})`,
                    reference: reversalTransactionId,
                    entries: reversalEntries,
                    totalDebit: reversalAmount,
                    totalCredit: reversalAmount,
                    source: 'manual',
                    sourceId: adminUser.id,
                    sourceModel: 'User',
                    createdBy: adminUser.id,
                    approvedBy: adminUser.id,
                    approvedAt: new Date(),
                    status: 'posted',
                    metadata: {
                        type: 'security_deposit_reversal',
                        studentId: studentId,
                        studentName: studentName,
                        originalDepositAmount: depositAmount,
                        paidAmount: totalDepositPaid,
                        reversalAmount: reversalAmount,
                        reason: reason,
                        originalTransactionId: leaseStartTransaction.transactionId
                    }
                });

                await reversalTransaction.save({ session });

                // 5. Update debtor record if it exists
                const debtor = await Debtor.findOne({ user: studentId }).session(session);
                if (debtor) {
                    debtor.currentBalance = Math.max(0, debtor.currentBalance - reversalAmount);
                    debtor.totalOwed = Math.max(0, debtor.totalOwed - reversalAmount);
                    debtor.notes = (debtor.notes || '') + `\n[${new Date().toISOString().split('T')[0]}] Security deposit reversal: $${reversalAmount} (${reason})`;
                    await debtor.save({ session });
                    console.log(`✅ Updated debtor record for ${studentName}`);
                }

                // 6. Create audit log
                await createAuditLog({
                    action: 'security_deposit_reversal',
                    collection: 'TransactionEntry',
                    recordId: reversalTransaction._id,
                    userId: adminUser.id,
                    details: JSON.stringify({
                        studentId,
                        studentName,
                        reversalAmount,
                        reason,
                        originalTransactionId: leaseStartTransaction.transactionId
                    })
                });

                // Update reversal summary
                reversalSummary.success = true;
                reversalSummary.transactionId = reversalTransactionId;
                reversalSummary.depositAmount = reversalAmount;
                reversalSummary.entries = reversalEntries;

                console.log(`✅ Security deposit reversal completed successfully`);
                console.log(`   Transaction ID: ${reversalTransactionId}`);
                console.log(`   Reversal Amount: $${reversalAmount}`);
                console.log(`   Reason: ${reason}`);

                return reversalSummary;
            });

            return result;

        } catch (error) {
            console.error('❌ Error in security deposit reversal:', error);
            reversalSummary.errors.push({
                step: 'Security deposit reversal',
                error: error.message
            });
            return reversalSummary;
        } finally {
            await session.endSession();
        }
    }

    /**
     * Get security deposit status for a student
     * @param {string} studentId - The student's ID
     * @returns {Object} - Deposit status information
     */
    static async getSecurityDepositStatus(studentId) {
        try {
            console.log(`🔍 Checking security deposit status for student: ${studentId}`);

            // Get student information (including expired students)
            const studentInfo = await getStudentInfo(studentId);
            const studentName = await getStudentName(studentId);

            // Find lease start transaction
            const leaseStartTransaction = await TransactionEntry.findOne({
                'metadata.studentId': studentId,
                'metadata.type': 'lease_start',
                status: 'posted'
            });

            if (!leaseStartTransaction) {
                return {
                    studentId,
                    studentName,
                    studentInfo,
                    hasLeaseStart: false,
                    depositAmount: 0,
                    paidAmount: 0,
                    outstandingAmount: 0,
                    status: 'no_lease_start'
                };
            }

            // Find deposit entry
            const depositEntry = leaseStartTransaction.entries.find(entry => 
                entry.accountCode === '2020' && 
                entry.accountName.toLowerCase().includes('deposit') &&
                entry.accountType === 'Liability' &&
                entry.credit > 0
            );

            if (!depositEntry) {
                return {
                    studentId,
                    studentName,
                    studentInfo,
                    hasLeaseStart: true,
                    depositAmount: 0,
                    paidAmount: 0,
                    outstandingAmount: 0,
                    status: 'no_deposit_liability'
                };
            }

            const depositAmount = depositEntry.credit;

            // Find deposit payments
            const depositPayments = await TransactionEntry.find({
                'metadata.studentId': studentId,
                'entries.accountCode': { $regex: `^1100-${studentId}` },
                'entries.description': { $regex: /deposit.*payment/i },
                status: 'posted'
            });

            let totalDepositPaid = 0;
            depositPayments.forEach(payment => {
                payment.entries.forEach(entry => {
                    if (entry.accountCode === `1100-${studentId}` && 
                        entry.description.toLowerCase().includes('deposit') &&
                        entry.credit > 0) {
                        totalDepositPaid += entry.credit;
                    }
                });
            });

            const outstandingAmount = depositAmount - totalDepositPaid;
            let status = 'paid';
            
            if (outstandingAmount > 0) {
                status = 'unpaid';
            } else if (outstandingAmount < 0) {
                status = 'overpaid';
            }

            return {
                studentId,
                studentName,
                studentInfo,
                hasLeaseStart: true,
                depositAmount,
                paidAmount: totalDepositPaid,
                outstandingAmount,
                status,
                leaseStartTransactionId: leaseStartTransaction.transactionId
            };

        } catch (error) {
            console.error('❌ Error checking security deposit status:', error);
            throw error;
        }
    }

    /**
     * Get all students (including expired ones) for security deposit management
     * @returns {Array} - Array of student information with deposit status
     */
    static async getAllStudentsForDepositManagement() {
        try {
            console.log('🔍 Getting all students for security deposit management');

            // Get all unique student IDs from lease start transactions
            const leaseStartTransactions = await TransactionEntry.find({
                'metadata.type': 'lease_start',
                status: 'posted'
            }).select('metadata.studentId metadata.studentName');

            // Extract unique student IDs
            const studentIds = [...new Set(leaseStartTransactions.map(tx => tx.metadata.studentId))];
            
            console.log(`📊 Found ${studentIds.length} unique students with lease start transactions`);

            // Get student information and deposit status for each student
            const studentsWithDepositInfo = await Promise.all(
                studentIds.map(async (studentId) => {
                    try {
                        const studentInfo = await getStudentInfo(studentId);
                        const studentName = await getStudentName(studentId);
                        const depositStatus = await this.getSecurityDepositStatus(studentId);

                        return {
                            studentId,
                            studentName,
                            studentInfo,
                            depositStatus: {
                                status: depositStatus.status,
                                depositAmount: depositStatus.depositAmount,
                                paidAmount: depositStatus.paidAmount,
                                outstandingAmount: depositStatus.outstandingAmount,
                                canReverse: depositStatus.status === 'unpaid' && depositStatus.outstandingAmount > 0
                            }
                        };
                    } catch (error) {
                        console.error(`❌ Error getting info for student ${studentId}:`, error);
                        return {
                            studentId,
                            studentName: 'Unknown Student',
                            studentInfo: null,
                            depositStatus: {
                                status: 'error',
                                depositAmount: 0,
                                paidAmount: 0,
                                outstandingAmount: 0,
                                canReverse: false
                            },
                            error: error.message
                        };
                    }
                })
            );

            // Sort by student name
            studentsWithDepositInfo.sort((a, b) => {
                if (a.studentInfo && b.studentInfo) {
                    if (a.studentInfo.isExpired !== b.studentInfo.isExpired) {
                        // Active students first, then expired
                        return a.studentInfo.isExpired ? 1 : -1;
                    }
                }
                return a.studentName.localeCompare(b.studentName);
            });

            return studentsWithDepositInfo;

        } catch (error) {
            console.error('❌ Error getting all students for deposit management:', error);
            throw error;
        }
    }
}

module.exports = SecurityDepositReversalService;
