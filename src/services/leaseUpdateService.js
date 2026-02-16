const mongoose = require('mongoose');
const Application = require('../models/Application');
const Debtor = require('../models/Debtor');
const User = require('../models/User');
const Residence = require('../models/Residence');
// const { createAuditLog } = require('./auditService'); // TODO: Implement audit service

/**
 * Service to handle updating student lease dates and automatically updating debtor records
 */
class LeaseUpdateService {
    
    /**
     * Update student lease dates and automatically update debtor record
     * @param {string} studentId - Student/User ID
     * @param {Object} leaseUpdates - Lease date updates
     * @param {Date} leaseUpdates.startDate - New lease start date
     * @param {Date} leaseUpdates.endDate - New lease end date
     * @param {string} updatedBy - User ID who is making the update
     * @returns {Promise<Object>} Update result
     */
    static async updateStudentLeaseDates(studentId, leaseUpdates, updatedBy) {
        const session = await mongoose.startSession();
        
        try {
            await session.withTransaction(async () => {
                console.log(`🔄 Starting lease date update for student: ${studentId}`);
                
                // Validate input
                if (!leaseUpdates.startDate || !leaseUpdates.endDate) {
                    throw new Error('Both startDate and endDate are required');
                }
                
                if (new Date(leaseUpdates.startDate) >= new Date(leaseUpdates.endDate)) {
                    throw new Error('Start date must be before end date');
                }
                
                // Find the student
                const student = await User.findById(studentId).session(session);
                if (!student) {
                    throw new Error('Student not found');
                }
                
                // Find the student's application
                const application = await Application.findOne({ 
                    student: studentId,
                    status: 'approved'
                }).session(session);
                
                if (!application) {
                    throw new Error('No approved application found for this student');
                }
                
                console.log(`📋 Found application: ${application.applicationCode}`);
                
                // Store original values for audit
                const originalStartDate = application.startDate;
                const originalEndDate = application.endDate;
                
                // Update application lease dates
                application.startDate = new Date(leaseUpdates.startDate);
                application.endDate = new Date(leaseUpdates.endDate);
                application.updatedBy = updatedBy;
                application.updatedAt = new Date();
                
                await application.save({ session });
                console.log(`✅ Updated application lease dates:`);
                console.log(`   Start: ${originalStartDate?.toISOString().split('T')[0]} → ${application.startDate.toISOString().split('T')[0]}`);
                console.log(`   End: ${originalEndDate?.toISOString().split('T')[0]} → ${application.endDate.toISOString().split('T')[0]}`);
                
                // 🆕 CRITICAL: If end date was moved earlier, automatically reverse accruals for months after new end date
                // Do this BEFORE updating debtor so we have the correct end date
                if (originalEndDate && new Date(leaseUpdates.endDate) < new Date(originalEndDate)) {
                    console.log(`⚠️ Application end date moved earlier - automatically reversing accruals...`);
                    console.log(`   Original end date: ${originalEndDate.toISOString().split('T')[0]}`);
                    console.log(`   New end date: ${leaseUpdates.endDate}`);
                    
                    try {
                        const AccrualCorrectionService = require('./accrualCorrectionService');
                        const User = require('../models/User');
                        const adminUser = await User.findById(updatedBy).session(session).lean();
                        
                        if (adminUser) {
                            const correctionResult = await AccrualCorrectionService.correctAccrualsForEarlyLeaseEnd(
                                application._id.toString(),
                                leaseUpdates.endDate,
                                adminUser,
                                `Lease end date updated - student left early`,
                                false // Don't update lease end date again (already updated)
                            );
                            
                            if (correctionResult.success) {
                                console.log(`✅ Automatically reversed ${correctionResult.reversedCount || 0} accrual(s) for months after new lease end date`);
                                console.log(`   Reversed transactions: ${correctionResult.reversedTransactions?.length || 0}`);
                            } else {
                                console.error(`❌ Failed to automatically reverse accruals: ${correctionResult.error}`);
                            }
                        } else {
                            console.warn(`⚠️ Could not find admin user ${updatedBy} for accrual reversal`);
                        }
                    } catch (accrualError) {
                        console.error(`❌ Error automatically reversing accruals: ${accrualError.message}`);
                        // Don't throw - lease update should still succeed even if accrual reversal fails
                    }
                }
                
                // Find and update debtor record
                const debtor = await Debtor.findOne({ user: studentId }).session(session);
                
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
                    await this.recalculateDebtorFinancials(debtor, application, session);
                    
                    await debtor.save({ session });
                    
                    console.log(`✅ Updated debtor lease dates and financials:`);
                    console.log(`   Start: ${originalDebtorStartDate?.toISOString().split('T')[0]} → ${debtor.leaseInfo.startDate.toISOString().split('T')[0]}`);
                    console.log(`   End: ${originalDebtorEndDate?.toISOString().split('T')[0]} → ${debtor.leaseInfo.endDate.toISOString().split('T')[0]}`);
                    console.log(`   Total Owed: $${originalTotalOwed} → $${debtor.totalOwed}`);
                    
                    // 🆕 CRITICAL: If end date was moved earlier, reverse accruals for months after new end date
                    if (originalDebtorEndDate && new Date(leaseUpdates.endDate) < new Date(originalDebtorEndDate)) {
                        console.log(`⚠️ Lease end date moved earlier - checking for accruals to reverse...`);
                        console.log(`   Original end date: ${originalDebtorEndDate.toISOString().split('T')[0]}`);
                        console.log(`   New end date: ${leaseUpdates.endDate}`);
                        
                        try {
                            const AccrualCorrectionService = require('./accrualCorrectionService');
                            const User = require('../models/User');
                            const adminUser = await User.findById(updatedBy).lean();
                            
                            if (adminUser) {
                                const correctionResult = await AccrualCorrectionService.correctAccrualsForEarlyLeaseEnd(
                                    application._id.toString(),
                                    leaseUpdates.endDate,
                                    adminUser,
                                    `Lease end date updated - student left early`,
                                    false // Don't update lease end date again (already updated)
                                );
                                
                                if (correctionResult.success) {
                                    console.log(`✅ Reversed ${correctionResult.reversedCount || 0} accrual(s) for months after new lease end date`);
                                    console.log(`   Reversed transactions: ${correctionResult.reversedTransactions?.length || 0}`);
                                } else {
                                    console.error(`❌ Failed to reverse accruals: ${correctionResult.error}`);
                                }
                            } else {
                                console.warn(`⚠️ Could not find admin user ${updatedBy} for accrual reversal`);
                            }
                        } catch (accrualError) {
                            console.error(`❌ Error reversing accruals: ${accrualError.message}`);
                            // Don't throw - lease update should still succeed even if accrual reversal fails
                        }
                    }
                    
                    // TODO: Create audit log for debtor update
                    console.log(`📝 Audit: Debtor ${debtor.debtorCode} updated by user ${updatedBy}`);
                    console.log(`   Before: Start: ${originalDebtorStartDate?.toISOString().split('T')[0]}, End: ${originalDebtorEndDate?.toISOString().split('T')[0]}, Total: $${originalTotalOwed}`);
                    console.log(`   After: Start: ${debtor.leaseInfo.startDate.toISOString().split('T')[0]}, End: ${debtor.leaseInfo.endDate.toISOString().split('T')[0]}, Total: $${debtor.totalOwed}`);
                } else {
                    console.log(`⚠️ No debtor record found for student: ${studentId}`);
                }
                
                // TODO: Create audit log for application update
                console.log(`📝 Audit: Application ${application.applicationCode} updated by user ${updatedBy}`);
                console.log(`   Before: Start: ${originalStartDate?.toISOString().split('T')[0]}, End: ${originalEndDate?.toISOString().split('T')[0]}`);
                console.log(`   After: Start: ${application.startDate.toISOString().split('T')[0]}, End: ${application.endDate.toISOString().split('T')[0]}`);
                
                console.log(`🎉 Lease date update completed successfully for student: ${student.email}`);
            });
            
            return {
                success: true,
                message: 'Lease dates updated successfully',
                studentId: studentId,
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
            const startDate = new Date(leaseUpdates.startDate);
            const endDate = new Date(leaseUpdates.endDate);
            
            if (isNaN(startDate.getTime())) {
                errors.push('Invalid start date format');
            }
            
            if (isNaN(endDate.getTime())) {
                errors.push('Invalid end date format');
            }
            
            if (startDate >= endDate) {
                errors.push('Start date must be before end date');
            }
            
            // Check if dates are not too far in the past or future
            const now = new Date();
            const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
            const twoYearsFromNow = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
            
            if (startDate < oneYearAgo) {
                errors.push('Start date cannot be more than one year in the past');
            }
            
            if (endDate > twoYearsFromNow) {
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
