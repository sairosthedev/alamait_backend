const mongoose = require('mongoose');
const Application = require('../models/Application');
const Debtor = require('../models/Debtor');
const User = require('../models/User');
const { Residence } = require('../models/Residence');
const { parseCalendarDate, getCalendarParts } = require('../utils/calendarDate');
// const { createAuditLog } = require('./auditService'); // TODO: Implement audit service

/**
 * Service to handle updating student lease dates and automatically updating debtor records
 */
class LeaseUpdateService {
    static applySession(query, session) {
        return session ? query.session(session) : query;
    }

    static calendarDateKey(parts) {
        return parts.year * 10000 + parts.month * 100 + parts.day;
    }

    static assertStartBeforeEnd(startDate, endDate) {
        const start = parseCalendarDate(startDate);
        const end = parseCalendarDate(endDate);
        if (!start || !end) {
            throw new Error('Both startDate and endDate are required');
        }
        const startParts = getCalendarParts(start);
        const endParts = getCalendarParts(end);
        if (!startParts || !endParts) {
            throw new Error('Invalid start or end date');
        }
        if (LeaseUpdateService.calendarDateKey(startParts) > LeaseUpdateService.calendarDateKey(endParts)) {
            throw new Error('Start date must be before end date');
        }
    }
    
    static async updateApplicationLeaseById(applicationId, leaseUpdates, updatedBy, options = {}) {
        return LeaseUpdateService.updateStudentLeaseDates(
            null,
            leaseUpdates,
            updatedBy,
            { applicationId, applicationOnly: true, adminUser: options.adminUser }
        );
    }

    /**
     * Resolve application + debtor from student, application, or debtor id.
     */
    static async resolveLeaseContext(identifier) {
        if (!identifier || !mongoose.Types.ObjectId.isValid(String(identifier))) {
            throw new Error('Invalid lease identifier');
        }

        const id = String(identifier);
        let application = null;
        let debtor = null;

        application = await Application.findById(id).lean();
        if (!application) {
            debtor = await Debtor.findById(id).lean();
            if (debtor?.application) {
                application = await Application.findById(debtor.application).lean();
            }
        }
        if (!application) {
            debtor = debtor || (await Debtor.findOne({ user: id }).lean());
            if (debtor?.application) {
                application = await Application.findById(debtor.application).lean();
            }
        }
        if (!application) {
            application = await Application.findOne({
                student: id,
                status: { $in: ['approved', 'expired'] }
            })
                .sort({ endDate: -1 })
                .lean();
        }
        if (!application) {
            throw new Error('No application found for this tenant');
        }

        if (!debtor) {
            debtor = await Debtor.findOne({
                $or: [{ application: application._id }, { user: application.student }]
            }).lean();
        }

        return {
            applicationId: application._id.toString(),
            application,
            debtor,
            studentId: application.student?.toString() || null,
            debtorId: debtor?._id?.toString() || null,
            debtorCode: debtor?.debtorCode || null
        };
    }

    /**
     * Backfill all missing monthly accruals for the application's current lease (through today).
     */
    static async backfillAccrualsForApplication(applicationId, updatedBy) {
        const ctx = await this.resolveLeaseContext(applicationId);
        const app = await Application.findById(ctx.applicationId);
        if (!app) {
            throw new Error('Application not found');
        }

        const now = new Date();
        const leaseEnd = new Date(app.endDate);
        const periodEnd = leaseEnd < now ? leaseEnd : now;

        const accrualBackfill = await this.createMissingAccrualsForExtendedLease(
            app,
            new Date(app.startDate),
            periodEnd,
            updatedBy,
            null
        );

        const debtorSync = await this.syncDebtorLeaseFromApplication(app, updatedBy);

        try {
            await LeaseUpdateService.syncTenantRoomTracking(app.toObject ? app.toObject() : app);
        } catch (roomErr) {
            console.error(`⚠️ Room sync after accrual backfill: ${roomErr.message}`);
        }

        return {
            success: true,
            applicationId: ctx.applicationId,
            studentId: ctx.studentId,
            debtorCode: ctx.debtorCode,
            lease: {
                startDate: app.startDate,
                endDate: app.endDate
            },
            accrualBackfill,
            debtorSync
        };
    }

    static formatDateKey(value) {
        if (!value) return null;
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return null;
        return d.toISOString().split('T')[0];
    }

    static datesMatch(a, b) {
        const left = LeaseUpdateService.formatDateKey(a);
        const right = LeaseUpdateService.formatDateKey(b);
        return !!(left && right && left === right);
    }

