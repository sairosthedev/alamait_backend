const TransactionEntry = require('../models/TransactionEntry');
const Account = require('../models/Account');
const DebtorTransactionSyncService = require('./debtorTransactionSyncService');
const DebtorDataSyncService = require('./debtorDataSyncService');

/**
 * Calculate prorated rent for the first month
 * @param {Date} startDate - Lease start date
 * @param {number} monthlyRent - Full monthly rent amount
 * @returns {number} Prorated rent amount
 */
function calculateProratedRent(startDate, monthlyRent, residence) {
    const start = new Date(startDate);
    const year = start.getFullYear();
    const month = start.getMonth();
    const dayOfMonth = start.getDate();
    
    // Get the last day of the month
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    
    // Calculate days from start date to end of month
    const daysFromStart = daysInMonth - dayOfMonth + 1;
    
    // If residence provided and has rentProration config, delegate to shared helper
    if (residence && residence.paymentConfiguration) {
        try {
            const RentalAccrualService = require('./rentalAccrualService');
            const room = { price: monthlyRent };
            const amount = RentalAccrualService.calculateProratedRent(residence, room, start);
            return Math.round(amount * 100) / 100;
        } catch (e) {
            console.warn('⚠️ Proration via shared helper failed, falling back:', e.message);
        }
    }

    let proratedAmount;
    
    // Business rule: If lease starts from 20th onwards, use $7 per day
    if (dayOfMonth >= 20) {
        proratedAmount = daysFromStart * 7; // $7 per day
        console.log(`📅 Lease starts on ${dayOfMonth}th (≥20th): Using $7/day rate`);
        console.log(`   Days from start: ${daysFromStart}, Amount: $${proratedAmount}`);
    } else {
        // Use normal prorated calculation
        proratedAmount = (monthlyRent / daysInMonth) * daysFromStart;
        console.log(`📅 Lease starts on ${dayOfMonth}th (<20th): Using prorated calculation`);
        console.log(`   Monthly rent: $${monthlyRent}, Days in month: ${daysInMonth}, Days from start: ${daysFromStart}`);
        console.log(`   Prorated amount: $${monthlyRent} × ${daysFromStart}/${daysInMonth} = $${proratedAmount}`);
    }
    
    return Math.round(proratedAmount * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate deposit amount based on room price
 * @param {number} roomPrice - Monthly room price
 * @returns {number} Deposit amount (typically 1 month rent)
 */
function calculateDepositAmount(roomPrice) {
	// Standard practice: 1 month rent as deposit
	return roomPrice || 0;
}

/**
 * Backfill missing transactions for a specific debtor
 * Only runs during explicit bulk operations (guarded via options.bulk === true)
 * @param {Object} debtor - The debtor object
 * @param {Object} options - Control flags
 * @param {boolean} options.bulk - Must be true to allow backfill
 * @returns {Object} Result of the backfill operation
 */
async function backfillTransactionsForDebtor(debtor, options = {}) {
	try {
		// Guard: run only when explicitly requested for bulk, manual, or auto flows
		if (!options.bulk && !options.manual && !options.auto) {
			return {
				success: true,
				skipped: true,
				reason: 'Backfill disabled outside bulk/manual/auto modes'
			};
		}

        console.log(`🔄 Backfilling transactions for debtor: ${debtor.debtorCode}`);
        const Debtor = require('../models/Debtor');
        const { Residence } = require('../models/Residence');
        
        let invoiceQueue = []; // Queue for FIFO invoice processing

        // Ensure debtor has populated user/residence to correctly identify student
		if (!debtor.user?.firstName || !debtor.user?.lastName || !debtor.residence?.name) {
            const populated = await Debtor.findById(debtor._id)
                .populate('user', 'firstName lastName email')
                .populate('residence', 'name');
            if (populated) debtor = populated;
        }

		// Abort if still missing a valid user — prevents "Student Unknown" entries
		if (!debtor.user?.firstName || !debtor.user?.lastName) {
			return {
				success: false,
				error: 'Debtor user not fully resolved; refusing to create fallback "Student Unknown" entries'
			};
        }

        // Helpers to normalize ids and names
        const getId = (value) => {
            if (!value) return undefined;
            if (typeof value === 'string') return value;
            return value._id || value.id || undefined;
        };
        const getName = (res) => (res?.name ? res.name : (debtor.residenceName || 'Unknown'));
        
        // Get debtor's AR account
        const debtorAccount = await Account.findOne({ code: debtor.accountCode });
        if (!debtorAccount) {
            throw new Error(`Debtor account not found: ${debtor.accountCode}`);
        }
        
        // Get financial data from debtor
        const monthlyRent = debtor.roomPrice || debtor.financialBreakdown?.monthlyRent || 500;
        const startDate = debtor.startDate || debtor.billingPeriod?.startDate || new Date();
        const endDate = debtor.endDate || debtor.billingPeriod?.endDate || new Date(new Date().setMonth(new Date().getMonth() + 6));
        const applicationCode = debtor.applicationCode || 'MANUAL';
        
        // Get residence and payment configuration
        const residence = await Residence.findById(debtor.residence);
        let adminFee = debtor.financialBreakdown?.adminFee || 0;
        let depositAmount = 0;
        
        if (residence && residence.paymentConfiguration) {
            const paymentConfig = residence.paymentConfiguration;
            
            console.log('🔍 Transaction Backfill - Payment Config Debug:', {
                residenceName: residence.name,
                paymentConfig: paymentConfig,
                monthlyRent: monthlyRent
            });
            
            // Calculate admin fee based on configuration
            if (paymentConfig.adminFee && paymentConfig.adminFee.enabled === true) {
                if (paymentConfig.adminFee.calculation === 'fixed' || paymentConfig.adminFee.amount) {
                    adminFee = paymentConfig.adminFee.amount || 0;
                } else if (paymentConfig.adminFee.calculation === 'percentage') {
                    adminFee = (monthlyRent * (paymentConfig.adminFee.percentage || 0)) / 100;
                }
            }
            
            // Calculate deposit based on configuration
            console.log('🔍 Deposit Config Check (Backfill):', {
                hasDepositConfig: !!paymentConfig.deposit,
                depositEnabled: paymentConfig.deposit?.enabled,
                depositCalculation: paymentConfig.deposit?.calculation
            });
            
            if (paymentConfig.deposit && paymentConfig.deposit.enabled === true) {
                if (paymentConfig.deposit.calculation === 'one_month_rent') {
                    depositAmount = monthlyRent;
                } else if (paymentConfig.deposit.calculation === 'fixed') {
                    depositAmount = paymentConfig.deposit.amount || 0;
                } else if (paymentConfig.deposit.calculation === 'percentage') {
                    depositAmount = (monthlyRent * (paymentConfig.deposit.percentage || 100)) / 100;
                }
                console.log('💰 Security Deposit Calculated (Backfill):', depositAmount);
            } else {
                console.log('🚫 Security Deposit Disabled (Backfill)');
            }
        } else {
            // Fallback to old behavior if no payment config
            console.log('⚠️ No payment configuration found, using fallback deposit calculation');
            depositAmount = calculateDepositAmount(monthlyRent) || 0;
        }
        
        let leaseStartCreated = false;
        let monthlyTransactionsCreated = 0;
		let duplicatesRemoved = 0;
        
		// Idempotency: skip if a lease-start entry already exists for THIS SPECIFIC APPLICATION/DEBTOR
		// Allow multiple lease starts for the same student (re-applications)
		const existingLeaseStart = await TransactionEntry.findOne({
            $or: [
				{ reference: `LEASE_START_${applicationCode}` },
				{ source: 'rental_accrual', sourceModel: 'Debtor', sourceId: debtor._id, description: { $regex: /^Lease start / } },
				{ 'metadata.applicationCode': applicationCode, 'metadata.type': 'lease_start' },
				{ 'metadata.debtorId': debtor._id.toString(), 'metadata.type': 'lease_start' }
			]
		});
		
		if (!existingLeaseStart) {
			// Create lease start transaction
            const proratedRent = calculateProratedRent(startDate, monthlyRent, residence);
			const totalLeaseStartAmount = proratedRent + (adminFee || 0) + depositAmount;
			
            // Create proper double-entry accounting entries
            const entries = [];
            
            // 1. Prorated Rent Accrual
            if (proratedRent > 0) {
                entries.push({
                    accountCode: debtor.accountCode,
                    accountName: debtorAccount.name,
                    accountType: debtorAccount.type,
                    debit: proratedRent,
                    credit: 0,
                    description: `Prorated rent due from ${debtor.user.firstName} ${debtor.user.lastName} - ${startDate.toISOString().split('T')[0]} to month end`
                });
                
                entries.push({
                    accountCode: '4001',
                    accountName: 'Rental Income',
                    accountType: 'Income',
                    debit: 0,
                    credit: proratedRent,
                    description: `Prorated rental income accrued - ${debtor.user.firstName} ${debtor.user.lastName}`
                });
            }
            
            // 2. Admin Fee Accrual (if applicable)
            if (adminFee > 0) {
                entries.push({
                    accountCode: debtor.accountCode,
                    accountName: debtorAccount.name,
                    accountType: debtorAccount.type,
                    debit: adminFee,
                    credit: 0,
                    description: `Admin fee due from ${debtor.user.firstName} ${debtor.user.lastName}`
                });
                
                entries.push({
                    accountCode: '4002',
                    accountName: 'Administrative Fees',
                    accountType: 'Income',
                    debit: 0,
                    credit: adminFee,
                    description: `Administrative income accrued - ${debtor.user.firstName} ${debtor.user.lastName}`
                });
            }
            
            // 3. Security Deposit Liability
            if (depositAmount > 0) {
                entries.push({
                    accountCode: debtor.accountCode,
                    accountName: debtorAccount.name,
                    accountType: debtorAccount.type,
                    debit: depositAmount,
                    credit: 0,
                    description: `Security deposit due from ${debtor.user.firstName} ${debtor.user.lastName}`
                });
                
                entries.push({
                    accountCode: '2020',
                    accountName: 'Tenant Security Deposits',
                    accountType: 'Liability',
                    debit: 0,
                    credit: depositAmount,
                    description: `Security deposit liability created - ${debtor.user.firstName} ${debtor.user.lastName}`
                });
            }
            
            // Calculate totals
            const totalDebit = entries.reduce((sum, entry) => sum + entry.debit, 0);
            const totalCredit = entries.reduce((sum, entry) => sum + entry.credit, 0);

            const leaseStartTransaction = new TransactionEntry({
                transactionId: `LEASE_START_${applicationCode}_${Date.now()}`,
                date: startDate,
				description: `Lease start for ${debtor.user.firstName} ${debtor.user.lastName}`,
                reference: `LEASE_START_${applicationCode}`,
                entries,
                totalDebit,
                totalCredit,
                source: 'rental_accrual',
                sourceId: debtor._id,
                sourceModel: 'Debtor',
                residence: debtor.residence?._id, // Add residence field
                status: 'posted',
                createdBy: 'system',
                metadata: {
					// marker for lease-start created by backfill
                    type: 'lease_start',
					applicationCode,
					debtorId: debtor._id.toString(),
					studentId: debtor.user._id,
					studentName: `${debtor.user.firstName} ${debtor.user.lastName}`,
					residenceId: debtor.residence?._id,
					residenceName: debtor.residence?.name || 'Unknown Residence',
					month: startDate.toISOString().substring(0, 7) // YYYY-MM format
				}
			});
            
            await leaseStartTransaction.save();
            leaseStartCreated = true;
            
            // Store lease start invoice data for FIFO processing
            invoiceQueue.push({
                type: 'lease_start',
                transaction: leaseStartTransaction,
                application: {
                    _id: debtor.application || new mongoose.Types.ObjectId(),
                    applicationCode: applicationCode,
                    student: debtor.user._id,
                    firstName: debtor.user.firstName,
                    lastName: debtor.user.lastName,
                    startDate: startDate,
                    residence: debtor.residence?._id,
                    allocatedRoom: debtor.roomNumber
                },
                amounts: {
                    proratedRent,
                    adminFee,
                    securityDeposit: depositAmount
                }
            });
		}

		// Prepare iteration over months (idempotent per monthKey)
		const currentMonthIter = new Date(startDate);
        currentMonthIter.setDate(1); // Set to first day of month
        
        // Get lease start month to skip it for monthly accruals
        const leaseStartYear = startDate.getFullYear();
        const leaseStartMonth = startDate.getMonth() + 1; // 1-12
        const leaseStartMonthKey = `${leaseStartYear}-${String(leaseStartMonth).padStart(2, '0')}`;
        
        // Get current month boundary - only create transactions up to current month
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // 1-12
        const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
        
        while (currentMonthIter < endDate) {
			const year = currentMonthIter.getFullYear();
			const month = currentMonthIter.getMonth() + 1; // 1-12
			const monthKey = `${year}-${String(month).padStart(2, '0')}`;

			// Stop at current month - future months are handled by cron job
			if (year > currentYear || (year === currentYear && month > currentMonth)) {
				console.log(`⏭️ Stopping at current month boundary: ${currentMonthKey}. Future months (${monthKey}+) will be handled by cron job.`);
				break;
			}

			// Skip creating monthly accrual for lease start month
			// Lease start transaction handles the entire month (full month when proration disabled, prorated when enabled)
			// No separate monthly accrual needed for the start month

			// Skip if any existing accrual exists for this student+period from either model
			// Check for both backfill-created and rental accrual service-created monthly accruals
			const existingMonthlyAccrual = await TransactionEntry.findOne({
                source: 'rental_accrual',
				$and: [
					{
						$or: [
							{ 'metadata.type': 'monthly_rent_accrual' },
							{ description: { $regex: /Monthly rent accrual/ } }
						]
					},
					{
                $or: [
                    { 'metadata.month': monthKey },
							{ 'metadata.accrualMonth': month, 'metadata.accrualYear': year },
							{ description: { $regex: new RegExp(monthKey) } }
						]
					},
					{
						$or: [
							{ 'metadata.studentId': getId(debtor.user) },
							{ sourceModel: 'Debtor', sourceId: debtor._id },
							{ 'entries.accountCode': debtor.accountCode }
						]
                    }
                ]
            });
            
            // Skip creating monthly accrual for lease start month
            if (month === leaseStartMonth && year === leaseStartYear) {
                console.log(`⏭️ Skipping monthly accrual for lease start month ${monthKey} - handled by lease start process`);
                continue;
            }
            
            // Skip monthly accruals if optimization option is set
            if (options.skipMonthlyAccruals) {
                console.log(`⏭️ Skipping monthly accrual for ${monthKey} - skipMonthlyAccruals option set`);
                continue;
            }
            
			if (!existingMonthlyAccrual) {
            const monthlyAccrualTransaction = new TransactionEntry({
                transactionId: `MONTHLY_ACCRUAL_${monthKey}_${applicationCode}_${Date.now()}`,
					date: new Date(year, month - 1, 1), // This is correct - month is 1-based, Date constructor expects 0-based
					description: `Monthly rent accrual for ${debtor.user.firstName} ${debtor.user.lastName} - ${monthKey}`,
                reference: `MONTHLY_ACCRUAL_${monthKey}_${applicationCode}`,
                entries: [
                    {
                        accountCode: debtor.accountCode,
                        accountName: debtorAccount.name,
                        accountType: debtorAccount.type,
							debit: monthlyRent,
                        credit: 0,
							description: `AR for rent - ${monthKey}`
                    },
                    {
                        accountCode: '4001',
                        accountName: 'Rental Income',
                        accountType: 'Income',
                        debit: 0,
							credit: monthlyRent,
							description: `Rental income - ${monthKey}`
                    }
                ],
					totalDebit: monthlyRent,
					totalCredit: monthlyRent,
                source: 'rental_accrual',
                sourceModel: 'Debtor',
                residence: debtor.residence?._id, // Add residence field
                status: 'posted',
                metadata: {
                    studentId: getId(debtor.user),
                    residenceId: getId(debtor.residence),
                    residenceName: getName(debtor.residence),
                    type: 'monthly_rent_accrual',
                    month: monthKey,
                    applicationCode: applicationCode,
                    roomNumber: debtor.roomNumber,
                    monthlyRent: monthlyRent
                },
                createdBy: debtor.createdBy || getId(debtor.user)
            });
            
            await monthlyAccrualTransaction.save();
            monthlyTransactionsCreated++;
            
            // Store monthly invoice data for FIFO processing
            invoiceQueue.push({
                type: 'monthly_rent_accrual',
                transaction: monthlyAccrualTransaction,
                student: {
                    student: debtor.user._id,
                    firstName: debtor.user.firstName,
                    lastName: debtor.user.lastName,
                    email: debtor.user.email,
                    phone: debtor.user.phone,
                    residence: debtor.residence?._id,
                    allocatedRoom: debtor.roomNumber
                },
                amounts: {
                    month,
                    year,
                    monthlyRent
                }
            });
			}
            
            // Move to next month
            currentMonthIter.setMonth(currentMonthIter.getMonth() + 1);
        }
        
        // Recalculate debtor totals from transactions
        await DebtorTransactionSyncService.recalculateDebtorTotalsFromTransactionEntries(debtor, debtor.user?._id);
        
        // Sync debtor data arrays with transaction data
        await DebtorDataSyncService.syncDebtorDataArrays(debtor._id);
        
        // 🆕 FIFO INVOICE PROCESSING: Create invoices in chronological order
        if (options.skipInvoiceCreation) {
            console.log(`⏭️ Skipping invoice creation - skipInvoiceCreation option set`);
        } else if (invoiceQueue.length > 0) {
            console.log(`\n📄 Processing ${invoiceQueue.length} invoices in FIFO order...`);
            
            // Sort invoice queue by transaction date (FIFO)
            invoiceQueue.sort((a, b) => {
                const dateA = new Date(a.transaction.date);
                const dateB = new Date(b.transaction.date);
                return dateA - dateB; // Ascending order (oldest first)
            });
            
            let invoicesCreated = 0;
            let invoiceErrors = 0;
            
            for (const invoiceData of invoiceQueue) {
                try {
                    const RentalAccrualService = require('./rentalAccrualService');
                    
                    if (invoiceData.type === 'lease_start') {
                        console.log(`📄 Creating lease start invoice (FIFO): ${invoiceData.transaction.transactionId}`);
                        const invoice = await RentalAccrualService.createAndSendLeaseStartInvoice(
                            invoiceData.application,
                            invoiceData.amounts.proratedRent,
                            invoiceData.amounts.adminFee,
                            invoiceData.amounts.securityDeposit
                        );
                        console.log(`✅ Lease start invoice created: ${invoice.invoiceNumber}`);
                        invoicesCreated++;
                        
                    } else if (invoiceData.type === 'monthly_rent_accrual') {
                        console.log(`📄 Creating monthly invoice (FIFO): ${invoiceData.transaction.transactionId}`);
                        const invoice = await RentalAccrualService.createAndSendMonthlyInvoice(
                            invoiceData.student,
                            invoiceData.amounts.month,
                            invoiceData.amounts.year,
                            invoiceData.amounts.monthlyRent
                        );
                        console.log(`✅ Monthly invoice created: ${invoice.invoiceNumber}`);
                        invoicesCreated++;
                    }
                    
                } catch (invoiceError) {
                    console.error(`❌ Failed to create invoice for ${invoiceData.transaction.transactionId}:`, invoiceError.message);
                    invoiceErrors++;
                }
            }
            
            console.log(`📊 FIFO Invoice Summary: ${invoicesCreated} created, ${invoiceErrors} errors`);
        }
        
        return {
            success: true,
            leaseStartCreated,
            monthlyTransactionsCreated,
            duplicatesRemoved,
            invoicesCreated: invoiceQueue.length,
            debtor: debtor
        };
        
    } catch (error) {
        console.error(`❌ Error backfilling transactions for debtor ${debtor.debtorCode}:`, error);
        return {
            success: false,
            error: error.message,
            debtor: debtor
        };
    }
}

/**
 * Backfill missing transactions for all debtors
 * @returns {Object} Result of the backfill operation
 */
async function backfillAllTransactions() {
    try {
        const Debtor = require('../models/Debtor');
        
        // Get all debtors with their user and application data
        const debtors = await Debtor.find({})
            .populate('user', 'firstName lastName email')
            .populate('application', 'applicationCode startDate endDate');
        
        console.log(`📊 Found ${debtors.length} debtors to process`);
        
        let processedCount = 0;
        let errorCount = 0;
        let totalLeaseStartCreated = 0;
        let totalMonthlyTransactionsCreated = 0;
        let totalDuplicatesRemoved = 0;
        
        for (const debtor of debtors) {
            const result = await backfillTransactionsForDebtor(debtor);
            
            if (result.success) {
                processedCount++;
                if (result.leaseStartCreated) totalLeaseStartCreated++;
                totalMonthlyTransactionsCreated += result.monthlyTransactionsCreated;
                totalDuplicatesRemoved += result.duplicatesRemoved;
            } else {
                errorCount++;
            }
        }
        
        return {
            success: true,
            summary: {
                totalDebtors: debtors.length,
                processedCount,
                errorCount,
                leaseStartCreated: totalLeaseStartCreated,
                monthlyTransactionsCreated: totalMonthlyTransactionsCreated,
                duplicatesRemoved: totalDuplicatesRemoved
            }
        };
        
    } catch (error) {
        console.error('❌ Error in backfillAllTransactions:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    backfillTransactionsForDebtor,
    backfillAllTransactions,
    calculateProratedRent,
    calculateDepositAmount
};
