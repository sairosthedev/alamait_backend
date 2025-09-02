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
function calculateProratedRent(startDate, monthlyRent) {
	const start = new Date(startDate);
	const year = start.getFullYear();
	const month = start.getMonth();
	
	// Get the last day of the month
	const lastDayOfMonth = new Date(year, month + 1, 0);
	const daysInMonth = lastDayOfMonth.getDate();
	
	// Calculate days from start date to end of month
	const daysFromStart = daysInMonth - start.getDate() + 1;
	
	// Calculate prorated amount
	const proratedAmount = (monthlyRent / daysInMonth) * daysFromStart;
	
	return Math.round(proratedAmount * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate deposit amount based on room price
 * @param {number} roomPrice - Monthly room price
 * @returns {number} Deposit amount (typically 1 month rent)
 */
function calculateDepositAmount(roomPrice) {
	// Standard practice: 1 month rent as deposit
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
		// Guard: run only when explicitly requested for bulk or manual flows
		if (!options.bulk && !options.manual) {
			return {
				success: true,
				skipped: true,
				reason: 'Backfill disabled outside bulk/manual modes'
			};
		}

		console.log(`🔄 Backfilling transactions for debtor: ${debtor.debtorCode}`);
		const Debtor = require('../models/Debtor');
		const Residence = require('../models/Residence');

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
		
		// Get admin fee
		const adminFee = debtor.financialBreakdown?.adminFee;
		const depositAmount = calculateDepositAmount(monthlyRent) || 0;

		let leaseStartCreated = false;
		let monthlyTransactionsCreated = 0;
		let duplicatesRemoved = 0;

		// Idempotency: skip if a lease-start entry already exists (either prior debtor-based or lease-based)
		const existingLeaseStart = await TransactionEntry.findOne({
			$or: [
				{ reference: `LEASE_START_${applicationCode}` },
				{ source: 'rental_accrual', sourceModel: 'Debtor', sourceId: debtor._id, description: { $regex: /^Lease start / } }
			]
		});
		
		if (!existingLeaseStart) {
			// Create lease start transaction
			const proratedRent = calculateProratedRent(startDate, monthlyRent);
			const totalLeaseStartAmount = proratedRent + (adminFee || 0) + depositAmount;
			
			const leaseStartTransaction = new TransactionEntry({
				transactionId: `LEASE_START_${applicationCode}_${Date.now()}`,
				date: startDate,
				description: `Lease start for ${debtor.user.firstName} ${debtor.user.lastName}`,
				reference: `LEASE_START_${applicationCode}`,
				entries: [
					{
						accountCode: debtor.accountCode,
						accountName: debtorAccount.name,
						accountType: debtorAccount.type,
						debit: totalLeaseStartAmount,
						credit: 0,
						description: `Lease start charges for ${startDate.toISOString().split('T')[0]}`
					},
					{
						accountCode: '4001',
						accountName: 'Rental Income',
						accountType: 'Income',
						debit: 0,
						credit: proratedRent,
						description: `Prorated rental income for ${debtor.user.firstName} ${debtor.user.lastName}`
					}
				],
				totalDebit: totalLeaseStartAmount,
				totalCredit: totalLeaseStartAmount,
				source: 'rental_accrual',
				sourceId: debtor._id,
				sourceModel: 'Debtor',
				status: 'posted',
				metadata: {
					// marker for lease-start created by backfill
					type: 'lease_start',
					applicationCode
				}
			});
			
			await leaseStartTransaction.save();
			leaseStartCreated = true;
		}

		// Prepare iteration over months (idempotent per monthKey)
		const currentMonthIter = new Date(startDate);
		currentMonthIter.setDate(1); // Set to first day of month
		
		while (currentMonthIter < endDate) {
			const year = currentMonthIter.getFullYear();
			const month = currentMonthIter.getMonth() + 1; // 1-12
			const monthKey = `${year}-${String(month).padStart(2, '0')}`;

			// Skip if any existing accrual exists for this student+period from either model
			const existingMonthlyAccrual = await TransactionEntry.findOne({
				source: 'rental_accrual',
				$and: [
					{ 'metadata.type': 'monthly_rent_accrual' },
					{
						$or: [
							{ 'metadata.month': monthKey },
							{ 'metadata.accrualMonth': month, 'metadata.accrualYear': year }
						]
					},
					{
						$or: [
							{ 'metadata.studentId': getId(debtor.user) },
							{ sourceModel: 'Debtor', sourceId: debtor._id }
						]
					}
				]
			});

			if (!existingMonthlyAccrual) {
				const monthlyAccrualTransaction = new TransactionEntry({
					transactionId: `MONTHLY_ACCRUAL_${monthKey}_${applicationCode}_${Date.now()}`,
					date: new Date(year, month - 1, 1),
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
			}

			// Move to next month
			currentMonthIter.setMonth(currentMonthIter.getMonth() + 1);
		}
		
		// Recalculate debtor totals from transactions
		await DebtorTransactionSyncService.recalculateDebtorTotalsFromTransactionEntries(debtor, debtor.user?._id);
		
		// Sync debtor data arrays with transaction data
		await DebtorDataSyncService.syncDebtorDataArrays(debtor._id);
		
		return {
			success: true,
			leaseStartCreated,
			monthlyTransactionsCreated,
			duplicatesRemoved,
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