    /**
     * Lease vs accrual reconciliation snapshot for frontend (application, debtor, or student id).
     */
    static async getLeaseReconciliationStatus(identifier) {
        const TenantAccrualCheckService = require('./tenantAccrualCheckService');
        const ctx = await LeaseUpdateService.resolveLeaseContext(identifier);
        const app = ctx.application;

        const validationResult = await TenantAccrualCheckService.validateTenantAccruals(
            ctx.applicationId,
            false
        );

        const validation = validationResult.validation || null;
        const tenantName = validation?.studentName
            || `${app.firstName || ''} ${app.lastName || ''}`.trim()
            || 'Unknown tenant';

        const applicationLease = {
            startDate: LeaseUpdateService.formatDateKey(app.startDate),
            endDate: LeaseUpdateService.formatDateKey(app.endDate),
            status: app.status,
            applicationCode: app.applicationCode,
            roomNumber: app.allocatedRoomDetails?.roomNumber || app.allocatedRoom || null
        };

        const debtorLease = ctx.debtor?.leaseInfo
            ? {
                startDate: LeaseUpdateService.formatDateKey(ctx.debtor.leaseInfo.startDate),
                endDate: LeaseUpdateService.formatDateKey(ctx.debtor.leaseInfo.endDate)
            }
            : null;

        const issues = [];

        if (!ctx.debtor) {
            issues.push({
                code: 'missing_debtor',
                severity: 'error',
                message: 'No debtor account linked to this tenant'
            });
        }

        if (debtorLease && !LeaseUpdateService.datesMatch(applicationLease.startDate, debtorLease.startDate)) {
            issues.push({
                code: 'debtor_start_mismatch',
                severity: 'warning',
                message: `Debtor start (${debtorLease.startDate}) differs from application (${applicationLease.startDate})`
            });
        }

        if (debtorLease && !LeaseUpdateService.datesMatch(applicationLease.endDate, debtorLease.endDate)) {
            issues.push({
                code: 'debtor_end_mismatch',
                severity: 'warning',
                message: `Debtor end (${debtorLease.endDate}) differs from application (${applicationLease.endDate})`
            });
        }

        if (validation && !validation.leaseStartExists && new Date(app.startDate) <= new Date()) {
            issues.push({
                code: 'missing_lease_start',
                severity: 'error',
                message: 'Lease start accrual is missing'
            });
        }

        (validation?.monthlyAccruals?.missing || []).forEach((monthKey) => {
            issues.push({
                code: 'missing_monthly_accrual',
                severity: 'error',
                message: `Missing monthly accrual for ${monthKey}`,
                monthKey
            });
        });

        (validation?.errors || []).forEach((err) => {
            issues.push({
                code: 'validation_error',
                severity: 'error',
                message: err.error || err.message || 'Accrual validation error',
                detail: err
            });
        });

        const missingCount = validation?.monthlyAccruals?.missing?.length || 0;
        const inSync = issues.filter(i => i.severity === 'error').length === 0;

        return {
            inSync,
            tenant: {
                name: tenantName,
                applicationId: ctx.applicationId,
                studentId: ctx.studentId,
                debtorId: ctx.debtorId,
                debtorCode: ctx.debtorCode
            },
            applicationLease,
            debtorLease,
            accruals: {
                leaseStartExists: validation?.leaseStartExists ?? null,
                expectedMonths: validation?.monthlyAccruals?.expected || [],
                foundMonths: validation?.monthlyAccruals?.found || [],
                missingMonths: validation?.monthlyAccruals?.missing || [],
                missingCount
            },
            debtorFinancials: ctx.debtor
                ? {
                    totalOwed: ctx.debtor.totalOwed,
                    totalPaid: ctx.debtor.totalPaid,
                    currentBalance: ctx.debtor.currentBalance,
                    status: ctx.debtor.status
                }
                : null,
            issues,
            actions: {
                updateLease: {
                    method: 'PUT',
                    application: `/api/admin/leases/applications/${ctx.applicationId}/lease`,
                    debtor: ctx.debtorId
                        ? `/api/admin/leases/debtors/${ctx.debtorId}/lease`
                        : null,
                    student: ctx.studentId
                        ? `/api/admin/leases/students/${ctx.studentId}/lease`
                        : null,
                    body: { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
                },
                syncAccruals: {
                    method: 'POST',
                    application: `/api/admin/leases/applications/${ctx.applicationId}/sync-accruals`,
                    debtor: ctx.debtorId
                        ? `/api/admin/leases/debtors/${ctx.debtorId}/sync-accruals`
                        : null
                },
                reconcileRentAccruals: {
                    method: 'POST',
                    admin: '/api/admin/rent-accrual-reconciliation/reconcile',
                    finance: '/api/finance/rent-accrual-reconciliation/reconcile',
                    body: {
                        applicationId: ctx.applicationId,
                        studentId: ctx.studentId || undefined
                    }
                }
            }
        };
    }

    /**
     * Update student lease dates and automatically update debtor record
     * @param {string|null} studentId - Student/User ID (optional when applicationId provided)
     * @param {Object} leaseUpdates - Lease date updates
     * @param {Date} leaseUpdates.startDate - New lease start date
     * @param {Date} leaseUpdates.endDate - New lease end date
     * @param {string} updatedBy - User ID who is making the update
     * @param {Object} [options] - Optional { applicationId, applicationOnly }
     * @returns {Promise<Object>} Update result
     */
    static async updateStudentLeaseDates(studentId, leaseUpdates, updatedBy, options = {}) {
        const session = await mongoose.startSession();
        let resolvedApplicationId = options.applicationId || null;
        let resolvedStudentId = studentId || null;
        let accrualReversalContext = null;
        const accrualBackfill = {
            extendedEnd: null,
            earlierStart: null
        };

        try {
            await session.withTransaction(async () => {
                console.log(`🔄 Starting lease date update for application/student: ${options.applicationId || studentId || 'unknown'}`);
                
                // Validate input
                if (!leaseUpdates.startDate || !leaseUpdates.endDate) {
                    throw new Error('Both startDate and endDate are required');
                }
                
                LeaseUpdateService.assertStartBeforeEnd(leaseUpdates.startDate, leaseUpdates.endDate);

                const normalizedStartDate = parseCalendarDate(leaseUpdates.startDate);
                const normalizedEndDate = parseCalendarDate(leaseUpdates.endDate);

                let application = null;
                let student = null;

                if (options.applicationId) {
                    application = await Application.findById(options.applicationId).session(session);
                }

                if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
                    student = await User.findById(studentId).session(session);
                }

                if (!application && student) {
                    application = await Application.findOne({
                        student: studentId,
                        status: { $in: ['approved', 'expired'] }
                    })
                        .sort({ endDate: -1 })
                        .session(session);
                }

                if (!application) {
                    throw new Error('No application found for this lease update');
                }

                if (!student && application.student) {
                    student = await User.findById(application.student).session(session);
                }

                if (!student && !options.applicationOnly && !options.applicationId) {
                    throw new Error('Student not found');
                }

                const effectiveStudentId = student?._id?.toString()
                    || application.student?.toString()
                    || studentId;
                resolvedApplicationId = application._id.toString();
                resolvedStudentId = effectiveStudentId || null;
                
                console.log(`📋 Found application: ${application.applicationCode}`);
                
                // Store original values for audit
                const originalStartDate = application.startDate;
                const originalEndDate = application.endDate;
                
                // Update application lease dates
                application.startDate = normalizedStartDate;
                application.endDate = normalizedEndDate;
                application.updatedBy = updatedBy;
                application.updatedAt = new Date();

                const now = new Date();
                const terminalStatuses = ['cancelled', 'rejected', 'forfeited', 'waitlisted'];
                if (
                    normalizedEndDate >= now &&
                    !terminalStatuses.includes(String(application.status || '').toLowerCase())
                ) {
                    application.status = 'approved';
                }
                
                await application.save({ session });
                console.log(`✅ Updated application lease dates:`);
                console.log(`   Start: ${originalStartDate?.toISOString().split('T')[0]} → ${application.startDate.toISOString().split('T')[0]}`);
                console.log(`   End: ${originalEndDate?.toISOString().split('T')[0]} → ${application.endDate.toISOString().split('T')[0]}`);
                
                if (originalEndDate && new Date(leaseUpdates.endDate) < new Date(originalEndDate)) {
                    accrualReversalContext = {
                        applicationId: application._id.toString(),
                        endDate: leaseUpdates.endDate
                    };
                }
                
                // If lease was extended (end date moved later), check for missing accruals and create them
                if (originalEndDate && new Date(leaseUpdates.endDate) > new Date(originalEndDate)) {
                    console.log(`📅 Application end date moved later - checking for missing accruals...`);
                    console.log(`   Original end date: ${originalEndDate.toISOString().split('T')[0]}`);
                    console.log(`   New end date: ${leaseUpdates.endDate}`);
                    
                    try {
                        accrualBackfill.extendedEnd = await this.createMissingAccrualsForExtendedLease(
                            application,
                            originalEndDate,
                            new Date(leaseUpdates.endDate),
                            updatedBy,
                            session
                        );
                    } catch (accrualError) {
                        console.error(`❌ Error creating missing accruals for extended lease: ${accrualError.message}`);
                        accrualBackfill.extendedEnd = {
                            success: false,
                            error: accrualError.message
                        };
                    }
                }
                
                // 3. If start date was moved earlier, check for missing accruals from new start to old start
                if (originalStartDate && new Date(leaseUpdates.startDate) < new Date(originalStartDate)) {
                    console.log(`📅 Application start date moved earlier - checking for missing accruals...`);
                    console.log(`   Original start date: ${originalStartDate.toISOString().split('T')[0]}`);
                    console.log(`   New start date: ${leaseUpdates.startDate}`);
                    
                    try {
                        accrualBackfill.earlierStart = await this.createMissingAccrualsForExtendedLease(
                            application,
                            new Date(leaseUpdates.startDate),
                            originalStartDate,
                            updatedBy,
                            session
                        );
                    } catch (accrualError) {
                        console.error(`❌ Error creating missing accruals for earlier start date: ${accrualError.message}`);
                        accrualBackfill.earlierStart = {
                            success: false,
                            error: accrualError.message
                        };
                    }
                }
                
                // Find and update debtor record
                let debtor = null;
                if (effectiveStudentId) {
                    debtor = await Debtor.findOne({ user: effectiveStudentId }).session(session);
                }
                if (!debtor) {
                    debtor = await Debtor.findOne({ application: application._id }).session(session);
                }
                
                if (debtor) {
                    console.log(`💰 Found debtor: ${debtor.debtorCode}`);
                    
                    // Store original debtor values for audit
                    const originalDebtorStartDate = debtor.leaseInfo?.startDate;
                    const originalDebtorEndDate = debtor.leaseInfo?.endDate;
                    const originalTotalOwed = debtor.totalOwed;
                    const originalFinancialBreakdown = debtor.financialBreakdown;
                    
                    // Update debtor lease information
                    if (!debtor.leaseInfo) {
                        debtor.leaseInfo = {};
                    }
                    
                    debtor.leaseInfo.startDate = new Date(leaseUpdates.startDate);
                    debtor.leaseInfo.endDate = new Date(leaseUpdates.endDate);
                    if (mongoose.Types.ObjectId.isValid(String(updatedBy))) {
                        debtor.updatedBy = updatedBy;
                    }
                    debtor.updatedAt = new Date();
                    
                    // Recalculate financial information based on new lease dates
                    try {
                        await this.recalculateDebtorFinancials(debtor, application, session);
                    } catch (recalcError) {
                        console.error(`❌ Error recalculating debtor financials: ${recalcError.message}`);
                    }
                    
                    try {
                        await debtor.save({ session });
                    } catch (debtorSaveError) {
                        console.error(`❌ Error saving debtor after lease update: ${debtorSaveError.message}`);
                    }
                    
                    console.log(`✅ Updated debtor lease dates and financials:`);
                    console.log(`   Start: ${originalDebtorStartDate?.toISOString().split('T')[0]} → ${debtor.leaseInfo.startDate.toISOString().split('T')[0]}`);
                    console.log(`   End: ${originalDebtorEndDate?.toISOString().split('T')[0]} → ${debtor.leaseInfo.endDate.toISOString().split('T')[0]}`);
                    console.log(`   Total Owed: $${originalTotalOwed} → $${debtor.totalOwed}`);
                    
                    // Note: Accrual reversal/creation is handled earlier in the function (before debtor update)
                    // TODO: Create audit log for debtor update
                    console.log(`📝 Audit: Debtor ${debtor.debtorCode} updated by user ${updatedBy}`);
                    console.log(`   Before: Start: ${originalDebtorStartDate?.toISOString().split('T')[0]}, End: ${originalDebtorEndDate?.toISOString().split('T')[0]}, Total: $${originalTotalOwed}`);
                    console.log(`   After: Start: ${debtor.leaseInfo.startDate.toISOString().split('T')[0]}, End: ${debtor.leaseInfo.endDate.toISOString().split('T')[0]}, Total: $${debtor.totalOwed}`);
                } else {
                    console.log(`⚠️ No debtor record found for application: ${application.applicationCode}`);
                }
                
                // TODO: Create audit log for application update
                console.log(`📝 Audit: Application ${application.applicationCode} updated by user ${updatedBy}`);
                console.log(`   Before: Start: ${originalStartDate?.toISOString().split('T')[0]}, End: ${originalEndDate?.toISOString().split('T')[0]}`);
                console.log(`   After: Start: ${application.startDate.toISOString().split('T')[0]}, End: ${application.endDate.toISOString().split('T')[0]}`);
                
                if (student) {
                    const roomNumber =
                        application.allocatedRoom ||
                        application.allocatedRoomDetails?.roomNumber ||
                        student.currentRoom;
                    if (roomNumber) {
                        student.currentRoom = roomNumber;
                    }
                    student.roomValidUntil = normalizedEndDate;
                    await student.save({ session });
                }

                console.log(`🎉 Lease date update completed for application: ${application.applicationCode}`);
            });

            try {
                const appForRoom = await Application.findById(resolvedApplicationId).lean();
                await LeaseUpdateService.syncTenantRoomTracking(appForRoom);
            } catch (roomSyncError) {
                console.error(`⚠️ Room tracking sync after lease update: ${roomSyncError.message}`);
            }

            if (accrualReversalContext) {
                console.log(`⚠️ Application end date moved earlier - reversing accruals after lease commit...`);
                try {
                    const AccrualCorrectionService = require('./accrualCorrectionService');
                    const adminUser = options.adminUser
                        || await User.findById(updatedBy).lean();

                    if (adminUser) {
                        const correctionResult = await AccrualCorrectionService.correctAccrualsForEarlyLeaseEnd(
                            accrualReversalContext.applicationId,
                            accrualReversalContext.endDate,
                            adminUser,
                            'Lease end date updated - student left early',
                            false
                        );

                        if (correctionResult.success) {
                            const reversed = correctionResult.correctedAccruals?.length || 0;
                            console.log(`✅ Automatically reversed ${reversed} accrual(s) for months after new lease end date`);
                        } else {
                            console.error(`❌ Failed to automatically reverse accruals: ${correctionResult.error}`);
                        }
                    } else {
                        console.warn(`⚠️ Could not find admin user ${updatedBy} for accrual reversal`);
                    }
                } catch (accrualError) {
                    console.error(`❌ Error automatically reversing accruals: ${accrualError.message}`);
                }
            }
            
            const createdCount =
                (accrualBackfill.extendedEnd?.accrualsCreated || 0) +
                (accrualBackfill.earlierStart?.accrualsCreated || 0);
            const skippedCount =
                (accrualBackfill.extendedEnd?.accrualsSkipped || 0) +
                (accrualBackfill.earlierStart?.accrualsSkipped || 0);

            let accrualMessage = 'Lease dates updated successfully';
            if (createdCount > 0 && skippedCount > 0) {
                accrualMessage = `Lease updated — ${createdCount} accrual(s) created, ${skippedCount} already existed`;
            } else if (createdCount > 0) {
                accrualMessage = `Lease updated — ${createdCount} missing accrual(s) created`;
            } else if (skippedCount > 0) {
                accrualMessage =
                    `Lease updated — all ${skippedCount} monthly accrual(s) through today already exist. ` +
                    'Future months (Oct–Dec) will post automatically when each month arrives.';
            }

            return {
                success: true,
                message: accrualMessage,
                studentId: resolvedStudentId,
                applicationId: resolvedApplicationId,
                updatedDates: {
                    startDate: leaseUpdates.startDate,
                    endDate: leaseUpdates.endDate
                },
                accrualBackfill: {
                    accrualsCreated: createdCount,
                    accrualsSkipped: skippedCount,
                    details: accrualBackfill
                }
            };
            
        } catch (error) {
            console.error('❌ Error updating lease dates:', error);
            throw error;
        } finally {
            await session.endSession();
        }
    }
    
