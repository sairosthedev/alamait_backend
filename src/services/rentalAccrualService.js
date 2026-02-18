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
     * Check if a monthly rent accrual already exists for a student/month/year
     * Uses comprehensive duplicate detection logic
     */
    static async checkExistingMonthlyAccrual(studentId, month, year, applicationId = null, debtorId = null) {
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        
        const query = {
            source: 'rental_accrual',
            status: { $ne: 'deleted' }, // Exclude deleted transactions
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
                        { description: { $regex: new RegExp(monthKey) } },
                        { description: { $regex: new RegExp(`\\b${month}\\b.*\\b${year}\\b`) } }
                    ]
                }
            ]
        };

        // Add student identification criteria - check BOTH formats to catch duplicates from both services
        const studentCriteria = [];
        if (studentId) {
            // Check both studentId formats (student ID and application ID formats)
            studentCriteria.push({ 'metadata.studentId': studentId.toString() });
            studentCriteria.push({ 'metadata.userId': studentId.toString() });
            // Also check if sourceId matches
            studentCriteria.push({ sourceId: mongoose.Types.ObjectId.isValid(studentId) ? new mongoose.Types.ObjectId(studentId) : studentId });
        }
        if (applicationId) {
            studentCriteria.push({ 'metadata.applicationId': applicationId.toString() });
            // Also check if AccountingService used application ID as studentId
            studentCriteria.push({ 'metadata.studentId': applicationId.toString() });
        }
        if (debtorId) {
            studentCriteria.push({ sourceModel: 'Debtor', sourceId: debtorId });
        }

        if (studentCriteria.length > 0) {
            query.$and.push({ $or: studentCriteria });
        }

        return await TransactionEntry.findOne(query);
    }

    /**
     * Calculate prorated rent based on residence paymentConfiguration.rentProration
     * Falls back to existing logic if config missing/disabled
     */
    static calculateProratedRent(residence, room, leaseStartDate) {
        const cfg = residence?.paymentConfiguration?.rentProration || {};
        const enabled = cfg.enabled === true;
        const startDate = new Date(leaseStartDate);
        const year = startDate.getFullYear();
        const month = startDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startDay = startDate.getDate();
        const daysRemaining = daysInMonth - startDay + 1;

        if (!enabled) {
            // When rent proration is disabled, charge full month regardless of start date
            return room.price;
        }

        const policy = cfg.policy || 'daily_calculation';
        const dailyMethod = cfg.dailyRateMethod || 'monthly_rent_calendar_days';
        const minimumDays = Number.isFinite(cfg.minimumDays) ? Math.max(0, Math.min(31, cfg.minimumDays)) : 0;
        const prorateAfterDay = Number.isFinite(cfg.prorateAfterDay) ? Math.max(0, Math.min(31, cfg.prorateAfterDay)) : 0;

        // Determine daily rate
        let dailyRate;
        switch (dailyMethod) {
            case 'monthly_rent_30_days':
                dailyRate = room.price / 30;
                break;
            case 'fixed_daily_rate':
                dailyRate = Number(cfg.fixedDailyRate) || (room.price / daysInMonth);
                break;
            case 'business_days_only':
                // Approximate by excluding weekends from remaining days
                {
                    let businessDays = 0;
                    for (let d = startDay; d <= daysInMonth; d++) {
                        const wd = new Date(year, month, d).getDay();
                        if (wd !== 0 && wd !== 6) businessDays++;
                    }
                    // Derive rate so that businessDays * rate ~= monthly price
                    dailyRate = room.price / businessDays;
                }
                break;
            case 'auto_calendar_days':
                // Alias to calendar days
                dailyRate = room.price / daysInMonth;
                break;
            case 'monthly_rent_calendar_days':
            default:
                dailyRate = room.price / daysInMonth;
        }

        // Compute charged days per policy
        let chargedDays = daysRemaining;
        switch (policy) {
            case 'full_month':
            case 'full_month_only':
                // If a cutoff is provided, charge full month only when starting on/before cutoff, else prorate
                if (prorateAfterDay > 0 && startDay > prorateAfterDay) {
                    chargedDays = daysRemaining;
                    break;
                }
                return room.price;
            case 'weekly_basis':
                // Charge by full weeks remaining (ceil to next full week)
                chargedDays = Math.ceil(daysRemaining / 7) * 7;
                break;
            case 'custom_period':
                // Respect customPeriodDays if provided; otherwise default to remaining days
                chargedDays = Number(cfg.customPeriodDays) || daysRemaining;
                break;
            case 'daily_calculation':
            default:
                // Already using chargedDays = daysRemaining
                break;
        }

        if (minimumDays > 0) {
            chargedDays = Math.max(chargedDays, minimumDays);
        }

        return dailyRate * chargedDays;
    }
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
     * 🆕 CRITICAL FIX: Ensure a student-specific AR account exists using DEBTOR account code
     * Always uses debtor.accountCode format (1100-{debtorId}) for consistency
     */
    static async ensureStudentARAccount(studentId, studentName) {
        const mainAR = await Account.findOne({ code: '1100' });
        if (!mainAR) {
            throw new Error('Main AR account (1100) not found');
        }

        // 🆕 CRITICAL: Always use debtor account code, not user ID
        const Debtor = require('../models/Debtor');
        const debtor = await Debtor.findOne({ user: studentId }).select('accountCode _id').lean();
        
        let childCode;
        if (debtor?.accountCode) {
            // 🆕 CRITICAL FIX: Ensure accountCode is a string, not an object
            // If accountCode is an object (bug), extract the debtor ID from it
            if (typeof debtor.accountCode === 'object' && debtor.accountCode !== null) {
                // If it's an object, try to extract the _id
                const debtorIdFromObject = debtor.accountCode._id || debtor._id;
                if (debtorIdFromObject) {
                    childCode = `1100-${debtorIdFromObject.toString()}`;
                    console.warn(`⚠️ Debtor accountCode was an object (bug), extracted ID: ${childCode}`);
                } else {
                    // Fallback to debtor._id
                    childCode = `1100-${debtor._id.toString()}`;
                    console.warn(`⚠️ Debtor accountCode was an object but no _id found, using debtor._id: ${childCode}`);
                }
            } else if (typeof debtor.accountCode === 'string') {
                // Normal case: accountCode is a string
                childCode = debtor.accountCode;
                console.log(`✅ Using debtor account code: ${childCode} for student ${studentId}`);
            } else {
                // Unexpected type, fallback to debtor ID
                childCode = `1100-${debtor._id.toString()}`;
                console.warn(`⚠️ Debtor accountCode has unexpected type (${typeof debtor.accountCode}), using debtor ID: ${childCode}`);
            }
        } else {
            // Fallback: create using debtor ID if debtor exists but no accountCode
            if (debtor?._id) {
                childCode = `1100-${debtor._id.toString()}`;
                console.log(`⚠️ Debtor exists but no accountCode, using debtor ID: ${childCode}`);
            } else {
                // Last resort: use user ID (should not happen if debtor exists)
                childCode = `1100-${studentId}`;
                console.warn(`⚠️ No debtor found, using user ID format: ${childCode} (this should be fixed)`);
            }
        }
        
        // 🆕 FINAL SAFETY CHECK: Ensure childCode is always a string
        if (typeof childCode !== 'string') {
            console.error(`❌ CRITICAL: childCode is not a string! Type: ${typeof childCode}, Value:`, childCode);
            // Force it to be a string using debtor ID
            if (debtor?._id) {
                childCode = `1100-${debtor._id.toString()}`;
                console.log(`   ✅ Fixed: Using debtor ID as account code: ${childCode}`);
            } else {
                childCode = `1100-${studentId}`;
                console.log(`   ✅ Fixed: Using student ID as account code: ${childCode}`);
            }
        }
        
        let child = await Account.findOne({ code: childCode });
        if (child) {
            // 🆕 SAFETY CHECK: Ensure the account's code is a string, not an object
            if (typeof child.code !== 'string') {
                console.error(`❌ CRITICAL: Account code is not a string! Type: ${typeof child.code}, Value:`, child.code);
                // If code is an object, we need to fix it
                if (typeof child.code === 'object' && child.code !== null) {
                    // Try to extract debtor ID from the object
                    const debtorIdFromObject = child.code._id || (debtor?._id?.toString());
                    if (debtorIdFromObject) {
                        const fixedCode = `1100-${debtorIdFromObject.toString()}`;
                        console.log(`   🔧 Fixing account code from object to string: ${fixedCode}`);
                        child.code = fixedCode;
                        await child.save();
                        console.log(`   ✅ Fixed account code in database`);
                    } else {
                        // If we can't fix it, create a new account with correct code
                        console.log(`   ⚠️ Cannot fix account code, will create new account with correct code`);
                        child = null; // Force creation of new account
                    }
                } else {
                    // Unexpected type, force creation of new account
                    console.log(`   ⚠️ Account code has unexpected type, will create new account`);
                    child = null; // Force creation of new account
                }
            }
            
            if (child && typeof child.code === 'string') {
                console.log(`✅ AR account already exists: ${childCode}`);
                return child;
            }
        }

        // 🆕 FINAL SAFETY CHECK: Ensure childCode is a string before creating Account
        if (typeof childCode !== 'string') {
            console.error(`❌ CRITICAL: childCode is not a string before Account creation! Type: ${typeof childCode}, Value:`, childCode);
            // Force it to be a string using debtor ID
            if (debtor?._id) {
                childCode = `1100-${debtor._id.toString()}`;
                console.log(`   ✅ Fixed: Using debtor ID as account code: ${childCode}`);
            } else {
                childCode = `1100-${studentId}`;
                console.log(`   ✅ Fixed: Using student ID as account code: ${childCode}`);
            }
        }
        
        // Create account with debtor account code format
        child = new Account({
            code: String(childCode), // Explicitly convert to string as final safeguard
            name: `Accounts Receivable - ${studentName || studentId}`,
            type: 'Asset',
            category: 'Current Assets',
            subcategory: 'Accounts Receivable',
            description: 'Student-specific AR control account (uses Debtor ID for persistence)',
            isActive: true,
            parentAccount: mainAR._id,
            level: 2,
            sortOrder: 0,
            metadata: new Map([
                ['parent', '1100'],
                ['hasParent', 'true'],
                ['studentId', String(studentId)],
                ['debtorId', debtor?._id?.toString() || ''],
                ['accountCodeFormat', debtor?._id ? 'debtor_id' : 'user_id']
            ])
        });
        await child.save();
        
        console.log(`✅ Created AR account: ${childCode} (${debtor?._id ? 'debtor ID format' : 'user ID format'})`);
        
        // Log account creation
        await logSystemOperation('create', 'Account', child._id, {
            source: 'Rental Accrual Service',
            type: 'student_ar_account',
            studentId: studentId,
            studentName: studentName,
            debtorId: debtor?._id?.toString(),
            parentAccount: '1100',
            accountCode: childCode,
            format: debtor?._id ? 'debtor_id' : 'user_id'
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
            
            // 🆕 CRITICAL FIX: Ensure student ID is extracted correctly (handle both ObjectId and populated object)
            let studentId;
            if (application.student) {
                if (typeof application.student === 'object' && application.student._id) {
                    // If student is populated object, extract the _id
                    studentId = application.student._id.toString();
                } else if (typeof application.student === 'object' && application.student.toString) {
                    // If it's an ObjectId, convert to string
                    studentId = application.student.toString();
                } else {
                    // Already a string
                    studentId = String(application.student);
                }
            } else {
                throw new Error('Application student field is missing');
            }
            
            console.log(`   Student ID: ${studentId}`);
            
            // 🆕 CRITICAL: Get debtor ID for sourceId (should use debtor ID, not user ID)
            const Debtor = require('../models/Debtor');
            const mongoose = require('mongoose');
            
            // Try multiple query formats to find the debtor
            let debtor = await Debtor.findOne({ user: studentId }).select('_id accountCode').lean();
            if (!debtor) {
                // Try with ObjectId conversion
                if (mongoose.Types.ObjectId.isValid(studentId)) {
                    debtor = await Debtor.findOne({ user: new mongoose.Types.ObjectId(studentId) }).select('_id accountCode').lean();
                }
            }
            if (!debtor) {
                // Try as string
                debtor = await Debtor.findOne({ user: String(studentId) }).select('_id accountCode').lean();
            }
            
            let debtorId = null;
            if (debtor) {
                debtorId = debtor._id.toString();
                console.log(`   ✅ Debtor found! Debtor ID: ${debtorId}, Account Code: ${debtor.accountCode || 'N/A'}`);
            } else {
                console.warn(`   ⚠️ No debtor found for student ${studentId} (tried multiple formats), will use student ID as sourceId`);
                console.warn(`   ⚠️ This will create transactions with user ID format instead of debtor ID format`);
            }
            
            // 🚫 PREVENT FUTURE MONTH LEASE STARTS: Only create lease starts for current or past months
            const now = new Date();
            const leaseStartDate = new Date(application.startDate);
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();
            const leaseStartMonth = leaseStartDate.getMonth() + 1;
            const leaseStartYear = leaseStartDate.getFullYear();
            
            // Check if lease starts in a future month
            if (leaseStartYear > currentYear || (leaseStartYear === currentYear && leaseStartMonth > currentMonth)) {
                console.log(`⏭️ Skipping lease start for ${application.firstName} ${application.lastName} - lease starts in future month (${leaseStartMonth}/${leaseStartYear}). Current month: ${currentMonth}/${currentYear}`);
                return {
                    success: true,
                    skipped: true,
                    message: `Lease start skipped - starts in future month (${leaseStartMonth}/${leaseStartYear}). Will be processed when that month begins.`,
                    leaseStartMonth,
                    leaseStartYear,
                    currentMonth,
                    currentYear
                };
            }
            
            // Check if lease start entries already exist for THIS SPECIFIC APPLICATION
            // Also check by student ID and date to prevent duplicates from race conditions
            // Note: studentId is already declared above
            const leaseStartDateStr = leaseStartDate.toISOString().split('T')[0]; // YYYY-MM-DD
            
            const existingEntries = await TransactionEntry.findOne({
                $or: [
                    // Check for transactions specific to this application
                    { 'metadata.applicationId': application._id, 'metadata.type': 'lease_start' },
                    { 'metadata.applicationCode': application.applicationCode, 'metadata.type': 'lease_start' },
                    // Check for transactions with this specific debtor (if it exists)
                    { source: 'rental_accrual', sourceModel: 'Application', sourceId: application._id },
                    { description: { $regex: new RegExp(`Lease start.*${application.applicationCode}`) } },
                    // 🆕 CRITICAL: Also check by student ID and date to catch race condition duplicates
                    ...(studentId ? [{
                        source: 'rental_accrual',
                        'metadata.type': 'lease_start',
                        'metadata.studentId': studentId,
                        date: {
                            $gte: new Date(leaseStartDateStr),
                            $lt: new Date(new Date(leaseStartDateStr).setDate(new Date(leaseStartDateStr).getDate() + 1))
                        },
                        status: { $ne: 'deleted' }
                    }] : [])
                ],
                status: { $ne: 'deleted' } // Exclude deleted transactions
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
                        
                        // Calculate prorated rent using residence proration config
                        let proratedRent = this.calculateProratedRent(residence, room, application.startDate);
                        
                        // Calculate fees based on residence payment configuration
                        const fees = this.calculateFeesFromPaymentConfig(residence, room);
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
                        
                        // 🆕 AUTO-WELCOME: Send welcome email even if invoice already exists
                        try {
                            await this.sendWelcomeEmail(application, existingInvoice);
                            console.log(`📧 Welcome email sent to: ${application.email}`);
                        } catch (welcomeError) {
                            console.error(`⚠️ Failed to send welcome email:`, welcomeError.message);
                            // Don't fail the entire process if welcome email fails
                        }
                        
                        return { 
                            success: true, 
                            message: 'Both transactions and invoice already exist, welcome email sent',
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
            
            // Calculate prorated rent using residence proration config
            let proratedRent = this.calculateProratedRent(residence, room, application.startDate);
            console.log(`📅 Prorated rent computed via config: $${proratedRent.toFixed(2)}`);
            
            // Calculate fees based on residence payment configuration
            const fees = this.calculateFeesFromPaymentConfig(residence, room);
            const adminFee = fees.adminFee;
            const securityDeposit = fees.securityDeposit;
            
            console.log(`   Room Price: $${room.price}`);
            console.log(`   Prorated Rent (${proratedDays} days): $${proratedRent.toFixed(2)}`);
            console.log(`   Admin Fee: $${adminFee}`);
            console.log(`   Security Deposit: $${securityDeposit}`);
            
            // 🆕 CRITICAL: Use debtor's account code if debtor exists, otherwise use ensureStudentARAccount
            let accountsReceivable;
            let arAccountCode;
            
            if (debtor && debtor.accountCode) {
                // Use debtor's account code directly
                arAccountCode = debtor.accountCode;
                console.log(`✅ Using debtor's account code: ${arAccountCode}`);
                
                // Validate it's a string and uses debtor ID format
                if (typeof arAccountCode !== 'string') {
                    console.error(`❌ CRITICAL: debtor.accountCode is not a string! Type: ${typeof arAccountCode}, Value:`, arAccountCode);
                    arAccountCode = `1100-${debtorId}`;
                    console.log(`   ✅ Fixed: Using debtor ID as account code: ${arAccountCode}`);
                } else if (!arAccountCode.startsWith('1100-') || !arAccountCode.includes(debtorId)) {
                    // Verify it uses debtor ID format
                    console.warn(`⚠️ Debtor account code (${arAccountCode}) doesn't match debtor ID format, using correct format`);
                    arAccountCode = `1100-${debtorId}`;
                    console.log(`   ✅ Fixed: Using debtor ID as account code: ${arAccountCode}`);
                }
                
                // Get or create the account with the correct code
                accountsReceivable = await Account.findOne({ code: arAccountCode });
                if (!accountsReceivable) {
                    // Account doesn't exist, create it
                    const mainAR = await Account.findOne({ code: '1100' });
                    if (!mainAR) {
                        throw new Error('Main AR account (1100) not found');
                    }
                    
                    accountsReceivable = new Account({
                        code: arAccountCode,
                        name: `Accounts Receivable - ${application.firstName} ${application.lastName}`,
                        type: 'Asset',
                        category: 'Current Assets',
                        subcategory: 'Accounts Receivable',
                        description: 'Student-specific AR control account (uses Debtor ID for persistence)',
                        isActive: true,
                        parentAccount: mainAR._id,
                        level: 2,
                        sortOrder: 0,
                        metadata: new Map([
                            ['parent', '1100'],
                            ['hasParent', 'true'],
                            ['studentId', String(studentId)],
                            ['debtorId', debtorId],
                            ['accountCodeFormat', 'debtor_id']
                        ])
                    });
                    await accountsReceivable.save();
                    console.log(`✅ Created AR account with debtor ID: ${arAccountCode}`);
                }
            } else {
                // Fallback: use ensureStudentARAccount (but this should use debtor ID if debtor exists)
                accountsReceivable = await this.ensureStudentARAccount(
                    studentId, // Use extracted student ID
                    `${application.firstName} ${application.lastName}`
                );
                
                // 🆕 CRITICAL SAFETY CHECK: Ensure accountsReceivable.code is a string
                arAccountCode = accountsReceivable.code;
                if (typeof arAccountCode !== 'string') {
                    console.error(`❌ CRITICAL: accountsReceivable.code is not a string! Type: ${typeof arAccountCode}, Value:`, arAccountCode);
                    // Try to extract debtor ID from the object
                    if (typeof arAccountCode === 'object' && arAccountCode !== null) {
                        if (debtor?._id) {
                            arAccountCode = `1100-${debtor._id.toString()}`;
                            console.log(`   ✅ Fixed: Extracted debtor ID and created account code: ${arAccountCode}`);
                        } else {
                            arAccountCode = `1100-${studentId}`;
                            console.log(`   ✅ Fixed: Using student ID as account code: ${arAccountCode}`);
                        }
                    } else {
                        arAccountCode = debtorId ? `1100-${debtorId}` : `1100-${studentId}`;
                        console.log(`   ✅ Fixed: Using ${debtorId ? 'debtor' : 'student'} ID as account code: ${arAccountCode}`);
                    }
                } else if (debtorId && !arAccountCode.includes(debtorId)) {
                    // If we have a debtor ID but the account code doesn't use it, fix it
                    console.warn(`⚠️ Account code (${arAccountCode}) doesn't use debtor ID (${debtorId}), but debtor exists`);
                    console.warn(`   This might cause inconsistencies. Consider updating the account code.`);
                }
            }
            
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
                    studentId: studentId, // Use extracted student ID
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
                    accountCode: String(arAccountCode), // Explicitly convert to string
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
                    accountCode: String(arAccountCode), // Explicitly convert to string
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
                accountCode: String(arAccountCode), // Explicitly convert to string
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
                reference: studentId, // Use extracted student ID string
                entries,
                totalDebit,
                totalCredit,
                source: 'rental_accrual',
                sourceId: debtorId || studentId, // 🆕 CRITICAL: Use debtor ID if available, otherwise fallback to student ID
                sourceModel: debtorId ? 'Debtor' : 'Lease', // Use 'Debtor' if debtor exists, otherwise 'Lease'
                residence: application.residence,
                createdBy: '68b7909295210ad2fa2c5dcf', // System user ID
                status: 'posted',
                metadata: {
                    applicationId: application._id.toString(),
                    applicationCode: application.applicationCode,
                    studentId: studentId, // Use extracted student ID
                    debtorId: debtorId || null, // 🆕 Add debtor ID to metadata
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
            
            // 🆕 CRITICAL: Final duplicate check right before save to prevent race conditions
            // This catches duplicates created by concurrent processes
            const finalDuplicateCheck = await TransactionEntry.findOne({
                source: 'rental_accrual',
                'metadata.type': 'lease_start',
                'metadata.studentId': application.student.toString(),
                date: {
                    $gte: new Date(leaseStartDateStr),
                    $lt: new Date(new Date(leaseStartDateStr).setDate(new Date(leaseStartDateStr).getDate() + 1))
                },
                status: { $ne: 'deleted' },
                _id: { $ne: transactionEntry._id } // Exclude this transaction if it already has an ID
            });
            
            if (finalDuplicateCheck) {
                console.log(`   ⚠️ Final duplicate check: Lease start already exists for ${application.firstName} ${application.lastName} on ${leaseStartDateStr} - aborting`);
                console.log(`   Existing transaction: ${finalDuplicateCheck.transactionId} (${finalDuplicateCheck.createdAt})`);
                return { 
                    success: false, 
                    error: 'Duplicate lease start detected in final check', 
                    existingTransaction: finalDuplicateCheck._id 
                };
            }
            
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
                
                // 🆕 AUTO-WELCOME: Send welcome email at the same time as invoice
                try {
                    await this.sendWelcomeEmail(application, invoice);
                    console.log(`📧 Welcome email sent to: ${application.email}`);
                } catch (welcomeError) {
                    console.error(`⚠️ Failed to send welcome email:`, welcomeError.message);
                    // Don't fail the entire process if welcome email fails
                }
                
            } catch (invoiceError) {
                console.error(`⚠️ Failed to create/send lease start invoice:`, invoiceError.message);
                // Don't fail the entire process if invoice creation fails
            }
            
            // 🆕 AUTO-BACKFILL: If lease started in the past, create missing monthly accruals
            // Reuse variables already declared at the top of the function
            const leaseStartDateForBackfill = new Date(application.startDate);
            const leaseStartMonthForBackfill = leaseStartDateForBackfill.getMonth() + 1;
            const leaseStartYearForBackfill = leaseStartDateForBackfill.getFullYear();
            
            // Check if lease started in a past month (not current month)
            if (leaseStartYearForBackfill < currentYear || (leaseStartYearForBackfill === currentYear && leaseStartMonthForBackfill < currentMonth)) {
                console.log(`🔄 Lease started in past month (${leaseStartMonthForBackfill}/${leaseStartYearForBackfill}), auto-creating missing monthly accruals...`);
                
                try {
                    // Create missing monthly accruals from month AFTER lease start up to current month
                    let month = leaseStartMonthForBackfill + 1;
                    let year = leaseStartYearForBackfill;
                    
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
                console.log(`ℹ️ Lease started in current month (${leaseStartMonthForBackfill}/${leaseStartYearForBackfill}), no backfill needed`);
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
     * Check for missing accruals across all students and create them
     * This proactively finds students who should have accruals but don't
     */
    static async checkAndCreateMissingAccruals(options = {}) {
        try {
            const { 
                startMonth = null, 
                startYear = null, 
                endMonth = null, 
                endYear = null,
                dryRun = false 
            } = options;

            console.log(`\n🔍 Checking for missing accruals...`);
            if (dryRun) {
                console.log(`   ⚠️ DRY RUN MODE - No accruals will be created`);
            }

            const Application = require('../models/Application');
            const now = new Date();
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();

            // Determine date range
            const checkStartMonth = startMonth || 1;
            const checkStartYear = startYear || currentYear;
            const checkEndMonth = endMonth || currentMonth;
            const checkEndYear = endYear || currentYear;

            console.log(`   Date range: ${checkStartMonth}/${checkStartYear} to ${checkEndMonth}/${checkEndYear}`);

            // Get all approved applications
            const applications = await Application.find({
                status: 'approved',
                paymentStatus: { $ne: 'cancelled' }
            }).populate('student', 'firstName lastName email').lean();

            console.log(`   Found ${applications.length} approved applications to check`);

            let totalMissing = 0;
            let totalCreated = 0;
            let totalErrors = 0;
            const missingAccruals = [];

            for (const app of applications) {
                if (!app.startDate || !app.endDate) {
                    continue;
                }

                const leaseStart = new Date(app.startDate);
                const leaseEnd = new Date(app.endDate);
                const leaseStartMonth = leaseStart.getMonth() + 1;
                const leaseStartYear = leaseStart.getFullYear();
                const leaseEndMonth = leaseEnd.getMonth() + 1;
                const leaseEndYear = leaseEnd.getFullYear();

                // Determine which months to check
                let checkMonth = Math.max(checkStartMonth, leaseStartMonth);
                let checkYear = checkStartMonth >= leaseStartMonth ? checkStartYear : leaseStartYear;

                // Adjust if lease started before check period
                if (leaseStartYear < checkStartYear || (leaseStartYear === checkStartYear && leaseStartMonth < checkStartMonth)) {
                    checkMonth = checkStartMonth;
                    checkYear = checkStartYear;
                }

                // Check each month from lease start (or check start) to lease end (or check end)
                const endCheckMonth = Math.min(checkEndMonth, leaseEndMonth);
                const endCheckYear = checkEndMonth <= leaseEndMonth ? checkEndYear : leaseEndYear;

                let month = checkMonth;
                let year = checkYear;

                while (year < endCheckYear || (year === endCheckYear && month <= endCheckMonth)) {
                    // 🆕 CRITICAL: Skip future months - only create accruals up to current month
                    if (year > currentYear || (year === currentYear && month > currentMonth)) {
                        console.log(`   ⏭️ Skipping future month ${month}/${year} for ${app.student?.firstName || app.firstName} - will be created when month arrives`);
                        break; // Stop at current month boundary
                    }

                    // Skip lease start month (handled by lease_start process)
                    if (month === leaseStartMonth && year === leaseStartYear) {
                        month++;
                        if (month > 12) {
                            month = 1;
                            year++;
                        }
                        continue;
                    }

                    // Check if accrual exists
                    const studentId = app.student?._id || app.student;
                    const existingAccrual = await this.checkExistingMonthlyAccrual(
                        studentId,
                        month,
                        year,
                        app._id,
                        null
                    );

                    if (!existingAccrual) {
                        totalMissing++;
                        missingAccruals.push({
                            applicationId: app._id,
                            studentId: studentId,
                            studentName: app.student ? `${app.student.firstName} ${app.student.lastName}` : app.firstName + ' ' + app.lastName,
                            month,
                            year
                        });

                        // Create missing accrual if not dry run
                        if (!dryRun) {
                            try {
                                const result = await this.createStudentRentAccrual(app, month, year);
                                if (result.success) {
                                    totalCreated++;
                                    console.log(`   ✅ Created missing accrual for ${app.student?.firstName || app.firstName} - ${month}/${year}`);
                                } else {
                                    totalErrors++;
                                    console.log(`   ❌ Failed to create accrual for ${app.student?.firstName || app.firstName} - ${month}/${year}: ${result.error}`);
                                }
                            } catch (error) {
                                totalErrors++;
                                console.log(`   ❌ Error creating accrual for ${app.student?.firstName || app.firstName} - ${month}/${year}: ${error.message}`);
                            }
                        }
                    }

                    // Move to next month
                    month++;
                    if (month > 12) {
                        month = 1;
                        year++;
                    }
                }
            }

            console.log(`\n📊 Missing Accrual Check Summary:`);
            console.log(`   Total missing accruals found: ${totalMissing}`);
            if (!dryRun) {
                console.log(`   Accruals created: ${totalCreated}`);
                console.log(`   Errors: ${totalErrors}`);
            }

            return {
                success: true,
                totalMissing,
                totalCreated: dryRun ? 0 : totalCreated,
                totalErrors: dryRun ? 0 : totalErrors,
                missingAccruals,
                dryRun
            };

        } catch (error) {
            console.error('❌ Error checking for missing accruals:', error);
            throw error;
        }
    }

    /**
     * Backfill missing monthly rent accruals from lease start up to current month
     * - Excludes the lease start month (handled by lease_start)
     * - Skips months that already have a monthly_rent_accrual entry
     * - Uses time-based throttling to prevent excessive execution
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
            const incorrectAccruals = []; // Track accruals created after lease end date

            for (const app of approvedApplications) {
                const leaseStart = new Date(app.startDate);
                const leaseEnd = new Date(app.endDate);
                if (isNaN(leaseStart) || isNaN(leaseEnd)) {
                    continue;
                }

                const leaseEndYear = leaseEnd.getFullYear();
                const leaseEndMonth = leaseEnd.getMonth() + 1;

                // Check for existing accruals that are AFTER the lease end date
                const appIdString = app._id.toString();
                const appIdObj = new mongoose.Types.ObjectId(app._id);
                
                const existingAccrualsQuery = {
                    $or: [
                        { source: 'rental_accrual', sourceId: appIdObj },
                        { source: 'rental_accrual', 'metadata.studentId': appIdString },
                        { source: 'rental_accrual', 'metadata.applicationId': appIdString }
                    ],
                    status: 'posted'
                };
                
                const allAccruals = await TransactionEntry.find(existingAccrualsQuery).lean();
                
                for (const accrual of allAccruals) {
                    // Get accrual month/year from metadata or date
                    let accrualMonth, accrualYear;
                    
                    if (accrual.metadata?.accrualMonth && accrual.metadata?.accrualYear) {
                        accrualMonth = accrual.metadata.accrualMonth;
                        accrualYear = accrual.metadata.accrualYear;
                    } else {
                        const accrualDate = new Date(accrual.date);
                        accrualMonth = accrualDate.getMonth() + 1;
                        accrualYear = accrualDate.getFullYear();
                    }
                    
                    // Check if accrual is for a month after the lease end date
                    const isAfterLeaseEnd = 
                        accrualYear > leaseEndYear || 
                        (accrualYear === leaseEndYear && accrualMonth > leaseEndMonth);
                    
                    // Skip lease start transactions (they're handled separately)
                    const isLeaseStart = accrual.metadata?.type === 'lease_start' || 
                                        (accrual.description && /lease start/i.test(accrual.description));
                    
                    if (isAfterLeaseEnd && !isLeaseStart) {
                        incorrectAccruals.push({
                            applicationId: app._id.toString(),
                            studentName: `${app.firstName || ''} ${app.lastName || ''}`.trim(),
                            email: app.email,
                            leaseEndDate: app.endDate,
                            accrualId: accrual._id.toString(),
                            accrualTransactionId: accrual.transactionId,
                            accrualMonth,
                            accrualYear,
                            accrualAmount: accrual.totalDebit,
                            accrualDescription: accrual.description,
                            issue: `Accrual for ${accrualMonth}/${accrualYear} is after lease end date (${leaseEndMonth}/${leaseEndYear})`
                        });
                    }
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
                        // Use improved duplicate detection logic
                        const existingAccrual = await this.checkExistingMonthlyAccrual(
                            app.student, 
                            month, 
                            year, 
                            app._id, 
                            app.debtor
                        );

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
            
            if (incorrectAccruals.length > 0) {
                console.log(`\n⚠️ Found ${incorrectAccruals.length} incorrect accruals (created after lease end date):`);
                incorrectAccruals.slice(0, 10).forEach(issue => {
                    console.log(`   - ${issue.studentName} (${issue.email}): Accrual for ${issue.accrualMonth}/${issue.accrualYear} after lease end ${issue.leaseEndDate}`);
                });
                if (incorrectAccruals.length > 10) {
                    console.log(`   ... and ${incorrectAccruals.length - 10} more`);
                }
                console.log(`\n💡 Use POST /api/finance/accrual-correction/correct to fix these issues`);
            }
            
            if (errors.length > 0) {
                console.log('⚠️ Backfill errors:', errors.slice(0, 10)); // print first few
            }

            return { 
                success: true, 
                created: totalCreated, 
                skipped: totalSkipped, 
                errors,
                incorrectAccruals: incorrectAccruals.length > 0 ? incorrectAccruals : undefined,
                summary: {
                    totalCreated,
                    totalSkipped,
                    totalErrors: errors.length,
                    incorrectAccrualsCount: incorrectAccruals.length
                }
            };
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
            // Use UTC to ensure date is always the 1st of the month, not end of previous month
            const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
            const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
            
            // Skip creating a monthly accrual for the lease start month
            // The lease start month is handled by lease_start process, not monthly accrual
            if (student && (student.startDate || student.leaseStartDate)) {
                const leaseStartDate = new Date(student.startDate || student.leaseStartDate);
                if (!isNaN(leaseStartDate)) {
                    const leaseStartMonth = leaseStartDate.getMonth() + 1;
                    const leaseStartYear = leaseStartDate.getFullYear();
                    if (leaseStartMonth === month && leaseStartYear === year) {
                        // Get residence to check rent proration configuration
                        const { Residence } = require('../models/Residence');
                        const residence = await Residence.findById(student.residence);
                        
                        if (residence && residence.paymentConfiguration && residence.paymentConfiguration.rentProration) {
                            const prorationEnabled = residence.paymentConfiguration.rentProration.enabled;
                            if (!prorationEnabled) {
                                return { 
                                    success: false, 
                                    error: 'Lease start month handled by lease_start (full month charged). No monthly accrual needed when rent proration is disabled.' 
                                };
                            } else {
                                return { 
                                    success: false, 
                                    error: 'Lease start month handled by lease_start (prorated). No monthly accrual needed.' 
                                };
                            }
                        } else {
                            return { 
                                success: false, 
                                error: 'Lease start month is always handled by lease_start. Skipping monthly accrual.' 
                            };
                        }
                    }
                }
            }

            // 🆕 CRITICAL: Use a more robust duplicate check that queries by exact metadata fields AND sourceId
            // This prevents race conditions better than the general checkExistingMonthlyAccrual
            const monthKey = `${year}-${String(month).padStart(2, '0')}`;
            const studentIdString = student.student.toString();
            const sourceId = student.student; // Lease/student ID used as sourceId
            
            // Check 1: By metadata (studentId + month + year)
            const existingAccrualExact = await TransactionEntry.findOne({
                source: 'rental_accrual',
                'metadata.type': 'monthly_rent_accrual',
                'metadata.accrualMonth': month,
                'metadata.accrualYear': year,
                'metadata.studentId': studentIdString,
                status: { $ne: 'deleted' }
            });
            
            if (existingAccrualExact) {
                console.log(`   ⚠️ Monthly accrual already exists (metadata check) for ${student.firstName} ${student.lastName} - ${monthKey} (ID: ${existingAccrualExact._id}, created: ${existingAccrualExact.createdAt})`);
                return { success: false, error: 'Accrual already exists for this month', existingTransaction: existingAccrualExact._id };
            }
            
            // Check 2: By sourceId + date (catches duplicates with same lease ID and date)
            const existingBySourceId = await TransactionEntry.findOne({
                source: 'rental_accrual',
                sourceId: sourceId,
                date: monthStart,
                'metadata.type': 'monthly_rent_accrual',
                status: { $ne: 'deleted' }
            });
            
            if (existingBySourceId) {
                console.log(`   ⚠️ Monthly accrual already exists (sourceId + date check) for ${student.firstName} ${student.lastName} - ${monthKey} (ID: ${existingBySourceId._id}, sourceId: ${sourceId})`);
                return { success: false, error: 'Accrual already exists for this lease and month', existingTransaction: existingBySourceId._id };
            }
            
            // Check 3: By description pattern (catches duplicates with same description)
            const existingByDescription = await TransactionEntry.findOne({
                source: 'rental_accrual',
                description: { $regex: new RegExp(`Monthly rent accrual.*${student.firstName}.*${student.lastName}.*${month}/${year}`, 'i') },
                status: { $ne: 'deleted' }
            });
            
            if (existingByDescription) {
                console.log(`   ⚠️ Monthly accrual already exists (description check) for ${student.firstName} ${student.lastName} - ${monthKey} (ID: ${existingByDescription._id})`);
                return { success: false, error: 'Accrual already exists (description match)', existingTransaction: existingByDescription._id };
            }
            
            // Check 4: Also check using the general method as a backup
            const existingAccrual = await this.checkExistingMonthlyAccrual(
                student.student, 
                month, 
                year, 
                student._id, 
                student.debtor
            );
            
            if (existingAccrual) {
                console.log(`   ⚠️ Monthly accrual already exists (general check) for ${student.firstName} ${student.lastName} - ${monthKey} (ID: ${existingAccrual._id})`);
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
            
            // 🆕 CRITICAL SAFETY CHECK: Ensure accountsReceivable.code is a string
            let arAccountCode = accountsReceivable.code;
            if (typeof arAccountCode !== 'string') {
                console.error(`❌ CRITICAL: accountsReceivable.code is not a string! Type: ${typeof arAccountCode}, Value:`, arAccountCode);
                // Try to extract debtor ID from the object
                if (typeof arAccountCode === 'object' && arAccountCode !== null) {
                    const Debtor = require('../models/Debtor');
                    const debtor = await Debtor.findOne({ user: student.student }).select('_id').lean();
                    if (debtor?._id) {
                        arAccountCode = `1100-${debtor._id.toString()}`;
                        console.log(`   ✅ Fixed: Extracted debtor ID and created account code: ${arAccountCode}`);
                    } else {
                        arAccountCode = `1100-${student.student}`;
                        console.log(`   ✅ Fixed: Using student ID as account code: ${arAccountCode}`);
                    }
                } else {
                    arAccountCode = `1100-${student.student}`;
                    console.log(`   ✅ Fixed: Using student ID as account code: ${arAccountCode}`);
                }
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
                    accountCode: String(arAccountCode), // Explicitly convert to string
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
            
            // 🆕 FINAL CHECK: One more comprehensive duplicate check right before creating the transaction entry
            // This is the last chance to prevent duplicates before database write
            // Check by both metadata AND sourceId to catch all possible duplicates
            const finalDuplicateCheck = await TransactionEntry.findOne({
                $or: [
                    {
                        source: 'rental_accrual',
                        'metadata.type': 'monthly_rent_accrual',
                        'metadata.accrualMonth': month,
                        'metadata.accrualYear': year,
                        'metadata.studentId': student.student.toString(),
                        status: { $ne: 'deleted' }
                    },
                    {
                        source: 'rental_accrual',
                        sourceId: sourceId,
                        date: monthStart,
                        'metadata.type': 'monthly_rent_accrual',
                        status: { $ne: 'deleted' }
                    }
                ]
            });
            
            if (finalDuplicateCheck) {
                console.log(`   ⚠️ Final duplicate check: Accrual already exists for ${student.firstName} ${student.lastName} - ${monthKey} - aborting`);
                console.log(`   Existing transaction ID: ${finalDuplicateCheck._id}, created: ${finalDuplicateCheck.createdAt}`);
                // Clean up the transaction we created
                await Transaction.findByIdAndDelete(transaction._id);
                return { success: false, error: 'Duplicate accrual detected in final check', existingTransaction: finalDuplicateCheck._id };
            }
            
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
            
            // 🆕 Use save with error handling to catch duplicate key errors (unique index violations)
            try {
                await transactionEntry.save();
            } catch (saveError) {
                // If save fails due to duplicate (unique index violation), check if another process created it
                if (saveError.code === 11000 || saveError.message.includes('duplicate') || saveError.message.includes('E11000')) {
                    console.log(`   ⚠️ Unique index violation detected during save - checking for existing accrual`);
                    
                    // Try multiple queries to find the existing duplicate
                    let existingAfterSave = await TransactionEntry.findOne({
                        source: 'rental_accrual',
                        'metadata.type': 'monthly_rent_accrual',
                        'metadata.accrualMonth': month,
                        'metadata.accrualYear': year,
                        'metadata.studentId': student.student.toString(),
                        status: { $ne: 'deleted' }
                    });
                    
                    // If not found by metadata, try by sourceId + date
                    if (!existingAfterSave) {
                        existingAfterSave = await TransactionEntry.findOne({
                            source: 'rental_accrual',
                            sourceId: sourceId,
                            date: monthStart,
                            'metadata.type': 'monthly_rent_accrual',
                            status: { $ne: 'deleted' }
                        });
                    }
                    
                    if (existingAfterSave) {
                        console.log(`   ⚠️ Duplicate detected during save - another process created the accrual (ID: ${existingAfterSave._id})`);
                        // Clean up the transaction we created
                        await Transaction.findByIdAndDelete(transaction._id);
                        return { 
                            success: false, 
                            error: 'Duplicate accrual detected - another process created it simultaneously', 
                            existingTransaction: existingAfterSave._id 
                        };
                    } else {
                        console.log(`   ⚠️ Unique index violation but existing accrual not found - may be a different constraint`);
                    }
                }
                throw saveError; // Re-throw if it's a different error
            }
            
            // Update transaction with entry reference
            transaction.entries = [transactionEntry._id];
            await transaction.save();
            
            // 🆕 CRITICAL: Check for advance payments (deferred income) for this month and apply them automatically
            // monthKey is already declared at the top of the function
            try {
                // Get Debtor to use correct AR code (Debtor ID format)
                const Debtor = require('../models/Debtor');
                const debtor = await Debtor.findOne({ user: student.student }).lean();
                const debtorId = debtor?._id?.toString();
                const arAccountCode = debtor?.accountCode || (debtorId ? `1100-${debtorId}` : `1100-${student.student.toString()}`);
                const studentIdStr = student.student.toString();
                
                console.log(`🔍 Checking for advance payments for ${monthKey} (student: ${studentIdStr}, AR: ${arAccountCode})`);
                
                // Strategy 1: Find advance payment transactions with monthSettled matching this month
                // OR paymentMonth/intendedLeaseStartMonth matching this month (for payments made before lease start)
                // Check by both studentId and AR account code to catch all formats
                let advancePayments = await TransactionEntry.find({
                    source: 'advance_payment',
                    $or: [
                        { 'metadata.studentId': studentIdStr },
                        { 'metadata.debtorId': debtorId },
                        { 'entries.accountCode': arAccountCode }
                    ],
                    $or: [
                        { 'metadata.monthSettled': monthKey },
                        { 'metadata.paymentMonth': monthKey },
                        { 'metadata.intendedLeaseStartMonth': monthKey }
                    ],
                    status: 'posted'
                }).sort({ date: 1 });
                
                console.log(`   Strategy 1: Found ${advancePayments.length} advance payment(s) with monthSettled/paymentMonth/intendedLeaseStartMonth=${monthKey}`);
                
                // Strategy 2: If none found, check for advance payments with null monthSettled made before this month
                if (advancePayments.length === 0) {
                    advancePayments = await TransactionEntry.find({
                        source: 'advance_payment',
                        $or: [
                            { 'metadata.studentId': studentIdStr },
                            { 'metadata.debtorId': debtorId },
                            { 'entries.accountCode': arAccountCode }
                        ],
                        $or: [
                            { 'metadata.monthSettled': null },
                            { 'metadata.monthSettled': { $exists: false } }
                        ],
                        status: 'posted',
                        date: { $lt: monthStart } // Payment was made before the month started
                    }).sort({ date: 1 });
                    
                    console.log(`   Strategy 2: Found ${advancePayments.length} advance payment(s) with null monthSettled made before ${monthStart.toISOString()}`);
                }
                
                // Strategy 3: Also check for advance payments in description (for older transactions)
                if (advancePayments.length === 0) {
                    const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' });
                    advancePayments = await TransactionEntry.find({
                        source: 'advance_payment',
                        $or: [
                            { 'metadata.studentId': studentIdStr },
                            { 'metadata.debtorId': debtorId },
                            { 'entries.accountCode': arAccountCode },
                            { 'entries.accountCode': `1100-${studentIdStr}` } // Fallback for old format
                        ],
                        $or: [
                            { description: { $regex: new RegExp(monthKey, 'i') } },
                            { description: { $regex: new RegExp(`${monthName}.*${year}`, 'i') } },
                            { description: { $regex: new RegExp(`${year}.*${month}`, 'i') } }
                        ],
                        status: 'posted',
                        date: { $lt: monthStart }
                    }).sort({ date: 1 });
                    
                    console.log(`   Strategy 3: Found ${advancePayments.length} advance payment(s) matching description for ${monthKey}`);
                }
                
                // Strategy 4: Find any unallocated advance payments (check if they have account 2200 entry)
                // Also check for payment transactions that have account 2200 (they might be advance payments)
                if (advancePayments.length === 0) {
                    const allAdvancePayments = await TransactionEntry.find({
                        $or: [
                            { source: 'advance_payment' },
                            { 
                                source: 'payment',
                                $or: [
                                    { 'entries.accountCode': '2200' }, // Payment transactions with deferred income
                                    { description: { $regex: new RegExp(monthKey, 'i') } } // Or description mentions the month
                                ]
                            }
                        ],
                        $or: [
                            { 'metadata.studentId': studentIdStr },
                            { 'metadata.debtorId': debtorId },
                            { 'entries.accountCode': arAccountCode },
                            { 'entries.accountCode': `1100-${studentIdStr}` } // Fallback for old format
                        ],
                        status: 'posted',
                        date: { $lt: monthStart }
                    }).sort({ date: 1 });
                    
                    // Filter to only those that match this month and haven't been allocated
                    advancePayments = allAdvancePayments.filter(tx => {
                        const has2200 = tx.entries && tx.entries.some(e => e.accountCode === '2200');
                        const notAllocated = !tx.metadata?.monthSettled || tx.metadata.monthSettled === null;
                        // Check if description mentions the month (for payment transactions without 2200)
                        const mentionsMonth = tx.description && (
                            tx.description.includes(monthKey) || 
                            tx.description.includes(`${month}/${year}`) ||
                            tx.description.includes(`for ${year}-${String(month).padStart(2, '0')}`)
                        );
                        // Include if: (has 2200 and not allocated) OR (mentions month and not allocated and made before month)
                        return (has2200 && notAllocated) || (mentionsMonth && notAllocated && tx.date < monthStart);
                    });
                    
                    console.log(`   Strategy 4: Found ${advancePayments.length} unallocated advance/payment transaction(s) for ${monthKey}`);
                }
                
                if (advancePayments.length > 0) {
                    console.log(`💰 Found ${advancePayments.length} advance payment(s) for ${monthKey} - applying automatically`);
                    
                    let totalAdvanceAmount = 0;
                    for (const advancePayment of advancePayments) {
                        // Get the amount from either:
                        // 1. Deferred income entry (account 2200) - for proper advance payments
                        // 2. Student AR credit entry - for payment transactions that were incorrectly created
                        let advanceAmount = 0;
                        const deferredEntry = advancePayment.entries.find(e => e.accountCode === '2200');
                        const studentAREntry = advancePayment.entries.find(e => 
                            (e.accountCode === arAccountCode || e.accountCode === `1100-${studentIdStr}`) && e.credit > 0
                        );
                        
                        if (deferredEntry) {
                            advanceAmount = deferredEntry.credit || 0;
                        } else if (studentAREntry) {
                            advanceAmount = studentAREntry.credit || 0;
                            console.log(`   ⚠️ Payment transaction ${advancePayment.transactionId} doesn't have account 2200, using AR credit amount`);
                        } else {
                            // Try to get amount from totalCredit
                            advanceAmount = advancePayment.totalCredit || 0;
                            console.log(`   ⚠️ Could not find amount in entries, using totalCredit: $${advanceAmount}`);
                        }
                        
                        if (advanceAmount > 0) {
                            totalAdvanceAmount += advanceAmount;
                            
                            console.log(`   📋 Advance payment details:`);
                            console.log(`      Transaction ID: ${advancePayment.transactionId}`);
                            console.log(`      Date: ${advancePayment.date}`);
                            console.log(`      Amount: $${advanceAmount}`);
                            console.log(`      Description: ${advancePayment.description}`);
                            console.log(`      monthSettled: ${advancePayment.metadata?.monthSettled || 'null'}`);
                            console.log(`      Source: ${advancePayment.source}`);
                            
                            // 🆕 CRITICAL: Add advance payment allocation directly to accrual transaction
                            // Don't create a separate transaction - add entries to the accrual itself
                            // This ensures the payment shows with the original payment date, not the accrual date
                            
                            // Check if allocation already exists in accrual
                            const hasAllocation = transactionEntry.entries?.some(e => 
                                e.accountCode === '2200' && e.debit > 0
                            ) && transactionEntry.entries?.some(e => 
                                e.accountCode === accountsReceivable.code && e.credit > 0
                            );
                            
                            if (hasAllocation) {
                                console.log(`   ⚠️ Accrual already has advance payment allocation - skipping`);
                                continue;
                            }
                            
                            // Add deferred income debit entry
                            transactionEntry.entries.push({
                                accountCode: '2200',
                                accountName: 'Advance Payment Liability',
                                accountType: 'Liability',
                                debit: advanceAmount,
                                credit: 0,
                                description: `Advance payment applied to ${monthKey} accrual`
                            });
                            
                            // Add AR credit entry
                            transactionEntry.entries.push({
                                accountCode: accountsReceivable.code,
                                accountName: accountsReceivable.name,
                                accountType: accountsReceivable.type,
                                debit: 0,
                                credit: advanceAmount,
                                description: `Advance payment applied to ${monthKey} accrual`
                            });
                            
                            // Update totals
                            transactionEntry.totalDebit = transactionEntry.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
                            transactionEntry.totalCredit = transactionEntry.entries.reduce((sum, e) => sum + (e.credit || 0), 0);
                            
                            // Store payment date in metadata so ledger can use it
                            if (!transactionEntry.metadata) {
                                transactionEntry.metadata = {};
                            }
                            transactionEntry.metadata.advancePaymentApplied = true;
                            transactionEntry.metadata.advancePaymentDate = new Date(advancePayment.date); // Store original payment date
                            transactionEntry.metadata.advanceAmount = advanceAmount;
                            transactionEntry.metadata.originalAdvancePaymentId = advancePayment._id.toString();
                            
                            // Mark metadata as modified
                            transactionEntry.markModified('metadata');
                            
                            // Save the accrual transaction with the new allocation entries
                            await transactionEntry.save();
                            
                            console.log(`   ✅ Added advance payment allocation directly to accrual transaction`);
                            console.log(`   ✅ Stored payment date: ${new Date(advancePayment.date).toLocaleDateString()}`);
                            console.log(`   ✅ Updated accrual totals: DR $${transactionEntry.totalDebit}, CR $${transactionEntry.totalCredit}`);
                            
                            // Update the advance payment metadata to mark it as allocated
                            if (!advancePayment.metadata) {
                                advancePayment.metadata = {};
                            }
                            advancePayment.metadata.monthSettled = monthKey;
                            await advancePayment.save();
                            
                            // 🆕 CRITICAL: Update debtor's prepayment record to mark it as allocated
                            try {
                                const Debtor = require('../models/Debtor');
                                const mongoose = require('mongoose');
                                const paymentId = advancePayment.metadata?.paymentId;
                                
                                if (paymentId) {
                                    // Normalize paymentId to string for comparison
                                    const paymentIdStr = paymentId.toString();
                                    
                                    // Find and update the prepayment record
                                    const debtor = await Debtor.findOne({ user: student.student.toString() });
                                    
                                    if (debtor && debtor.deferredIncome && debtor.deferredIncome.prepayments) {
                                        // Find prepayment by paymentId (handle both string and ObjectId formats)
                                        const prepayment = debtor.deferredIncome.prepayments.find(p => {
                                            if (!p.paymentId) return false;
                                            // Compare as strings to handle both ObjectId and string formats
                                            return p.paymentId.toString() === paymentIdStr;
                                        });
                                        
                                        if (prepayment && prepayment.status === 'pending') {
                                            // Update the prepayment to mark it as allocated
                                            prepayment.allocatedMonth = monthKey;
                                            prepayment.status = 'allocated';
                                            
                                            // Reduce deferred income total amount
                                            debtor.deferredIncome.totalAmount = Math.max(0, 
                                                (debtor.deferredIncome.totalAmount || 0) - advanceAmount
                                            );
                                            
                                            await debtor.save();
                                            console.log(`   ✅ Updated debtor prepayment record: paymentId=${paymentIdStr}, allocatedMonth=${monthKey}, status=allocated`);
                                            console.log(`   ✅ Reduced deferred income total by $${advanceAmount} (new total: $${debtor.deferredIncome.totalAmount})`);
                                        } else if (prepayment) {
                                            console.log(`   ℹ️ Prepayment ${paymentIdStr} already allocated (status: ${prepayment.status})`);
                                        } else {
                                            console.log(`   ⚠️ Prepayment record not found for paymentId ${paymentIdStr} - debtor may need manual update`);
                                            console.log(`      Available prepayment IDs: ${debtor.deferredIncome.prepayments.map(p => p.paymentId?.toString()).join(', ')}`);
                                        }
                                    } else {
                                        console.log(`   ⚠️ Debtor or deferredIncome not found for student ${student.student.toString()}`);
                                    }
                                } else {
                                    console.log(`   ⚠️ No paymentId found in advance payment metadata - cannot update debtor prepayment`);
                                    console.log(`      Advance payment metadata:`, JSON.stringify(advancePayment.metadata, null, 2));
                                }
                            } catch (debtorUpdateError) {
                                console.error(`   ❌ Error updating debtor prepayment record: ${debtorUpdateError.message}`);
                                console.error(`      Stack: ${debtorUpdateError.stack}`);
                                // Don't fail the accrual creation if debtor update fails
                            }
                            
                            console.log(`   ✅ Applied advance payment of $${advanceAmount} to accrual for ${monthKey}`);
                            
                            // Break after applying first advance payment to avoid applying multiple times
                            break;
                        } else {
                            console.log(`   ⚠️ Advance payment ${advancePayment.transactionId} has no valid amount - skipping`);
                        }
                    }
                    
                    if (totalAdvanceAmount > 0) {
                        console.log(`✅ Total advance payments applied: $${totalAdvanceAmount} for ${monthKey}`);
                    } else {
                        console.log(`⚠️ No valid advance payments found with account 2200 entries`);
                    }
                } else {
                    console.log(`ℹ️ No advance payments found for ${monthKey} - student will show as owing`);
                }
            } catch (advanceError) {
                console.error(`⚠️ Error applying advance payments: ${advanceError.message}`);
                console.error(`   Stack: ${advanceError.stack}`);
                // Don't fail the accrual creation if advance payment application fails
            }
            
            // 🆕 NEW: Automatically sync to debtor
            try {
                const DebtorTransactionSyncService = require('./debtorTransactionSyncService');
                
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
            // Send email in background (non-blocking)
            setTimeout(async () => {
                try {
                    console.log(`📧 Sending lease start invoice email to ${student.email}...`);
                    console.log(`   Invoice: ${invoiceNumber}`);
                    console.log(`   Student: ${student.firstName} ${student.lastName}`);
                    console.log(`   Amount: $${totalAmount}`);
                    
                    await this.sendInvoiceEmail(invoice, student, residence);
                    console.log(`✅ Lease start invoice email sent successfully to ${student.email}`);
                } catch (emailError) {
                    console.error(`❌ Error sending lease start invoice email to ${student.email}:`, emailError);
                    console.error(`   Error details:`, emailError.message);
                    
                    // Try to send a simple email as fallback
                    try {
                        console.log(`🔄 Attempting fallback invoice email to ${student.email}...`);
                        const { sendEmail } = require('../utils/email');
                        await sendEmail({
                            to: student.email,
                            subject: `Invoice ${invoiceNumber} - Alamait Student Accommodation`,
                            text: `Dear ${student.firstName} ${student.lastName}, Your invoice ${invoiceNumber} for $${totalAmount} has been created. Please check your student portal for details.`
                        });
                        console.log(`✅ Fallback invoice email sent successfully to ${student.email}`);
                    } catch (fallbackError) {
                        console.error(`❌ Fallback invoice email also failed for ${student.email}:`, fallbackError.message);
                    }
                }
            }, 100); // Small delay to ensure invoice creation completes first
            
            console.log(`📄 Lease start invoice created and sent: ${invoiceNumber}`);
            return invoice;
            
        } catch (error) {
            console.error('❌ Error creating/sending lease start invoice:', error);
            throw error;
        }
    }
    
    /**
     * 🆕 Send welcome email for lease start
     */
    static async sendWelcomeEmail(application, invoice) {
        try {
            const { sendEmail } = require('../utils/email');
            const User = require('../models/User');
            const { Residence } = require('../models/Residence');
            
            // Get student and residence details
            const student = await User.findById(application.student);
            const residence = await Residence.findById(application.residence);
            
            if (!student || !residence) {
                throw new Error('Student or residence not found for welcome email');
            }
            
            const welcomeEmailContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
                        <h2 style="color: #333;">Welcome to Alamait Student Accommodation!</h2>
                        <p>Dear ${application.firstName} ${application.lastName},</p>
                        
                        <p>Congratulations! Your application has been approved and your lease has started.</p>
                        
                        <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
                            <h3 style="color: #333; margin-top: 0;">Account Details</h3>
                            <p><strong>Email:</strong> ${application.email}</p>
                            <p><strong>Application Code:</strong> ${application.applicationCode}</p>
                            <p><strong>Allocated Room:</strong> ${application.allocatedRoom || 'TBD'}</p>
                            <p><strong>Residence:</strong> ${residence.name}</p>
                            <p><strong>Lease Start Date:</strong> ${new Date(application.startDate).toLocaleDateString()}</p>
                            <p><strong>Lease End Date:</strong> ${new Date(application.endDate).toLocaleDateString()}</p>
                        </div>
                        
                        <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
                            <h3 style="color: #333; margin-top: 0;">Payment Information</h3>
                            <p><strong>Monthly Rent:</strong> $${application.monthlyRent || 0}</p>
                            <p><strong>Admin Fee:</strong> $${invoice.metadata?.adminFee || 0}</p>
                            <p><strong>Security Deposit:</strong> $${invoice.metadata?.securityDeposit || 0}</p>
                            <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
                            <p><strong>Total Amount Due:</strong> $${invoice.totalAmount}</p>
                        </div>
                        
                        <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 15px 0;">
                            <h3 style="color: #1976d2; margin-top: 0;">Next Steps</h3>
                            <p>1. Please check your email for your invoice details</p>
                            <p>2. Make payment by the due date to avoid late fees</p>
                            <p>3. Contact our office to arrange move-in</p>
                            <p>4. Review and sign your lease agreement</p>
                        </div>
                        
                        <div style="background-color: #f3e5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
                            <h3 style="color: #7b1fa2; margin-top: 0;">Important Contact Information</h3>
                            <p><strong>Support Email:</strong> support@alamait.com</p>
                            <p><strong>Finance Team:</strong> finance@alamait.com</p>
                            <p><strong>Student Portal:</strong> https://alamait.vercel.app/login</p>
                        </div>
                        
                        <hr style="margin: 20px 0;">
                        <p style="font-size: 12px; color: #666;">
                            This is an automated message from Alamait Student Accommodation.<br>
                            For assistance, please contact our support team.
                        </p>
                    </div>
                </div>
            `;
            
            // Send welcome email in background (non-blocking)
            setTimeout(async () => {
                try {
                    await sendEmail({
                        to: application.email,
                        subject: `Welcome to Alamait Student Accommodation - Your Account Details`,
                        html: welcomeEmailContent
                    });
                    console.log(`📧 Welcome email sent to ${application.email}`);
                } catch (emailError) {
                    console.error(`❌ Failed to send welcome email to ${application.email}:`, emailError.message);
                }
            }, 100);
            
        } catch (error) {
            console.error('❌ Error sending welcome email:', error);
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
            
            // Send email in background (non-blocking)
            setTimeout(async () => {
                try {
                    console.log(`📧 Sending monthly invoice email to ${student.email}...`);
                    console.log(`   Invoice: ${invoiceNumber}`);
                    console.log(`   Student: ${student.firstName} ${student.lastName}`);
                    console.log(`   Amount: $${rentAmount}`);
                    
                    await this.sendInvoiceEmail(invoice, student, residence);
                    console.log(`✅ Monthly invoice email sent successfully to ${student.email}`);
                } catch (emailError) {
                    console.error(`❌ Error sending monthly invoice email to ${student.email}:`, emailError);
                    console.error(`   Error details:`, emailError.message);
                    
                    // Try to send a simple email as fallback
                    try {
                        console.log(`🔄 Attempting fallback monthly invoice email to ${student.email}...`);
                        const { sendEmail } = require('../utils/email');
                        await sendEmail({
                            to: student.email,
                            subject: `Monthly Invoice ${invoiceNumber} - Alamait Student Accommodation`,
                            text: `Dear ${student.firstName} ${student.lastName}, Your monthly invoice ${invoiceNumber} for $${rentAmount} has been created. Please check your student portal for details.`
                        });
                        console.log(`✅ Fallback monthly invoice email sent successfully to ${student.email}`);
                    } catch (fallbackError) {
                        console.error(`❌ Fallback monthly invoice email also failed for ${student.email}:`, fallbackError.message);
                    }
                }
            }, 100); // Small delay to ensure invoice creation completes first
            
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
            const EmailNotificationService = require('./emailNotificationService');
            
            // Generate charges table HTML
            const chargesTableHtml = invoice.charges && invoice.charges.length > 0 ? `
                <div style="margin: 20px 0;">
                    <h3 style="color: #333; margin-bottom: 15px;">💰 Charges Breakdown</h3>
                    <table style="width: 100%; border-collapse: collapse; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <thead>
                            <tr style="background-color: #f8f9fa;">
                                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6; color: #495057; font-weight: 600;">Description</th>
                                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #dee2e6; color: #495057; font-weight: 600;">Quantity</th>
                                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6; color: #495057; font-weight: 600;">Unit Price</th>
                                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6; color: #495057; font-weight: 600;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${invoice.charges.map((charge, index) => `
                                <tr style="border-bottom: 1px solid #dee2e6; ${index % 2 === 0 ? 'background-color: #f8f9fa;' : 'background-color: white;'}">
                                    <td style="padding: 12px; color: #333;">${charge.description}</td>
                                    <td style="padding: 12px; text-align: center; color: #495057;">${charge.quantity || 1}</td>
                                    <td style="padding: 12px; text-align: right; color: #495057;">$${(charge.unitPrice || charge.amount || 0).toFixed(2)}</td>
                                    <td style="padding: 12px; text-align: right; color: #495057; font-weight: 600;">$${(charge.total || charge.amount || 0).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                            <tr style="background-color: #e8f5e8; border-top: 2px solid #28a745;">
                                <td colspan="3" style="padding: 12px; text-align: right; color: #155724; font-weight: 600;">Total Amount:</td>
                                <td style="padding: 12px; text-align: right; color: #155724; font-weight: 600; font-size: 16px;">$${invoice.totalAmount.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            ` : '';

            const content = `
                <p style="color: #333; font-size: 16px; margin-bottom: 20px;">Dear ${student.firstName} ${student.lastName},</p>
                <p style="color: #666; font-size: 14px; margin-bottom: 25px;">Please find your invoice details below:</p>
                
                <!-- Invoice Details -->
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff; margin-bottom: 25px;">
                    <h3 style="color: #333; margin: 0 0 15px 0; font-size: 18px;">📋 Invoice Details</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div>
                            <strong style="color: #495057;">📄 Invoice Number:</strong><br>
                            <span style="color: #333; font-size: 14px;">${invoice.invoiceNumber}</span>
                        </div>
                        <div>
                            <strong style="color: #495057;">📅 Billing Period:</strong><br>
                            <span style="color: #333; font-size: 14px;">${invoice.billingPeriod}</span>
                        </div>
                        <div>
                            <strong style="color: #495057;">🚪 Room:</strong><br>
                            <span style="color: #333; font-size: 14px;">${invoice.room}</span>
                        </div>
                        <div>
                            <strong style="color: #495057;">🏠 Residence:</strong><br>
                            <span style="color: #333; font-size: 14px;">${residence.name}</span>
                        </div>
                        <div>
                            <strong style="color: #495057;">⏰ Due Date:</strong><br>
                            <span style="color: #333; font-size: 14px;">${new Date(invoice.dueDate).toLocaleDateString()}</span>
                        </div>
                        <div>
                            <strong style="color: #495057;">💵 Total Amount:</strong><br>
                            <span style="color: #28a745; font-size: 16px; font-weight: 600;">$${invoice.totalAmount.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                
                ${chargesTableHtml}
                
                <!-- Payment Information -->
                <div style="background-color: #e3f2fd; border: 1px solid #bbdefb; padding: 20px; border-radius: 8px; margin: 25px 0;">
                    <h3 style="color: #1976d2; margin: 0 0 10px 0; font-size: 16px;">💳 Payment Information</h3>
                    <p style="color: #1976d2; margin: 0; font-size: 14px;">Please make payment by the due date to avoid late fees. For payment inquiries, please contact our finance team.</p>
                </div>
            `;

            const emailContent = EmailNotificationService.getBaseEmailTemplate(
                '📄 Invoice',
                `Invoice ${invoice.invoiceNumber} - Please find your invoice details below`,
                content
            );
            
            // Send email in background (non-blocking)
            setTimeout(async () => {
                try {
                    await sendEmail({
                        to: student.email,
                        subject: `Invoice ${invoice.invoiceNumber} - Alamait Student Accommodation`,
                        html: emailContent
                    });
                    console.log(`📧 Invoice email sent to ${student.email}`);
                } catch (emailError) {
                    console.error(`❌ Failed to send invoice email to ${student.email}:`, emailError.message);
                }
            }, 100);
            
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
                        const fees = this.calculateFeesFromPaymentConfig(residence, roomData);
                        adminFee = fees.adminFee;
                    } else {
                        // Fallback pricing if room not found
                        rentAmount = 200;
                        // Check payment config for admin fee even in fallback
                        const fees = this.calculateFeesFromPaymentConfig(residence, { price: 200 });
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
