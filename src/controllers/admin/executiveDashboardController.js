const { Residence } = require('../../models/Residence');
const User = require('../../models/User');
const Debtor = require('../../models/Debtor');
const Maintenance = require('../../models/Maintenance');
const TransactionEntry = require('../../models/TransactionEntry');
const Application = require('../../models/Application');
const EnhancedCashFlowService = require('../../services/enhancedCashFlowService');
const AccountingService = require('../../services/accountingService');
const RoomOccupancyUtils = require('../../utils/roomOccupancyUtils');

// OPTIMIZED: Use centralized cache service instead of local Map
const cacheService = require('../../services/cacheService');

function getCacheKey(year, month) {
    return `executive-dashboard:${year}:${month}`;
}

/**
 * Get comprehensive executive dashboard data by month
 * GET /api/admin/dashboard/executive?year=2025&month=11
 */
exports.getExecutiveDashboard = async (req, res) => {
    try {
        const { year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query;
        const yearNum = parseInt(year);
        const monthNum = parseInt(month);

        // Check cache first (5 minute TTL)
        const cacheKey = getCacheKey(yearNum, monthNum);
        const cached = cacheService.get(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        // Get all residences
        const residences = await Residence.find().lean();

        // OPTIMIZATION: Run all independent operations in parallel
        // 1. Revenue and Expense Summary - Parallelize all 12 months
        const monthlyBreakdownPromises = Array.from({ length: 12 }, (_, i) => {
            const m = i + 1;
            return AccountingService.generateMonthlyIncomeStatement(m, yearNum)
                .then(monthData => ({
                    month: m,
                    monthName: new Date(yearNum, m - 1, 1).toLocaleString('en-US', { month: 'short' }),
                    revenue: monthData?.revenue?.total || 0,
                    expenses: monthData?.expenses?.total || 0,
                    netIncome: monthData?.netIncome || 0
                }))
                .catch(error => {
                    // Silently fail and return zeros
                    return {
                        month: m,
                        monthName: new Date(yearNum, m - 1, 1).toLocaleString('en-US', { month: 'short' }),
                        revenue: 0,
                        expenses: 0,
                        netIncome: 0
                    };
                });
        });

        // OPTIMIZED: Cache cash flow data separately (it's expensive and used by multiple functions)
        const cashFlowCacheKey = `cash-flow:${yearNum}:all`;
        let cashFlowData = cacheService.get(cashFlowCacheKey);
        if (!cashFlowData) {
            cashFlowData = await EnhancedCashFlowService.generateDetailedCashFlowStatement(String(yearNum), 'cash', null).catch(() => ({ monthly_breakdown: {} }));
            // Cache cash flow for 10 minutes (it's expensive to generate)
            cacheService.set(cashFlowCacheKey, cashFlowData, 600);
        }

        // Run all independent operations in parallel
        // OPTIMIZED: Removed cashBalanceSummary, occupancyByResidence, transactions, roomPrices
        // OPTIMIZED: Use cached cash flow data instead of regenerating
        // NOTE: propertyPerformance must be resolved first before getAlertsAndNotifications can use it
        const [
            monthlyBreakdownResults,
            propertyPerformance,
            recentMaintenances,
            operationalOverview,
            applications,
            debtorSummary
        ] = await Promise.all([
            Promise.all(monthlyBreakdownPromises),
            getPropertyPerformance(residences, yearNum, monthNum),
            getRecentMaintenances(10),
            getOperationalOverview(residences, yearNum, monthNum),
            getApplications(yearNum, monthNum),
            getDebtorSummary()
        ]);

        // Get alerts after propertyPerformance is resolved (it depends on propertyPerformance)
        const alerts = await getAlertsAndNotifications(residences, propertyPerformance);

        // Build monthly breakdown object
        const monthlyBreakdown = {};
        monthlyBreakdownResults.forEach(result => {
            monthlyBreakdown[result.month] = result;
        });
        
        // Get current month data
        const currentMonthData = monthlyBreakdown[monthNum] || {};
        const revenueExpenseSummary = {
            revenue: currentMonthData.revenue || 0,
            expenses: currentMonthData.expenses || 0,
            netIncome: currentMonthData.netIncome || 0,
            monthlyBreakdown
        };

        // 2. Net Profit Margin
        const netProfitMargin = calculateNetProfitMargin(revenueExpenseSummary);

        // 7. Cash Flow Monthly Data - Extract from cash flow service response
        const cashFlowMonthlyBreakdown = cashFlowData?.monthly_breakdown || {};
        const cashFlowMonthlyData = [];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthKeys = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
        
        for (let m = 0; m < 12; m++) {
            const monthKey = monthKeys[m];
            const monthData = cashFlowMonthlyBreakdown[monthKey];
            
            let revenue = 0;
            let expenses = 0;
            let profit = 0;
            
            if (monthData?.operating_activities) {
                revenue = monthData.operating_activities.inflows || 0;
                expenses = monthData.operating_activities.outflows || 0;
                profit = monthData.operating_activities.net || (revenue - expenses);
            } else if (monthData) {
                revenue = monthData.income?.total || 0;
                expenses = monthData.expenses?.total || 0;
                profit = revenue - expenses;
            }
            
            cashFlowMonthlyData.push({
                period: monthNames[m],
                revenue: revenue,
                expenses: expenses,
                profit: profit
            });
        }

        // 8. Expense Breakdown - Use the cash flow data we already fetched, pass residences for by-residence breakdown
        const expenseBreakdown = await getExpenseBreakdown(yearNum, monthNum, cashFlowData, residences);

        // 11. Financial Health Score
        const financialHealth = calculateFinancialHealth(
            revenueExpenseSummary,
            propertyPerformance,
            alerts
        );

        // 12-17. Monthly breakdown data (OPTIMIZED: Only fetch current month data)
        // Only revenueExpenseSummary and cashFlowMonthlyData fetch all 12 months (for graphs)
        // Everything else only fetches the current month to optimize performance
        const [
            revenueByResidenceCurrentMonth,
            cashReceivedByResidenceCurrentMonth,
            maintenancesByResidenceCurrentMonth,
            monthlyDataByResidenceCurrentMonth
        ] = await Promise.all([
            getRevenueByResidenceForMonth(residences, yearNum, monthNum),
            getCashReceivedByResidenceForMonth(residences, yearNum, monthNum),
            getMaintenancesByResidenceForMonth(residences, yearNum, monthNum),
            getMonthlyDataByResidenceForMonth(residences, yearNum, monthNum)
        ]);
        
        // Format as monthly structures (only current month populated)
        const revenueByResidenceByMonth = {};
        const cashReceivedByResidenceByMonth = {};
        const maintenancesByResidenceByMonth = {};
        const monthlyDataByResidence = {};
        
        residences.forEach(residence => {
            const resId = residence._id.toString();
            revenueByResidenceByMonth[resId] = {};
            cashReceivedByResidenceByMonth[resId] = {};
            maintenancesByResidenceByMonth[resId] = {};
            monthlyDataByResidence[resId] = {};
            
            // Only populate current month
            revenueByResidenceByMonth[resId][monthNum] = revenueByResidenceCurrentMonth[resId] || 0;
            cashReceivedByResidenceByMonth[resId][monthNum] = cashReceivedByResidenceCurrentMonth[resId] || 0;
            maintenancesByResidenceByMonth[resId][monthNum] = maintenancesByResidenceCurrentMonth[resId] || [];
            monthlyDataByResidence[resId][monthNum] = monthlyDataByResidenceCurrentMonth[resId] || {
                month: monthNum,
                monthName: new Date(yearNum, monthNum - 1, 1).toLocaleString('en-US', { month: 'short' }),
                revenue: { total: 0, breakdown: {} },
                expenses: { total: 0, breakdown: {} },
                netIncome: 0
            };
        });

        // Applications and debtor summary are now fetched in parallel above

        // 23. Financial Stats - Use revenue from revenueExpenseSummary
        const financialStats = {
            totalRevenue: revenueExpenseSummary.revenue,
            totalExpenses: revenueExpenseSummary.expenses,
            netIncome: revenueExpenseSummary.netIncome
        };

        // 24. Dashboard Stats
        const dashboardStats = {
            totalIncome: revenueExpenseSummary.revenue,
            totalExpenses: revenueExpenseSummary.expenses,
            netProfit: revenueExpenseSummary.netIncome
        };

        // 25. Portfolio Value (removed - was calculated from room prices)
        const portfolioValue = 0;

        const response = {
            success: true,
            period: {
                year: yearNum,
                month: monthNum,
                monthName: new Date(yearNum, monthNum - 1, 1).toLocaleString('en-US', { month: 'long' })
            },
            data: {
                // Existing data
                revenueExpenseSummary,
                netProfitMargin,
                // OPTIMIZED: Removed cashBalanceSummary, occupancyByResidence, transactions, roomPrices
                propertyPerformance,
                recentMaintenances,
                expenseBreakdown,
                operationalOverview,
                alerts,
                financialHealth,
                // New monthly breakdown data
                revenueByResidence: revenueByResidenceByMonth,
                // expensesByResidence removed - use expenseBreakdown.byResidence instead
                cashReceivedByResidence: cashReceivedByResidenceByMonth,
                // occupancyByResidenceByMonth removed for optimization
                maintenancesByResidenceByMonth,
                monthlyDataByResidence,
                cashFlowMonthlyData,
                // Additional data for frontend
                applications,
                // transactions removed for optimization
                debtorSummary,
                // roomPrices removed for optimization
                financialStats,
                dashboardStats,
                portfolioValue,
                // Alias for compatibility
                maintenance: recentMaintenances
            }
        };

        // Cache the result (5 minute TTL)
        cacheService.set(cacheKey, response, 300);

        res.json(response);

    } catch (error) {
        console.error('Error in getExecutiveDashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating executive dashboard',
            error: error.message
        });
    }
};

// Removed getRevenueExpenseSummary - now using AccountingService directly in main function

/**
 * Calculate Net Profit Margin
 */
function calculateNetProfitMargin(revenueExpenseSummary) {
    if (!revenueExpenseSummary || revenueExpenseSummary.revenue === 0) {
        return 0;
    }
    return ((revenueExpenseSummary.netIncome / revenueExpenseSummary.revenue) * 100).toFixed(2);
}

/**
 * Get Cash Balance Summary
 */
async function getCashBalanceSummary(year, month) {
    try {
        const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
        const cashBalance = await EnhancedCashFlowService.getCashBalanceByAccount(monthEnd);
        
        const total = Object.values(cashBalance).reduce((sum, account) => {
            return sum + (account.balance || 0);
        }, 0);

        return {
            total: total,
            breakdown: cashBalance,
            formatted: formatCurrency(total)
        };
    } catch (error) {
        console.error('Error getting cash balance summary:', error);
        return {
            total: 0,
            breakdown: {},
            formatted: '$0'
        };
    }
}

/**
 * Get Occupancy by Residence (OPTIMIZED: Use Application aggregation instead of per-room queries)
 */
async function getOccupancyByResidence(residences) {
    // OPTIMIZED: Use single aggregation query instead of per-room queries
    const residenceIds = residences.map(r => r._id);
    const now = new Date();
    
    // Single query to get all active applications
    const activeApplications = await Application.find({
        $or: residences.map(r => ({
            $or: [
                { residenceId: r._id },
                { 'allocatedRoomDetails.residenceId': r._id.toString() },
                { residence: r._id }
            ]
        })),
        status: { $in: ['approved', 'allocated', 'active', 'enrolled'] },
        $and: [
            {
                $or: [
                    { endDate: null },
                    { endDate: { $gte: now } }
                ]
            },
            {
                $or: [
                    { startDate: null },
                    { startDate: { $lte: now } }
                ]
            }
        ]
    }).select('residenceId allocatedRoomDetails residence allocatedRoom').lean();
    
    // Group by residence
    const occupancyByResidence = {};
    residences.forEach(residence => {
        const resId = residence._id.toString();
        occupancyByResidence[resId] = {
            occupiedRooms: new Set(),
            totalOccupants: 0
        };
    });
    
    activeApplications.forEach(app => {
        const resId = app.residenceId?.toString() || 
                     app.allocatedRoomDetails?.residenceId?.toString() ||
                     app.residence?.toString();
        if (resId && occupancyByResidence[resId]) {
            occupancyByResidence[resId].totalOccupants++;
            if (app.allocatedRoom || app.allocatedRoomDetails?.roomNumber) {
                occupancyByResidence[resId].occupiedRooms.add(
                    app.allocatedRoom || app.allocatedRoomDetails?.roomNumber
                );
            }
        }
    });
    
    // Format results
    return residences.map(residence => {
        const resId = residence._id.toString();
        const data = occupancyByResidence[resId] || { occupiedRooms: new Set(), totalOccupants: 0 };
        const totalRooms = residence.rooms.length;
        const occupiedRooms = data.occupiedRooms.size;
        const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;
        
        return {
            residenceId: residence._id,
            name: residence.name,
            occupants: data.totalOccupants,
            rooms: totalRooms,
            occupiedRooms: occupiedRooms,
            occupancy: Math.round(occupancyRate)
        };
    });
}

/**
 * Get Property Performance (OPTIMIZED: Batch room occupancy queries)
 */
async function getPropertyPerformance(residences, year, month) {
    // OPTIMIZED: Batch fetch all room occupancies in a single query instead of per-room queries
    const residenceIds = residences.map(r => r._id);
    const now = new Date();
    
    // Single aggregation query to get all room occupancies
    const activeApplications = await Application.find({
        $or: residences.map(r => ({
            $or: [
                { residenceId: r._id },
                { 'allocatedRoomDetails.residenceId': r._id.toString() },
                { residence: r._id }
            ]
        })),
        status: { $in: ['approved', 'allocated', 'active', 'enrolled'] },
        $and: [
            {
                $or: [
                    { endDate: null },
                    { endDate: { $gte: now } }
                ]
            },
            {
                $or: [
                    { startDate: null },
                    { startDate: { $lte: now } }
                ]
            }
        ]
    }).select('residenceId allocatedRoomDetails residence allocatedRoom').lean();
    
    // Group occupancy by residence and room
    const occupancyByResidence = {};
    residences.forEach(residence => {
        const resId = residence._id.toString();
        occupancyByResidence[resId] = {
            occupiedRooms: new Set(),
            totalOccupants: 0,
            totalRooms: residence.rooms.length
        };
    });
    
    activeApplications.forEach(app => {
        const resId = app.residenceId?.toString() || 
                     app.allocatedRoomDetails?.residenceId?.toString() ||
                     app.residence?.toString();
        if (resId && occupancyByResidence[resId]) {
            occupancyByResidence[resId].totalOccupants++;
            if (app.allocatedRoom || app.allocatedRoomDetails?.roomNumber) {
                occupancyByResidence[resId].occupiedRooms.add(
                    app.allocatedRoom || app.allocatedRoomDetails?.roomNumber
                );
            }
        }
    });
    
    // Parallelize residence calculations (but use batched occupancy data)
    const performancePromises = residences.map(async (residence) => {
        const resId = residence._id.toString();
        const occupancyData = occupancyByResidence[resId] || { occupiedRooms: new Set(), totalOccupants: 0, totalRooms: 0 };
        
        // Get revenue for this residence (cached)
        const monthData = await AccountingService.generateMonthlyIncomeStatement(month, year, resId).catch(() => ({ revenue: { total: 0 }, expenses: { total: 0 } }));
        
        const revenue = monthData?.revenue?.total || 0;
        const expenses = monthData?.expenses?.total || 0;
        const net = revenue - expenses;

        // Calculate occupancy from batched data
        const totalRooms = occupancyData.totalRooms || residence.rooms.length;
        const occupiedRooms = occupancyData.occupiedRooms.size;
        const totalOccupants = occupancyData.totalOccupants;
        const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

        return {
            residenceId: residence._id,
            name: residence.name,
            revenue: revenue,
            expenses: expenses,
            net: net,
            occupancy: Math.round(occupancyRate),
            rooms: totalRooms,
            occupants: totalOccupants
        };
    });

    return Promise.all(performancePromises);
}

/**
 * Get Recent Maintenances
 */
async function getRecentMaintenances(limit = 10) {
    try {
        const maintenances = await Maintenance.find()
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('residence', 'name')
            .populate('student', 'firstName lastName')
            .populate('assignedTo', 'firstName lastName')
            .lean();

        return maintenances.map(m => ({
            _id: m._id,
            issue: m.issue,
            description: m.description,
            category: m.category,
            priority: m.priority,
            status: m.status,
            room: m.room,
            residence: m.residence ? {
                _id: m.residence._id,
                name: m.residence.name
            } : null,
            student: m.student ? {
                _id: m.student._id,
                name: `${m.student.firstName} ${m.student.lastName}`
            } : null,
            assignedTo: m.assignedTo ? {
                _id: m.assignedTo._id,
                name: `${m.assignedTo.firstName} ${m.assignedTo.lastName}`
            } : null,
            createdAt: m.createdAt,
            updatedAt: m.updatedAt
        }));
    } catch (error) {
        console.error('Error getting recent maintenances:', error);
        return [];
    }
}

// Removed getCashFlowMonthlyData - now extracting directly in main function like revenue/expense

/**
 * Get Expense Breakdown (Cash Basis) - OPTIMIZED: Reuse cash flow data, query expenses by residence directly
 */
async function getExpenseBreakdown(year, month, cashFlowData = null, residences = null) {
    try {
        // Use provided cash flow data or fetch it
        let monthlyBreakdown = {};
        if (cashFlowData) {
            monthlyBreakdown = cashFlowData.data?.monthly_breakdown || cashFlowData.monthly_breakdown || {};
        } else {
            const cfData = await EnhancedCashFlowService.generateDetailedCashFlowStatement(String(year), 'cash', null);
            monthlyBreakdown = cfData?.data?.monthly_breakdown || cfData?.monthly_breakdown || {};
        }

        const monthKeys = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
        const currentMonthKey = monthKeys[month - 1];
        const monthData = monthlyBreakdown[currentMonthKey];

        if (!monthData) {
            return {
                total: 0,
                byResidence: [],
                byCategory: {}
            };
        }

        // Get expenses from operating activities outflows or expenses.total
        const totalExpenses = monthData.operating_activities?.outflows || 
                             monthData.expenses?.total || 0;

        // Get expense breakdown by category
        const expenseBreakdown = monthData.expenses || {};
        const byCategory = {};
        
        // Extract expense categories from breakdown
        Object.keys(expenseBreakdown).forEach(key => {
            if (key !== 'total' && key !== 'transactions' && typeof expenseBreakdown[key] === 'number') {
                byCategory[key] = expenseBreakdown[key];
            }
        });

        // OPTIMIZED: Use aggregation pipeline for expenses by residence
        const byResidence = [];
        if (residences && residences.length > 0) {
            const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
            const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
            const residenceIds = residences.map(r => r._id);
            
            const expenseResults = await TransactionEntry.aggregate([
                {
                    $match: {
                        date: { $gte: monthStart, $lte: monthEnd },
                        source: { $in: ['expense_payment', 'expense', 'manual'] },
                        status: { $nin: ['reversed', 'draft'] },
                        $or: [
                            { residence: { $in: residenceIds } },
                            { 'metadata.residenceId': { $in: residences.map(r => r._id.toString()) } },
                            { 'metadata.residence': { $in: residences.map(r => r._id.toString()) } }
                        ]
                    }
                },
                { $unwind: '$entries' },
                {
                    $match: {
                        'entries.accountType': 'Expense',
                        'entries.debit': { $gt: 0 }
                    }
                },
                {
                    $group: {
                        _id: {
                            $ifNull: [
                                { $toString: '$residence' },
                                { $ifNull: ['$metadata.residenceId', '$metadata.residence'] }
                            ]
                        },
                        totalExpenses: { $sum: '$entries.debit' }
                    }
                }
            ]);
            
            // Map results to residence names
            const residenceMap = {};
            residences.forEach(res => {
                residenceMap[res._id.toString()] = {
                    residenceId: res._id,
                    name: res.name,
                    amount: 0
                };
            });
            
            expenseResults.forEach(result => {
                const resId = result._id?.toString();
                if (resId && residenceMap[resId]) {
                    residenceMap[resId].amount = result.totalExpenses || 0;
                }
            });
            
            byResidence.push(...Object.values(residenceMap).filter(r => r.amount > 0));
        }

        return {
            total: totalExpenses,
            byResidence: byResidence,
            byCategory: byCategory
        };
    } catch (error) {
        console.error('Error getting expense breakdown:', error);
        return {
            total: 0,
            byResidence: [],
            byCategory: {}
        };
    }
}

/**
 * Get Operational Overview (Revenue vs Cash Received) - OPTIMIZED: Parallelized
 */
async function getOperationalOverview(residences, year, month) {
    const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    // Parallelize all residence calculations
    const overviewPromises = residences.map(async (residence) => {
        // Get revenue and cash received in parallel
        const [monthData, cashReceived] = await Promise.all([
            AccountingService.generateMonthlyIncomeStatement(month, year, residence._id.toString()).catch(() => ({ revenue: { total: 0 } })),
            getCashReceivedForResidence(residence._id.toString(), monthStart, monthEnd).catch(() => 0)
        ]);

        const revenue = monthData?.revenue?.total || 0;
        const owing = Math.max(0, revenue - cashReceived);
        const collectionRate = revenue > 0 ? (cashReceived / revenue) * 100 : 0;

        return {
            residenceId: residence._id,
            name: residence.name,
            revenue: revenue,
            cashReceived: cashReceived,
            owing: owing,
            collectionRate: Math.round(collectionRate)
        };
    });

    const overview = await Promise.all(overviewPromises);
    return overview.filter(o => o.revenue > 0 || o.cashReceived > 0);
}

/**
 * Get cash received for a residence in a date range (OPTIMIZED: Single query)
 */
async function getCashReceivedForResidence(residenceId, startDate, endDate) {
    try {
        const mongoose = require('mongoose');
        const residenceObjectId = mongoose.Types.ObjectId.isValid(residenceId) 
            ? new mongoose.Types.ObjectId(residenceId) 
            : residenceId;
        
        // OPTIMIZED: Use aggregation pipeline instead of fetching all transactions
        const result = await TransactionEntry.aggregate([
            {
                $match: {
                    date: { $gte: startDate, $lte: endDate },
                    source: { $in: ['payment', 'accounts_receivable_collection', 'advance_payment'] },
                    $or: [
                        { residence: residenceObjectId },
                        { residence: residenceId },
                        { 'metadata.residenceId': residenceId },
                        { 'metadata.residenceId': residenceId.toString() },
                        { 'metadata.residence': residenceId },
                        { 'metadata.residence': residenceId.toString() }
                    ]
                }
            },
            { $unwind: '$entries' },
            {
                $match: {
                    $or: [
                        // Cash accounts (1000-1999) - debit means cash coming in
                        { 
                            'entries.accountCode': { $regex: /^10[0-9]{2}$/ },
                            'entries.debit': { $gt: 0 }
                        },
                        // Income accounts (4000-4999) - credit means income received
                        { 
                            'entries.accountCode': { $regex: /^40[0-9]{2}$/ },
                            'entries.accountType': 'Income',
                            'entries.credit': { $gt: 0 }
                        }
                    ]
                }
            },
            {
                $group: {
                    _id: null,
                    totalCash: {
                        $sum: {
                            $cond: [
                                { $regexMatch: { input: '$entries.accountCode', regex: /^10[0-9]{2}$/ } },
                                '$entries.debit',
                                '$entries.credit'
                            ]
                        }
                    }
                }
            }
        ]);
        
        return result.length > 0 ? (result[0].totalCash || 0) : 0;
    } catch (error) {
        console.error('Error getting cash received:', error);
        return 0;
    }
}

/**
 * Get Alerts and Notifications
 * OPTIMIZED: Accept propertyPerformance to avoid duplicate room occupancy queries
 */
async function getAlertsAndNotifications(residences, propertyPerformance = null) {
    const alerts = [];

    try {
        // 1. Rent arrears above threshold
        const allDebtors = await Debtor.find({ status: { $ne: 'paid' } }).lean();
        let totalArrears = 0;

        for (const debtor of allDebtors) {
            const balance = debtor.currentBalance || 0;
            if (balance > 0) {
                totalArrears += balance;
            }
        }

        const arrearsThreshold = 5000; // $5K threshold
        if (totalArrears > arrearsThreshold) {
            alerts.push({
                type: 'rent_arrears',
                severity: 'high',
                message: `Rent arrears above threshold: ${formatCurrency(totalArrears)}`,
                value: totalArrears,
                threshold: arrearsThreshold
            });
        }

        // 2. Low occupancy alerts
        // OPTIMIZED: Use propertyPerformance if provided to avoid duplicate room queries
        if (propertyPerformance && propertyPerformance.length > 0) {
            // Use occupancy data already calculated in getPropertyPerformance
            propertyPerformance.forEach(property => {
                const occupancyRate = property.occupancy || 0;
                const lowOccupancyThreshold = 50; // 50% threshold

                if (occupancyRate < lowOccupancyThreshold) {
                    alerts.push({
                        type: 'low_occupancy',
                        severity: 'medium',
                        message: `Low occupancy alert at ${property.name}`,
                        residenceId: property.residenceId,
                        residenceName: property.name,
                        occupancyRate: occupancyRate,
                        threshold: lowOccupancyThreshold
                    });
                }
            });
        } else {
            // Fallback: Calculate occupancy if propertyPerformance not provided
            // OPTIMIZED: Use single aggregation query instead of per-room queries
            const residenceIds = residences.map(r => r._id);
            const now = new Date();
            
            const activeApplications = await Application.find({
                $or: residences.map(r => ({
                    $or: [
                        { residenceId: r._id },
                        { 'allocatedRoomDetails.residenceId': r._id.toString() },
                        { residence: r._id }
                    ]
                })),
                status: { $in: ['approved', 'allocated', 'active', 'enrolled'] },
                $and: [
                    {
                        $or: [
                            { endDate: null },
                            { endDate: { $gte: now } }
                        ]
                    },
                    {
                        $or: [
                            { startDate: null },
                            { startDate: { $lte: now } }
                        ]
                    }
                ]
            }).select('residenceId allocatedRoomDetails residence allocatedRoom').lean();
            
            // Group by residence and calculate occupancy
            const occupancyByResidence = {};
            residences.forEach(residence => {
                const resId = residence._id.toString();
                occupancyByResidence[resId] = {
                    occupiedRooms: new Set(),
                    totalRooms: residence.rooms.length
                };
            });
            
            activeApplications.forEach(app => {
                const resId = app.residenceId?.toString() || 
                             app.allocatedRoomDetails?.residenceId?.toString() ||
                             app.residence?.toString();
                if (resId && occupancyByResidence[resId] && app.allocatedRoom) {
                    occupancyByResidence[resId].occupiedRooms.add(app.allocatedRoom);
                }
            });
            
            // Generate alerts
            residences.forEach(residence => {
                const resId = residence._id.toString();
                const data = occupancyByResidence[resId] || { occupiedRooms: new Set(), totalRooms: 0 };
                const occupiedRooms = data.occupiedRooms.size;
                const occupancyRate = data.totalRooms > 0 ? (occupiedRooms / data.totalRooms) * 100 : 0;
                const lowOccupancyThreshold = 50;

                if (occupancyRate < lowOccupancyThreshold) {
                    alerts.push({
                        type: 'low_occupancy',
                        severity: 'medium',
                        message: `Low occupancy alert at ${residence.name}`,
                        residenceId: residence._id,
                        residenceName: residence.name,
                        occupancyRate: Math.round(occupancyRate),
                        threshold: lowOccupancyThreshold
                    });
                }
            });
        }

    } catch (error) {
        console.error('Error getting alerts:', error);
    }

    return alerts;
}

/**
 * Calculate Financial Health Score
 */
function calculateFinancialHealth(revenueExpenseSummary, propertyPerformance, alerts) {
    let score = 100;

    // Deduct points for negative net income
    if (revenueExpenseSummary.netIncome < 0) {
        score -= 20;
    }

    // Deduct points for low occupancy (from propertyPerformance)
    const avgOccupancy = propertyPerformance.length > 0
        ? propertyPerformance.reduce((sum, p) => sum + (p.occupancy || 0), 0) / propertyPerformance.length
        : 0;
    
    if (avgOccupancy < 50) {
        score -= 15;
    } else if (avgOccupancy < 70) {
        score -= 10;
    }

    // Deduct points for alerts
    const highSeverityAlerts = alerts.filter(a => a.severity === 'high').length;
    const mediumSeverityAlerts = alerts.filter(a => a.severity === 'medium').length;
    
    score -= (highSeverityAlerts * 10);
    score -= (mediumSeverityAlerts * 5);

    score = Math.max(0, Math.min(100, score));

    let status = 'Excellent';
    if (score < 50) status = 'Poor';
    else if (score < 70) status = 'Fair';
    else if (score < 85) status = 'Good';
    else if (score < 95) status = 'Very Good';

    return {
        score: Math.round(score),
        status,
        factors: {
            netIncome: revenueExpenseSummary.netIncome >= 0,
            occupancy: avgOccupancy >= 70,
            alerts: alerts.length
        }
    };
}

/**
 * Get Revenue by Residence by Month (for all 12 months)
 * Optimized: Batch queries per residence
 */
async function getRevenueByResidenceByMonth(year) {
    const residences = await Residence.find().lean();
    const revenueByResidence = {};

    // Process all residences in parallel
    await Promise.all(residences.map(async (residence) => {
        const resId = residence._id.toString();
        revenueByResidence[resId] = {};

        // Process all 12 months in parallel for this residence
        const monthPromises = [];
        for (let month = 1; month <= 12; month++) {
            monthPromises.push(
                AccountingService.generateMonthlyIncomeStatement(month, year, resId)
                    .then(monthData => ({ month, revenue: monthData?.revenue?.total || 0 }))
                    .catch(error => {
                        console.error(`Error getting revenue for residence ${resId}, month ${month}:`, error);
                        return { month, revenue: 0 };
                    })
            );
        }

        const results = await Promise.all(monthPromises);
        results.forEach(({ month, revenue }) => {
            revenueByResidence[resId][month] = revenue;
        });
    }));

    return revenueByResidence;
}

/**
 * Get Expenses by Residence by Month (for all 12 months)
 * Optimized: Batch queries per residence
 */
async function getExpensesByResidenceByMonth(year) {
    const residences = await Residence.find().lean();
    const expensesByResidence = {};

    // Process all residences in parallel
    await Promise.all(residences.map(async (residence) => {
        const resId = residence._id.toString();
        expensesByResidence[resId] = {};

        // Process all 12 months in parallel for this residence
        const monthPromises = [];
        for (let month = 1; month <= 12; month++) {
            monthPromises.push(
                AccountingService.generateMonthlyIncomeStatement(month, year, resId)
                    .then(monthData => ({ month, expenses: monthData?.expenses?.total || 0 }))
                    .catch(error => {
                        console.error(`Error getting expenses for residence ${resId}, month ${month}:`, error);
                        return { month, expenses: 0 };
                    })
            );
        }

        const results = await Promise.all(monthPromises);
        results.forEach(({ month, expenses }) => {
            expensesByResidence[resId][month] = expenses;
        });
    }));

    return expensesByResidence;
}

/**
 * Get Cash Received by Residence by Month (for all 12 months)
 */
async function getCashReceivedByResidenceByMonth(year) {
    const residences = await Residence.find().lean();
    const cashReceivedByResidence = {};

    for (const residence of residences) {
        const resId = residence._id.toString();
        cashReceivedByResidence[resId] = {};

        for (let month = 1; month <= 12; month++) {
            try {
                const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
                const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
                const cashReceived = await getCashReceivedForResidence(resId, monthStart, monthEnd);
                cashReceivedByResidence[resId][month] = cashReceived;
            } catch (error) {
                console.error(`Error getting cash received for residence ${resId}, month ${month}:`, error);
                cashReceivedByResidence[resId][month] = 0;
            }
        }
    }

    return cashReceivedByResidence;
}

/**
 * Get Occupancy by Residence by Month (for all 12 months)
 */
async function getOccupancyByResidenceByMonth(residences, year) {
    const occupancyByResidence = {};

    for (const residence of residences) {
        const resId = residence._id.toString();
        occupancyByResidence[resId] = {};

        for (let month = 1; month <= 12; month++) {
            try {
                // Get applications active during this month
                const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
                const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

                const activeApplications = await Application.find({
                    $or: [
                        { residenceId: resId },
                        { 'allocatedRoomDetails.residenceId': resId },
                        { residence: resId }
                    ],
                    status: { $in: ['approved', 'allocated', 'active', 'enrolled'] },
                    $and: [
                        {
                            $or: [
                                { startDate: { $lte: monthEnd } },
                                { leaseStartDate: { $lte: monthEnd } }
                            ]
                        },
                        {
                            $or: [
                                { endDate: { $gte: monthStart } },
                                { leaseEndDate: { $gte: monthStart } },
                                { endDate: null },
                                { leaseEndDate: null }
                            ]
                        }
                    ]
                }).lean();

                let totalOccupants = 0;
                let occupiedRooms = new Set();

                for (const app of activeApplications) {
                    const roomNumber = app.allocatedRoom || app.preferredRoom || app.room?.roomNumber;
                    if (roomNumber) {
                        occupiedRooms.add(roomNumber);
                    }
                    totalOccupants += 1;
                }

                const totalRooms = residence.rooms?.length || 0;
                const occupancyRate = totalRooms > 0 ? (occupiedRooms.size / totalRooms) * 100 : 0;

                occupancyByResidence[resId][month] = {
                    occupants: totalOccupants,
                    occupiedRooms: occupiedRooms.size,
                    totalRooms: totalRooms,
                    occupancy: Math.round(occupancyRate)
                };
            } catch (error) {
                console.error(`Error getting occupancy for residence ${resId}, month ${month}:`, error);
                occupancyByResidence[resId][month] = {
                    occupants: 0,
                    occupiedRooms: 0,
                    totalRooms: residence.rooms?.length || 0,
                    occupancy: 0
                };
            }
        }
    }

    return occupancyByResidence;
}

/**
 * Get Maintenances by Residence by Month (for all 12 months)
 */
async function getMaintenancesByResidenceByMonth(year) {
    const residences = await Residence.find().lean();
    const maintenancesByResidence = {};

    for (const residence of residences) {
        const resId = residence._id.toString();
        maintenancesByResidence[resId] = {};

        for (let month = 1; month <= 12; month++) {
            try {
                const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
                const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

                const maintenances = await Maintenance.find({
                    residence: resId,
                    createdAt: { $gte: monthStart, $lte: monthEnd }
                })
                .populate('residence', 'name')
                .populate('student', 'firstName lastName')
                .populate('assignedTo', 'firstName lastName')
                .lean();

                maintenancesByResidence[resId][month] = maintenances.map(m => ({
                    _id: m._id,
                    issue: m.issue,
                    description: m.description,
                    category: m.category,
                    priority: m.priority,
                    status: m.status,
                    room: m.room,
                    residence: m.residence ? {
                        _id: m.residence._id,
                        name: m.residence.name
                    } : null,
                    student: m.student ? {
                        _id: m.student._id,
                        name: `${m.student.firstName} ${m.student.lastName}`
                    } : null,
                    assignedTo: m.assignedTo ? {
                        _id: m.assignedTo._id,
                        name: `${m.assignedTo.firstName} ${m.assignedTo.lastName}`
                    } : null,
                    createdAt: m.createdAt,
                    updatedAt: m.updatedAt
                }));
            } catch (error) {
                console.error(`Error getting maintenances for residence ${resId}, month ${month}:`, error);
                maintenancesByResidence[resId][month] = [];
            }
        }
    }

    return maintenancesByResidence;
}

/**
 * Get Monthly Breakdown Data by Residence (for all 12 months)
 */
async function getMonthlyDataByResidence(residences, year) {
    const monthlyDataByResidence = {};

    for (const residence of residences) {
        const resId = residence._id.toString();
        monthlyDataByResidence[resId] = {};

        for (let month = 1; month <= 12; month++) {
            try {
                const monthData = await AccountingService.generateMonthlyIncomeStatement(month, year, resId);
                
                monthlyDataByResidence[resId][month] = {
                    month: month,
                    monthName: new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short' }),
                    revenue: {
                        total: monthData?.revenue?.total || 0,
                        breakdown: monthData?.revenue?.breakdown || {}
                    },
                    expenses: {
                        total: monthData?.expenses?.total || 0,
                        breakdown: monthData?.expenses?.breakdown || {}
                    },
                    netIncome: monthData?.netIncome || 0
                };
            } catch (error) {
                console.error(`Error getting monthly data for residence ${resId}, month ${month}:`, error);
                monthlyDataByResidence[resId][month] = {
                    month: month,
                    monthName: new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short' }),
                    revenue: { total: 0, breakdown: {} },
                    expenses: { total: 0, breakdown: {} },
                    netIncome: 0
                };
            }
        }
    }

    return monthlyDataByResidence;
}

/**
 * Get Revenue by Residence for a single month (OPTIMIZED)
 */
async function getRevenueByResidenceForMonth(residences, year, month) {
    const revenueByResidence = {};
    
    // Process all residences in parallel
    await Promise.all(residences.map(async (residence) => {
        const resId = residence._id.toString();
        try {
            const monthData = await AccountingService.generateMonthlyIncomeStatement(month, year, resId);
            revenueByResidence[resId] = monthData?.revenue?.total || 0;
        } catch (error) {
            console.error(`Error getting revenue for residence ${resId}, month ${month}:`, error);
            revenueByResidence[resId] = 0;
        }
    }));
    
    return revenueByResidence;
}

/**
 * Get Cash Received by Residence for a single month (OPTIMIZED)
 */
async function getCashReceivedByResidenceForMonth(residences, year, month) {
    const cashReceivedByResidence = {};
    const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    
    // Process all residences in parallel
    await Promise.all(residences.map(async (residence) => {
        const resId = residence._id.toString();
        try {
            const cashReceived = await getCashReceivedForResidence(resId, monthStart, monthEnd);
            cashReceivedByResidence[resId] = cashReceived;
        } catch (error) {
            console.error(`Error getting cash received for residence ${resId}, month ${month}:`, error);
            cashReceivedByResidence[resId] = 0;
        }
    }));
    
    return cashReceivedByResidence;
}

/**
 * Get Maintenances by Residence for a single month (OPTIMIZED)
 */
async function getMaintenancesByResidenceForMonth(residences, year, month) {
    const maintenancesByResidence = {};
    const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    
    // Process all residences in parallel
    await Promise.all(residences.map(async (residence) => {
        const resId = residence._id.toString();
        try {
            const maintenances = await Maintenance.find({
                residence: resId,
                createdAt: { $gte: monthStart, $lte: monthEnd }
            })
            .populate('residence', 'name')
            .populate('student', 'firstName lastName')
            .populate('assignedTo', 'firstName lastName')
            .lean();
            
            maintenancesByResidence[resId] = maintenances.map(m => ({
                _id: m._id,
                issue: m.issue,
                description: m.description,
                category: m.category,
                priority: m.priority,
                status: m.status,
                room: m.room,
                residence: m.residence ? {
                    _id: m.residence._id,
                    name: m.residence.name
                } : null,
                student: m.student ? {
                    _id: m.student._id,
                    name: `${m.student.firstName} ${m.student.lastName}`
                } : null,
                assignedTo: m.assignedTo ? {
                    _id: m.assignedTo._id,
                    name: `${m.assignedTo.firstName} ${m.assignedTo.lastName}`
                } : null,
                createdAt: m.createdAt,
                updatedAt: m.updatedAt
            }));
        } catch (error) {
            console.error(`Error getting maintenances for residence ${resId}, month ${month}:`, error);
            maintenancesByResidence[resId] = [];
        }
    }));
    
    return maintenancesByResidence;
}

/**
 * Get Monthly Data by Residence for a single month (OPTIMIZED)
 */
async function getMonthlyDataByResidenceForMonth(residences, year, month) {
    const monthlyDataByResidence = {};
    
    // Process all residences in parallel
    await Promise.all(residences.map(async (residence) => {
        const resId = residence._id.toString();
        try {
            const monthData = await AccountingService.generateMonthlyIncomeStatement(month, year, resId);
            
            monthlyDataByResidence[resId] = {
                month: month,
                monthName: new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short' }),
                revenue: {
                    total: monthData?.revenue?.total || 0,
                    breakdown: monthData?.revenue?.breakdown || {}
                },
                expenses: {
                    total: monthData?.expenses?.total || 0,
                    breakdown: monthData?.expenses?.breakdown || {}
                },
                netIncome: monthData?.netIncome || 0
            };
        } catch (error) {
            console.error(`Error getting monthly data for residence ${resId}, month ${month}:`, error);
            monthlyDataByResidence[resId] = {
                month: month,
                monthName: new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short' }),
                revenue: { total: 0, breakdown: {} },
                expenses: { total: 0, breakdown: {} },
                netIncome: 0
            };
        }
    }));
    
    return monthlyDataByResidence;
}

// Removed formatCashFlowMonthlyData - now using getCashFlowMonthlyData which calls cash flow service directly

/**
 * Get Applications for selected month/year
 */
async function getApplications(year, month) {
    try {
        const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
        const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

        const applications = await Application.find({
            $or: [
                { applicationDate: { $gte: monthStart, $lte: monthEnd } },
                { createdAt: { $gte: monthStart, $lte: monthEnd } }
            ]
        })
        .populate('residence', 'name')
        .populate('student', 'firstName lastName email')
        .lean();

        return applications.map(app => ({
            _id: app._id,
            status: app.status,
            requestType: app.requestType,
            applicationDate: app.applicationDate || app.createdAt,
            residence: app.residence ? {
                _id: app.residence._id,
                name: app.residence.name
            } : null,
            student: app.student ? {
                _id: app.student._id,
                firstName: app.student.firstName,
                lastName: app.student.lastName,
                email: app.student.email
            } : null,
            startDate: app.startDate || app.leaseStartDate,
            endDate: app.endDate || app.leaseEndDate,
            allocatedRoom: app.allocatedRoom,
            allocatedRoomDetails: app.allocatedRoomDetails
        }));
    } catch (error) {
        console.error('Error getting applications:', error);
        return [];
    }
}

/**
 * Get Transactions for selected month/year
 */
async function getTransactions(year, month) {
    try {
        const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
        const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

        const transactions = await TransactionEntry.find({
            date: { $gte: monthStart, $lte: monthEnd }
        })
        .populate('residence', 'name')
        .lean();

        return transactions.map(tx => ({
            _id: tx._id,
            date: tx.date,
            description: tx.description,
            reference: tx.reference,
            entries: tx.entries || [],
            residence: tx.residence ? {
                _id: tx.residence._id,
                name: tx.residence.name
            } : null,
            source: tx.source,
            sourceModel: tx.sourceModel,
            sourceId: tx.sourceId
        }));
    } catch (error) {
        console.error('Error getting transactions:', error);
        return [];
    }
}

/**
 * Get Debtor Summary
 */
async function getDebtorSummary() {
    try {
        const allDebtors = await Debtor.find({ status: { $ne: 'paid' } }).lean();
        
        let totalOutstanding = 0;
        let outstandingCount = 0;

        for (const debtor of allDebtors) {
            const balance = debtor.currentBalance || 0;
            if (balance > 0) {
                totalOutstanding += balance;
                outstandingCount++;
            }
        }

        return {
            outstandingCount,
            totalOutstanding,
            totalBalance: totalOutstanding
        };
    } catch (error) {
        console.error('Error getting debtor summary:', error);
        return {
            outstandingCount: 0,
            totalOutstanding: 0,
            totalBalance: 0
        };
    }
}

/**
 * Get Room Prices
 */
async function getRoomPrices() {
    try {
        const residences = await Residence.find().lean();
        const roomPrices = [];

        for (const residence of residences) {
            if (residence.rooms && Array.isArray(residence.rooms)) {
                for (const room of residence.rooms) {
                    roomPrices.push({
                        _id: room._id || `${residence._id}_${room.roomNumber}`,
                        residenceId: residence._id,
                        residenceName: residence.name,
                        roomNumber: room.roomNumber,
                        roomId: room._id,
                        price: room.price || 0,
                        type: room.type,
                        capacity: room.capacity
                    });
                }
            }
        }

        return roomPrices;
    } catch (error) {
        console.error('Error getting room prices:', error);
        return [];
    }
}

/**
 * Calculate Portfolio Value
 */
function calculatePortfolioValue(roomPrices) {
    let monthlyPotential = 0;

    for (const room of roomPrices) {
        monthlyPotential += parseFloat(room.price) || 0;
    }

    // Return annual potential
    return monthlyPotential * 12;
}

/**
 * Format currency
 */
function formatCurrency(amount) {
    if (amount >= 1000) {
        return `$${(amount / 1000).toFixed(1)}K`;
    }
    return `$${amount.toFixed(2)}`;
}