    /**
     * Recalculate debtor financial information based on new lease dates
     * @param {Object} debtor - Debtor record
     * @param {Object} application - Application record
     * @param {Object} session - MongoDB session
     */
    static async recalculateDebtorFinancials(debtor, application, session) {
        try {
            console.log(`🧮 Recalculating debtor financials for: ${debtor.debtorCode}`);
            
            // Get residence and room information
            const residence = await this.applySession(
                Residence.findById(application.residence),
                session
            );
            if (!residence) {
                throw new Error('Residence not found');
            }

            const roomNumber =
                application.allocatedRoomDetails?.roomNumber ||
                application.allocatedRoom ||
                application.roomNumber ||
                '';

            const allocatedRoom = residence.rooms.find(
                (room) =>
                    room.roomNumber === roomNumber ||
                    room.roomNumber?.toLowerCase() === String(roomNumber).toLowerCase()
            );

            if (!allocatedRoom) {
                console.warn(
                    `⚠️ Room "${roomNumber || 'unknown'}" not found in residence — using rent fallback`
                );
            }

            const roomPrice =
                allocatedRoom?.price ||
                application.allocatedRoomDetails?.price ||
                application.monthlyRent ||
                debtor?.leaseInfo?.roomPrice ||
                0;
            
            // Calculate new lease period
            const startDate = new Date(application.startDate);
            const endDate = new Date(application.endDate);
            
            // Calculate number of months in the lease period
            const billingPeriodMonths = this.calculateMonthsBetween(startDate, endDate);
            
            console.log(`   📅 Lease period: ${billingPeriodMonths} months`);
            console.log(`   💰 Room price: $${roomPrice} per month`);
            
            // Calculate financial breakdown
            const totalRent = roomPrice * billingPeriodMonths;
            const adminFee = this.calculateAdminFee(totalRent);
            const deposit = this.calculateDeposit(roomPrice);
            const expectedTotal = totalRent + adminFee + deposit;
            
            // Update debtor financial information
            debtor.totalOwed = expectedTotal;
            debtor.leaseInfo.roomPrice = roomPrice;
            debtor.leaseInfo.billingPeriodMonths = billingPeriodMonths;
            
            // Update financial breakdown
            debtor.financialBreakdown = {
                monthlyRent: roomPrice,
                numberOfMonths: billingPeriodMonths,
                totalRent: totalRent,
                adminFee: adminFee,
                deposit: deposit,
                totalOwed: expectedTotal,
                lastUpdated: new Date(),
                updatedBy: 'lease_update_service'
            };
            
            // Recalculate current balance (totalOwed - totalPaid)
            debtor.currentBalance = Math.max(0, debtor.totalOwed - debtor.totalPaid);
            
            // Update debtor status based on new balance
            debtor.status = this.determineDebtorStatus(debtor.currentBalance, debtor.totalPaid);
            
            console.log(`   💰 Financial breakdown updated:`);
            console.log(`      Total Rent: $${totalRent}`);
            console.log(`      Admin Fee: $${adminFee}`);
            console.log(`      Deposit: $${deposit}`);
            console.log(`      Total Owed: $${expectedTotal}`);
            console.log(`      Current Balance: $${debtor.currentBalance}`);
            console.log(`      Status: ${debtor.status}`);
            
        } catch (error) {
            console.error('❌ Error recalculating debtor financials:', error);
            throw error;
        }
    }
    
