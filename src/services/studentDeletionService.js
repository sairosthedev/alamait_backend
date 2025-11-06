const mongoose = require('mongoose');

// Import all models that might reference students
const User = require('../models/User');
const Student = require('../models/Student');
const Application = require('../models/Application');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Receipt = require('../models/Receipt');
const Debtor = require('../models/Debtor');
const StudentAccount = require('../models/StudentAccount');
const TenantAccount = require('../models/TenantAccount');
const Invoice = require('../models/Invoice');
const Lease = require('../models/Lease');
const Message = require('../models/Message');
const Maintenance = require('../models/Maintenance');
const MaintenanceCategory = require('../models/MaintenanceCategory');
const MaintenanceStaff = require('../models/MaintenanceStaff');
const { Residence } = require('../models/Residence');
const Transaction = require('../models/Transaction');
const TransactionEntry = require('../models/TransactionEntry');
const MonthlyRequest = require('../models/MonthlyRequest');
const Vendor = require('../models/Vendor');
const ExpiredStudent = require('../models/ExpiredStudent');
const AuditLog = require('../models/AuditLog');

// Import finance models
const PettyCash = require('../models/finance/PettyCash');
const Asset = require('../models/finance/Asset');
const Liability = require('../models/finance/Liability');
const IncomeStatement = require('../models/finance/IncomeStatement');
const OtherExpense = require('../models/finance/OtherExpense');
const OtherIncome = require('../models/finance/OtherIncome');
const Account = require('../models/Account');

const { createAuditLog } = require('../utils/auditLogger');
const DeletionLogService = require('./deletionLogService');

class StudentDeletionService {
    /**
     * Comprehensively delete a student and all related data
     * @param {string} studentId - The student's User ID
     * @param {Object} adminUser - The admin user performing the deletion
     * @returns {Object} - Deletion summary
     */
    static async deleteStudentCompletely(studentId, adminUser) {
        const session = await mongoose.startSession();
        
        let deletionSummary = {
            studentInfo: null,
            deletedCollections: {},
            errors: [],
            archived: false
        };

        try {
            const result = await session.withTransaction(async () => {
                console.log(`🗑️ Starting comprehensive deletion for student: ${studentId}`);
                
                // First, find the student to ensure they exist using flexible lookup
                const studentLookup = await this.findStudentById(studentId);
                if (!studentLookup || !studentLookup.student) {
                    throw new Error('Student not found');
                }

                console.log(`🔍 Found student via: ${studentLookup.source}`);
                
                // Get the actual User record for the student
                let student = studentLookup.student;
                
                // If we found via Application, get the actual User record
                if (studentLookup.source.includes('Application')) {
                    const userRecord = await User.findOne({ email: student.email }).session(session);
                    if (!userRecord) {
                        throw new Error('Student User record not found');
                    }
                    student = userRecord;
                    console.log(`📝 Retrieved User record for: ${student.email}`);
                } else if (!student._id.toString) {
                    // If it's not a full mongoose document, fetch it
                    const userRecord = await User.findById(student._id).session(session);
                    if (!userRecord) {
                        throw new Error('Student User record not found');
                    }
                    student = userRecord;
                }

                console.log(`📝 Found student: ${student.email} (${student.firstName} ${student.lastName})`);

                // Update deletion summary with student info
                deletionSummary.studentInfo = {
                    id: student._id,
                    email: student.email,
                    name: `${student.firstName} ${student.lastName}`,
                    applicationCode: student.applicationCode
                };

                // Archive student data before deletion
                await this.archiveStudentData(student, session, deletionSummary);

                // Delete from all collections in the correct order (dependencies first)
                const deletionPlan = [
                    // Step 1: Delete transaction-related data (ONLY by explicit ID references - no fuzzy matching)
                    { special: 'deleteTransactionEntriesByMetadata', description: 'Transaction entries (by metadata.studentId only - safest)' },
                    { collection: 'TransactionEntry', field: 'reference', description: 'Transaction entries (by reference - exact match only)' },
                    { special: 'deleteAccrualTransactions', description: 'Accrual transaction entries (by explicit student ID only)' },
                    { special: 'deleteNegotiationTransactions', description: 'Negotiation transaction entries (by explicit student ID only)' },
                    { collection: 'Transaction', field: 'reference', description: 'Transactions (by reference - exact match only)' },
                    
                    // Step 2: Delete financial records (delete payment-related transactions BEFORE payments)
                    { special: 'deletePaymentRelatedTransactions', description: 'Payment-related transaction entries' },
                    { collection: 'Payment', field: 'student', description: 'Payments (student field)' },
                    { collection: 'Payment', field: 'user', description: 'Payments (user field)' },
                    { collection: 'Receipt', field: 'student', description: 'Receipts' },
                    { collection: 'Debtor', field: 'user', description: 'Debtor accounts' },
                    { special: 'deleteStudentSpecificAccounts', description: 'Student-specific AR accounts' },
                    { collection: 'StudentAccount', field: 'student', description: 'Student accounts' },
                    { collection: 'TenantAccount', field: 'tenant', description: 'Tenant accounts' },
                    { collection: 'Invoice', field: 'student', description: 'Invoices' },
                    
                    // Step 3: Delete operational records
                    { collection: 'Booking', field: 'student', description: 'Bookings' },
                    { collection: 'Lease', field: 'studentId', description: 'Leases' },
                    { collection: 'Message', field: 'student', description: 'Messages (student field)' },
                    { collection: 'Message', field: 'sender', description: 'Messages (sender field)' },
                    { collection: 'Message', field: 'recipient', description: 'Messages (recipient field)' },
                    
                    // Step 4: Delete maintenance-related records
                    { collection: 'Maintenance', field: 'requestedBy', description: 'Maintenance requests' },
                    { collection: 'Maintenance', field: 'student', description: 'Maintenance (student field)' },
                    
                    // Step 5: Delete finance-related records
                    { collection: 'PettyCash', field: 'requestedBy', description: 'Petty cash requests' },
                    { collection: 'PettyCash', field: 'approvedBy', description: 'Petty cash approvals' },
                    { collection: 'PettyCash', field: 'user', description: 'Petty cash (user field)' },
                    { collection: 'MonthlyRequest', field: 'user', description: 'Monthly requests' },
                    { collection: 'OtherExpense', field: 'user', description: 'Other expenses' },
                    { collection: 'OtherIncome', field: 'user', description: 'Other income' },
                    
                    // Step 6: Delete application and user records
                    { collection: 'Application', field: 'student', description: 'Applications' },
                    { collection: 'Student', field: '_id', description: 'Student records' },
                    
                    // Step 7: Clean up residence data (room occupancy)
                    { special: 'updateResidenceOccupancy', description: 'Update residence room occupancy' },
                    
                    // Step 8: Delete the main user record
                    { collection: 'User', field: '_id', description: 'User record' }
                ];

                // Use the actual student User ID for deletions
                const actualStudentId = student._id;
                console.log(`🎯 Using actual student User ID for deletions: ${actualStudentId}`);

                // Execute deletion plan
                for (const step of deletionPlan) {
                    try {
                        if (step.special) {
                            await this.handleSpecialDeletion(step.special, student, session, deletionSummary, adminUser);
                        } else {
                            await this.deleteFromCollection(step.collection, step.field, actualStudentId, session, deletionSummary, step.description, adminUser);
                        }
                    } catch (error) {
                        console.error(`❌ Error in step ${step.description}:`, error.message);
                        deletionSummary.errors.push({
                            step: step.description,
                            error: error.message
                        });
                    }
                }

                // Create comprehensive audit log
                await this.createDeletionAuditLog(student, adminUser, deletionSummary, session);

                console.log(`✅ Comprehensive deletion completed for student: ${student.email}`);
                return deletionSummary;
            });

            return result || deletionSummary;

        } catch (error) {
            console.error('❌ Comprehensive student deletion failed:', error);
            // Return partial summary with error information
            deletionSummary.errors.push({
                step: 'Transaction execution',
                error: error.message
            });
            return deletionSummary;
        } finally {
            await session.endSession();
        }
    }

