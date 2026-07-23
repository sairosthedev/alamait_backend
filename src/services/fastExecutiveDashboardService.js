/**
 * Fast executive dashboard aggregations.
 * Replaces full cashflow rebuild + N× monthly income statements.
 */
const mongoose = require('mongoose');
const TransactionEntry = require('../models/TransactionEntry');
const Debtor = require('../models/Debtor');
const Maintenance = require('../models/Maintenance');
const Application = require('../models/Application');

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthBounds(year, month) {
    return {
        start: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)),
        end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
    };
}

function yearBounds(year) {
    return {
        start: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)),
        end: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))
    };
}

function residenceIdExpr() {
    return {
        $toString: {
            $ifNull: [
                '$residence',
                { $ifNull: ['$metadata.residenceId', '$metadata.residence'] }
            ]
        }
    };
}

class FastExecutiveDashboardService {
    /**
     * Accrual / income P&L by calendar month for a year (12 rows).
     */
    static async getYearMonthlyPnL(year) {
        const { start, end } = yearBounds(year);
        const rows = await TransactionEntry.aggregate([
            {
                $match: {
                    date: { $gte: start, $lte: end },
                    status: { $nin: ['reversed', 'draft'] }
                }
            },
            { $unwind: '$entries' },
            {
                $group: {
                    _id: { $month: '$date' },
                    revenue: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ['$entries.accountType', 'Income'] },
                                        { $gt: ['$entries.credit', 0] }
                                    ]
                                },
                                '$entries.credit',
                                0
                            ]
                        }
                    },
                    expenses: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ['$entries.accountType', 'Expense'] },
                                        { $gt: ['$entries.debit', 0] }
                                    ]
                                },
                                '$entries.debit',
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const byMonth = {};
        for (let m = 1; m <= 12; m++) {
            byMonth[m] = {
                month: m,
                monthName: MONTH_NAMES_SHORT[m - 1],
                revenue: 0,
                expenses: 0,
                netIncome: 0
            };
        }
        rows.forEach((r) => {
            const m = r._id;
            if (!byMonth[m]) return;
            byMonth[m].revenue = r.revenue || 0;
            byMonth[m].expenses = r.expenses || 0;
            byMonth[m].netIncome = byMonth[m].revenue - byMonth[m].expenses;
        });
        return byMonth;
    }

    /**
     * Cash inflows / outflows by month (cash account lines) for charts.
     */
    static async getYearMonthlyCashFlow(year) {
        const { start, end } = yearBounds(year);
        const rows = await TransactionEntry.aggregate([
            {
                $match: {
                    date: { $gte: start, $lte: end },
                    status: { $nin: ['reversed', 'draft'] },
                    source: {
                        $nin: [
                            'rental_accrual',
                            'rental_accrual_reversal',
                            'expense_accrual',
                            'expense_accrual_reversal'
                        ]
                    }
                }
            },
            { $unwind: '$entries' },
            {
                $match: {
                    $or: [
                        { 'entries.accountCode': { $regex: /^10[0-1]\d$/ } },
                        { 'entries.accountCode': '10003' }
                    ]
                }
            },
            {
                $group: {
                    _id: { $month: '$date' },
                    inflows: { $sum: { $ifNull: ['$entries.debit', 0] } },
                    outflows: { $sum: { $ifNull: ['$entries.credit', 0] } }
                }
            }
        ]);

        return Array.from({ length: 12 }, (_, i) => {
            const m = i + 1;
            const row = rows.find((r) => r._id === m) || { inflows: 0, outflows: 0 };
            const revenue = row.inflows || 0;
            const expenses = row.outflows || 0;
            return {
                period: MONTH_NAMES_SHORT[i],
                revenue,
                expenses,
                profit: revenue - expenses
            };
        });
    }

    /**
     * Per-residence P&L for one month.
     */
    static async getResidenceMonthPnL(year, month) {
        const { start, end } = monthBounds(year, month);
        const rows = await TransactionEntry.aggregate([
            {
                $match: {
                    date: { $gte: start, $lte: end },
                    status: { $nin: ['reversed', 'draft'] }
                }
            },
            { $unwind: '$entries' },
            {
                $group: {
                    _id: residenceIdExpr(),
                    revenue: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ['$entries.accountType', 'Income'] },
                                        { $gt: ['$entries.credit', 0] }
                                    ]
                                },
                                '$entries.credit',
                                0
                            ]
                        }
                    },
                    expenses: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ['$entries.accountType', 'Expense'] },
                                        { $gt: ['$entries.debit', 0] }
                                    ]
                                },
                                '$entries.debit',
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const map = {};
        rows.forEach((r) => {
            if (!r._id || r._id === 'null') return;
            map[String(r._id)] = {
                revenue: r.revenue || 0,
                expenses: r.expenses || 0,
                net: (r.revenue || 0) - (r.expenses || 0)
            };
        });
        return map;
    }

    /**
     * Cash received (payment sources) by residence for one month.
     */
    static async getCashReceivedByResidence(year, month) {
        const { start, end } = monthBounds(year, month);
        const rows = await TransactionEntry.aggregate([
            {
                $match: {
                    date: { $gte: start, $lte: end },
                    status: { $nin: ['reversed', 'draft'] },
                    source: {
                        $in: [
                            'payment',
                            'advance_payment',
                            'accounts_receivable_collection',
                            'payment_collection',
                            'rental_payment',
                            'current_payment'
                        ]
                    }
                }
            },
            { $unwind: '$entries' },
            {
                $match: {
                    'entries.accountCode': { $regex: /^10[0-1]\d$/ },
                    'entries.debit': { $gt: 0 }
                }
            },
            {
                $group: {
                    _id: residenceIdExpr(),
                    total: { $sum: '$entries.debit' }
                }
            }
        ]);

        const map = {};
        rows.forEach((r) => {
            if (!r._id || r._id === 'null') return;
            map[String(r._id)] = r.total || 0;
        });
        return map;
    }

    /**
     * Expense totals by category + by residence for one month.
     */
    static async getExpenseBreakdown(year, month, residences) {
        const { start, end } = monthBounds(year, month);
        const [byCategoryRows, byResidenceRows] = await Promise.all([
            TransactionEntry.aggregate([
                {
                    $match: {
                        date: { $gte: start, $lte: end },
                        status: { $nin: ['reversed', 'draft'] }
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
                            $ifNull: ['$entries.accountName', '$entries.accountCode']
                        },
                        amount: { $sum: '$entries.debit' }
                    }
                }
            ]),
            TransactionEntry.aggregate([
                {
                    $match: {
                        date: { $gte: start, $lte: end },
                        status: { $nin: ['reversed', 'draft'] }
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
                        _id: residenceIdExpr(),
                        amount: { $sum: '$entries.debit' }
                    }
                }
            ])
        ]);

        const byCategory = {};
        let total = 0;
        byCategoryRows.forEach((r) => {
            const key = r._id || 'Other';
            byCategory[key] = r.amount || 0;
            total += r.amount || 0;
        });

        const residenceMap = {};
        (residences || []).forEach((res) => {
            residenceMap[res._id.toString()] = {
                residenceId: res._id,
                name: res.name,
                amount: 0
            };
        });
        byResidenceRows.forEach((r) => {
            const id = r._id ? String(r._id) : null;
            if (id && residenceMap[id]) {
                residenceMap[id].amount = r.amount || 0;
            }
        });

        return {
            total,
            byCategory,
            byResidence: Object.values(residenceMap).filter((r) => r.amount > 0)
        };
    }

    static async getDebtorSummary() {
        const [agg] = await Debtor.aggregate([
            { $match: { status: { $ne: 'paid' }, currentBalance: { $gt: 0 } } },
            {
                $group: {
                    _id: null,
                    outstandingCount: { $sum: 1 },
                    totalOutstanding: { $sum: '$currentBalance' }
                }
            }
        ]);
        const totalOutstanding = agg?.totalOutstanding || 0;
        return {
            outstandingCount: agg?.outstandingCount || 0,
            totalOutstanding,
            totalBalance: totalOutstanding
        };
    }

    static async getOccupancyByResidence(residences) {
        const now = new Date();
        const apps = await Application.find({
            status: { $in: ['approved', 'allocated', 'active', 'enrolled'] },
            $and: [
                { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
                { $or: [{ startDate: null }, { startDate: { $lte: now } }] }
            ]
        })
            .select('residence residenceId allocatedRoomDetails allocatedRoom')
            .lean();

        const byRes = {};
        residences.forEach((r) => {
            byRes[r._id.toString()] = {
                occupiedRooms: new Set(),
                totalOccupants: 0,
                totalRooms: Array.isArray(r.rooms) ? r.rooms.length : 0
            };
        });

        apps.forEach((app) => {
            const resId =
                app.residenceId?.toString() ||
                app.allocatedRoomDetails?.residenceId?.toString() ||
                app.residence?.toString();
            if (!resId || !byRes[resId]) return;
            byRes[resId].totalOccupants += 1;
            const room = app.allocatedRoom || app.allocatedRoomDetails?.roomNumber;
            if (room) byRes[resId].occupiedRooms.add(room);
        });

        return byRes;
    }

    static async getMaintenancesByResidence(year, month, residences) {
        const { start, end } = monthBounds(year, month);
        const ids = residences.map((r) => r._id);
        const items = await Maintenance.find({
            residence: { $in: ids },
            createdAt: { $gte: start, $lte: end }
        })
            .select('residence issue status priority category amount createdAt')
            .lean();

        const map = {};
        residences.forEach((r) => {
            map[r._id.toString()] = [];
        });
        items.forEach((m) => {
            const id = m.residence?.toString();
            if (id && map[id]) {
                map[id].push({
                    _id: m._id,
                    issue: m.issue,
                    status: m.status,
                    priority: m.priority,
                    category: m.category,
                    amount: m.amount || 0,
                    createdAt: m.createdAt
                });
            }
        });
        return map;
    }

    static async getRecentMaintenances(limit = 10) {
        const maintenances = await Maintenance.find()
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('residence', 'name')
            .populate('student', 'firstName lastName')
            .populate('assignedTo', 'firstName lastName')
            .lean();

        return maintenances.map((m) => ({
            _id: m._id,
            issue: m.issue,
            description: m.description,
            category: m.category,
            priority: m.priority,
            status: m.status,
            room: m.room,
            amount: m.amount || 0,
            financeStatus: m.financeStatus || 'pending',
            residence: m.residence
                ? { _id: m.residence._id, name: m.residence.name }
                : null,
            student: m.student
                ? {
                      _id: m.student._id,
                      name: `${m.student.firstName} ${m.student.lastName}`
                  }
                : null,
            assignedTo: m.assignedTo
                ? {
                      _id: m.assignedTo._id,
                      name: `${m.assignedTo.firstName} ${m.assignedTo.lastName}`
                  }
                : null,
            createdAt: m.createdAt,
            updatedAt: m.updatedAt
        }));
    }

    static async getApplications(year, month) {
        const { start, end } = monthBounds(year, month);
        const applications = await Application.find({
            $or: [
                { applicationDate: { $gte: start, $lte: end } },
                { createdAt: { $gte: start, $lte: end } }
            ]
        })
            .select(
                'status requestType applicationDate createdAt residence student startDate endDate leaseStartDate leaseEndDate allocatedRoom allocatedRoomDetails'
            )
            .populate('residence', 'name')
            .populate('student', 'firstName lastName email')
            .limit(100)
            .lean();

        return applications.map((app) => ({
            _id: app._id,
            status: app.status,
            requestType: app.requestType,
            applicationDate: app.applicationDate || app.createdAt,
            residence: app.residence
                ? { _id: app.residence._id, name: app.residence.name }
                : null,
            student: app.student
                ? {
                      _id: app.student._id,
                      firstName: app.student.firstName,
                      lastName: app.student.lastName,
                      email: app.student.email
                  }
                : null,
            startDate: app.startDate || app.leaseStartDate,
            endDate: app.endDate || app.leaseEndDate,
            allocatedRoom: app.allocatedRoom,
            allocatedRoomDetails: app.allocatedRoomDetails
        }));
    }
}

module.exports = FastExecutiveDashboardService;
