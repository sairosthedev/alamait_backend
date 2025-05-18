const Payment = require('../../models/Payment');
const Expense = require('../../models/finance/Expense');
const Residence = require('../../models/Residence');
const User = require('../../models/User');
const { validateMongoId } = require('../../utils/validators');

// Get finance overview
exports.getFinanceOverview = async (req, res) => {
    try {
        const { residence, startDate, endDate } = req.query;
        
        // Build filter object
        const filter = {};
        const expenseFilter = {};
        
        if (residence) {
            if (!validateMongoId(residence)) {
                return res.status(400).json({ error: 'Invalid residence ID format' });
            }
            filter.residence = residence;
            expenseFilter.residence = residence;
        }
        
        // Date filtering
        if (startDate || endDate) {
            filter.date = {};
            expenseFilter.expenseDate = {};
            
            if (startDate) {
                filter.date.$gte = new Date(startDate);
                expenseFilter.expenseDate.$gte = new Date(startDate);
            }
            
            if (endDate) {
                filter.date.$lte = new Date(endDate);
                expenseFilter.expenseDate.$lte = new Date(endDate);
            }
        }

        // Get income (payments)
        const incomeData = await Payment.aggregate([
            { $match: { ...filter, status: { $in: ['Confirmed', 'Verified'] } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);

        // Get expenses
        const expensesData = await Expense.aggregate([
            { $match: { ...expenseFilter, paymentStatus: 'Paid' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // Get pending payments
        const pendingPaymentsData = await Payment.aggregate([
            { $match: { ...filter, status: 'Pending' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
        ]);

        // Get unpaid expenses
        const unpaidExpensesData = await Expense.aggregate([
            { $match: { ...expenseFilter, paymentStatus: 'Pending' } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]);

        // Calculate totals
        const totalIncome = incomeData.length > 0 ? incomeData[0].total : 0;
        const totalExpenses = expensesData.length > 0 ? expensesData[0].total : 0;
        const netProfit = totalIncome - totalExpenses;

        // Get residence counts
        const residenceCount = await Residence.countDocuments();
        const activeResidenceCount = await Residence.countDocuments({ status: 'Active' });

        // Get student counts
        const studentCount = await User.countDocuments({ role: 'student' });
        const activeStudentCount = await User.countDocuments({ role: 'student', status: 'Active' });

        // Format data for response
        const overview = {
            financialSummary: {
                totalIncome,
                totalExpenses,
                netProfit,
                profitMargin: totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0,
                pendingPayments: {
                    amount: pendingPaymentsData.length > 0 ? pendingPaymentsData[0].total : 0,
                    count: pendingPaymentsData.length > 0 ? pendingPaymentsData[0].count : 0
                },
                unpaidExpenses: {
                    amount: unpaidExpensesData.length > 0 ? unpaidExpensesData[0].total : 0,
                    count: unpaidExpensesData.length > 0 ? unpaidExpensesData[0].count : 0
                }
            },
            residenceSummary: {
                totalResidences: residenceCount,
                activeResidences: activeResidenceCount,
                occupancyRate: Math.round((activeResidenceCount / residenceCount) * 100) || 0
            },
            studentSummary: {
                totalStudents: studentCount,
                activeStudents: activeStudentCount,
                activeRate: Math.round((activeStudentCount / studentCount) * 100) || 0
            }
        };

        res.status(200).json({ overview });
    } catch (error) {
        console.error('Error generating finance overview:', error);
        res.status(500).json({ error: 'Failed to generate finance overview' });
    }
};

// Get income by period
exports.getIncomeByPeriod = async (req, res) => {
    try {
        const { residence, period = 'month', startDate, endDate } = req.query;
        
        // Build filter object
        const filter = { status: { $in: ['Confirmed', 'Verified'] } };
        
        if (residence) {
            if (!validateMongoId(residence)) {
                return res.status(400).json({ error: 'Invalid residence ID format' });
            }
            filter.residence = residence;
        }
        
        // Date filtering
        if (startDate || endDate) {
            filter.date = {};
            if (startDate) filter.date.$gte = new Date(startDate);
            if (endDate) filter.date.$lte = new Date(endDate);
        }

        // Determine the time grouping based on period
        let timeGrouping;
        if (period === 'day') {
            timeGrouping = { $dateToString: { format: '%Y-%m-%d', date: '$date' } };
        } else if (period === 'week') {
            timeGrouping = { 
                year: { $year: '$date' },
                week: { $week: '$date' }
            };
        } else if (period === 'month') {
            timeGrouping = { 
                year: { $year: '$date' },
                month: { $month: '$date' }
            };
        } else if (period === 'quarter') {
            timeGrouping = {
                year: { $year: '$date' },
                quarter: { $ceil: { $divide: [{ $month: '$date' }, 3] } }
            };
        } else { // year
            timeGrouping = { $year: '$date' };
        }

        // Get income grouped by time period
        const incomeByPeriod = await Payment.aggregate([
            { $match: filter },
            { $group: { 
                _id: timeGrouping,
                totalAmount: { $sum: '$totalAmount' },
                count: { $sum: 1 }
            }},
            { $sort: { '_id': 1 } }
        ]);

        // Format results based on period
        const formattedData = incomeByPeriod.map(item => {
            let label;
            
            if (period === 'day') {
                label = item._id;
            } else if (period === 'week') {
                label = `${item._id.year}-W${item._id.week}`;
            } else if (period === 'month') {
                label = `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`;
            } else if (period === 'quarter') {
                label = `${item._id.year}-Q${item._id.quarter}`;
            } else { // year
                label = item._id.toString();
            }
            
            return {
                period: label,
                amount: item.totalAmount,
                count: item.count
            };
        });

        res.status(200).json({ incomeByPeriod: formattedData });
    } catch (error) {
        console.error('Error generating income by period:', error);
        res.status(500).json({ error: 'Failed to generate income by period data' });
    }
};

// Get expenses by period
exports.getExpensesByPeriod = async (req, res) => {
    try {
        const { residence, period = 'month', startDate, endDate } = req.query;
        
        // Build filter object
        const filter = { paymentStatus: 'Paid' };
        
        if (residence) {
            if (!validateMongoId(residence)) {
                return res.status(400).json({ error: 'Invalid residence ID format' });
            }
            filter.residence = residence;
        }
        
        // Date filtering
        if (startDate || endDate) {
            filter.expenseDate = {};
            if (startDate) filter.expenseDate.$gte = new Date(startDate);
            if (endDate) filter.expenseDate.$lte = new Date(endDate);
        }

        // Determine the time grouping based on period
        let timeGrouping;
        if (period === 'day') {
            timeGrouping = { $dateToString: { format: '%Y-%m-%d', date: '$expenseDate' } };
        } else if (period === 'week') {
            timeGrouping = { 
                year: { $year: '$expenseDate' },
                week: { $week: '$expenseDate' }
            };
        } else if (period === 'month') {
            timeGrouping = { 
                year: { $year: '$expenseDate' },
                month: { $month: '$expenseDate' }
            };
        } else if (period === 'quarter') {
            timeGrouping = {
                year: { $year: '$expenseDate' },
                quarter: { $ceil: { $divide: [{ $month: '$expenseDate' }, 3] } }
            };
        } else { // year
            timeGrouping = { $year: '$expenseDate' };
        }

        // Get expenses grouped by time period
        const expensesByPeriod = await Expense.aggregate([
            { $match: filter },
            { $group: { 
                _id: timeGrouping,
                totalAmount: { $sum: '$amount' },
                count: { $sum: 1 }
            }},
            { $sort: { '_id': 1 } }
        ]);

        // Format results based on period
        const formattedData = expensesByPeriod.map(item => {
            let label;
            
            if (period === 'day') {
                label = item._id;
            } else if (period === 'week') {
                label = `${item._id.year}-W${item._id.week}`;
            } else if (period === 'month') {
                label = `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`;
            } else if (period === 'quarter') {
                label = `${item._id.year}-Q${item._id.quarter}`;
            } else { // year
                label = item._id.toString();
            }
            
            return {
                period: label,
                amount: item.totalAmount,
                count: item.count
            };
        });

        res.status(200).json({ expensesByPeriod: formattedData });
    } catch (error) {
        console.error('Error generating expenses by period:', error);
        res.status(500).json({ error: 'Failed to generate expenses by period data' });
    }
};

// Get expenses by category
exports.getExpensesByCategory = async (req, res) => {
    try {
        const { residence, startDate, endDate } = req.query;
        
        // Build filter object
        const filter = {};
        
        if (residence) {
            if (!validateMongoId(residence)) {
                return res.status(400).json({ error: 'Invalid residence ID format' });
            }
            filter.residence = residence;
        }
        
        // Date filtering
        if (startDate || endDate) {
            filter.expenseDate = {};
            if (startDate) filter.expenseDate.$gte = new Date(startDate);
            if (endDate) filter.expenseDate.$lte = new Date(endDate);
        }

        // Get expenses by category
        const expensesByCategory = await Expense.aggregate([
            { $match: filter },
            { $group: { 
                _id: '$category',
                totalAmount: { $sum: '$amount' },
                count: { $sum: 1 }
            }},
            { $sort: { 'totalAmount': -1 } }
        ]);

        // Get total expenses
        const totalExpenses = expensesByCategory.reduce((sum, item) => sum + item.totalAmount, 0);

        // Format results
        const formattedData = expensesByCategory.map(item => ({
            category: item._id,
            amount: item.totalAmount,
            count: item.count,
            percentage: totalExpenses > 0 ? Math.round((item.totalAmount / totalExpenses) * 100) : 0
        }));

        res.status(200).json({ 
            expensesByCategory: formattedData,
            totalExpenses
        });
    } catch (error) {
        console.error('Error generating expenses by category:', error);
        res.status(500).json({ error: 'Failed to generate expenses by category data' });
    }
};

// Get income by residence
exports.getIncomeByResidence = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        // Build filter object
        const filter = { status: { $in: ['Confirmed', 'Verified'] } };
        
        // Date filtering
        if (startDate || endDate) {
            filter.date = {};
            if (startDate) filter.date.$gte = new Date(startDate);
            if (endDate) filter.date.$lte = new Date(endDate);
        }

        // Get income by residence
        const incomeByResidence = await Payment.aggregate([
            { $match: filter },
            { $group: { 
                _id: '$residence',
                totalAmount: { $sum: '$totalAmount' },
                count: { $sum: 1 }
            }},
            { $sort: { 'totalAmount': -1 } }
        ]);

        // Populate residence data
        const residenceIds = incomeByResidence.map(item => item._id);
        const residences = await Residence.find({ _id: { $in: residenceIds } }, 'name location');
        
        // Create lookup for residence data
        const residenceLookup = {};
        residences.forEach(residence => {
            residenceLookup[residence._id.toString()] = {
                name: residence.name,
                location: residence.location
            };
        });

        // Get total income
        const totalIncome = incomeByResidence.reduce((sum, item) => sum + item.totalAmount, 0);

        // Format results
        const formattedData = incomeByResidence.map(item => {
            const residenceId = item._id.toString();
            const residenceData = residenceLookup[residenceId] || { name: 'Unknown', location: 'Unknown' };
            
            return {
                residenceId: item._id,
                name: residenceData.name,
                location: residenceData.location,
                amount: item.totalAmount,
                count: item.count,
                percentage: totalIncome > 0 ? Math.round((item.totalAmount / totalIncome) * 100) : 0
            };
        });

        res.status(200).json({ 
            incomeByResidence: formattedData,
            totalIncome
        });
    } catch (error) {
        console.error('Error generating income by residence:', error);
        res.status(500).json({ error: 'Failed to generate income by residence data' });
    }
};