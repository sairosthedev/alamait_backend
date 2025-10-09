const Transaction = require('../models/Transaction');
const TransactionEntry = require('../models/TransactionEntry');
const Account = require('../models/Account');
const Invoice = require('../models/Invoice');
const mongoose = require('mongoose');
const { logTransactionOperation, logSystemOperation } = require('../utils/auditLogger');

/**
 * Enhanced Rental Accrual Service
 * 
 * Implements complete accounting lifecycle for student leases:
 * 1. Lease Start: Creates initial entries for admin fees and deposits
 * 2. Monthly Accruals: Records rent as earned each month (accrual basis)
 * 3. Payment Processing: Handles cash receipts and debt settlement
 * 
 * Supports both accrual and cash basis accounting
 */
class RentalAccrualService {
    /**
     * Calculate fees based on residence payment configuration
     * @param {Object} residence - Residence object with paymentConfiguration
     * @param {Object} room - Room object with price
     * @returns {Object} - Object containing calculated fees
     */
    static calculateFeesFromPaymentConfig(residence, room) {
        const paymentConfig = residence.paymentConfiguration || {};
        const fees = {
            adminFee: 0,
            securityDeposit: 0,
            utilities: 0,
            maintenance: 0
        };

        console.log('🔍 Payment Config Debug:', {
            residenceName: residence.name,
            paymentConfig: paymentConfig,
            roomPrice: room.price
        });

        // Calculate admin fee
        if (paymentConfig.adminFee && paymentConfig.adminFee.enabled === true) {
            if (paymentConfig.adminFee.calculation === 'fixed' || paymentConfig.adminFee.amount) {
                fees.adminFee = paymentConfig.adminFee.amount || 0;
            } else if (paymentConfig.adminFee.calculation === 'percentage') {
                fees.adminFee = (room.price * (paymentConfig.adminFee.percentage || 0)) / 100;
            }
        }

        // Calculate security deposit
        console.log('🔍 Deposit Config Check:', {
            hasDepositConfig: !!paymentConfig.deposit,
            depositEnabled: paymentConfig.deposit?.enabled,
            depositCalculation: paymentConfig.deposit?.calculation,
            depositAmount: paymentConfig.deposit?.amount
        });
        
        if (paymentConfig.deposit && paymentConfig.deposit.enabled === true) {
            if (paymentConfig.deposit.calculation === 'one_month_rent') {
                fees.securityDeposit = room.price;
            } else if (paymentConfig.deposit.calculation === 'fixed') {
                fees.securityDeposit = paymentConfig.deposit.amount || 0;
            } else if (paymentConfig.deposit.calculation === 'percentage') {
                fees.securityDeposit = (room.price * (paymentConfig.deposit.percentage || 100)) / 100;
            }
            console.log('💰 Security Deposit Calculated:', fees.securityDeposit);
        } else {
            console.log('🚫 Security Deposit Disabled or Not Configured');
        }

        // Calculate utilities (if configured)
        if (paymentConfig.utilities && paymentConfig.utilities.enabled === true) {
            if (paymentConfig.utilities.calculation === 'fixed') {
                fees.utilities = paymentConfig.utilities.amount || 0;
            } else if (paymentConfig.utilities.calculation === 'percentage') {
                fees.utilities = (room.price * (paymentConfig.utilities.percentage || 0)) / 100;
            }
        }

        // Calculate maintenance (if configured)
        if (paymentConfig.maintenance && paymentConfig.maintenance.enabled === true) {
            if (paymentConfig.maintenance.calculation === 'fixed') {
                fees.maintenance = paymentConfig.maintenance.amount || 0;
            } else if (paymentConfig.maintenance.calculation === 'percentage') {
                fees.maintenance = (room.price * (paymentConfig.maintenance.percentage || 0)) / 100;
            }
        }

        console.log('✅ Final Calculated Fees:', fees);
        return fees;
    }

    /**
     * Ensure a student-specific AR child account exists and return it
     */
    static async ensureStudentARAccount(studentId, studentName) {
        const mainAR = await Account.findOne({ code: '1100' });
        if (!mainAR) {
            throw new Error('Main AR account (1100) not found');
        }

        const childCode = `1100-${studentId}`;
        let child = await Account.findOne({ code: childCode });
        if (child) return child;

        child = new Account({
            code: childCode,
            name: `Accounts Receivable - ${studentName || studentId}`,
            type: 'Asset',
            category: 'Current Assets',
            subcategory: 'Accounts Receivable',
            description: 'Student-specific AR control account',
            isActive: true,
            parentAccount: mainAR._id,
            level: 2,
            sortOrder: 0,
            metadata: new Map([
                ['parent', '1100'],
                ['hasParent', 'true'],
                ['studentId', String(studentId)]
            ])
        });
        await child.save();
        
        // Log account creation
        await logSystemOperation('create', 'Account', child._id, {
            source: 'Rental Accrual Service',
            type: 'student_ar_account',
            studentId: studentId,
            studentName: studentName,
            parentAccount: '1100',
            accountCode: childCode
        });
        
        return child;
    }
    