    /**
     * Calculate number of months between two dates
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {number} Number of months
     */
    static calculateMonthsBetween(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        const yearDiff = end.getFullYear() - start.getFullYear();
        const monthDiff = end.getMonth() - start.getMonth();
        
        return (yearDiff * 12) + monthDiff;
    }
    
    /**
     * Calculate admin fee (typically 10% of total rent)
     * @param {number} totalRent - Total rent amount
     * @returns {number} Admin fee amount
     */
    static calculateAdminFee(totalRent) {
        return Math.round(totalRent * 0.1 * 100) / 100; // 10% admin fee
    }
    
    /**
     * Calculate security deposit (typically 1 month's rent)
     * @param {number} monthlyRent - Monthly rent amount
     * @returns {number} Deposit amount
     */
    static calculateDeposit(monthlyRent) {
        return monthlyRent; // 1 month's rent as deposit
    }
    
    /**
     * Determine debtor status based on balance and payments
     * @param {number} currentBalance - Current balance owed
     * @param {number} totalPaid - Total amount paid
     * @returns {string} Debtor status
     */
    static determineDebtorStatus(currentBalance, totalPaid) {
        if (currentBalance <= 0 && totalPaid > 0) {
            return 'paid';
        } else if (currentBalance > 0) {
            return 'active';
        } else {
            return 'active';
        }
    }
    