    /**
     * Archive student data to ExpiredStudent collection
     */
    static async archiveStudentData(student, session, deletionSummary) {
        try {
            console.log('📦 Archiving student data...');
            
            // Get related data for archiving
            const application = await Application.findOne({ student: student._id }).sort({ createdAt: -1 }).session(session);
            const bookings = await Booking.find({ student: student._id }).lean().session(session);
            const paymentHistory = bookings.flatMap(booking => booking.payments || []);
            const leases = await Lease.find({ studentId: student._id }).lean().session(session);
            const payments = await Payment.find({ 
                $or: [{ student: student._id }, { user: student._id }] 
            }).lean().session(session);
            const debtor = await Debtor.findOne({ user: student._id }).lean().session(session);
            
            // IMPORTANT: Archive transaction entries before deletion
            // Get all transaction entries that will be deleted
            const studentId = student._id.toString();
            const studentIdObj = student._id;
            
            const transactionEntries = await TransactionEntry.find({
                $or: [
                    { 'metadata.studentId': studentId },
                    { reference: studentId },
                    { reference: studentIdObj },
                    { sourceId: studentIdObj }
                ]
            }).lean().session(session);
            
            console.log(`📦 Archiving ${transactionEntries.length} transaction entries...`);

            // Create comprehensive archive
            const archiveData = {
                student: student.toObject(),
                application: application ? application.toObject() : null,
                previousApplicationCode: application ? application.applicationCode : null,
                archivedAt: new Date(),
                reason: 'comprehensive_deletion_by_admin',
                paymentHistory,
                leases,
                payments,
                debtor,
                bookings,
                transactionEntries: transactionEntries, // Archive transaction entries
                archiveMetadata: {
                    deletedBy: deletionSummary.adminUserId || 'system',
                    deletionType: 'comprehensive',
                    totalRelatedRecords: bookings.length + payments.length + leases.length + transactionEntries.length,
                    transactionEntryCount: transactionEntries.length
                }
            };

            await ExpiredStudent.create([archiveData], { session });
            deletionSummary.archived = true;
            console.log('✅ Student data archived successfully');

        } catch (error) {
            console.error('❌ Error archiving student data:', error);
            deletionSummary.errors.push({
                step: 'Archive student data',
                error: error.message
            });
        }
    }

