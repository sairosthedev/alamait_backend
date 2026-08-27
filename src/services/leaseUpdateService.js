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
                        await this.createMissingAccrualsForExtendedLease(
                            application,
                            originalEndDate,
                            new Date(leaseUpdates.endDate),
                            updatedBy,
                            session
                        );
                    } catch (accrualError) {
                        console.error(`❌ Error creating missing accruals for extended lease: ${accrualError.message}`);
                        // Don't throw - lease update should still succeed even if accrual creation fails
                    }
                }
                
                // 3. If start date was moved earlier, check for missing accruals from new start to old start
                if (originalStartDate && new Date(leaseUpdates.startDate) < new Date(originalStartDate)) {
                    console.log(`📅 Application start date moved earlier - checking for missing accruals...`);
                    console.log(`   Original start date: ${originalStartDate.toISOString().split('T')[0]}`);
                    console.log(`   New start date: ${leaseUpdates.startDate}`);
                    
                    try {
                        await this.createMissingAccrualsForExtendedLease(
                            application,
                            new Date(leaseUpdates.startDate),
                            originalStartDate,
                            updatedBy,
                            session
                        );
                    } catch (accrualError) {
                        console.error(`❌ Error creating missing accruals for earlier start date: ${accrualError.message}`);
                        // Don't throw - lease update should still succeed even if accrual creation fails
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
                    debtor.updatedBy = updatedBy;
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
                
                console.log(`🎉 Lease date update completed for application: ${application.applicationCode}`);
            });

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
            
            return {
                success: true,
                message: 'Lease dates updated successfully',
                studentId: resolvedStudentId,
                applicationId: resolvedApplicationId,
                updatedDates: {
                    startDate: leaseUpdates.startDate,
                    endDate: leaseUpdates.endDate
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
            const residence = await Residence.findById(application.residence).session(session);
            if (!residence) {
                throw new Error('Residence not found');
            }
            
            // Find the allocated room
            const allocatedRoom = residence.rooms.find(room => 
                room.roomNumber === application.allocatedRoomDetails?.roomNumber
            );
            
            if (!allocatedRoom) {
                throw new Error('Allocated room not found');
            }
            
            const roomPrice = allocatedRoom.price || application.allocatedRoomDetails?.price || 0;
            
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
     * Create missing accruals for extended lease period
     * @param {Object} application - Application record
     * @param {Date} periodStart - Start of the period to check
     * @param {Date} periodEnd - End of the period to check
     * @param {string} updatedBy - User ID who is making the update
     * @param {Object} session - MongoDB session
     */
    static async createMissingAccrualsForExtendedLease(application, periodStart, periodEnd, updatedBy, session) {
        try {
            console.log(`🔍 Checking for missing accruals from ${periodStart.toISOString().split('T')[0]} to ${periodEnd.toISOString().split('T')[0]}`);
            
            const RentalAccrualService = require('./rentalAccrualService');
            const TransactionEntry = require('../models/TransactionEntry');
            const Debtor = require('../models/Debtor');
            const now = new Date();
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();
            
            // Get student ID from application
            const studentId = application.student?.toString() || application.student;
            if (!studentId) {
                console.warn(`⚠️ Cannot find student ID from application - skipping accrual check`);
                return;
            }
            
            // Look up debtor to get debtorId for more accurate accrual checking
            const debtor = await Debtor.findOne({ user: studentId }).session(session).lean();
            const debtorId = debtor?._id?.toString();
            const arAccountCode = debtor?.accountCode ? (typeof debtor.accountCode === 'string' && debtor.accountCode.startsWith('1100-') ? debtor.accountCode : `1100-${debtorId}`) : (debtorId ? `1100-${debtorId}` : null);
            
            console.log(`   📋 Student ID: ${studentId}, Debtor ID: ${debtorId || 'N/A'}, AR Account Code: ${arAccountCode || 'N/A'}`);
            
            // Calculate months to check
            const startMonth = periodStart.getMonth() + 1;
            const startYear = periodStart.getFullYear();
            const endMonth = periodEnd.getMonth() + 1;
            const endYear = periodEnd.getFullYear();
            
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
                const leaseStartDate = new Date(application.startDate);
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
                    application._id,
                    debtorId
                );
                
                // Also check by AR account code if we have it
                if (!existingAccrual && arAccountCode) {
                    console.log(`   🔍 Checking by AR account code ${arAccountCode} for ${month}/${year}...`);
                    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
                    existingAccrual = await TransactionEntry.findOne({
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
                    }).session(session);
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
                            firstName: application.firstName,
                            lastName: application.lastName,
                            email: application.email || '',
                            residence: application.residence,
                            allocatedRoom: application.allocatedRoom || application.allocatedRoomDetails?.roomNumber || '',
                            startDate: application.startDate,
                            endDate: application.endDate,
                            application: application._id,
                            applicationCode: application.applicationCode
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