    /**
     * Get student lease information
     * @param {string} studentId - Student/User ID
     * @returns {Promise<Object>} Lease information
     */
    static async getStudentLeaseInfo(studentId) {
        try {
            const student = await User.findById(studentId);
            if (!student) {
                throw new Error('Student not found');
            }
            
            const application = await Application.findOne({ 
                student: studentId,
                status: 'approved'
            });
            
            if (!application) {
                throw new Error('No approved application found for this student');
            }
            
            const debtor = await Debtor.findOne({ user: studentId });
            
            return {
                student: {
                    id: student._id,
                    name: `${student.firstName} ${student.lastName}`,
                    email: student.email
                },
                application: {
                    id: application._id,
                    applicationCode: application.applicationCode,
                    startDate: application.startDate,
                    endDate: application.endDate,
                    residence: application.residence,
                    roomNumber: application.allocatedRoomDetails?.roomNumber
                },
                debtor: debtor ? {
                    id: debtor._id,
                    debtorCode: debtor.debtorCode,
                    totalOwed: debtor.totalOwed,
                    totalPaid: debtor.totalPaid,
                    currentBalance: debtor.currentBalance,
                    status: debtor.status,
                    financialBreakdown: debtor.financialBreakdown
                } : null
            };
            
        } catch (error) {
            console.error('❌ Error getting student lease info:', error);
            throw error;
        }
    }
    