    /**
     * Delete records from a specific collection
     * Logs all deleted records to deletions collection
     */
    static async deleteFromCollection(collectionName, fieldName, studentId, session, deletionSummary, description, adminUser) {
        try {
            const Model = this.getModel(collectionName);
            if (!Model) {
                throw new Error(`Model ${collectionName} not found`);
            }

            // Handle special field cases
            let query = {};
            if (fieldName === '_id') {
                query._id = studentId;
            } else if (fieldName === 'reference') {
                // For transactions, the reference field contains student ID as string (exact match only)
                query.reference = studentId.toString();
            } else {
                query[fieldName] = studentId;
            }

            // Fetch records before deletion to log them
            const recordsToDelete = await Model.find(query).lean().session(session);
            
            if (recordsToDelete.length > 0) {
                // Log each deleted record to deletions collection
                for (const record of recordsToDelete) {
                    try {
                        await DeletionLogService.logDeletion({
                            modelName: collectionName,
                            documentId: record._id,
                            deletedData: record,
                            deletedBy: adminUser._id,
                            reason: `Student deletion: ${deletionSummary.studentInfo?.name || studentId}`,
                            context: 'cascade_delete',
                            metadata: {
                                studentId: studentId.toString(),
                                deletionType: 'comprehensive_student_deletion',
                                field: fieldName,
                                description: description
                            },
                            session: session
                        });
                    } catch (logError) {
                        console.error(`⚠️ Error logging deletion for ${collectionName} (${record._id}):`, logError.message);
                        // Don't fail deletion if logging fails
                    }
                }

                // Now delete the records
                const deleteResult = await Model.deleteMany(query).session(session);
                
                if (deleteResult.deletedCount > 0) {
                    deletionSummary.deletedCollections[collectionName] = {
                        count: deleteResult.deletedCount,
                        field: fieldName,
                        description,
                        loggedToDeletions: recordsToDelete.length
                    };
                    console.log(`🗑️ Deleted ${deleteResult.deletedCount} records from ${collectionName} (${description}) - Logged to deletions collection`);
                }
            }

        } catch (error) {
            console.error(`❌ Error deleting from ${collectionName}:`, error.message);
            throw error;
        }
    }

    /**
     * Handle special deletion cases
     */
    static async handleSpecialDeletion(type, student, session, deletionSummary, adminUser) {
        switch (type) {
            case 'updateResidenceOccupancy':
                await this.updateResidenceOccupancy(student, session, deletionSummary);
                break;
            case 'deleteTransactionEntriesAdvanced':
                await this.deleteTransactionEntriesAdvanced(student, session, deletionSummary);
                break;
            case 'deleteStudentSpecificAccounts':
                await this.deleteStudentSpecificAccounts(student, session, deletionSummary, adminUser);
                break;
            case 'deletePaymentRelatedTransactions':
                await this.deletePaymentRelatedTransactions(student, session, deletionSummary, adminUser);
                break;
            case 'deleteAccrualTransactions':
                await this.deleteAccrualTransactions(student, session, deletionSummary, adminUser);
                break;
            case 'deleteNegotiationTransactions':
                await this.deleteNegotiationTransactions(student, session, deletionSummary, adminUser);
                break;
            case 'deleteTransactionEntriesByMetadata':
                await this.deleteTransactionEntriesByMetadata(student, session, deletionSummary, adminUser);
                break;
            default:
                console.log(`⚠️ Unknown special deletion type: ${type}`);
        }
    }

    /**
     * Delete transaction entries by metadata.studentId only (safest method)
     * ONLY uses explicit student ID - no description/regex matching
     */
    static async deleteTransactionEntriesByMetadata(student, session, deletionSummary, adminUser) {
        try {
            const studentId = student._id.toString();
            
            console.log(`🔍 Deleting transaction entries by metadata.studentId for: ${student.email} (ID-based only)`);
            
            // Fetch records before deletion to log them
            const recordsToDelete = await TransactionEntry.find({
                'metadata.studentId': studentId
            }).lean().session(session);
            
            // Log each deleted record to deletions collection BEFORE deletion
            let loggedCount = 0;
            for (const record of recordsToDelete) {
                try {
                    // Double-check: verify this record actually belongs to this student
                    const recordStudentId = record.metadata?.studentId;
                    if (!recordStudentId || recordStudentId !== studentId) {
                        console.warn(`⚠️ Skipping record ${record._id} - metadata.studentId (${recordStudentId}) doesn't match student ID (${studentId})`);
                        continue;
                    }
                    
                    await DeletionLogService.logDeletion({
                        modelName: 'TransactionEntry',
                        documentId: record._id,
                        deletedData: record,
                        deletedBy: adminUser._id,
                        reason: `Student deletion: ${student.email}`,
                        context: 'cascade_delete',
                        metadata: {
                            studentId: studentId,
                            deletionType: 'transaction_entry_by_metadata',
                            transactionId: record.transactionId,
                            source: record.source
                        },
                        session: session
                    });
                    loggedCount++;
                } catch (logError) {
                    console.error(`⚠️ Error logging deletion for TransactionEntry (${record._id}):`, logError.message);
                    console.error(`   Full error:`, logError);
                    // Don't fail deletion if logging fails, but log the error
                }
            }
            
            // Only delete transactions where metadata.studentId explicitly matches (ID-based only)
            // Only delete records that were successfully logged (safety check)
            const recordsToDeleteIds = recordsToDelete
                .filter(r => {
                    const recordStudentId = r.metadata?.studentId;
                    return recordStudentId === studentId;
                })
                .map(r => r._id);
            
            const result = recordsToDeleteIds.length > 0 
                ? await TransactionEntry.deleteMany({ _id: { $in: recordsToDeleteIds } }).session(session)
                : { deletedCount: 0 };
            
            if (result.deletedCount > 0) {
                if (!deletionSummary.deletedCollections['TransactionEntry (By Metadata)']) {
                    deletionSummary.deletedCollections['TransactionEntry (By Metadata)'] = {
                        count: 0,
                        description: 'Transaction entries (by metadata.studentId only - ID-based)',
                        loggedToDeletions: 0
                    };
                }
                deletionSummary.deletedCollections['TransactionEntry (By Metadata)'].count += result.deletedCount;
                deletionSummary.deletedCollections['TransactionEntry (By Metadata)'].loggedToDeletions = loggedCount;
                
                console.log(`🗑️ Deleted ${result.deletedCount} transaction entries by metadata.studentId - Logged ${loggedCount} to deletions collection`);
            }
            
        } catch (error) {
            console.error('❌ Error in metadata-based transaction entry deletion:', error);
            throw error;
        }
    }

