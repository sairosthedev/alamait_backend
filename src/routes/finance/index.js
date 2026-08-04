const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { auth, checkAdminOrFinance } = require('../../middleware/auth');
const User = require('../../models/User');
const { Residence } = require('../../models/Residence');
const Application = require('../../models/Application');
const auditLogRoutes = require('./auditLogRoutes');
// const pettyCashRoutes = require('./pettyCashRoutes');
const vendorRoutes = require('./vendorRoutes');
const employeeRoutes = require('./employeeRoutes');
const transactionRoutes = require('./transactionRoutes');
const accountRoutes = require('./accountRoutes');
const studentARBalancesRoutes = require('./studentARBalancesRoutes');
const transactionAccountsRoutes = require('./transactionAccountsRoutes');
const enhancedBalanceSheetRoutes = require('./enhancedBalanceSheetRoutes');
const debtorLedgerRoutes = require('./debtorLedgerRoutes');
const debtorRoutes = require('./debtorRoutes');
const { getAllStudentAccounts } = require('../../controllers/finance/studentAccountController');
const SecurityDepositController = require('../../controllers/finance/securityDepositController');
const CashFlowController = require('../../controllers/finance/cashFlowController');
const Lease = require('../../models/Lease');
const Payment = require('../../models/Payment');
const FinanceController = require('../../controllers/financeController');

// Finance middleware - allow both admin and finance roles
router.use(auth);
router.use(checkAdminOrFinance);
router.use('/audit-log', auditLogRoutes);
// router.use('/petty-cash', pettyCashRoutes);
router.use('/vendors', vendorRoutes);
router.use('/employees', employeeRoutes);
router.use('/transactions', transactionRoutes);
router.use('/accounts', accountRoutes);
router.use('/students', studentARBalancesRoutes);
router.use('/transaction-accounts', transactionAccountsRoutes);
router.use('/', enhancedBalanceSheetRoutes);
router.use('/debtors', debtorRoutes);
router.use('/debtors', debtorLedgerRoutes);

// Security Deposit Management Routes
router.get('/security-deposits/status/:studentId', SecurityDepositController.getDepositStatus);
router.get('/security-deposits/students', SecurityDepositController.getAllStudents);
router.post('/security-deposits/reverse', SecurityDepositController.reverseUnpaidDeposit);

// Cash Flow Drill-down Routes
router.get('/cashflow/account-details', CashFlowController.getAccountTransactionDetails);
router.get('/cashflow/with-drilldown', CashFlowController.getCashFlowWithDrillDown);