    /**
     * Sync debtor lease dates and financials after an application lease change.
     */
    static async syncDebtorLeaseFromApplication(application, updatedBy, session = null) {
        const studentId = application.student?.toString() || null;
        let debtor = null;

        if (studentId) {
            debtor = await this.applySession(Debtor.findOne({ user: studentId }), session);
        }
        if (!debtor) {
            debtor = await this.applySession(
                Debtor.findOne({ application: application._id }),
                session
            );
        }

        if (!debtor) {
            console.log(`⚠️ No debtor record found for application: ${application.applicationCode}`);
            return { updated: false };
        }

        if (!debtor.leaseInfo) {
            debtor.leaseInfo = {};
        }

        debtor.leaseInfo.startDate = new Date(application.startDate);
        debtor.leaseInfo.endDate = new Date(application.endDate);
        const roomNumber =
            application.allocatedRoom ||
            application.allocatedRoomDetails?.roomNumber ||
            debtor.roomNumber;
        if (roomNumber) {
            debtor.roomNumber = roomNumber;
        }
        if (new Date(application.endDate) >= new Date()) {
            debtor.isExpired = false;
            if (debtor.status === 'expired' || debtor.status === 'inactive') {
                debtor.status = 'active';
            }
        }
        if (mongoose.Types.ObjectId.isValid(String(updatedBy))) {
            debtor.updatedBy = updatedBy;
        }
        debtor.updatedAt = new Date();

        try {
            await this.recalculateDebtorFinancials(debtor, application, session);
        } catch (recalcError) {
            console.error(`❌ Error recalculating debtor financials: ${recalcError.message}`);
        }

        await this.applySession(debtor.save(), session);
        console.log(`✅ Synced debtor ${debtor.debtorCode} lease dates and financials`);
        return { updated: true, debtorCode: debtor.debtorCode };
    }