    /**
     * 🆕 NEW: Process lease start with initial accounting entries
     * Creates entries for admin fees and deposits when lease begins
     */
    static async processLeaseStart(application) {
        try {
            console.log(`🏠 Processing lease start for ${application.firstName} ${application.lastName}`);
            
            // Check if lease start entries already exist for THIS SPECIFIC APPLICATION
            // Allow multiple lease starts for the same student (re-applications)
            const existingEntries = await TransactionEntry.findOne({
                $or: [
                    // Check for transactions specific to this application
                    { 'metadata.applicationId': application._id, 'metadata.type': 'lease_start' },
                    { 'metadata.applicationCode': application.applicationCode, 'metadata.type': 'lease_start' },
                    // Check for transactions with this specific debtor (if it exists)
                    { source: 'rental_accrual', sourceModel: 'Application', sourceId: application._id },
                    { description: { $regex: new RegExp(`Lease start.*${application.applicationCode}`) } }
                ]
            });
            
            if (existingEntries) {
                console.log(`⚠️ Lease start entries already exist for this application ${application.applicationCode} (created by ${existingEntries.createdBy || 'unknown service'})`);
                
                // 🆕 Even if transactions exist, still create invoice if it doesn't exist
                try {
                    console.log(`📄 Checking if lease start invoice exists for application ${application.applicationCode}...`);
                    
                    const Invoice = require('../models/Invoice');
                    const existingInvoice = await Invoice.findOne({
                        student: application.student,
                        billingPeriod: `LEASE_START_${application.applicationCode}`,
                        status: { $ne: 'cancelled' }
                    });
                    
                    if (!existingInvoice) {
                        console.log(`📄 Creating missing lease start invoice for application ${application.applicationCode}...`);
                        
                        // Get residence and room details for pricing
                        const { Residence } = require('../models/Residence');
                        const residence = await Residence.findById(application.residence);
                        if (!residence) {
                            throw new Error('Residence not found for invoice creation');
                        }
                        
                        // Find room price
                        const room = residence.rooms.find(r => r.roomNumber === application.allocatedRoom);
                        if (!room || !room.price) {
                            throw new Error('Room price not found for invoice creation');
                        }
                        
                        // Calculate prorated amounts (same logic as transaction creation)
                        const startDate = new Date(application.startDate);
                        const daysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
                        const startDay = startDate.getDate();
                        const proratedDays = daysInMonth - startDay + 1;
                        
                        let proratedRent;
                        if (startDay >= 20) {
                            proratedRent = proratedDays * 7; // $7 per day
                        } else {
                            proratedRent = (room.price / daysInMonth) * proratedDays;
                        }
                        
                        // Calculate fees based on residence payment configuration
                        const fees = this.constructor.calculateFeesFromPaymentConfig(residence, room);
                        const adminFee = fees.adminFee;
                        const securityDeposit = fees.securityDeposit;
                        
                        const invoice = await this.createAndSendLeaseStartInvoice(application, proratedRent, adminFee, securityDeposit);
                        console.log(`📄 Lease start invoice created and sent: ${invoice.invoiceNumber}`);
                        
                        return { 
                            success: true, 
                            message: 'Transactions already existed, but invoice was created and sent',
                            existingTransaction: existingEntries._id,
                            invoiceCreated: true,
                            invoiceNumber: invoice.invoiceNumber
                        };
                    } else {
                        console.log(`📄 Lease start invoice already exists: ${existingInvoice.invoiceNumber}`);
                        return { 
                            success: true, 
                            message: 'Both transactions and invoice already exist',
                            existingTransaction: existingEntries._id,
                            existingInvoice: existingInvoice._id
                        };
                    }
                } catch (invoiceError) {
                    console.error(`❌ Error creating invoice for existing transactions:`, invoiceError.message);
                    return { 
                        success: false, 
                        error: 'Transactions exist but invoice creation failed', 
                        existingTransaction: existingEntries._id,
                        invoiceError: invoiceError.message
                    };
                }
            }
            
            // Get residence and room details for pricing
            const { Residence } = require('../models/Residence');
            const residence = await Residence.findById(application.residence);
            if (!residence) {
                throw new Error('Residence not found');
            }
            
            // Find room price
            const room = residence.rooms.find(r => r.roomNumber === application.allocatedRoom);
            if (!room || !room.price) {
                throw new Error('Room price not found');
            }
            
            // Calculate prorated rent for start month
            const startDate = new Date(application.startDate);
            const endDate = new Date(application.endDate);
            const daysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
            const startDay = startDate.getDate();
            const proratedDays = daysInMonth - startDay + 1;
            
            let proratedRent;
            
            // Business rule: If lease starts from 20th onwards, use $7 per day
            if (startDay >= 20) {
                proratedRent = proratedDays * 7; // $7 per day
                console.log(`📅 Lease starts on ${startDay}th (≥20th): Using $7/day rate`);
                console.log(`   Days from start: ${proratedDays}, Amount: $${proratedRent}`);
            } else {
                // Use normal prorated calculation
                proratedRent = (room.price / daysInMonth) * proratedDays;
                console.log(`📅 Lease starts on ${startDay}th (<20th): Using prorated calculation`);
                console.log(`   Monthly rent: $${room.price}, Days in month: ${daysInMonth}, Days from start: ${proratedDays}`);
                console.log(`   Prorated rent: $${proratedRent} (${room.price} × ${proratedDays}/${daysInMonth})`);
            }
            
            // Calculate fees based on residence payment configuration
            const fees = this.constructor.calculateFeesFromPaymentConfig(residence, room);
            const adminFee = fees.adminFee;
            const securityDeposit = fees.securityDeposit;
            
            console.log(`   Room Price: $${room.price}`);
            console.log(`   Prorated Rent (${proratedDays} days): $${proratedRent.toFixed(2)}`);
            console.log(`   Admin Fee: $${adminFee}`);
            console.log(`   Security Deposit: $${securityDeposit}`);
            
            // Get required accounts
            const accountsReceivable = await this.ensureStudentARAccount(
                application.student,
                `${application.firstName} ${application.lastName}`
            );
            const rentalIncome = await Account.findOne({ code: '4001' }); // Student Accommodation Rent
            const adminIncome = await Account.findOne({ code: '4002' }); // Administrative Fees
            const depositLiability = await Account.findOne({ code: '2020' }); // Tenant Security Deposits
            
            if (!accountsReceivable || !rentalIncome || !depositLiability) {
                throw new Error('Required accounts not found');
            }
            
            // Create transaction for lease start
            const transaction = new Transaction({
                transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
                date: startDate,
                description: `Lease start: ${application.firstName} ${application.lastName} - ${residence.name}`,
                type: 'accrual',
                residence: application.residence,
                createdBy: '68b7909295210ad2fa2c5dcf', // System user ID // System-generated transaction
                metadata: {
                    studentId: application.student,
                    studentName: `${application.firstName} ${application.lastName}`,
                    residence: application.residence,
                    room: application.allocatedRoom,
                    type: 'lease_start',
                    leaseStartDate: application.startDate
                }
            });
            
            await transaction.save();
            
            // Create double-entry accounting entries
            const entries = [];
            
            // 1. Prorated Rent Accrual
            if (proratedRent > 0) {
                entries.push({
                    accountCode: accountsReceivable.code,
                    accountName: accountsReceivable.name,
                    accountType: accountsReceivable.type,
                    debit: proratedRent,
                    credit: 0,
                    description: `Prorated rent due from ${application.firstName} ${application.lastName} - ${startDate.toLocaleDateString()} to month end`
                });
                
                entries.push({
                    accountCode: rentalIncome.code,
                    accountName: rentalIncome.name,
                    accountType: rentalIncome.type,
                    debit: 0,
                    credit: proratedRent,
                    description: `Prorated rental income accrued - ${application.firstName} ${application.lastName}`
                });
            }
            
            // 2. Admin Fee Accrual (if applicable)
            if (adminFee > 0) {
                entries.push({
                    accountCode: accountsReceivable.code,
                    accountName: accountsReceivable.name,
                    accountType: accountsReceivable.type,
                    debit: adminFee,
                    credit: 0,
                    description: `Admin fee due from ${application.firstName} ${application.lastName}`
                });
                
                entries.push({
                    accountCode: adminIncome.code,
                    accountName: adminIncome.name,
                    accountType: adminIncome.type,
                    debit: 0,
                    credit: adminFee,
                    description: `Administrative income accrued - ${application.firstName} ${application.lastName}`
                });
            }
            
            // 3. Security Deposit Liability
            entries.push({
                accountCode: accountsReceivable.code,
                accountName: accountsReceivable.name,
                accountType: accountsReceivable.type,
                debit: securityDeposit,
                credit: 0,
                description: `Security deposit due from ${application.firstName} ${application.lastName}`
            });
            
            entries.push({
                accountCode: depositLiability.code,
                accountName: depositLiability.name,
                accountType: depositLiability.type,
                debit: 0,
                credit: securityDeposit,
                description: `Security deposit liability created - ${application.firstName} ${application.lastName}`
            });
            
            // Calculate totals
            const totalDebit = entries.reduce((sum, entry) => sum + entry.debit, 0);
            const totalCredit = entries.reduce((sum, entry) => sum + entry.credit, 0);
            
            // Create transaction entry
            const transactionEntry = new TransactionEntry({
                transactionId: transaction.transactionId,
                date: startDate,
                description: `Lease start accounting entries: ${application.firstName} ${application.lastName}`,
                reference: application.student.toString(), // Use student ID, not application ID
                entries,
                totalDebit,
                totalCredit,
                source: 'rental_accrual',
                sourceId: application.student, // Use student ID, not application ID
                sourceModel: 'Lease',
                residence: application.residence,
                createdBy: '68b7909295210ad2fa2c5dcf', // System user ID
                status: 'posted',
                metadata: {
                    applicationId: application._id.toString(),
                    applicationCode: application.applicationCode,
                    studentId: application.student.toString(), // Add correct student ID
                    studentName: `${application.firstName} ${application.lastName}`,
                    residence: application.residence,
                    room: application.allocatedRoom,
                    type: 'lease_start',
                    leaseStartDate: application.startDate,
                    accrualMonth: startDate.getMonth() + 1, // Add accrual month
                    accrualYear: startDate.getFullYear(), // Add accrual year
                    proratedRent,
                    adminFee,
                    securityDeposit,
                    totalDebit,
                    totalCredit
                }
            });
            
            await transactionEntry.save();
            
            // Log transaction creation
            await logSystemOperation('create', 'TransactionEntry', transactionEntry._id, {
                source: 'Rental Accrual Service',
                type: 'lease_start',
                applicationId: application._id,
                studentId: application.student,
                studentName: `${application.firstName} ${application.lastName}`,
                totalDebit: totalDebit,
                totalCredit: totalCredit
            });
            
            // Update transaction with entry reference
            transaction.entries = [transactionEntry._id];
            await transaction.save();
            
            console.log(`✅ Lease start accounting entries created for ${application.firstName} ${application.lastName}`);
            console.log(`   Total Debit: $${totalDebit.toFixed(2)}`);
            console.log(`   Total Credit: $${totalCredit.toFixed(2)}`);
            
            // 🆕 AUTO-INVOICE: Create and send lease start invoice
            try {
                const invoice = await this.createAndSendLeaseStartInvoice(application, proratedRent, adminFee, securityDeposit);
                console.log(`📄 Lease start invoice created and sent: ${invoice.invoiceNumber}`);
            } catch (invoiceError) {
                console.error(`⚠️ Failed to create/send lease start invoice:`, invoiceError.message);
                // Don't fail the entire process if invoice creation fails
            }
            
            // 🆕 AUTO-BACKFILL: If lease started in the past, create missing monthly accruals
            const now = new Date();
            const leaseStartDate = new Date(application.startDate);
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();
            const leaseStartMonth = leaseStartDate.getMonth() + 1;
            const leaseStartYear = leaseStartDate.getFullYear();
            
            // Check if lease started in a past month (not current month)
            if (leaseStartYear < currentYear || (leaseStartYear === currentYear && leaseStartMonth < currentMonth)) {
                console.log(`🔄 Lease started in past month (${leaseStartMonth}/${leaseStartYear}), auto-creating missing monthly accruals...`);
                
                try {
                    // Create missing monthly accruals from month AFTER lease start up to current month
                    let month = leaseStartMonth + 1;
                    let year = leaseStartYear;
                    
                    // Handle year boundary
                    if (month > 12) {
                        month = 1;
                        year++;
                    }
                    
                    let accrualsCreated = 0;
                    while (year < currentYear || (year === currentYear && month <= currentMonth)) {
                        const result = await this.createStudentRentAccrual(application, month, year);
                        if (result.success) {
                            accrualsCreated++;
                            console.log(`   ✅ Created accrual for ${month}/${year}: $${result.amount}`);
                        } else if (result.error && result.error.includes('already exists')) {
                            console.log(`   ⚠️ Accrual already exists for ${month}/${year}`);
                        } else {
                            console.log(`   ❌ Failed to create accrual for ${month}/${year}: ${result.error}`);
                        }
                        
                        // Move to next month
                        month++;
                        if (month > 12) {
                            month = 1;
                            year++;
                        }
                    }
                    
                    if (accrualsCreated > 0) {
                        console.log(`✅ Auto-backfill completed: ${accrualsCreated} monthly accruals created`);
                    }
                    
                } catch (error) {
                    console.error(`⚠️ Auto-backfill failed: ${error.message}`);
                    // Don't fail the lease start process if backfill fails
                }
            } else {
                console.log(`ℹ️ Lease started in current month (${leaseStartMonth}/${leaseStartYear}), no backfill needed`);
            }
            
            return {
                success: true,
                transactionId: transaction.transactionId,
                proratedRent,
                adminFee,
                securityDeposit,
                totalAmount: totalDebit
            };
            
        } catch (error) {
            console.error(`❌ Error processing lease start for ${application.firstName}:`, error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * 🆕 ENHANCED: Create monthly rent accrual for all active students
     * This records rent as income when it becomes due, not when paid
     */
    static async createMonthlyRentAccrual(month, year) {
        try {
            console.log(`🏠 Creating rent accruals for ${month}/${year}...`);
            
            // Get all active student applications for the month
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);
            
            // Find students with active leases for this month
            const Application = require('../models/Application');
            const activeStudents = await Application.find({
                    status: 'approved',
                    startDate: { $lte: endDate },
                    endDate: { $gte: startDate },
                    paymentStatus: { $ne: 'cancelled' }
                });
            
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
     * Backfill missing monthly rent accruals from lease start up to current month
     * - Excludes the lease start month (handled by lease_start)
     * - Skips months that already have a monthly_rent_accrual entry
     */
    static async backfillMissingAccruals() {
        try {
            const now = new Date();
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();

            console.log(`\n🧩 Backfilling missing monthly rent accruals up to ${currentMonth}/${currentYear}...`);

            // Load approved applications (active leases at any time)
            const approvedApplications = await mongoose.connection.db
                .collection('applications')
                .find({ status: 'approved', paymentStatus: { $ne: 'cancelled' } })
                .toArray();

            let totalCreated = 0;
            let totalSkipped = 0;
            let totalErrors = 0;
            const errors = [];

            for (const app of approvedApplications) {
                const leaseStart = new Date(app.startDate);
                const leaseEnd = new Date(app.endDate);
                if (isNaN(leaseStart) || isNaN(leaseEnd)) {
                    continue;
                }

                // Determine backfill window: from month AFTER lease start up to current month
                // Future months will be created by the monthly cron job on the 1st of each month
                const windowEnd = new Date(Math.min(leaseEnd.getTime(), now.getTime()));

                // Start from the first day of the month AFTER lease start month
                // The lease start month is handled by lease_start (prorated), not monthly accrual
                let startMonth = leaseStart.getMonth() + 1; // Convert to 1-based month
                let startYear = leaseStart.getFullYear();
                
                // Move to next month
                if (startMonth > 12) {
                    startMonth = 1;
                    startYear++;
                }
                
                const cursor = new Date(startYear, startMonth - 1, 1); // Convert back to 0-based for Date constructor

                while (cursor <= windowEnd) {
                    const month = cursor.getMonth() + 1; // Convert 0-based to 1-based month
                    const year = cursor.getFullYear();

                    try {
                        // Skip if accrual already exists for this application/month/year
                        const existingAccrual = await TransactionEntry.findOne({
                            'metadata.applicationId': app._id.toString(),
                            'metadata.accrualMonth': month,
                            'metadata.accrualYear': year,
                            'metadata.type': 'monthly_rent_accrual'
                        });

                        if (existingAccrual) {
                            totalSkipped++;
                        } else {
                            const res = await this.createStudentRentAccrual(app, month, year);
                            if (res && res.success) {
                                totalCreated++;
                            } else {
                                totalErrors++;
                                errors.push({ applicationId: app._id.toString(), month, year, error: res?.error || 'Unknown error' });
                            }
                        }
                    } catch (err) {
                        totalErrors++;
                        errors.push({ applicationId: app._id.toString(), month, year, error: err.message });
                    }

                    // Move to next month
                    cursor.setMonth(cursor.getMonth() + 1);
                }
            }

            console.log(`✅ Backfill complete. Created: ${totalCreated}, Skipped existing: ${totalSkipped}, Errors: ${totalErrors}`);
            if (errors.length > 0) {
                console.log('⚠️ Backfill errors:', errors.slice(0, 10)); // print first few
            }

            return { success: true, created: totalCreated, skipped: totalSkipped, errors };
        } catch (error) {
            console.error('❌ Error backfilling monthly rent accruals:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * 🆕 ENHANCED: Create rent accrual for a specific student
     * Now handles full month rent (not prorated) and excludes admin fees
     */
    static async createStudentRentAccrual(student, month, year) {
        try {
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0);
            
            // Skip creating a monthly accrual for the lease start month
            // The lease start month is always handled by lease_start (prorated), not monthly accrual
            if (student && (student.startDate || student.leaseStartDate)) {
                const leaseStartDate = new Date(student.startDate || student.leaseStartDate);
                if (!isNaN(leaseStartDate)) {
                    const leaseStartMonth = leaseStartDate.getMonth() + 1;
                    const leaseStartYear = leaseStartDate.getFullYear();
                    if (leaseStartMonth === month && leaseStartYear === year) {
                        return { success: false, error: 'Lease start month is always handled by lease_start (prorated). Skipping monthly accrual.' };
                    }
                }
            }

            // Check if accrual already exists for this month (from either rental accrual service or backfill service)
            const monthKey = `${year}-${String(month).padStart(2, '0')}`;
            const existingAccrual = await TransactionEntry.findOne({
                $or: [
                    // Rental accrual service created transactions
                    { 'metadata.studentId': student.student.toString(), 'metadata.accrualMonth': month, 'metadata.accrualYear': year, 'metadata.type': 'monthly_rent_accrual' },
                    // Backfill service created transactions
                    { 'metadata.studentId': student.student.toString(), 'metadata.month': monthKey, 'metadata.type': 'monthly_rent_accrual' },
                    { source: 'rental_accrual', 'metadata.studentId': student.student.toString(), description: { $regex: new RegExp(monthKey) } },
                    { 'entries.accountCode': { $regex: `^1100-${student.student.toString()}` }, description: { $regex: /Monthly rent accrual/ }, description: { $regex: new RegExp(monthKey) } }
                ]
            });
            
            if (existingAccrual) {
                console.log(`   ⚠️ Monthly accrual already exists for ${student.firstName} ${student.lastName} - ${monthKey} (created by ${existingAccrual.createdBy || 'unknown service'})`);
                return { success: false, error: 'Accrual already exists for this month', existingTransaction: existingAccrual._id };
            }
            
            // Get residence and room details for pricing
            const { Residence } = require('../models/Residence');
            const residence = await Residence.findById(student.residence);
            if (!residence) {
                throw new Error('Residence not found');
            }
            
            // Find room price
            const room = residence.rooms.find(r => r.roomNumber === student.allocatedRoom);
            if (!room || !room.price) {
                throw new Error('Room price not found');
            }
            
            // Full month rent (admin fee was already accrued at lease start)
            const rentAmount = room.price;
            
            console.log(`   ${student.firstName} ${student.lastName}: $${rentAmount} rent for ${month}/${year}`);
            console.log(`   📅 Month start date: ${monthStart.toISOString()}`);
            console.log(`   📅 Month end date: ${monthEnd.toISOString()}`);
            
            // Get required accounts
            const accountsReceivable = await this.ensureStudentARAccount(
                student.student, // Use student ID, not application ID
                `${student.firstName} ${student.lastName}`
            );
            const rentalIncome = await Account.findOne({ code: '4001' }); // Student Accommodation Rent
            
            if (!accountsReceivable || !rentalIncome) {
                throw new Error('Required accounts not found');
            }
            
            // Create transaction with CORRECT date (1st of the month)
            const transaction = new Transaction({
                transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
                date: monthStart, // This should be 1st of the month
                description: `Monthly rent accrual for ${student.firstName} ${student.lastName} - ${month}/${year}`,
                type: 'accrual',
                residence: student.residence,
                createdBy: '68b7909295210ad2fa2c5dcf', // System user ID
                metadata: {
                    studentId: student.student.toString(), // Use student ID, not application ID
                    studentName: `${student.firstName} ${student.lastName}`,
                    residence: student.residence,
                    room: student.allocatedRoom,
                    accrualMonth: month,
                    accrualYear: year,
                    type: 'monthly_rent_accrual'
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
                    debit: rentAmount,
                    credit: 0,
                    description: `Monthly rent due from ${student.firstName} ${student.lastName} - ${month}/${year}`
                },
                // Credit: Rental Income
                {
                    accountCode: rentalIncome.code,
                    accountName: rentalIncome.name,
                    accountType: rentalIncome.type,
                    debit: 0,
                    credit: rentAmount,
                    description: `Monthly rental income accrued - ${student.firstName} ${student.lastName} - ${month}/${year}`
                }
            ];
            
            // Create transaction entry with CORRECT date (1st of the month)
            const transactionEntry = new TransactionEntry({
                transactionId: transaction.transactionId,
                date: monthStart, // This should be 1st of the month
                description: `Monthly rent accrual: ${student.firstName} ${student.lastName} - ${month}/${year}`,
                reference: student.student.toString(),
                entries,
                totalDebit: rentAmount,
                totalCredit: rentAmount,
                source: 'rental_accrual',
                sourceId: student.student, // Use student ID, not application ID
                sourceModel: 'Lease',
                residence: student.residence,
                createdBy: '68b7909295210ad2fa2c5dcf', // System user ID
                status: 'posted',
                metadata: {
                    studentId: student.student.toString(), // Use student ID, not application ID
                    studentName: `${student.firstName} ${student.lastName}`,
                    residence: student.residence,
                    room: student.allocatedRoom,
                    accrualMonth: month,
                    accrualYear: year,
                    type: 'monthly_rent_accrual',
                    rentAmount,
                    totalAmount: rentAmount
                }
            });
            
            await transactionEntry.save();
            
            // Update transaction with entry reference
            transaction.entries = [transactionEntry._id];
            await transaction.save();
            
            // 🆕 NEW: Automatically sync to debtor
            try {
                const DebtorTransactionSyncService = require('./debtorTransactionSyncService');
                const monthKey = `${year}-${String(month).padStart(2, '0')}`;
                
                await DebtorTransactionSyncService.updateDebtorFromAccrual(
                    transactionEntry,
                    student.student.toString(),
                    rentAmount,
                    monthKey,
                    {
                        studentName: `${student.firstName} ${student.lastName}`,
                        residence: student.residence,
                        room: student.allocatedRoom,
                        accrualMonth: month,
                        accrualYear: year,
                        type: 'monthly_rent_accrual',
                        transactionId: transaction.transactionId
                    }
                );
                
                console.log(`✅ Debtor automatically synced for accrual: ${student.firstName} ${student.lastName}`);
                
            } catch (debtorError) {
                console.error(`❌ Error syncing to debtor: ${debtorError.message}`);
                // Don't fail the accrual creation if debtor sync fails
            }
            
            // 🆕 AUTO-INVOICE: Create and send monthly rent invoice
            try {
                const invoice = await this.createAndSendMonthlyInvoice(student, month, year, rentAmount);
                console.log(`📄 Monthly invoice created and sent: ${invoice.invoiceNumber}`);
            } catch (invoiceError) {
                console.error(`⚠️ Failed to create/send monthly invoice:`, invoiceError.message);
                // Don't fail the entire process if invoice creation fails
            }
            
            console.log(`✅ Monthly rent accrual created for ${student.firstName} ${student.lastName} - $${rentAmount}`);
            
            return {
                success: true,
                transactionId: transaction.transactionId,
                amount: rentAmount,
                student: `${student.firstName} ${student.lastName}`
            };
            
        } catch (error) {
            console.error(`❌ Error creating monthly rent accrual for ${student.firstName}:`, error);
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
                createdBy: '68b7909295210ad2fa2c5dcf', // System user ID
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
        
        // Get count of all invoices (not just for this month) to ensure uniqueness
        const count = await Invoice.countDocuments();
        
        // Use timestamp to ensure uniqueness
        const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
        
        return `INV-${year}${month}-${timestamp}`;
    }
    
    /**
     * 🆕 Create and send lease start invoice
     */
    static async createAndSendLeaseStartInvoice(application, proratedRent, adminFee, securityDeposit) {
        try {
            const Invoice = require('../models/Invoice');
            const User = require('../models/User');
            const { Residence } = require('../models/Residence');
            const { sendEmail } = require('../utils/email');
            
            // Get student and residence details
            const student = await User.findById(application.student);
            const residence = await Residence.findById(application.residence);
            
            if (!student || !residence) {
                throw new Error('Student or residence not found');
            }
            
            // Check if invoice already exists
            const existingInvoice = await Invoice.findOne({
                student: student._id,
                billingPeriod: `LEASE_START_${application.applicationCode}`,
                status: { $ne: 'cancelled' }
            });
            
            if (existingInvoice) {
                console.log(`📄 Lease start invoice already exists: ${existingInvoice.invoiceNumber}`);
                return existingInvoice;
            }
            
            // Generate invoice number
            const invoiceNumber = await this.generateInvoiceNumber();
            
            // Calculate totals
            const totalAmount = proratedRent + adminFee + securityDeposit;
            
            // Create charges array
            const charges = [];
            if (proratedRent > 0) {
                charges.push({
                    description: 'Prorated Rent',
                    amount: proratedRent,
                    quantity: 1,
                    unitPrice: proratedRent,
                    total: proratedRent
                });
            }
            if (adminFee > 0) {
                charges.push({
                    description: 'Administrative Fee',
                    amount: adminFee,
                    quantity: 1,
                    unitPrice: adminFee,
                    total: adminFee
                });
            }
            if (securityDeposit > 0) {
                charges.push({
                    description: 'Security Deposit',
                    amount: securityDeposit,
                    quantity: 1,
                    unitPrice: securityDeposit,
                    total: securityDeposit
                });
            }
            
            // Create invoice
            const invoice = new Invoice({
                invoiceNumber,
                student: student._id,
                residence: residence._id,
                room: application.allocatedRoom,
                billingPeriod: `LEASE_START_${application.applicationCode}`,
                billingStartDate: new Date(application.startDate),
                billingEndDate: new Date(application.startDate),
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
                subtotal: totalAmount,
                totalAmount: totalAmount,
                balanceDue: totalAmount,
                charges,
                status: 'sent',
                paymentStatus: 'unpaid',
                studentName: `${student.firstName} ${student.lastName}`,
                studentEmail: student.email,
                studentPhone: student.phone,
                residenceName: residence.name,
                residenceAddress: `${residence.address}, ${residence.city}`,
                createdBy: '68b7909295210ad2fa2c5dcf', // System user ID
                metadata: {
                    type: 'lease_start',
                    applicationId: application._id,
                    applicationCode: application.applicationCode,
                    proratedRent,
                    adminFee,
                    securityDeposit
                }
            });
            
            await invoice.save();
            
            // Send email
            await this.sendInvoiceEmail(invoice, student, residence);
            
            console.log(`📄 Lease start invoice created and sent: ${invoiceNumber}`);
            return invoice;
            
        } catch (error) {
            console.error('❌ Error creating/sending lease start invoice:', error);
            throw error;
        }
    }
    
    /**
     * 🆕 Create and send monthly rent invoice
     */
    static async createAndSendMonthlyInvoice(student, month, year, rentAmount) {
        try {
            const Invoice = require('../models/Invoice');
            const User = require('../models/User');
            const { Residence } = require('../models/Residence');
            
            // Get residence details
            const residence = await Residence.findById(student.residence);
            
            if (!residence) {
                throw new Error('Residence not found');
            }
            
            const billingPeriod = `${year}-${month.toString().padStart(2, '0')}`;
            
            // Check if invoice already exists
            const existingInvoice = await Invoice.findOne({
                student: student.student,
                billingPeriod: billingPeriod,
                status: { $ne: 'cancelled' }
            });
            
            if (existingInvoice) {
                console.log(`📄 Monthly invoice already exists: ${existingInvoice.invoiceNumber}`);
                return existingInvoice;
            }
            
            // Generate invoice number
            const invoiceNumber = await this.generateInvoiceNumber();
            
            // Calculate dates
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0);
            const dueDate = new Date(year, month - 1, 5); // Due on 5th of month
            
            // Create charges array
            const charges = [{
                description: 'Monthly Rent',
                amount: rentAmount,
                quantity: 1,
                unitPrice: rentAmount,
                total: rentAmount
            }];
            
            // Create invoice
            const invoice = new Invoice({
                invoiceNumber,
                student: student.student,
                residence: student.residence,
                room: student.allocatedRoom,
                billingPeriod: billingPeriod,
                billingStartDate: monthStart,
                billingEndDate: monthEnd,
                dueDate: dueDate,
                subtotal: rentAmount,
                totalAmount: rentAmount,
                balanceDue: rentAmount,
                charges,
                status: 'sent',
                paymentStatus: 'unpaid',
                studentName: `${student.firstName} ${student.lastName}`,
                studentEmail: student.email,
                studentPhone: student.phone,
                residenceName: residence.name,
                residenceAddress: `${residence.address}, ${residence.city}`,
                createdBy: '68b7909295210ad2fa2c5dcf', // System user ID
                metadata: {
                    type: 'monthly_rent',
                    month,
                    year,
                    rentAmount
                }
            });
            
            await invoice.save();
            
            // Send email
            await this.sendInvoiceEmail(invoice, student, residence);
            
            console.log(`📄 Monthly invoice created and sent: ${invoiceNumber}`);
            return invoice;
            
        } catch (error) {
            console.error('❌ Error creating/sending monthly invoice:', error);
            throw error;
        }
    }
    
    /**
     * 🆕 Send invoice email to student
     */
    static async sendInvoiceEmail(invoice, student, residence) {
        try {
            const { sendEmail } = require('../utils/email');
            
            const emailContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
                        <h2 style="color: #333;">Invoice ${invoice.invoiceNumber}</h2>
                        <p>Dear ${student.firstName} ${student.lastName},</p>
                        <p>Please find your invoice details below:</p>
                        
                        <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
                            <h3 style="color: #333; margin-top: 0;">Invoice Details</h3>
                            <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
                            <p><strong>Billing Period:</strong> ${invoice.billingPeriod}</p>
                            <p><strong>Room:</strong> ${invoice.room}</p>
                            <p><strong>Residence:</strong> ${residence.name}</p>
                            <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
                        </div>
                        
                        <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
                            <h3 style="color: #333; margin-top: 0;">Charges</h3>
                            ${invoice.charges.map(charge => `
                                <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                                    <span>${charge.description}</span>
                                    <span>$${(charge.total || charge.amount || 0).toFixed(2)}</span>
                                </div>
                            `).join('')}
                            <hr style="margin: 10px 0;">
                            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 16px;">
                                <span>Total Amount:</span>
                                <span>$${invoice.totalAmount.toFixed(2)}</span>
                            </div>
                        </div>
                        
                        <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 15px 0;">
                            <h3 style="color: #1976d2; margin-top: 0;">Payment Information</h3>
                            <p>Please make payment by the due date to avoid late fees.</p>
                            <p>For payment inquiries, please contact our finance team.</p>
                        </div>
                        
                        <hr style="margin: 20px 0;">
                        <p style="font-size: 12px; color: #666;">
                            This is an automated message from Alamait Student Accommodation.<br>
                            Please do not reply to this email.
                        </p>
                    </div>
                </div>
            `;
            
            await sendEmail({
                to: student.email,
                subject: `Invoice ${invoice.invoiceNumber} - Alamait Student Accommodation`,
                html: emailContent
            });
            
            console.log(`📧 Invoice email sent to ${student.email}`);
            
        } catch (error) {
            console.error('❌ Error sending invoice email:', error);
            throw error;
        }
    }
    
    /**
     * Get outstanding rent balances for all students
     */
    static async getOutstandingRentBalances(month = null, year = null) {
        try {
            // Get all active students from applications
            const activeStudents = await mongoose.connection.db
                .collection('applications')
                .find({
                    status: 'approved',
                    paymentStatus: { $ne: 'cancelled' }
                }).toArray();
            
            // Get all residences with room pricing
            const residences = await mongoose.connection.db
                .collection('residences')
                .find({}).toArray();
            
            // Create residence map for quick lookup
            const residenceMap = {};
            residences.forEach(residence => {
                residenceMap[residence._id.toString()] = residence;
            });
            
            // Get all payments from payments collection
            const payments = await mongoose.connection.db
                .collection('payments')
                .find({}).toArray();
            
            // Calculate outstanding balances by student
            const studentBalances = {};
            
            // Use current date if month/year not provided
            if (!month || !year) {
                const now = new Date();
                month = now.getMonth() + 1;
                year = now.getFullYear();
            }
            
            for (const student of activeStudents) {
                const studentId = student._id.toString();
                const studentName = `${student.firstName || 'Unknown'} ${student.lastName || 'Student'}`;
                
                // Calculate what should be owed (based on lease period)
                const leaseStart = new Date(student.startDate);
                const leaseEnd = new Date(student.endDate);
                const now = new Date();
                
                // Calculate for all approved students (including future leases)
                // Calculate months from lease start to now (or 0 if lease hasn't started)
                const monthsActive = Math.max(0, 
                    (now.getFullYear() - leaseStart.getFullYear()) * 12 + 
                    (now.getMonth() - leaseStart.getMonth())
                );
                
                // Get student's residence and room pricing
                const residenceId = student.residence?.toString();
                const residence = residenceMap[residenceId];
                const allocatedRoom = student.allocatedRoom || student.preferredRoom;
                
                let monthlyRent = 0;
                let monthlyAdminFee = 0;
                
                if (residence && allocatedRoom && residence.rooms) {
                    // Find the specific room in the residence
                    const roomData = residence.rooms.find(room => 
                        room.roomNumber === allocatedRoom || 
                        room._id?.toString() === allocatedRoom
                    );
                    
                    if (roomData && roomData.price) {
                        monthlyRent = roomData.price;
                        
                        // Billing structure based on residence:
                        if (residence.name.includes('St Kilda')) {
                            // St Kilda: Rent + Admin Fee (one-time) + Deposit (last month's rent)
                            const leaseStartMonth = new Date(student.startDate).getMonth() + 1;
                            const leaseStartYear = new Date(student.startDate).getFullYear();
                            
                            if (month === leaseStartMonth && year === leaseStartYear) {
                                monthlyAdminFee = 20; // Admin fee only in first month
                            } else {
                                monthlyAdminFee = 0; // No admin fee in subsequent months
                            }
                            
                            // Check if this is the last month of the lease (deposit = last month's rent)
                            const leaseEndMonth = new Date(student.endDate).getMonth() + 1;
                            const leaseEndYear = new Date(student.endDate).getFullYear();
                            
                            if (month === leaseEndMonth && year === leaseEndYear) {
                                // Last month is called "deposit" but amount is same as regular rent
                                // No change to monthlyRent - it stays the same
                            }
                            
                        } else if (residence.name.includes('Belvedere')) {
                            // Belvedere: Rent only (no admin, no deposit)
                            monthlyAdminFee = 0;
                            
                        } else {
                            // All other properties: Rent + Deposit (no admin fee)
                            monthlyAdminFee = 0;
                            
                            // Check if this is the last month of the lease (deposit = last month's rent)
                            const leaseEndMonth = new Date(student.endDate).getMonth() + 1;
                            const leaseEndYear = new Date(student.endDate).getFullYear();
                            
                            if (month === leaseEndMonth && year === leaseEndYear) {
                                // Last month is called "deposit" but amount is same as regular rent
                                // No change to monthlyRent - it stays the same
                            }
                        }
                    } else {
                        // Fallback pricing if room not found
                        monthlyRent = 200;
                        monthlyAdminFee = 0; // No admin fee in fallback
                    }
                } else {
                    // Fallback pricing if residence not found
                    monthlyRent = 200;
                    monthlyAdminFee = 0; // No admin fee in fallback
                }
                
                const totalShouldBeOwed = monthsActive * (monthlyRent + monthlyAdminFee);
                
                // Find payments for this student
                const studentPayments = payments.filter(payment => 
                    payment.student && payment.student.toString() === studentId
                );
                
                // Calculate total paid by payment type
                let totalRentPaid = 0;
                let totalAdminPaid = 0;
                let totalDepositPaid = 0;
                
                studentPayments.forEach(payment => {
                    if (payment.payments && Array.isArray(payment.payments)) {
                        payment.payments.forEach(subPayment => {
                            if (subPayment.type === 'rent') {
                                totalRentPaid += subPayment.amount || 0;
                            } else if (subPayment.type === 'admin') {
                                totalAdminPaid += subPayment.amount || 0;
                            } else if (subPayment.type === 'deposit') {
                                totalDepositPaid += subPayment.amount || 0;
                            }
                        });
                    }
                });
                
                const totalPaid = totalRentPaid + totalAdminPaid + totalDepositPaid;
                
                // Calculate outstanding balance
                const outstandingBalance = Math.max(0, totalShouldBeOwed - totalPaid);
                
                // Include all students regardless of outstanding balance
                studentBalances[studentId] = {
                    studentId,
                    studentName,
                    email: student.email || 'N/A',
                    residence: residence?.name || 'N/A',
                    room: allocatedRoom || 'N/A',
                    totalOutstanding: outstandingBalance,
                    totalShouldBeOwed,
                    totalPaid,
                    totalRentPaid,
                    totalAdminPaid,
                    totalDepositPaid,
                    monthsActive,
                    leaseStart: leaseStart.toDateString(),
                    leaseEnd: leaseEnd.toDateString(),
                    monthlyRent,
                    monthlyAdminFee,
                    roomType: residence?.rooms?.find(r => 
                        r.roomNumber === allocatedRoom || 
                        r._id?.toString() === allocatedRoom
                    )?.type || 'N/A',
                    payments: studentPayments.length,
                    oldestPayment: studentPayments.length > 0 ? 
                        new Date(Math.min(...studentPayments.map(p => new Date(p.paymentDate || p.createdAt)))) : null
                };
            }
            
            // Calculate summary
            const totalOutstanding = Object.values(studentBalances).reduce((sum, student) => sum + student.totalOutstanding, 0);
            const totalStudents = Object.keys(studentBalances).length;
            const overdueStudents = Object.values(studentBalances).filter(student => student.totalOutstanding > 0).length;
            
            return {
                students: Object.values(studentBalances),
                summary: {
                    totalOutstanding,
                    totalStudents,
                    overdueStudents,
                    averageOutstanding: totalStudents > 0 ? totalOutstanding / totalStudents : 0
                }
            };
            
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
            
            // Get active students for this month from applications collection
            const activeStudents = await mongoose.connection.db
                .collection('applications')
                .find({
                    status: 'approved',
                    startDate: { $lte: monthEnd },
                    endDate: { $gte: monthStart },
                    paymentStatus: { $ne: 'cancelled' }
                }).toArray();
            
            // Get all residences with room pricing
            const residences = await mongoose.connection.db
                .collection('residences')
                .find({}).toArray();
            
            // Create residence map for quick lookup
            const residenceMap = {};
            residences.forEach(residence => {
                residenceMap[residence._id.toString()] = residence;
            });
            
            let totalRentAccrued = 0;
            let totalAdminFeesAccrued = 0;
            let totalStudents = activeStudents.length;
            
            // Calculate what should be accrued for each student
            for (const student of activeStudents) {
                // Get student's residence and room pricing
                const residenceId = student.residence?.toString();
                const residence = residenceMap[residenceId];
                const allocatedRoom = student.allocatedRoom || student.preferredRoom;
                
                let rentAmount = 0;
                let adminFee = 0;
                
                if (residence && allocatedRoom && residence.rooms) {
                    // Find the specific room in the residence
                    const roomData = residence.rooms.find(room => 
                        room.roomNumber === allocatedRoom || 
                        room._id?.toString() === allocatedRoom
                    );
                    
                    if (roomData && roomData.price) {
                        rentAmount = roomData.price;
                        // Calculate admin fee based on residence payment configuration
                        const fees = this.constructor.calculateFeesFromPaymentConfig(residence, roomData);
                        adminFee = fees.adminFee;
                    } else {
                        // Fallback pricing if room not found
                        rentAmount = 200;
                        // Check payment config for admin fee even in fallback
                        const fees = this.constructor.calculateFeesFromPaymentConfig(residence, { price: 200 });
                        adminFee = fees.adminFee;
                    }
            } else {
                    // Fallback pricing if residence not found
                    rentAmount = 200;
                    adminFee = 0; // No admin fee if residence not found
                }
                
                totalRentAccrued += rentAmount;
                totalAdminFeesAccrued += adminFee;
            }
            
            // Check if accruals were actually created in TransactionEntry
            const existingAccruals = await TransactionEntry.find({
                'metadata.type': 'rent_accrual',
                'metadata.accrualMonth': month,
                'metadata.accrualYear': year,
                status: 'posted'
            });
            
            return {
                month,
                year,
                totalStudents,
                totalRentAccrued,
                totalAdminFeesAccrued,
                totalAmountAccrued: totalRentAccrued + totalAdminFeesAccrued,
                accruals: existingAccruals.length,
                accrualsCreated: existingAccruals.length > 0,
                pendingAccruals: totalStudents - existingAccruals.length
            };
            
        } catch (error) {
            console.error('❌ Error getting rent accrual summary:', error);
            throw error;
        }
    }
    
    /**
     * Get yearly summary of rent accruals
     */
    static async getYearlySummary(year) {
        try {
            // Get all active students for the year from applications
            const yearStart = new Date(year, 0, 1);
            const yearEnd = new Date(year, 11, 31);
            
            const activeStudents = await mongoose.connection.db
                .collection('applications')
                .find({
                    status: 'approved',
                    startDate: { $lte: yearEnd },
                    endDate: { $gte: yearStart },
                    paymentStatus: { $ne: 'cancelled' }
                }).toArray();
            
            let totalAmountAccrued = 0;
            let totalStudents = activeStudents.length;
            let monthlyBreakdown = [];
            
            // Calculate monthly breakdown
            for (let month = 1; month <= 12; month++) {
                const monthStart = new Date(year, month - 1, 1);
                const monthEnd = new Date(year, month - 1, 31);
                
                // Count students active in this month
                const studentsThisMonth = activeStudents.filter(student => {
                    const studentStart = new Date(student.startDate);
                    const studentEnd = new Date(student.endDate);
                    return studentStart <= monthEnd && studentEnd >= monthStart;
                });
                
                const monthlyRent = studentsThisMonth.length * 200; // $200 per student
                const monthlyAdminFees = studentsThisMonth.length * 20; // $20 per student
                const monthlyTotal = monthlyRent + monthlyAdminFees;
                
                totalAmountAccrued += monthlyTotal;
                
                monthlyBreakdown.push({
                    month,
                    monthName: new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' }),
                    students: studentsThisMonth.length,
                    rentAmount: monthlyRent,
                    adminFees: monthlyAdminFees,
                    total: monthlyTotal
                });
            }
            
            return {
                year,
                totalAmountAccrued,
                totalStudents,
                monthlyBreakdown,
                averageMonthlyAccrual: totalAmountAccrued / 12
            };
            
        } catch (error) {
            console.error('❌ Error getting yearly summary:', error);
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

module.exports = RentalAccrualService;
