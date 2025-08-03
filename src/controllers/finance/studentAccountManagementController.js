const StudentAccount = require('../../models/StudentAccount');
const User = require('../../models/User');
const Payment = require('../../models/Payment');
const Transaction = require('../../models/Transaction');
const TransactionEntry = require('../../models/TransactionEntry');
const AuditLog = require('../../models/AuditLog');

// Create individual student account
exports.createStudentAccount = async (req, res) => {
    try {
        const { studentId, initialBalance = 0, notes } = req.body;

        // Validate student exists
        const student = await User.findOne({ _id: studentId, role: 'student' });
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // Check if account already exists
        const existingAccount = await StudentAccount.findOne({ student: studentId });
        if (existingAccount) {
            return res.status(400).json({ error: 'Student account already exists' });
        }

        // Create new student account
        const studentAccount = new StudentAccount({
            student: studentId,
            balance: initialBalance,
            notes,
            createdBy: req.user._id
        });

        await studentAccount.save();

        // Create corresponding chart of accounts entry
        const Account = require('../../models/Account');
        const chartAccount = new Account({
            code: studentAccount.accountCode,
            name: `Student Account - ${student.firstName} ${student.lastName}`,
            type: 'Asset'
        });

        await chartAccount.save();

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'create',
            collection: 'StudentAccount',
            recordId: studentAccount._id,
            before: null,
            after: studentAccount.toObject(),
            timestamp: new Date(),
            details: {
                source: 'Finance',
                description: `Created individual account for student ${student.firstName} ${student.lastName}`,
                accountCode: studentAccount.accountCode,
                initialBalance
            }
        });

        const populatedAccount = await StudentAccount.findById(studentAccount._id)
            .populate('student', 'firstName lastName email');

        res.status(201).json({
            message: 'Student account created successfully',
            account: populatedAccount
        });

    } catch (error) {
        console.error('Error creating student account:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get individual student account
exports.getStudentAccount = async (req, res) => {
    try {
        const { studentId } = req.params;

        const account = await StudentAccount.findOne({ student: studentId })
            .populate('student', 'firstName lastName email')
            .populate('createdBy', 'firstName lastName');

        if (!account) {
            return res.status(404).json({ error: 'Student account not found' });
        }

        // Get recent transactions for this student
        const recentTransactions = await TransactionEntry.find({
            account: account.accountCode
        })
        .populate('transaction')
        .sort({ createdAt: -1 })
        .limit(10);

        res.json({
            account,
            recentTransactions
        });

    } catch (error) {
        console.error('Error fetching student account:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get all student accounts
exports.getAllStudentAccounts = async (req, res) => {
    try {
        const { status, search } = req.query;
        
        let query = {};
        
        if (status) {
            query.status = status;
        }

        const accounts = await StudentAccount.find(query)
            .populate('student', 'firstName lastName email')
            .populate('createdBy', 'firstName lastName')
            .sort({ createdAt: -1 });

        // Filter by search if provided
        let filteredAccounts = accounts;
        if (search) {
            filteredAccounts = accounts.filter(account => 
                account.student.firstName.toLowerCase().includes(search.toLowerCase()) ||
                account.student.lastName.toLowerCase().includes(search.toLowerCase()) ||
                account.student.email.toLowerCase().includes(search.toLowerCase()) ||
                account.accountCode.toLowerCase().includes(search.toLowerCase())
            );
        }

        res.json(filteredAccounts);

    } catch (error) {
        console.error('Error fetching student accounts:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update student account
exports.updateStudentAccount = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { balance, status, notes } = req.body;

        const account = await StudentAccount.findOne({ student: studentId });
        if (!account) {
            return res.status(404).json({ error: 'Student account not found' });
        }

        const oldData = account.toObject();

        // Update fields
        if (balance !== undefined) account.balance = balance;
        if (status) account.status = status;
        if (notes !== undefined) account.notes = notes;

        await account.save();

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'update',
            collection: 'StudentAccount',
            recordId: account._id,
            before: oldData,
            after: account.toObject(),
            timestamp: new Date(),
            details: {
                source: 'Finance',
                description: `Updated student account for ${account.student.firstName} ${account.student.lastName}`,
                changes: { balance, status, notes }
            }
        });

        const updatedAccount = await StudentAccount.findById(account._id)
            .populate('student', 'firstName lastName email');

        res.json({
            message: 'Student account updated successfully',
            account: updatedAccount
        });

    } catch (error) {
        console.error('Error updating student account:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get student account summary with payment history
exports.getStudentAccountSummary = async (req, res) => {
    try {
        const { studentId } = req.params;

        const account = await StudentAccount.findOne({ student: studentId })
            .populate('student', 'firstName lastName email');

        if (!account) {
            return res.status(404).json({ error: 'Student account not found' });
        }

        // Get payment history
        const payments = await Payment.find({ student: studentId })
            .sort({ date: -1 })
            .limit(20);

        // Calculate totals
        const totalPaid = payments
            .filter(p => ['Confirmed', 'Verified'].includes(p.status))
            .reduce((sum, p) => sum + (p.totalAmount || 0), 0);

        const pendingPayments = payments
            .filter(p => ['Pending', 'Under Review'].includes(p.status));

        res.json({
            account,
            paymentHistory: payments,
            summary: {
                totalPaid,
                pendingAmount: pendingPayments.reduce((sum, p) => sum + (p.totalAmount || 0), 0),
                totalPayments: payments.length,
                lastPayment: payments[0] || null
            }
        });

    } catch (error) {
        console.error('Error fetching student account summary:', error);
        res.status(500).json({ error: 'Server error' });
    }
}; 