    /**
     * Keep room occupancy + debtor room fields aligned with the application lease.
     */
    static async syncTenantRoomTracking(application) {
        if (!application) return { updated: false };

        const RoomOccupancyUtils = require('../utils/roomOccupancyUtils');
        const roomNumber =
            application.allocatedRoom || application.allocatedRoomDetails?.roomNumber;
        const residenceId = application.residence?._id || application.residence;

        if (roomNumber && residenceId) {
            await RoomOccupancyUtils.updateRoomOccupancy(
                String(residenceId),
                roomNumber
            );
        }

        return { updated: true, roomNumber: roomNumber || null, residenceId: residenceId || null };
    }

    /**
     * Create missing accruals for extended lease period
     * @param {Object} application - Application record
     * @param {Date} periodStart - Start of the period to check
     * @param {Date} periodEnd - End of the period to check
     * @param {string} updatedBy - User ID who is making the update
     * @param {Object} session - MongoDB session (optional)
     */
    static async createMissingAccrualsForExtendedLease(application, periodStart, periodEnd, updatedBy, session) {
        try {
            console.log(`🔍 Checking for missing accruals from ${periodStart.toISOString().split('T')[0]} to ${periodEnd.toISOString().split('T')[0]}`);
            
            const RentalAccrualService = require('./rentalAccrualService');
            const TransactionEntry = require('../models/TransactionEntry');
            const now = new Date();
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();

            const appDoc =
                application?.startDate && application?.endDate
                    ? application
                    : await this.applySession(Application.findById(application._id), session);

            if (!appDoc) {
                console.warn(`⚠️ Application not found — skipping accrual backfill`);
                return { success: false, accrualsCreated: 0, accrualsSkipped: 0, errors: [] };
            }

            let studentId = appDoc.student?.toString() || appDoc.student || null;

            const debtor = await this.applySession(
                Debtor.findOne({
                    $or: [
                        ...(studentId ? [{ user: studentId }] : []),
                        { application: appDoc._id }
                    ]
                }),
                session
            ).lean();

            if (!studentId && debtor?.user) {
                studentId = debtor.user.toString();
            }
            if (!studentId) {
                studentId = appDoc._id.toString();
                console.log(`   ℹ️ No user on application — using application ID for accrual backfill`);
            }

            const debtorId = debtor?._id?.toString();
            const arAccountCode = debtor?.accountCode
                ? typeof debtor.accountCode === 'string' && debtor.accountCode.startsWith('1100-')
                    ? debtor.accountCode
                    : `1100-${debtorId}`
                : debtorId
                  ? `1100-${debtorId}`
                  : null;

            console.log(`   📋 Student ID: ${studentId}, Debtor ID: ${debtorId || 'N/A'}, AR Account Code: ${arAccountCode || 'N/A'}`);

            // When extending the lease end, start from the month after the old end date
            let iterationStart = new Date(periodStart);
            const periodEndDate = new Date(periodEnd);
            if (periodEndDate > iterationStart) {
                const oldEndMonth = iterationStart.getMonth();
                const oldEndYear = iterationStart.getFullYear();
                const newEndMonth = periodEndDate.getMonth();
                const newEndYear = periodEndDate.getFullYear();
                if (
                    newEndYear > oldEndYear ||
                    (newEndYear === oldEndYear && newEndMonth > oldEndMonth)
                ) {
                    iterationStart.setMonth(iterationStart.getMonth() + 1);
                    iterationStart.setDate(1);
                }
            }

            const startMonth = iterationStart.getMonth() + 1;
            const startYear = iterationStart.getFullYear();
            const endMonth = periodEndDate.getMonth() + 1;
            const endYear = periodEndDate.getFullYear();
            
            let month = startMonth;
            let year = startYear;
            let accrualsCreated = 0;
            let accrualsSkipped = 0;
            const errors = [];
            
            // Iterate through each month in the extended period
            while (year < endYear || (year === endYear && month <= endMonth)) {
                // Skip future months - only create accruals up to current month
                if (year > currentYear || (year === currentYear && month > currentMonth)) {
                    console.log(`   ⏭️ Skipping future month ${month}/${year} - will be created when month arrives`);
                    month++;
                    if (month > 12) {
                        month = 1;
                        year++;
                    }
                    continue;
                }
                
                // Skip the lease start month (handled by lease_start process)
                const leaseStartDate = new Date(appDoc.startDate);
                const leaseStartMonth = leaseStartDate.getMonth() + 1;
                const leaseStartYear = leaseStartDate.getFullYear();
                
                if (month === leaseStartMonth && year === leaseStartYear) {
                    console.log(`   ⏭️ Skipping lease start month ${month}/${year} - handled by lease_start process`);
                    month++;
                    if (month > 12) {
                        month = 1;
                        year++;
                    }
                    continue;
                }
                
                // Check if accrual already exists for this month
                // Use multiple checks to ensure we find existing accruals
                console.log(`   🔍 Checking for existing accrual for ${month}/${year}...`);
                let existingAccrual = await RentalAccrualService.checkExistingMonthlyAccrual(
                    studentId,
                    month,
                    year,
                    appDoc._id,
                    debtorId
                );

                if (!existingAccrual && appDoc._id) {
                    existingAccrual = await RentalAccrualService.checkExistingMonthlyAccrual(
                        appDoc._id.toString(),
                        month,
                        year,
                        appDoc._id,
                        debtorId
                    );
                }
                
                // Also check by AR account code if we have it
                if (!existingAccrual && arAccountCode) {
                    console.log(`   🔍 Checking by AR account code ${arAccountCode} for ${month}/${year}...`);
                    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
                    existingAccrual = await this.applySession(
                        TransactionEntry.findOne({
                            source: 'rental_accrual',
                            status: { $ne: 'deleted' },
                            'entries.accountCode': arAccountCode,
                            $and: [
                                {
                                    $or: [
                                        { 'metadata.type': 'monthly_rent_accrual' },
                                        { description: { $regex: /Monthly.*accrual/i } }
                                    ]
                                },
                                {
                                    $or: [
                                        { 'metadata.accrualMonth': month, 'metadata.accrualYear': year },
                                        { 'metadata.month': monthKey },
                                        { description: { $regex: new RegExp(monthKey) } }
                                    ]
                                }
                            ]
                        }),
                        session
                    );
                }
                
                if (existingAccrual) {
                    console.log(`   ✅ Accrual already exists for ${month}/${year} (ID: ${existingAccrual._id}, date: ${existingAccrual.date?.toISOString().split('T')[0]})`);
                    accrualsSkipped++;
                } else {
                    // Create missing accrual
                    try {
                        console.log(`   🔄 No accrual found - creating missing accrual for ${month}/${year}...`);
                        
                        // Create student-like object from application for createStudentRentAccrual
                        const studentData = {
                            student: studentId,
                            firstName: appDoc.firstName,
                            lastName: appDoc.lastName,
                            email: appDoc.email || '',
                            residence: appDoc.residence,
                            allocatedRoom:
                                appDoc.allocatedRoom ||
                                appDoc.allocatedRoomDetails?.roomNumber ||
                                debtor?.roomNumber ||
                                '',
                            startDate: appDoc.startDate,
                            endDate: appDoc.endDate,
                            application: appDoc._id,
                            applicationCode: appDoc.applicationCode,
                            debtor: debtorId || null,
                            debtorAccountCode: arAccountCode || null
                        };
                        
                        const result = await RentalAccrualService.createStudentRentAccrual(studentData, month, year);
                        
                        if (result.success) {
                            console.log(`   ✅ Created accrual for ${month}/${year}: $${result.amount}`);
                            accrualsCreated++;
                        } else {
                            console.log(`   ⚠️ Failed to create accrual for ${month}/${year}: ${result.error}`);
                            errors.push({ month, year, error: result.error });
                        }
                    } catch (error) {
                        console.error(`   ❌ Error creating accrual for ${month}/${year}: ${error.message}`);
                        errors.push({ month, year, error: error.message });
                    }
                }
                
                // Move to next month
                month++;
                if (month > 12) {
                    month = 1;
                    year++;
                }
            }
            
            console.log(`✅ Missing accrual check completed:`);
            console.log(`   Created: ${accrualsCreated}`);
            console.log(`   Skipped (already exist): ${accrualsSkipped}`);
            if (errors.length > 0) {
                console.log(`   Errors: ${errors.length}`);
                errors.forEach(err => {
                    console.log(`      - ${err.month}/${err.year}: ${err.error}`);
                });
            }
            
            return {
                success: true,
                accrualsCreated,
                accrualsSkipped,
                errors
            };
            
        } catch (error) {
            console.error(`❌ Error creating missing accruals: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Validate lease date updates
     * @param {Object} leaseUpdates - Lease date updates
     * @returns {Object} Validation result
     */
    static validateLeaseUpdates(leaseUpdates) {
        const errors = [];
        
        if (!leaseUpdates.startDate) {
            errors.push('Start date is required');
        }
        
        if (!leaseUpdates.endDate) {
            errors.push('End date is required');
        }
        
        if (leaseUpdates.startDate && leaseUpdates.endDate) {
            try {
                LeaseUpdateService.assertStartBeforeEnd(leaseUpdates.startDate, leaseUpdates.endDate);
            } catch (validationError) {
                errors.push(validationError.message);
            }

            const startDate = parseCalendarDate(leaseUpdates.startDate);
            const endDate = parseCalendarDate(leaseUpdates.endDate);
            
            if (!startDate || isNaN(startDate.getTime())) {
                errors.push('Invalid start date format');
            }
            
            if (!endDate || isNaN(endDate.getTime())) {
                errors.push('Invalid end date format');
            }
            
            // Check if dates are not too far in the past or future
            const now = new Date();
            const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
            const twoYearsFromNow = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
            
            if (startDate && startDate < oneYearAgo) {
                errors.push('Start date cannot be more than one year in the past');
            }
            
            if (endDate && endDate > twoYearsFromNow) {
                errors.push('End date cannot be more than two years in the future');
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
}

module.exports = LeaseUpdateService;
