const mongoose = require('mongoose');
const TransactionEntry = require('../models/TransactionEntry');
const Application = require('../models/Application');
const DeletionLogService = require('./deletionLogService');
const { createAuditLog } = require('../utils/auditLogger');
const RentalAccrualService = require('./rentalAccrualService');

/**
 * Service to correct accruals for students who left early
 * Handles reversing accruals created for months after the actual lease end date
 */
class AccrualCorrectionService {
    
    /**
     * Find and reverse incorrect accruals for a student
     * Accruals are considered incorrect if they were created for months after the actual lease end date
     * 
     * @param {string} studentId - Student/Application ID
     * @param {Date} actualLeaseEndDate - The actual date the student left (lease ended)
     * @param {Object} adminUser - Admin user performing the correction
     * @param {string} reason - Reason for correction (default: "Student left early - lease ended before expected")
     * @param {boolean} updateLeaseEndDate - Whether to update the application's endDate (default: true)
     * @returns {Promise<Object>} Correction result
     */
    static async correctAccrualsForEarlyLeaseEnd(studentId, actualLeaseEndDate, adminUser, reason = 'Student left early - lease ended before expected', updateLeaseEndDate = true) {
        const session = await mongoose.startSession();
        session.startTransaction();
        
        try {
            console.log(`🔧 Correcting accruals for student ${studentId} - actual lease end: ${actualLeaseEndDate}`);
            
            // Convert to Date if string
            const leaseEndDate = new Date(actualLeaseEndDate);
            const leaseEndYear = leaseEndDate.getFullYear();
            const leaseEndMonth = leaseEndDate.getMonth() + 1; // 1-12
            
            // Find the student's application
            const application = await Application.findById(studentId).session(session);
            if (!application) {
                await session.abortTransaction();
                return {
                    success: false,
                    error: 'Application not found'
                };
            }
            
            const applicationIdString = studentId.toString();
            const applicationIdObj = new mongoose.Types.ObjectId(studentId);
            
            // Get the actual student ID (User ID) from the application
            const actualStudentIdString = application.student ? application.student.toString() : null;
            const actualStudentIdObj = application.student ? new mongoose.Types.ObjectId(application.student) : null;
            
            // Find all accrual transactions for this student - check multiple ID formats
            const accrualQueryConditions = [
                // By sourceId (application ID)
                { source: 'rental_accrual', sourceId: applicationIdObj },
                // By sourceId (student ID)
                ...(actualStudentIdObj ? [{ source: 'rental_accrual', sourceId: actualStudentIdObj }] : []),
                // By metadata.applicationId
                { source: 'rental_accrual', 'metadata.applicationId': applicationIdString },
                // By metadata.studentId (application ID format)
                { source: 'rental_accrual', 'metadata.studentId': applicationIdString },
                // By metadata.studentId (student ID format)
                ...(actualStudentIdString ? [{ source: 'rental_accrual', 'metadata.studentId': actualStudentIdString }] : []),
                // By metadata.userId
                ...(actualStudentIdString ? [{ source: 'rental_accrual', 'metadata.userId': actualStudentIdString }] : []),
                // By account code pattern (1100-{applicationId})
                { source: 'rental_accrual', 'entries.accountCode': `1100-${applicationIdString}` },
                // By account code pattern (1100-{studentId})
                ...(actualStudentIdString ? [{ source: 'rental_accrual', 'entries.accountCode': `1100-${actualStudentIdString}` }] : [])
            ];
            
            const accrualQuery = {
                $or: accrualQueryConditions,
                status: 'posted'
            };
            
            console.log(`   Query conditions: ${accrualQueryConditions.length} different ways to find accruals`);
            
            let allAccruals = await TransactionEntry.find(accrualQuery).session(session);
            console.log(`📊 Found ${allAccruals.length} total accrual transactions via query`);
            
            // Fallback: If no accruals found, try finding by account code pattern directly
            if (allAccruals.length === 0) {
                console.log(`   ⚠️ No accruals found via query, trying account code pattern fallback...`);
                const accountCodePatterns = [
                    `1100-${applicationIdString}`,
                    ...(actualStudentIdString ? [`1100-${actualStudentIdString}`] : [])
                ];
                
                const fallbackQuery = {
                    source: 'rental_accrual',
                    status: 'posted',
                    $or: accountCodePatterns.map(pattern => ({
                        'entries.accountCode': pattern
                    }))
                };
                
                allAccruals = await TransactionEntry.find(fallbackQuery).session(session);
                console.log(`   Found ${allAccruals.length} accruals via account code pattern fallback`);
            }
            
            // 🔄 Check if there's a renewed/active application that covers months after the expired lease
            // This prevents reversing accruals for months that are covered by a renewed lease
            let renewedApplication = null;
            if (actualStudentIdString) {
                // Check for active or approved applications for the same student
                // that start after or around when this lease ends (could be renewal)
                const monthAfterLeaseEnd = new Date(leaseEndYear, leaseEndMonth, 1); // First day of month after lease end
                
                renewedApplication = await Application.findOne({
                    student: actualStudentIdObj,
                    _id: { $ne: application._id }, // Exclude the current expired application
                    status: { $in: ['approved', 'pending'] },
                    $or: [
                        // Renewal that starts in the same month as lease end or after
                        { startDate: { $gte: new Date(leaseEndYear, leaseEndMonth - 1, 1) } },
                        // Renewal that starts before lease end but extends beyond it
                        { 
                            startDate: { $lte: leaseEndDate },
                            endDate: { $gt: leaseEndDate }
                        }
                    ]
                }).session(session);
                
                if (renewedApplication) {
                    console.log(`🔄 Found renewed application: ${renewedApplication.applicationCode}`);
                    console.log(`   Start: ${renewedApplication.startDate}`);
                    console.log(`   End: ${renewedApplication.endDate}`);
                    console.log(`   Status: ${renewedApplication.status}`);
                    console.log(`   Request Type: ${renewedApplication.requestType}`);
                    console.log(`   Is Reapplication: ${renewedApplication.isReapplication}`);
                }
            }
            
            // Identify incorrect accruals (created for months after lease end date)
            const incorrectAccruals = [];
            
            console.log(`📅 Lease end date: ${leaseEndDate.toISOString()} (${leaseEndMonth}/${leaseEndYear})`);
            if (renewedApplication) {
                const renewedStart = new Date(renewedApplication.startDate);
                const renewedEnd = new Date(renewedApplication.endDate);
                console.log(`🔄 Renewed lease covers: ${renewedStart.toISOString()} to ${renewedEnd.toISOString()}`);
            }
            
            for (const accrual of allAccruals) {
                // Get accrual month/year from metadata or date
                let accrualMonth, accrualYear;
                
                // Try multiple ways to extract accrual month/year
                if (accrual.metadata?.accrualMonth && accrual.metadata?.accrualYear) {
                    // Format: accrualMonth: 10, accrualYear: 2025
                    accrualMonth = parseInt(accrual.metadata.accrualMonth);
                    accrualYear = parseInt(accrual.metadata.accrualYear);
                } else if (accrual.metadata?.month) {
                    // Format: month: "2025-10"
                    const monthStr = accrual.metadata.month;
                    const monthMatch = monthStr.match(/(\d{4})-(\d{2})/);
                    if (monthMatch) {
                        accrualYear = parseInt(monthMatch[1]);
                        accrualMonth = parseInt(monthMatch[2]);
                    } else {
                        // Fallback to transaction date
                        const accrualDate = new Date(accrual.date);
                        accrualMonth = accrualDate.getMonth() + 1;
                        accrualYear = accrualDate.getFullYear();
                    }
                } else {
                    // Fallback to transaction date
                    const accrualDate = new Date(accrual.date);
                    accrualMonth = accrualDate.getMonth() + 1;
                    accrualYear = accrualDate.getFullYear();
                }
                
                // Validate extracted month/year
                if (!accrualMonth || !accrualYear || accrualMonth < 1 || accrualMonth > 12) {
                    console.warn(`⚠️ Invalid accrual month/year for accrual ${accrual._id}: month=${accrualMonth}, year=${accrualYear}`);
                    continue;
                }
                
                // Check if accrual is for a month AFTER the lease end date
                // An accrual is incorrect if:
                // 1. The accrual year is greater than the lease end year, OR
                // 2. The accrual year equals the lease end year AND the accrual month is greater than the lease end month
                const isAfterLeaseEnd = 
                    accrualYear > leaseEndYear || 
                    (accrualYear === leaseEndYear && accrualMonth > leaseEndMonth);
                
                // 🔄 Check if the accrual month is covered by a renewed lease
                let isCoveredByRenewedLease = false;
                if (renewedApplication && isAfterLeaseEnd) {
                    const accrualDate = new Date(accrualYear, accrualMonth - 1, 1); // First day of accrual month
                    const renewedStart = new Date(renewedApplication.startDate);
                    const renewedEnd = new Date(renewedApplication.endDate);
                    
                    // Check if accrual month falls within the renewed lease period
                    isCoveredByRenewedLease = accrualDate >= renewedStart && accrualDate <= renewedEnd;
                    
                    if (isCoveredByRenewedLease) {
                        console.log(`  ✅ Accrual ${accrualMonth}/${accrualYear} is covered by renewed lease - SKIPPING reversal`);
                    }
                }
                
                // Also check if it's a lease start transaction (should not be reversed unless it's after lease end)
                const isLeaseStart = accrual.metadata?.type === 'lease_start' || 
                                    (accrual.description && /lease start/i.test(accrual.description));
                
                console.log(`  📊 Accrual ${accrual._id}: ${accrualMonth}/${accrualYear} | After lease end: ${isAfterLeaseEnd} | Covered by renewal: ${isCoveredByRenewedLease} | Is lease start: ${isLeaseStart}`);
                
                // Only reverse if:
                // 1. It's after the lease end date, AND
                // 2. It's NOT covered by a renewed lease, AND
                // 3. It's NOT a lease start transaction
                if (isAfterLeaseEnd && !isCoveredByRenewedLease && !isLeaseStart) {
                    incorrectAccruals.push({
                        accrual,
                        accrualMonth,
                        accrualYear,
                        reason: `Accrual for ${accrualMonth}/${accrualYear} is after lease end date (${leaseEndMonth}/${leaseEndYear}) and not covered by renewed lease`
                    });
                }
            }
            
            console.log(`⚠️ Found ${incorrectAccruals.length} incorrect accruals to reverse`);
            
            if (incorrectAccruals.length === 0) {
                await session.abortTransaction();
                return {
                    success: true,
                    message: 'No incorrect accruals found',
                    correctedAccruals: [],
                    updatedLeaseEndDate: false
                };
            }
            
            // Reverse each incorrect accrual
            const reversedAccruals = [];
            const errors = [];
            
            for (const { accrual, accrualMonth, accrualYear } of incorrectAccruals) {
                try {
                    console.log(`🔄 Reversing accrual: ${accrual._id} (${accrualMonth}/${accrualYear})`);
                    
                    // Create reversal transaction entry directly
                    const reversalTransactionId = `REVERSE-ACCrual-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
                    
                    // Build reversal entries - reverse all entries from the original accrual
                    const reversalEntries = accrual.entries.map(entry => {
                        return {
                            accountCode: entry.accountCode,
                            accountName: entry.accountName,
                            accountType: entry.accountType,
                            debit: entry.credit, // Original credit becomes debit
                            credit: entry.debit, // Original debit becomes credit
                            description: `Reversal: ${entry.description || ''}`
                        };
                    });
                    
                    // Calculate totals
                    const totalDebit = reversalEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
                    const totalCredit = reversalEntries.reduce((sum, e) => sum + (e.credit || 0), 0);
                    
                    // Create reversal transaction entry
                    const reversalEntry = new TransactionEntry({
                        transactionId: reversalTransactionId,
                        date: new Date(),
                        description: `Reversal (Early Lease End): ${accrual.description}`,
                        reference: accrual._id.toString(),
                        entries: reversalEntries,
                        totalDebit: totalDebit,
                        totalCredit: totalCredit,
                        source: 'rental_accrual_reversal',
                        sourceModel: 'TransactionEntry',
                        sourceId: accrual._id,
                        residence: accrual.residence,
                        status: 'posted',
                        createdBy: adminUser.email || 'system',
                        metadata: {
                            originalAccrualId: accrual._id,
                            originalTransactionId: accrual.transactionId,
                            correctionReason: reason,
                            originalLeaseEndDate: application.endDate,
                            actualLeaseEndDate: leaseEndDate,
                            correctedBy: adminUser._id,
                            correctedByEmail: adminUser.email,
                            correctedAt: new Date(),
                            studentId: accrual.metadata?.studentId || studentIdString,
                            studentName: accrual.metadata?.studentName || `${application.firstName} ${application.lastName}`,
                            accrualMonth: accrualMonth,
                            accrualYear: accrualYear,
                            correctionType: 'early_lease_end'
                        }
                    });
                    
                    await reversalEntry.save({ session });
                    
                    // Log to deletion log (for audit trail)
                    try {
                        await DeletionLogService.logDeletion({
                            modelName: 'TransactionEntry',
                            documentId: accrual._id,
                            deletedData: accrual.toObject(),
                            deletedBy: adminUser._id,
                            reason: `Accrual correction: ${reason} - Accrual for ${accrualMonth}/${accrualYear} reversed`,
                            context: 'accrual_correction',
                            metadata: {
                                studentId: studentIdString,
                                studentName: `${application.firstName} ${application.lastName}`,
                                accrualMonth,
                                accrualYear,
                                originalLeaseEndDate: application.endDate,
                                actualLeaseEndDate: leaseEndDate,
                                correctionType: 'early_lease_end',
                                reversalEntryId: reversalResult?.reversalEntry?._id
                            },
                            session: session
                        });
                    } catch (logError) {
                        console.error(`⚠️ Error logging deletion for accrual ${accrual._id}:`, logError.message);
                    }
                    
                    reversedAccruals.push({
                        accrualId: accrual._id,
                        transactionId: accrual.transactionId,
                        month: accrualMonth,
                        year: accrualYear,
                        amount: accrual.totalDebit,
                        description: accrual.description,
                        reversalEntryId: reversalEntry._id,
                        reversalTransactionId: reversalTransactionId
                    });
                    
                } catch (error) {
                    console.error(`❌ Error reversing accrual ${accrual._id}:`, error);
                    errors.push({
                        accrualId: accrual._id,
                        error: error.message
                    });
                }
            }
            
            // Update application end date if requested
            let leaseEndDateUpdated = false;
            if (updateLeaseEndDate && application.endDate) {
                const originalEndDate = application.endDate;
                const newEndDate = new Date(leaseEndDate);
                
                // Only update if the new date is different and earlier
                if (newEndDate < originalEndDate) {
                    application.endDate = newEndDate;
                    application.updatedBy = adminUser._id;
                    application.updatedAt = new Date();
                    await application.save({ session });
                    leaseEndDateUpdated = true;
                    
                    console.log(`✅ Updated lease end date: ${originalEndDate} → ${newEndDate}`);
                }
            }
            
            // Log to audit trail
            try {
                await createAuditLog({
                    user: adminUser._id,
                    action: 'correct_accruals_early_lease_end',
                    collection: 'TransactionEntry',
                    recordId: studentId,
                    before: {
                        incorrectAccrualsCount: incorrectAccruals.length,
                        originalLeaseEndDate: application.endDate
                    },
                    after: {
                        reversedAccrualsCount: reversedAccruals.length,
                        updatedLeaseEndDate: leaseEndDateUpdated ? leaseEndDate : null
                    },
                    details: JSON.stringify({
                        reason,
                        actualLeaseEndDate: leaseEndDate,
                        reversedAccruals: reversedAccruals.map(a => ({
                            accrualId: a.accrualId,
                            month: a.month,
                            year: a.year,
                            amount: a.amount
                        })),
                        errors: errors.length > 0 ? errors : undefined
                    })
                });
            } catch (auditError) {
                console.error('⚠️ Failed to create audit log:', auditError);
            }
            
            await session.commitTransaction();
            
            console.log(`✅ Accrual correction completed: ${reversedAccruals.length} accruals reversed`);
            
            return {
                success: true,
                message: `Successfully corrected ${reversedAccruals.length} incorrect accruals`,
                correctedAccruals: reversedAccruals,
                errors: errors.length > 0 ? errors : undefined,
                updatedLeaseEndDate: leaseEndDateUpdated,
                studentInfo: {
                    id: studentId,
                    name: `${application.firstName} ${application.lastName}`,
                    email: application.email,
                    originalLeaseEndDate: application.endDate,
                    actualLeaseEndDate: leaseEndDate
                }
            };
            
        } catch (error) {
            await session.abortTransaction();
            console.error('❌ Error correcting accruals:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            session.endSession();
        }
    }
    
    /**
     * Find all students with potential incorrect accruals
     * (accruals created for months after their current lease end date)
     * 
     * @param {number} year - Year to check (optional, defaults to current year)
     * @param {number} month - Month to check (optional, defaults to current month)
     * @returns {Promise<Array>} List of students with potential issues
     */
    static async findStudentsWithIncorrectAccruals(year = null, month = null) {
        try {
            const startTime = Date.now();
            const checkDate = year && month 
                ? new Date(year, month - 1, 1)
                : new Date();
            
            const checkYear = checkDate.getFullYear();
            const checkMonth = checkDate.getMonth() + 1;
            
            console.log(`🔍 Finding students with incorrect accruals for ${checkMonth}/${checkYear}`);
            
            // Get all approved or expired applications with their update history
            // Include expired applications because they may have had accruals created before expiration
            const applications = await Application.find({
                status: { $in: ['approved', 'expired'] },
                endDate: { $exists: true, $ne: null }
            })
            .select('_id student firstName lastName email startDate endDate createdAt updatedAt updatedBy status')
            .lean();
            
            console.log(`📋 Found ${applications.length} approved/expired applications with endDate to check`);
            
            if (applications.length === 0) {
                return {
                    success: true,
                    count: 0,
                    totalApplicationsChecked: 0,
                    issues: []
                };
            }
            
            // OPTIMIZATION: Batch fetch all accruals and reversals in one query instead of N+1 queries
            const applicationIds = applications.map(app => app._id);
            const studentIds = applications
                .map(app => app.student)
                .filter(id => id)
                .map(id => new mongoose.Types.ObjectId(id));
            
            // Build comprehensive query to get all accruals for all students at once
            const allAccrualQuery = {
                source: 'rental_accrual',
                status: 'posted',
                $or: [
                    { sourceId: { $in: applicationIds } },
                    { sourceId: { $in: studentIds } },
                    { 'metadata.applicationId': { $in: applicationIds.map(id => id.toString()) } },
                    { 'metadata.studentId': { $in: [...applicationIds.map(id => id.toString()), ...studentIds.map(id => id.toString())] } },
                    { 'metadata.userId': { $in: studentIds.map(id => id.toString()) } },
                    { 'entries.accountCode': { $in: [...applicationIds.map(id => `1100-${id}`), ...studentIds.map(id => `1100-${id}`)] } }
                ]
            };
            
            // Batch fetch all reversals
            const allReversalQuery = {
                source: 'rental_accrual_reversal',
                status: 'posted',
                $or: [
                    { sourceId: { $in: applicationIds } },
                    { sourceId: { $in: studentIds } },
                    { 'metadata.applicationId': { $in: applicationIds.map(id => id.toString()) } },
                    { 'metadata.studentId': { $in: [...applicationIds.map(id => id.toString()), ...studentIds.map(id => id.toString())] } }
                ]
            };
            
            // Execute both queries in parallel
            const [allAccruals, allReversals] = await Promise.all([
                TransactionEntry.find(allAccrualQuery).lean(),
                TransactionEntry.find(allReversalQuery).lean()
            ]);
            
            console.log(`📊 Batch fetched ${allAccruals.length} accruals and ${allReversals.length} reversals`);
            
            // Build a map of reversed accrual IDs for fast lookup
            const reversedAccrualIds = new Set();
            allReversals.forEach(reversal => {
                if (reversal.sourceId) {
                    reversedAccrualIds.add(reversal.sourceId.toString());
                }
                if (reversal.metadata?.originalAccrualId) {
                    reversedAccrualIds.add(reversal.metadata.originalAccrualId.toString());
                }
            });
            
            // Build maps for fast lookup: applicationId -> accruals, studentId -> accruals
            const accrualsByApplicationId = new Map();
            const accrualsByStudentId = new Map();
            
            // Create sets of ID strings for fast lookup
            const applicationIdStrings = new Set(applicationIds.map(id => id.toString()));
            const studentIdStrings = new Set(studentIds.map(id => id.toString()));
            
            allAccruals.forEach(accrual => {
                // Map by application ID (from sourceId)
                if (accrual.sourceId) {
                    const sourceIdStr = accrual.sourceId.toString();
                    if (applicationIdStrings.has(sourceIdStr)) {
                        if (!accrualsByApplicationId.has(sourceIdStr)) {
                            accrualsByApplicationId.set(sourceIdStr, []);
                        }
                        accrualsByApplicationId.get(sourceIdStr).push(accrual);
                    }
                }
                
                // Map by application ID (from metadata.applicationId)
                if (accrual.metadata?.applicationId) {
                    const appId = accrual.metadata.applicationId.toString();
                    if (applicationIdStrings.has(appId)) {
                        if (!accrualsByApplicationId.has(appId)) {
                            accrualsByApplicationId.set(appId, []);
                        }
                        accrualsByApplicationId.get(appId).push(accrual);
                    }
                }
                
                // Map by student ID (from sourceId)
                if (accrual.sourceId) {
                    const sourceIdStr = accrual.sourceId.toString();
                    if (studentIdStrings.has(sourceIdStr)) {
                        if (!accrualsByStudentId.has(sourceIdStr)) {
                            accrualsByStudentId.set(sourceIdStr, []);
                        }
                        accrualsByStudentId.get(sourceIdStr).push(accrual);
                    }
                }
                
                // Map by student ID (from metadata.studentId or metadata.userId)
                if (accrual.metadata?.studentId) {
                    const studentId = accrual.metadata.studentId.toString();
                    if (studentIdStrings.has(studentId)) {
                        if (!accrualsByStudentId.has(studentId)) {
                            accrualsByStudentId.set(studentId, []);
                        }
                        accrualsByStudentId.get(studentId).push(accrual);
                    }
                    // Also check if it's an application ID
                    if (applicationIdStrings.has(studentId)) {
                        if (!accrualsByApplicationId.has(studentId)) {
                            accrualsByApplicationId.set(studentId, []);
                        }
                        accrualsByApplicationId.get(studentId).push(accrual);
                    }
                }
                
                if (accrual.metadata?.userId) {
                    const userId = accrual.metadata.userId.toString();
                    if (studentIdStrings.has(userId)) {
                        if (!accrualsByStudentId.has(userId)) {
                            accrualsByStudentId.set(userId, []);
                        }
                        accrualsByStudentId.get(userId).push(accrual);
                    }
                }
                
                // Map by account code
                if (accrual.entries) {
                    accrual.entries.forEach(entry => {
                        if (entry.accountCode && entry.accountCode.startsWith('1100-')) {
                            const id = entry.accountCode.replace('1100-', '');
                            if (applicationIdStrings.has(id)) {
                                if (!accrualsByApplicationId.has(id)) {
                                    accrualsByApplicationId.set(id, []);
                                }
                                accrualsByApplicationId.get(id).push(accrual);
                            }
                            if (studentIdStrings.has(id)) {
                                if (!accrualsByStudentId.has(id)) {
                                    accrualsByStudentId.set(id, []);
                                }
                                accrualsByStudentId.get(id).push(accrual);
                            }
                        }
                    });
                }
            });
            
            // 🔄 Pre-fetch all renewed applications for all students to avoid N+1 queries
            const allStudentIds = applications
                .map(app => app.student)
                .filter(id => id)
                .map(id => new mongoose.Types.ObjectId(id));
            
            const renewedApplications = await Application.find({
                student: { $in: allStudentIds },
                status: { $in: ['approved', 'pending'] }
            }).lean();
            
            // Build a map: studentId -> renewed applications
            const renewedAppsByStudent = new Map();
            renewedApplications.forEach(renewedApp => {
                if (renewedApp.student) {
                    const studentIdStr = renewedApp.student.toString();
                    if (!renewedAppsByStudent.has(studentIdStr)) {
                        renewedAppsByStudent.set(studentIdStr, []);
                    }
                    renewedAppsByStudent.get(studentIdStr).push(renewedApp);
                }
            });
            
            console.log(`🔄 Found ${renewedApplications.length} renewed/active applications for ${renewedAppsByStudent.size} students`);
            
            const issues = [];
            
            for (const app of applications) {
                if (!app.endDate) {
                    console.log(`⏭️ Skipping application ${app._id} - no endDate`);
                    continue;
                }
                
                const appEndDate = new Date(app.endDate);
                const appEndYear = appEndDate.getFullYear();
                const appEndMonth = appEndDate.getMonth() + 1;
                
                // Check if lease was updated (updatedAt is significantly different from createdAt)
                const createdAt = app.createdAt ? new Date(app.createdAt) : null;
                const updatedAt = app.updatedAt ? new Date(app.updatedAt) : null;
                const leaseWasUpdated = updatedAt && createdAt && 
                    (updatedAt.getTime() - createdAt.getTime()) > 60000; // More than 1 minute difference
                
                // 🔄 Check for renewed applications for this student
                const studentIdString = app.student ? app.student.toString() : null;
                const renewedApps = studentIdString ? (renewedAppsByStudent.get(studentIdString) || []) : [];
                const renewedApp = renewedApps.find(ra => ra._id.toString() !== app._id.toString());
                
                // Only log in development or for first few applications
                if (process.env.NODE_ENV === 'development' || issues.length < 3) {
                    console.log(`\n🔍 Checking application ${app._id} (${app.firstName} ${app.lastName})`);
                    console.log(`   Lease end date: ${appEndDate.toISOString()} (${appEndMonth}/${appEndYear})`);
                    if (leaseWasUpdated) {
                        console.log(`   ⚠️ Lease was updated: ${updatedAt.toISOString()} (originally created: ${createdAt.toISOString()})`);
                    }
                    if (renewedApp) {
                        console.log(`   🔄 Found renewed application: ${renewedApp.applicationCode || renewedApp._id}`);
                        console.log(`      Renewed lease: ${renewedApp.startDate} to ${renewedApp.endDate}`);
                    }
                }
                
                // OPTIMIZATION: Get accruals from pre-built maps instead of querying
                const applicationIdString = app._id.toString();
                // studentIdString already declared above (line 651)
                
                // Get accruals from maps (deduplicate)
                const accrualIds = new Set();
                const accruals = [];
                
                // Get accruals by application ID
                const appAccruals = accrualsByApplicationId.get(applicationIdString) || [];
                appAccruals.forEach(acc => {
                    if (!accrualIds.has(acc._id.toString())) {
                        accrualIds.add(acc._id.toString());
                        accruals.push(acc);
                    }
                });
                
                // Get accruals by student ID
                if (studentIdString) {
                    const studentAccruals = accrualsByStudentId.get(studentIdString) || [];
                    studentAccruals.forEach(acc => {
                        if (!accrualIds.has(acc._id.toString())) {
                            accrualIds.add(acc._id.toString());
                            accruals.push(acc);
                        }
                    });
                }
                
                // Check for accruals after lease end date
                const incorrectAccruals = [];
                
                for (const accrual of accruals) {
                    // Skip if this accrual has already been reversed
                    if (reversedAccrualIds.has(accrual._id.toString())) {
                        if (process.env.NODE_ENV === 'development') {
                            console.log(`   ⏭️ Skipping accrual ${accrual._id} - already reversed`);
                        }
                        continue;
                    }
                    
                    let accrualMonth, accrualYear;
                    
                    // Try multiple ways to extract accrual month/year (same logic as correctAccrualsForEarlyLeaseEnd)
                    if (accrual.metadata?.accrualMonth && accrual.metadata?.accrualYear) {
                        // Format: accrualMonth: 10, accrualYear: 2025
                        accrualMonth = parseInt(accrual.metadata.accrualMonth);
                        accrualYear = parseInt(accrual.metadata.accrualYear);
                    } else if (accrual.metadata?.month) {
                        // Format: month: "2025-10"
                        const monthStr = accrual.metadata.month;
                        const monthMatch = monthStr.match(/(\d{4})-(\d{2})/);
                        if (monthMatch) {
                            accrualYear = parseInt(monthMatch[1]);
                            accrualMonth = parseInt(monthMatch[2]);
                        } else {
                            // Fallback to transaction date
                            const accrualDate = new Date(accrual.date);
                            accrualMonth = accrualDate.getMonth() + 1;
                            accrualYear = accrualDate.getFullYear();
                        }
                    } else {
                        // Fallback to transaction date
                        const accrualDate = new Date(accrual.date);
                        accrualMonth = accrualDate.getMonth() + 1;
                        accrualYear = accrualDate.getFullYear();
                    }
                    
                    // Validate extracted month/year
                    if (!accrualMonth || !accrualYear || accrualMonth < 1 || accrualMonth > 12) {
                        if (process.env.NODE_ENV === 'development') {
                            console.log(`   ⚠️ Skipping accrual ${accrual._id} - invalid month/year: ${accrualMonth}/${accrualYear}`);
                        }
                        continue;
                    }
                    
                    // Check if accrual is for a month AFTER the lease end date
                    const isAfterLeaseEnd = 
                        accrualYear > appEndYear || 
                        (accrualYear === appEndYear && accrualMonth > appEndMonth);
                    
                    // 🔄 Check if the accrual month is covered by a renewed lease
                    let isCoveredByRenewedLease = false;
                    if (renewedApp && isAfterLeaseEnd) {
                        const accrualDate = new Date(accrualYear, accrualMonth - 1, 1); // First day of accrual month
                        const renewedStart = new Date(renewedApp.startDate);
                        const renewedEnd = new Date(renewedApp.endDate);
                        
                        // Check if accrual month falls within the renewed lease period
                        isCoveredByRenewedLease = accrualDate >= renewedStart && accrualDate <= renewedEnd;
                        
                        if (isCoveredByRenewedLease && (process.env.NODE_ENV === 'development' || issues.length < 3)) {
                            console.log(`   ✅ Accrual ${accrualMonth}/${accrualYear} is covered by renewed lease - SKIPPING`);
                        }
                    }
                    
                    const isLeaseStart = accrual.metadata?.type === 'lease_start' || 
                                        (accrual.description && /lease start/i.test(accrual.description));
                    
                    // Only log in development
                    if (process.env.NODE_ENV === 'development') {
                        console.log(`   📊 Accrual ${accrual._id}: ${accrualMonth}/${accrualYear} | After lease end: ${isAfterLeaseEnd} | Covered by renewal: ${isCoveredByRenewedLease} | Is lease start: ${isLeaseStart}`);
                    }
                    
                    // Only mark as incorrect if:
                    // 1. It's after the lease end date, AND
                    // 2. It's NOT covered by a renewed lease, AND
                    // 3. It's NOT a lease start transaction
                    if (isAfterLeaseEnd && !isCoveredByRenewedLease && !isLeaseStart) {
                        incorrectAccruals.push({
                            accrualId: accrual._id,
                            transactionId: accrual.transactionId,
                            month: accrualMonth,
                            year: accrualYear,
                            amount: accrual.totalDebit,
                            description: accrual.description,
                            createdAt: accrual.createdAt,
                            issue: `Accrual for ${accrualMonth}/${accrualYear} is after lease end date (${appEndMonth}/${appEndYear}) and not covered by renewed lease`
                        });
                    }
                }
                
                if (incorrectAccruals.length > 0) {
                    if (process.env.NODE_ENV === 'development') {
                        console.log(`   ⚠️ Found ${incorrectAccruals.length} incorrect accruals for this application`);
                    }
                    
                    // Check if accruals were created after the lease end date was updated
                    const accrualsCreatedAfterUpdate = incorrectAccruals.filter(accrual => {
                        if (!leaseWasUpdated || !updatedAt) return false;
                        const accrualCreatedAt = accrual.createdAt ? new Date(accrual.createdAt) : null;
                        return accrualCreatedAt && accrualCreatedAt > updatedAt;
                    });
                    
                    issues.push({
                        applicationId: app._id.toString(),
                        studentId: app._id.toString(), // Same as applicationId for compatibility
                        studentName: `${app.firstName} ${app.lastName}`,
                        email: app.email,
                        leaseEndDate: app.endDate,
                        leaseStartDate: app.startDate,
                        leaseWasUpdated: leaseWasUpdated,
                        leaseUpdatedAt: updatedAt ? updatedAt.toISOString() : null,
                        leaseCreatedAt: createdAt ? createdAt.toISOString() : null,
                        incorrectAccrualsCount: incorrectAccruals.length,
                        accrualsCreatedAfterUpdate: accrualsCreatedAfterUpdate.length,
                        incorrectAccruals: incorrectAccruals.map(acc => ({
                            ...acc,
                            createdAt: acc.createdAt ? new Date(acc.createdAt).toISOString() : null,
                            wasCreatedAfterLeaseUpdate: leaseWasUpdated && updatedAt && acc.createdAt ? 
                                new Date(acc.createdAt) > updatedAt : false
                        }))
                    });
                }
            }
            
            const endTime = Date.now();
            const duration = ((endTime - startTime) / 1000).toFixed(2);
            
            console.log(`\n📊 Summary (completed in ${duration}s):`);
            console.log(`   Total applications checked: ${applications.length}`);
            console.log(`   Students with incorrect accruals: ${issues.length}`);
            
            // Log summary of issues (only in development or if issues found)
            if (issues.length > 0 && (process.env.NODE_ENV === 'development' || issues.length <= 10)) {
                console.log(`\n⚠️ Students with incorrect accruals:`);
                issues.slice(0, 10).forEach((issue, idx) => {
                    console.log(`   ${idx + 1}. ${issue.studentName} (${issue.email})`);
                    console.log(`      Lease end: ${new Date(issue.leaseEndDate).toISOString().split('T')[0]}`);
                    console.log(`      Incorrect accruals: ${issue.incorrectAccrualsCount}`);
                    if (issue.leaseWasUpdated) {
                        console.log(`      ⚠️ Lease was updated after creation`);
                    }
                });
                if (issues.length > 10) {
                    console.log(`   ... and ${issues.length - 10} more`);
                }
            }
            
            return {
                success: true,
                count: issues.length,
                totalApplicationsChecked: applications.length,
                duration: `${duration}s`,
                issues
            };
            
        } catch (error) {
            console.error('❌ Error finding students with incorrect accruals:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = AccrualCorrectionService;