    /**
     * Delete transaction entries using advanced patterns
     * REMOVED - This function is no longer used to prevent deleting unrelated transactions
     * Only explicit ID-based matching is now used
     */
    static async deleteTransactionEntriesAdvanced(student, session, deletionSummary) {
        // This function is disabled - we only use explicit ID matching now
        console.log(`⚠️ Advanced transaction entry deletion skipped - using only explicit ID matching`);
        return;
    }

    /**
     * Delete student-specific accounts from the Account collection
     * ONLY by explicit student ID in account code - no name/description matching
     */
    static async deleteStudentSpecificAccounts(student, session, deletionSummary, adminUser) {
        try {
            const studentId = student._id.toString();
            const studentEmail = student.email;
            const studentName = `${student.firstName} ${student.lastName}`;
            
            console.log(`🔍 Deleting student-specific accounts for: ${studentEmail} (ID-based only)`);
            
            // ONLY delete accounts where code exactly matches the student-specific AR account format
            // Account codes are like "1100-{studentId}" - we use EXACT string matching only
            // No regex - only exact match to prevent deleting unrelated accounts
            const exactAccountCode = `1100-${studentId}`;
            const accountQuery = {
                code: exactAccountCode  // Exact string match only - no regex
            };
            
            // Fetch records before deletion to log them
            const recordsToDelete = await Account.find(accountQuery).lean().session(session);
            
            // Log each deleted record to deletions collection
            let loggedCount = 0;
            for (const record of recordsToDelete) {
                try {
                    await DeletionLogService.logDeletion({
                        modelName: 'Account',
                        documentId: record._id,
                        deletedData: record,
                        deletedBy: adminUser._id,
                        reason: `Student deletion: ${student.email}`,
                        context: 'cascade_delete',
                        metadata: {
                            studentId: studentId,
                            deletionType: 'student_specific_account',
                            accountCode: record.code,
                            accountName: record.name
                        },
                        session: session
                    });
                    loggedCount++;
                } catch (logError) {
                    console.error(`⚠️ Error logging deletion for Account (${record._id}):`, logError.message);
                    // Don't fail deletion if logging fails
                }
            }
            
            // Now delete the accounts (ID-based only - code contains student ID)
            const result = await Account.deleteMany(accountQuery).session(session);
            
            if (result.deletedCount > 0) {
                if (!deletionSummary.deletedCollections['Account (Student-Specific)']) {
                    deletionSummary.deletedCollections['Account (Student-Specific)'] = {
                        count: 0,
                        description: 'Student-specific AR control accounts (ID-based only)',
                        loggedToDeletions: 0
                    };
                }
                deletionSummary.deletedCollections['Account (Student-Specific)'].count += result.deletedCount;
                deletionSummary.deletedCollections['Account (Student-Specific)'].loggedToDeletions = loggedCount;
                
                console.log(`🗑️ Student-specific account deletion: ${result.deletedCount} accounts (ID-based only) - Logged ${loggedCount} to deletions collection`);
            }
            
        } catch (error) {
            console.error('❌ Error in student-specific account deletion:', error);
            throw error;
        }
    }