// Get all users (for finance)
router.get('/users', async (req, res) => {
    try {
        const { page = 1, limit = 10, search, role, status } = req.query;
        const query = {};

        if (role) {
            query.role = role;
        }

        if (status) {
            query.status = status;
        }

        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
        const skip = (pageNum - 1) * limitNum;

        const [users, total] = await Promise.all([
            User.find(query)
                .select('firstName lastName email role status createdAt isVerified phone applicationCode currentRoom roomValidUntil roomApprovalDate residence emergencyContact lastLogin')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            User.countDocuments(query)
        ]);

        const processedUsers = users.map((user) => ({
            ...user,
            role: user.role || 'student'
        }));

        res.status(200).json({
            users: processedUsers,
            currentPage: pageNum,
            totalPages: Math.ceil(total / limitNum),
            total,
            limit: limitNum
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get specific user by ID (for finance)
router.get('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid user ID format' });
        }

        const user = await User.findById(id)
            .select('firstName lastName email role status createdAt isVerified phone applicationCode currentRoom roomValidUntil roomApprovalDate residence emergencyContact lastLogin')
            .lean();
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({
            ...user,
            role: user.role || 'student'
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get students for Add Payment — same source as debtors list
router.get('/students', async (req, res) => {
    try {
        const Debtor = require('../../models/Debtor');
        const {
            page = 1,
            limit = 1000,
            search,
            status,
            residence,
            overdue
        } = req.query;

        const query = {};
        // Match debtors list: status=all / omitted → everyone
        if (status && String(status).toLowerCase() !== 'all') {
            query.status = status;
        }
        if (residence) query.residence = residence;
        if (overdue === 'true') query.currentBalance = { $gt: 0 };

        if (search) {
            query.$or = [
                { 'contactInfo.name': { $regex: search, $options: 'i' } },
                { 'contactInfo.email': { $regex: search, $options: 'i' } },
                { debtorCode: { $regex: search, $options: 'i' } },
                { accountCode: { $regex: search, $options: 'i' } }
            ];
        }

        const limitNum = Math.min(2000, Math.max(1, parseInt(limit, 10) || 1000));
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const skip = (pageNum - 1) * limitNum;

        const [total, debtors] = await Promise.all([
            Debtor.countDocuments(query),
            Debtor.find(query)
                .select(
                    'debtorCode accountCode status currentBalance totalOwed totalPaid residence user application contactInfo roomNumber isExpired expiredAt expirationReason createdAt'
                )
                .populate('user', 'firstName lastName email phone')
                .populate('residence', 'name')
                .sort({ 'contactInfo.name': 1 })
                .skip(skip)
                .limit(limitNum)
                .lean()
        ]);

        // Shape expected by Add Payment modal (student picker)
        const students = debtors.map((d) => {
            const nameFromContact = String(d.contactInfo?.name || '').trim();
            const parts = nameFromContact.split(/\s+/).filter(Boolean);
            const firstName =
                d.user?.firstName || parts[0] || 'Tenant';
            const lastName =
                d.user?.lastName || parts.slice(1).join(' ') || '';
            const fullName = `${firstName} ${lastName}`.trim() || nameFromContact || d.debtorCode;
            // Prefer user id when present (legacy payments), else debtor id
            const studentId = d.user?._id || d.user || d._id;

            return {
                _id: studentId,
                id: studentId,
                firstName,
                lastName,
                name: fullName,
                email: d.user?.email || d.contactInfo?.email || '',
                phone: d.user?.phone || d.contactInfo?.phone || '',
                status: d.isExpired ? 'expired' : d.status || 'active',
                isExpired: Boolean(d.isExpired),
                expiredAt: d.expiredAt || null,
                residence: d.residence || null,
                residenceName: d.residence?.name || null,
                room: d.roomNumber || null,
                currentRoom: d.roomNumber || null,
                debtorId: d._id,
                debtorCode: d.debtorCode,
                accountCode: d.accountCode,
                currentBalance: d.currentBalance || 0,
                totalOwed: d.totalOwed || 0,
                totalPaid: d.totalPaid || 0,
                source: 'debtor'
            };
        });

        res.json({
            students,
            debtors: students, // alias for clients that expect debtors shape
            currentPage: pageNum,
            totalPages: Math.max(1, Math.ceil(total / limitNum) || 1),
            total,
            limit: limitNum,
            source: 'debtors',
            includesExpired: true
        });
    } catch (error) {
        console.error('Error fetching students for finance (from debtors):', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get student details by ID (for finance)
router.get('/students/:studentId', async (req, res) => {
    try {
        const student = await User.findOne({
            _id: req.params.studentId,
            role: 'student'
        })
        .select('-password')
        .populate('residence', 'name _id')
        .lean();

        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        res.json(student);
    } catch (error) {
        console.error('Error fetching student for finance:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get student payments by ID (for finance)
router.get('/students/:studentId/payments', async (req, res) => {
    try {
        const { getPaymentsByStudent } = require('../../controllers/finance/paymentController');
        return getPaymentsByStudent(req, res);
    } catch (error) {
        console.error('Error fetching student payments for finance:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get student leases by ID (for finance)
router.get('/students/:studentId/leases', async (req, res) => {
    try {
        const { getLeasesByStudent } = require('../../controllers/finance/leaseController');
        return getLeasesByStudent(req, res);
    } catch (error) {
        console.error('Error fetching student leases for finance:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Add this route for student accounts summary
router.get('/student-accounts', getAllStudentAccounts);

// ========================================
// PETTY CASH MANAGEMENT ROUTES
// ========================================

// Allocate petty cash to user
router.post('/allocate-petty-cash', FinanceController.allocatePettyCash);

// Replenish petty cash for user
router.post('/replenish-petty-cash', FinanceController.replenishPettyCash);

// Record petty cash expense
router.post('/record-petty-cash-expense', FinanceController.recordPettyCashExpense);

// Get user's petty cash balance
router.get('/petty-cash-balance/:userId', FinanceController.getPettyCashBalance);

// Get all petty cash balances (for finance dashboard)
router.get('/all-petty-cash-balances', FinanceController.getAllPettyCashBalances);

// Get user's petty cash transactions
router.get('/petty-cash-transactions/:userId', FinanceController.getPettyCashTransactions);

// Get eligible users for petty cash allocation
router.get('/eligible-users-for-petty-cash', async (req, res) => {
    try {
        console.log('🔍 Getting eligible users for petty cash allocation');
        
        // Get users who are eligible for petty cash (not students/tenants)
        const eligibleUsers = await User.find({
            role: { 
                $in: [
                    'admin', 
                    'admin_assistant', 
                    'ceo_assistant', 
                    'finance_assistant',
                    'finance_admin', 
                    'finance_user', 
                    'property_manager', 
                    'maintenance', 
                    'manager', 
                    'staff'
                ] 
            },
            status: 'active'
        })
        .select('firstName lastName email role status')
        .sort({ firstName: 1, lastName: 1 })
        .lean();

        console.log(`✅ Found ${eligibleUsers.length} eligible users for petty cash`);
        
        res.json({
            success: true,
            eligibleUsers,
            total: eligibleUsers.length
        });

    } catch (error) {
        console.error('❌ Error getting eligible users for petty cash:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get petty cash accounts (role-based accounts)
router.get('/petty-cash-accounts', async (req, res) => {
    try {
        console.log('💰 Getting petty cash accounts');
        
        const Account = require('../../models/Account');
        
        // Get all petty cash accounts
        const pettyCashAccounts = await Account.find({
            code: { $in: ['1010', '1011', '1012', '1013', '1014'] }
        })
        .select('code name type balance')
        .sort({ code: 1 })
        .lean();

        // Map accounts to roles
        const accountRoleMapping = {
            '1010': { role: 'general', name: 'General Petty Cash' },
            '1011': { role: 'admin', name: 'Admin Petty Cash' },
            '1012': { role: 'finance', name: 'Finance Petty Cash' },
            '1013': { role: 'property_manager', name: 'Property Manager Petty Cash' },
            '1014': { role: 'maintenance', name: 'Maintenance Petty Cash' }
        };

        const accountsWithRoles = pettyCashAccounts.map(account => ({
            ...account,
            role: accountRoleMapping[account.code]?.role || 'general',
            displayName: accountRoleMapping[account.code]?.name || account.name
        }));

        console.log(`✅ Found ${accountsWithRoles.length} petty cash accounts`);
        
        res.json({
            success: true,
            accounts: accountsWithRoles,  // Return as 'accounts' for frontend compatibility
            pettyCashAccounts: accountsWithRoles,  // Keep both for backward compatibility
            total: accountsWithRoles.length
        });

    } catch (error) {
        console.error('❌ Error getting petty cash accounts:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get petty cash summary for finance dashboard
router.get('/petty-cash-summary', async (req, res) => {
    try {
        console.log('📊 Getting petty cash summary for finance dashboard');
        
        const Account = require('../../models/Account');
        
        // Get petty cash accounts with balances
        const pettyCashAccounts = await Account.find({
            code: { $in: ['1010', '1011', '1012', '1013', '1014'] }
        })
        .select('code name balance')
        .lean();

        // Calculate totals
        const totalPettyCash = pettyCashAccounts.reduce((sum, account) => sum + (account.balance || 0), 0);
        
        // Get recent petty cash transactions
        const TransactionEntry = require('../../models/TransactionEntry');
        const recentTransactions = await TransactionEntry.find({
            source: 'manual',
            'metadata.transactionType': { $in: ['petty_cash_allocation', 'petty_cash_expense', 'petty_cash_replenishment'] }
        })
        .sort({ date: -1 })
        .limit(10)
        .populate('transactionId')
        .lean();

        console.log(`✅ Petty cash summary: Total $${totalPettyCash}, ${recentTransactions.length} recent transactions`);
        
        res.json({
            success: true,
            summary: {
                totalPettyCash,
                totalAccounts: pettyCashAccounts.length,
                recentTransactions: recentTransactions.length
            },
            pettyCashAccounts,
            recentTransactions
        });

    } catch (error) {
        console.error('❌ Error getting petty cash summary:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 