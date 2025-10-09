const Transaction = require('../../models/Transaction');
const { Residence } = require('../../models/Residence');
const Account = require('../../models/Account');

/**
 * Get income summary for all residences
 */
const getIncomeSummary = async (req, res) => {
    try {
        console.log('💰 Fetching income summary...');

        // Get all transactions and residences
        const transactions = await Transaction.find({});
        const residences = await Residence.find({});

        // Calculate income by residence
        let incomeByResidence = {};
        let totalIncome = 0;
        let totalTransactions = 0;

        residences.forEach(residence => {
            incomeByResidence[residence._id.toString()] = {
                id: residence._id,
                name: residence.name,
                address: residence.address,
                totalIncome: 0,
                paymentIncome: 0,
                accrualIncome: 0,
                transactionCount: 0,
                paymentCount: 0,
                accrualCount: 0,
                monthlyBreakdown: {},
                roomCount: residence.rooms ? residence.rooms.length : 0,
                averageRoomPrice: 0
            };

            // Calculate average room price
            if (residence.rooms && residence.rooms.length > 0) {
                const totalRoomPrice = residence.rooms.reduce((sum, room) => sum + (room.price || 0), 0);
                incomeByResidence[residence._id.toString()].averageRoomPrice = totalRoomPrice / residence.rooms.length;
            }
        });

        // Process transactions
        transactions.forEach(transaction => {
            const amount = transaction.amount || 0;
            const type = transaction.type || 'unknown';
            const residenceId = transaction.residence?.toString();
            const date = transaction.date || transaction.createdAt;
            const month = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : 'unknown';

            if (residenceId && incomeByResidence[residenceId]) {
                const residence = incomeByResidence[residenceId];
                
                residence.totalIncome += amount;
                residence.transactionCount++;

                // Track by transaction type
                if (type === 'payment') {
                    residence.paymentIncome += amount;
                    residence.paymentCount++;
                } else if (type === 'accrual') {
                    residence.accrualIncome += amount;
                    residence.accrualCount++;
                }

                // Track by month
                if (!residence.monthlyBreakdown[month]) {
                    residence.monthlyBreakdown[month] = {
                        total: 0,
                        payments: 0,
                        accruals: 0,
                        count: 0
                    };
                }
                residence.monthlyBreakdown[month].total += amount;
                residence.monthlyBreakdown[month].count++;
                
                if (type === 'payment') {
                    residence.monthlyBreakdown[month].payments += amount;
                } else if (type === 'accrual') {
                    residence.monthlyBreakdown[month].accruals += amount;
                }

                totalIncome += amount;
                totalTransactions++;
            }
        });

        // Convert monthly breakdown to array and sort
        Object.keys(incomeByResidence).forEach(residenceId => {
            const residence = incomeByResidence[residenceId];
            residence.monthlyBreakdown = Object.entries(residence.monthlyBreakdown)
                .map(([month, data]) => ({
                    month,
                    ...data
                }))
                .sort((a, b) => a.month.localeCompare(b.month));
        });

        // Convert to array and sort by total income
        const incomeArray = Object.values(incomeByResidence)
            .sort((a, b) => b.totalIncome - a.totalIncome);

        const response = {
            success: true,
            data: {
                summary: {
                    totalIncome,
                    totalTransactions,
                    residenceCount: residences.length,
                    averageIncomePerResidence: residences.length > 0 ? totalIncome / residences.length : 0
                },
                residences: incomeArray
            }
        };

        console.log(`✅ Income summary fetched: $${totalIncome.toLocaleString()} from ${totalTransactions} transactions`);
        res.json(response);

    } catch (error) {
        console.error('❌ Error fetching income summary:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch income summary',
            error: error.message
        });
    }
};

/**
 * Get income for a specific residence
 */