    /**
     * Delete payment-related transaction entries
     * ONLY by explicit payment ID or student ID - no description matching
     */
    static async deletePaymentRelatedTransactions(student, session, deletionSummary, adminUser) {
        try {
            const studentId = student._id.toString();
            const studentIdObj = student._id;
            
            console.log(`🔍 Deleting payment-related transaction entries for: ${student.email} (ID-based only)`);
            
            // First, get all payment IDs for this student
            const payments = await Payment.find({
                $or: [
                    { student: studentIdObj },
                    { user: studentIdObj }
                ]
            }).select('_id').session(session);
            
            const paymentIds = payments.map(p => p._id);
            const paymentIdStrings = paymentIds.map(id => id.toString());
            
            console.log(`   📊 Found ${paymentIds.length} payments for this student`);
            
            // Build query for all payment-related transactions (ID-based only)
            const paymentQuery = {
                $or: [
                    // Pattern 1: sourceId pointing to a payment (explicit payment ID)
                    ...(paymentIds.length > 0 ? [{
                        source: 'payment',
                        sourceModel: 'Payment',
                        sourceId: { $in: paymentIds }
                    }] : []),
                    // Pattern 2: metadata.paymentId matching any payment (explicit payment ID)
                    ...(paymentIdStrings.length > 0 ? [{
                        'metadata.paymentId': { $in: paymentIdStrings }
                    }] : []),
                    // Pattern 3: metadata.paymentAllocation.paymentId (explicit payment ID)
                    ...(paymentIdStrings.length > 0 ? [{
                        'metadata.paymentAllocation.paymentId': { $in: paymentIdStrings }
                    }] : []),
                    // Pattern 4: source='payment' and metadata.studentId matching (explicit student ID)
                    {
                        source: 'payment',
                        'metadata.studentId': studentId
                    },
                    // Pattern 5: reference exactly matching payment IDs (exact match only)
                    ...(paymentIdStrings.length > 0 ? [{
                        reference: { $in: paymentIdStrings }
                    }] : []),
                    // Pattern 6: metadata.paymentAllocation.studentId (explicit student ID)
                    {
                        'metadata.paymentAllocation.studentId': studentId
                    }
                ]
            };
            
            // Fetch records before deletion to log them
            const recordsToDelete = await TransactionEntry.find(paymentQuery).lean().session(session);
            
            // Log each deleted record to deletions collection
            let loggedCount = 0;
            for (const record of recordsToDelete) {
                try {
                    await DeletionLogService.logDeletion({
                        modelName: 'TransactionEntry',
                        documentId: record._id,
                        deletedData: record,
                        deletedBy: adminUser._id,
                        reason: `Student deletion: ${student.email}`,
                        context: 'cascade_delete',
                        metadata: {
                            studentId: studentId,
                            deletionType: 'payment_related_transaction',
                            transactionId: record.transactionId,
                            source: record.source,
                            paymentId: record.metadata?.paymentId || record.sourceId
                        },
                        session: session
                    });
                    loggedCount++;
                } catch (logError) {
                    console.error(`⚠️ Error logging deletion for TransactionEntry (${record._id}):`, logError.message);
                    // Don't fail deletion if logging fails
                }
            }
            
            // Now delete the records (ID-based only - no description matching)
            const result = await TransactionEntry.deleteMany(paymentQuery).session(session);
            
            if (result.deletedCount > 0) {
                if (!deletionSummary.deletedCollections['TransactionEntry (Payment-Related)']) {
                    deletionSummary.deletedCollections['TransactionEntry (Payment-Related)'] = {
                        count: 0,
                        description: 'Payment-related transaction entries (ID-based only)',
                        loggedToDeletions: 0
                    };
                }
                deletionSummary.deletedCollections['TransactionEntry (Payment-Related)'].count += result.deletedCount;
                deletionSummary.deletedCollections['TransactionEntry (Payment-Related)'].loggedToDeletions = loggedCount;
                
                console.log(`🗑️ Payment-related transaction entry deletion: ${result.deletedCount} entries (ID-based only) - Logged ${loggedCount} to deletions collection`);
            }
            
        } catch (error) {
            console.error('❌ Error in payment-related transaction entry deletion:', error);
            throw error;
        }
    }

    /**
     * Delete accrual transaction entries (rental_accrual, expense_accrual)
     * ONLY by explicit student ID - no description matching
     */
    static async deleteAccrualTransactions(student, session, deletionSummary, adminUser) {
        try {
            const studentId = student._id.toString();
            const studentIdObj = student._id;
            
            console.log(`🔍 Deleting accrual transaction entries for: ${student.email} (ID-based only)`);
            
            // Build query for all accrual transactions (ID-based only)
            const accrualQuery = {
                $or: [
                    // Pattern 1: source='rental_accrual' and sourceId pointing to student
                    {
                        source: 'rental_accrual',
                        sourceId: studentIdObj
                    },
                    // Pattern 2: source='rental_accrual' and metadata.studentId matching
                    {
                        source: 'rental_accrual',
                        'metadata.studentId': studentId
                    },
                    // Pattern 3: source='expense_accrual' and metadata.studentId matching
                    {
                        source: 'expense_accrual',
                        'metadata.studentId': studentId
                    },
                    // Pattern 4: source='rental_accrual_reversal' and metadata.studentId matching
                    {
                        source: 'rental_accrual_reversal',
                        'metadata.studentId': studentId
                    },
                    // Pattern 5: source='expense_accrual_reversal' and metadata.studentId matching
                    {
                        source: 'expense_accrual_reversal',
                        'metadata.studentId': studentId
                    },
                    // Pattern 6: reference containing student ID (exact match) AND metadata.studentId matching AND source indicating accrual
                    // This ensures we only delete accruals that explicitly belong to this student
                    {
                        $and: [
                            {
                                $or: [
                                    { reference: studentId }, // String match
                                    { reference: studentIdObj } // ObjectId match
                                ]
                            },
                            {
                                'metadata.studentId': studentId  // MUST have explicit studentId match
                            },
                            {
                                source: { $in: ['rental_accrual', 'expense_accrual', 'rental_accrual_reversal', 'expense_accrual_reversal'] }
                            }
                        ]
                    }
                ]
            };
            
            // Fetch records before deletion to log them
            const recordsToDelete = await TransactionEntry.find(accrualQuery).lean().session(session);
            
            // Log each deleted record to deletions collection BEFORE deletion
            let loggedCount = 0;
            for (const record of recordsToDelete) {
                try {
                    // Verify this record actually belongs to this student before logging
                    const recordStudentId = record.metadata?.studentId;
                    if (recordStudentId && recordStudentId !== studentId) {
                        console.warn(`⚠️ Skipping record ${record._id} - metadata.studentId (${recordStudentId}) doesn't match student ID (${studentId})`);
                        continue;
                    }
                    
                    await DeletionLogService.logDeletion({
                        modelName: 'TransactionEntry',
                        documentId: record._id,
                        deletedData: record,
                        deletedBy: adminUser._id,
                        reason: `Student deletion: ${student.email}`,
                        context: 'cascade_delete',
                        metadata: {
                            studentId: studentId,
                            deletionType: 'accrual_transaction',
                            transactionId: record.transactionId,
                            source: record.source,
                            accrualMonth: record.metadata?.accrualMonth,
                            accrualYear: record.metadata?.accrualYear
                        },
                        session: session
                    });
                    loggedCount++;
                } catch (logError) {
                    console.error(`⚠️ Error logging deletion for TransactionEntry (${record._id}):`, logError.message);
                    console.error(`   Full error:`, logError);
                    // Don't fail deletion if logging fails, but log the error
                }
            }
            
            // Now delete the records (ID-based only - no description matching)
            // Only delete records that were successfully logged (safety check)
            const recordsToDeleteIds = recordsToDelete
                .filter(r => {
                    const recordStudentId = r.metadata?.studentId;
                    return !recordStudentId || recordStudentId === studentId;
                })
                .map(r => r._id);
            
            const result = recordsToDeleteIds.length > 0 
                ? await TransactionEntry.deleteMany({ _id: { $in: recordsToDeleteIds } }).session(session)
                : { deletedCount: 0 };
            
            if (result.deletedCount > 0) {
                if (!deletionSummary.deletedCollections['TransactionEntry (Accruals)']) {
                    deletionSummary.deletedCollections['TransactionEntry (Accruals)'] = {
                        count: 0,
                        description: 'Accrual transaction entries (ID-based only)',
                        loggedToDeletions: 0
                    };
                }
                deletionSummary.deletedCollections['TransactionEntry (Accruals)'].count += result.deletedCount;
                deletionSummary.deletedCollections['TransactionEntry (Accruals)'].loggedToDeletions = loggedCount;
                
                console.log(`🗑️ Accrual transaction entry deletion: ${result.deletedCount} entries (ID-based only) - Logged ${loggedCount} to deletions collection`);
            }
            
        } catch (error) {
            console.error('❌ Error in accrual transaction entry deletion:', error);
            throw error;
        }
    }