const getResidenceIncome = async (req, res) => {
    try {
        const { residenceId } = req.params;
        console.log(`💰 Fetching income for residence: ${residenceId}`);

        // Validate residence exists
        const residence = await Residence.findById(residenceId);
        if (!residence) {
            return res.status(404).json({
                success: false,
                message: 'Residence not found'
            });
        }

        // Get transactions for this residence
        const transactions = await Transaction.find({ residence: residenceId })
            .sort({ date: -1 });

        // Calculate income breakdown
        let totalIncome = 0;
        let paymentIncome = 0;
        let accrualIncome = 0;
        let monthlyBreakdown = {};
        let transactionTypes = {};

        transactions.forEach(transaction => {
            const amount = transaction.amount || 0;
            const type = transaction.type || 'unknown';
            const date = transaction.date || transaction.createdAt;
            const month = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : 'unknown';

            totalIncome += amount;

            // Track by type
            if (!transactionTypes[type]) {
                transactionTypes[type] = { total: 0, count: 0 };
            }
            transactionTypes[type].total += amount;
            transactionTypes[type].count++;

            // Track by month
            if (!monthlyBreakdown[month]) {
                monthlyBreakdown[month] = {
                    total: 0,
                    payments: 0,
                    accruals: 0,
                    count: 0,
                    transactions: []
                };
            }
            monthlyBreakdown[month].total += amount;
            monthlyBreakdown[month].count++;

            if (type === 'payment') {
                paymentIncome += amount;
                monthlyBreakdown[month].payments += amount;
            } else if (type === 'accrual') {
                accrualIncome += amount;
                monthlyBreakdown[month].accruals += amount;
            }

            // Add transaction to monthly breakdown
            monthlyBreakdown[month].transactions.push({
                id: transaction._id,
                transactionId: transaction.transactionId,
                type: transaction.type,
                amount: transaction.amount,
                date: transaction.date,
                description: transaction.description,
                reference: transaction.reference
            });
        });

        // Convert monthly breakdown to array and sort
        const monthlyArray = Object.entries(monthlyBreakdown)
            .map(([month, data]) => ({
                month,
                ...data
            }))
            .sort((a, b) => a.month.localeCompare(b.month));

        const response = {
            success: true,
            data: {
                residence: {
                    id: residence._id,
                    name: residence.name,
                    address: residence.address,
                    roomCount: residence.rooms ? residence.rooms.length : 0,
                    averageRoomPrice: residence.rooms && residence.rooms.length > 0 
                        ? residence.rooms.reduce((sum, room) => sum + (room.price || 0), 0) / residence.rooms.length 
                        : 0
                },
                income: {
                    total: totalIncome,
                    payments: paymentIncome,
                    accruals: accrualIncome,
                    transactionCount: transactions.length
                },
                breakdown: {
                    byType: transactionTypes,
                    byMonth: monthlyArray
                },
                transactions: transactions.slice(0, 50) // Limit to last 50 transactions
            }
        };

        console.log(`✅ Residence income fetched: $${totalIncome.toLocaleString()} from ${transactions.length} transactions`);
        res.json(response);

    } catch (error) {
        console.error('❌ Error fetching residence income:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch residence income',
            error: error.message
        });
    }
};

/**
 * Get income by date range
 */
const getIncomeByDateRange = async (req, res) => {
    try {
        const { startDate, endDate, residenceId } = req.query;
        console.log(`💰 Fetching income from ${startDate} to ${endDate}${residenceId ? ` for residence ${residenceId}` : ''}`);

        // Build query
        let query = {};
        
        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        if (residenceId) {
            query.residence = residenceId;
        }

        // Get transactions
        const transactions = await Transaction.find(query)
            .sort({ date: -1 });

        // Calculate income
        let totalIncome = 0;
        let incomeByResidence = {};
        let incomeByMonth = {};

        transactions.forEach(transaction => {
            const amount = transaction.amount || 0;
            const type = transaction.type || 'unknown';
            const residenceId = transaction.residence?.toString();
            const date = transaction.date || transaction.createdAt;
            const month = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : 'unknown';

            totalIncome += amount;

            // Track by residence
            if (residenceId) {
                if (!incomeByResidence[residenceId]) {
                    incomeByResidence[residenceId] = { total: 0, count: 0 };
                }
                incomeByResidence[residenceId].total += amount;
                incomeByResidence[residenceId].count++;
            }

            // Track by month
            if (!incomeByMonth[month]) {
                incomeByMonth[month] = { total: 0, count: 0 };
            }
            incomeByMonth[month].total += amount;
            incomeByMonth[month].count++;
        });

        const response = {
            success: true,
            data: {
                dateRange: { startDate, endDate },
                summary: {
                    totalIncome,
                    totalTransactions: transactions.length,
                    averageTransactionAmount: transactions.length > 0 ? totalIncome / transactions.length : 0
                },
                breakdown: {
                    byResidence: incomeByResidence,
                    byMonth: incomeByMonth
                },
                transactions: transactions.slice(0, 100) // Limit to last 100 transactions
            }
        };

        console.log(`✅ Date range income fetched: $${totalIncome.toLocaleString()} from ${transactions.length} transactions`);
        res.json(response);

    } catch (error) {
        console.error('❌ Error fetching income by date range:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch income by date range',
            error: error.message
        });
    }
};

module.exports = {
    getIncomeSummary,
    getResidenceIncome,
    getIncomeByDateRange
};