    /**
     * Delete negotiation transaction entries
     * ONLY by explicit student ID - no description matching
     */
    static async deleteNegotiationTransactions(student, session, deletionSummary, adminUser) {
        try {
            const studentId = student._id.toString();
            const studentIdObj = student._id;
            
            console.log(`🔍 Deleting negotiation transaction entries for: ${student.email} (ID-based only)`);
            
            // Build query for all negotiation transactions (ID-based only)
            const negotiationQuery = {
                $or: [
                    // Pattern 1: source='manual' and metadata.isNegotiated=true AND metadata.studentId matching
                    {
                        source: 'manual',
                        'metadata.isNegotiated': true,
                        'metadata.studentId': studentId
                    },
                    // Pattern 2: source='manual' and metadata.transactionType='negotiated_payment_adjustment' AND metadata.studentId matching
                    {
                        source: 'manual',
                        'metadata.transactionType': 'negotiated_payment_adjustment',
                        'metadata.studentId': studentId
                    },
                    // Pattern 3: metadata.negotiationReason AND metadata.studentId matching
                    {
                        'metadata.negotiationReason': { $exists: true },
                        'metadata.studentId': studentId
                    },
                    // Pattern 4: metadata containing negotiation data AND student ID (explicit match)
                    {
                        'metadata.studentId': studentId,
                        $or: [
                            { 'metadata.negotiationReason': { $exists: true } },
                            { 'metadata.isNegotiated': true },
                            { 'metadata.negotiatedAmount': { $exists: true } },
                            { 'metadata.discountAmount': { $exists: true } }
                        ]
                    },
                    // Pattern 5: reference matching student ID (exact match) AND metadata.studentId matching AND negotiation indicators
                    // This ensures we only delete negotiations that explicitly belong to this student
                    {
                        $and: [
                            {
                                $or: [
                                    { reference: studentId }, // String match
                                    { reference: studentIdObj } // ObjectId match
                                ]
                            },
                            {
                                'metadata.studentId': studentId  // MUST have explicit studentId match
                            },
                            {
                                $or: [
                                    { 'metadata.isNegotiated': true },
                                    { 'metadata.transactionType': 'negotiated_payment_adjustment' },
                                    { 'metadata.negotiationReason': { $exists: true } }
                                ]
                            }
                        ]
                    }
                ]
            };
            
            // Fetch records before deletion to log them
            const recordsToDelete = await TransactionEntry.find(negotiationQuery).lean().session(session);
            
            // Log each deleted record to deletions collection BEFORE deletion
            let loggedCount = 0;
            for (const record of recordsToDelete) {
                try {
                    // Verify this record actually belongs to this student before logging
                    const recordStudentId = record.metadata?.studentId;
                    if (recordStudentId && recordStudentId !== studentId) {
                        console.warn(`⚠️ Skipping record ${record._id} - metadata.studentId (${recordStudentId}) doesn't match student ID (${studentId})`);
                        continue;
                    }
                    
                    await DeletionLogService.logDeletion({
                        modelName: 'TransactionEntry',
                        documentId: record._id,
                        deletedData: record,
                        deletedBy: adminUser._id,
                        reason: `Student deletion: ${student.email}`,
                        context: 'cascade_delete',
                        metadata: {
                            studentId: studentId,
                            deletionType: 'negotiation_transaction',
                            transactionId: record.transactionId,
                            source: record.source,
                            isNegotiated: record.metadata?.isNegotiated,
                            negotiationReason: record.metadata?.negotiationReason
                        },
                        session: session
                    });
                    loggedCount++;
                } catch (logError) {
                    console.error(`⚠️ Error logging deletion for TransactionEntry (${record._id}):`, logError.message);
                    console.error(`   Full error:`, logError);
                    // Don't fail deletion if logging fails, but log the error
                }
            }
            
            // Now delete the records (ID-based only - no description matching)
            // Only delete records that were successfully logged (safety check)
            const recordsToDeleteIds = recordsToDelete
                .filter(r => {
                    const recordStudentId = r.metadata?.studentId;
                    return !recordStudentId || recordStudentId === studentId;
                })
                .map(r => r._id);
            
            const result = recordsToDeleteIds.length > 0 
                ? await TransactionEntry.deleteMany({ _id: { $in: recordsToDeleteIds } }).session(session)
                : { deletedCount: 0 };
            
            if (result.deletedCount > 0) {
                if (!deletionSummary.deletedCollections['TransactionEntry (Negotiations)']) {
                    deletionSummary.deletedCollections['TransactionEntry (Negotiations)'] = {
                        count: 0,
                        description: 'Negotiation transaction entries (ID-based only)',
                        loggedToDeletions: 0
                    };
                }
                deletionSummary.deletedCollections['TransactionEntry (Negotiations)'].count += result.deletedCount;
                deletionSummary.deletedCollections['TransactionEntry (Negotiations)'].loggedToDeletions = loggedCount;
                
                console.log(`🗑️ Negotiation transaction entry deletion: ${result.deletedCount} entries (ID-based only) - Logged ${loggedCount} to deletions collection`);
            }
            
        } catch (error) {
            console.error('❌ Error in negotiation transaction entry deletion:', error);
            throw error;
        }
    }

    /**
     * Update residence room occupancy when student is deleted
     */
    static async updateResidenceOccupancy(student, session, deletionSummary) {
        try {
            if (student.residence && student.currentRoom) {
                const residence = await Residence.findById(student.residence).session(session);
                if (residence) {
                    const room = residence.rooms.find(r => r.roomNumber === student.currentRoom);
                    if (room) {
                        const oldOccupancy = room.currentOccupancy;
                        room.currentOccupancy = Math.max(0, (room.currentOccupancy || 1) - 1);
                        
                        // Update room status
                        if (room.currentOccupancy === 0) {
                            room.status = 'available';
                        } else if (room.currentOccupancy < room.capacity) {
                            room.status = 'reserved';
                        } else {
                            room.status = 'occupied';
                        }
                        
                        await residence.save({ session });
                        
                        deletionSummary.residenceUpdated = {
                            residenceId: residence._id,
                            roomNumber: student.currentRoom,
                            occupancyChange: `${oldOccupancy} → ${room.currentOccupancy}`,
                            newStatus: room.status
                        };
                        
                        console.log(`🏠 Updated room ${student.currentRoom} occupancy: ${oldOccupancy} → ${room.currentOccupancy} (${room.status})`);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error updating residence occupancy:', error);
            throw error;
        }
    }

    /**
     * Create comprehensive audit log for deletion
     */
    static async createDeletionAuditLog(student, adminUser, deletionSummary, session) {
        try {
            // Create detailed audit log
            await AuditLog.create([{
                user: adminUser._id,
                action: 'comprehensive_delete',
                collection: 'User',
                recordId: student._id,
                before: student.toObject(),
                after: null,
                metadata: {
                    deletionType: 'comprehensive',
                    deletedCollections: Object.keys(deletionSummary.deletedCollections),
                    totalRecordsDeleted: Object.values(deletionSummary.deletedCollections)
                        .reduce((sum, item) => sum + item.count, 0),
                    errors: deletionSummary.errors,
                    residenceUpdated: deletionSummary.residenceUpdated
                }
            }], { session });

            // Create human-readable audit log
            await createAuditLog({
                action: 'COMPREHENSIVE_DELETE',
                resourceType: 'Student',
                resourceId: student._id,
                userId: adminUser._id,
                details: `Comprehensively deleted student ${student.email} and all related data across ${Object.keys(deletionSummary.deletedCollections).length} collections`
            }, session);

        } catch (error) {
            console.error('❌ Error creating audit logs:', error);
            // Don't throw here as the main deletion has succeeded
        }
    }

    /**
     * Find student by ID across multiple collections (copied from controller)
     */
    static async findStudentById(studentId) {
        try {
            // First, try to find in User collection
            let student = await User.findById(studentId).select('firstName lastName email');
            if (student) {
                return { student, source: 'User' };
            }

            // If not found in User, try Application collection
            const Application = require('../models/Application');
            const application = await Application.findById(studentId).select('firstName lastName email');
            if (application) {
                // Try to find User by email from Application
                if (application.email) {
                    const userByEmail = await User.findOne({ email: application.email }).select('firstName lastName email');
                    if (userByEmail) {
                        return { student: userByEmail, source: 'User (from Application email)' };
                    }
                }
                // fallback: return application as before
                return { 
                    student: { 
                        _id: application._id,
                        firstName: application.firstName,
                        lastName: application.lastName,
                        email: application.email
                    }, 
                    source: 'Application' 
                };
            }

            // If not found in Application, try to find by email in User collection
            if (studentId.includes('@')) {
                student = await User.findOne({ email: studentId }).select('firstName lastName email');
                if (student) {
                    return { student, source: 'User (by email)' };
                }
            }

            // If not found by email, try to find in Application collection by email
            if (studentId.includes('@')) {
                const appByEmail = await Application.findOne({ email: studentId }).select('firstName lastName email');
                if (appByEmail) {
                    return { 
                        student: { 
                            _id: appByEmail._id,
                            firstName: appByEmail.firstName,
                            lastName: appByEmail.lastName,
                            email: appByEmail.email
                        }, 
                        source: 'Application (by email)' 
                    };
                }
            }

            // If still not found, try to find by looking up payments for this student ID
            const payment = await Payment.findOne({ student: studentId }).populate('student', 'firstName lastName email');
            if (payment && payment.student) {
                return { student: payment.student, source: 'Payment' };
            }

            // If not found in payments, try to find by looking up leases for this student ID
            const lease = await Lease.findOne({ studentId }).populate('studentId', 'firstName lastName email');
            if (lease && lease.studentId) {
                return { student: lease.studentId, source: 'Lease' };
            }

            return null;

        } catch (error) {
            console.error('Error in findStudentById:', error);
            return null;
        }
    }

    /**
     * Get model by collection name
     */
    static getModel(collectionName) {
        const models = {
            User,
            Student,
            Application,
            Booking,
            Payment,
            Receipt,
            Debtor,
            Account,
            StudentAccount,
            TenantAccount,
            Invoice,
            Lease,
            Message,
            Maintenance,
            MaintenanceCategory,
            MaintenanceStaff,
            Residence,
            Transaction,
            TransactionEntry,
            MonthlyRequest,
            Vendor,
            ExpiredStudent,
            AuditLog,
            PettyCash,
            Asset,
            Liability,
            IncomeStatement,
            OtherExpense,
            OtherIncome
        };

        return models[collectionName];
    }

    /**
     * Validate that student can be deleted (check for constraints)
     */
    static async validateDeletion(studentId) {
        const validationResults = {
            canDelete: true,
            warnings: [],
            blockers: []
        };

        try {
            // Use the same lookup logic as the controller
            const studentLookup = await this.findStudentById(studentId);
            if (!studentLookup || !studentLookup.student) {
                validationResults.canDelete = false;
                validationResults.blockers.push('Student not found');
                return validationResults;
            }

            const student = studentLookup.student;

            // Get the actual User ID for validation checks
            let actualUserId = student._id;
            
            // If we found via Application, get the User record
            if (studentLookup.source.includes('Application')) {
                const userRecord = await User.findOne({ email: student.email });
                if (userRecord) {
                    actualUserId = userRecord._id;
                } else {
                    validationResults.canDelete = false;
                    validationResults.blockers.push('Student User record not found for deletion');
                    return validationResults;
                }
            }

            // Check for active bookings (this might block deletion)
            const activeBookings = await Booking.find({
                student: actualUserId,
                status: { $in: ['pending', 'confirmed'] }
            });

            if (activeBookings.length > 0) {
                validationResults.warnings.push(`Student has ${activeBookings.length} active booking(s)`);
            }

            // Check for recent payments
            const recentPayments = await Payment.find({
                $or: [{ student: actualUserId }, { user: actualUserId }],
                createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
            });

            if (recentPayments.length > 0) {
                validationResults.warnings.push(`Student has ${recentPayments.length} payment(s) in the last 30 days`);
            }

            // Check for outstanding balance
            const debtor = await Debtor.findOne({ user: actualUserId });
            if (debtor && debtor.currentBalance > 0) {
                validationResults.warnings.push(`Student has outstanding balance: $${debtor.currentBalance}`);
            }

        } catch (error) {
            validationResults.canDelete = false;
            validationResults.blockers.push(`Validation error: ${error.message}`);
        }

        return validationResults;
    }
}

module.exports = StudentDeletionService; 