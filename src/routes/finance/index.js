const express = require('express');
const router = express.Router();
const { auth, checkAdminOrFinance } = require('../../middleware/auth');
const User = require('../../models/User');
const Residence = require('../../models/Residence');
const Application = require('../../models/Application');
const auditLogRoutes = require('./auditLogRoutes');
const { getAllStudentAccounts } = require('../../controllers/finance/studentAccountController');
const Lease = require('../../models/Lease');
const Payment = require('../../models/Payment');

// Finance middleware - allow both admin and finance roles
router.use(auth);
router.use(checkAdminOrFinance);
router.use('/audit-log', auditLogRoutes);

// Get all students with residence information (for finance)
router.get('/students', async (req, res) => {
    try {
        const { page = 1, limit = 10, search, status, residence } = req.query;
        const query = { role: 'student' };

        // Add filters
        if (status) {
            query.status = status;
        }

        if (residence) {
            query.residence = residence;
        }

        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;

        const students = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        // Fetch all applications for these students in one query
        const studentIds = students.map(s => s._id.toString());
        const applications = await Application.find({ student: { $in: studentIds } })
            .sort({ createdAt: -1 })
            .populate('residence', 'name')
            .lean();
        // Map all applications by student ID
        const allAppsMap = {};
        // Fetch all residences for room price lookup
        const allResidences = await Residence.find({}).lean();
        applications.forEach(app => {
            const sid = app.student?.toString();
            if (!allAppsMap[sid]) allAppsMap[sid] = [];
            // Attach room price if possible
            let roomPrice = null;
            if (app.allocatedRoom && app.residence && app.residence._id) {
                const residence = allResidences.find(r => r._id.toString() === app.residence._id.toString());
                if (residence && Array.isArray(residence.rooms)) {
                    const roomObj = residence.rooms.find(rm => rm.roomNumber === app.allocatedRoom);
                    if (roomObj && roomObj.price) roomPrice = roomObj.price;
                }
            }
            allAppsMap[sid].push({ ...app, roomPrice });
        });

        const studentsWithDetails = await Promise.all(students.map(async s => {
            // Find all leases for this student
            const leases = await Lease.find({ student: s._id }).populate('residence', 'name').lean();
            // Find all payments for this student
            const paymentHistory = await Payment.find({ student: s._id }).lean();

            // Add paymentMonth to each payment in paymentHistory if present
            const paymentHistoryWithMonth = paymentHistory.map(p => ({ ...p, paymentMonth: p.paymentMonth || null }));

            // Try to get residenceName, room, and billingPeriod from the latest lease or application
            let residenceName = null;
            let room = null;
            let billingPeriod = null;
            let adminFeeRequired = 0;
            let depositRequired = 0;
            let adminFeePaid = 0;
            let depositPaid = 0;
            let application = allAppsMap[s._id.toString()]?.[0] || null; // latest approved application

            if (leases.length > 0) {
                const latestLease = leases[leases.length - 1];
                residenceName = latestLease.residence?.name || null;
                room = latestLease.room || null;
                if (latestLease.startDate && latestLease.endDate) {
                    const start = new Date(latestLease.startDate);
                    const end = new Date(latestLease.endDate);
                    const startStr = start.toLocaleString('default', { month: 'long', year: 'numeric' });
                    const endStr = end.toLocaleString('default', { month: 'long', year: 'numeric' });
                    billingPeriod = `${startStr} - ${endStr}`;
                }
                adminFeeRequired = latestLease.adminFee || 0;
                depositRequired = latestLease.deposit || 0;
            } else if (application) {
                room = application.allocatedRoom || null;
                residenceName = application.residence?.name || null;
                if (application.startDate && application.endDate) {
                    const start = new Date(application.startDate);
                    const end = new Date(application.endDate);
                    const startStr = start.toLocaleString('default', { month: 'long', year: 'numeric' });
                    const endStr = end.toLocaleString('default', { month: 'long', year: 'numeric' });
                    billingPeriod = `${startStr} - ${endStr}`;
                }
                adminFeeRequired = application.adminFee || 0;
                depositRequired = application.deposit || 0;
            }

            // Calculate paid adminFee and deposit from payments
            paymentHistoryWithMonth.forEach(p => {
                if (p.adminFee) adminFeePaid += p.adminFee;
                if (p.deposit) depositPaid += p.deposit;
            });
            const unpaidAdminFee = Math.max(0, adminFeeRequired - adminFeePaid);
            const unpaidDeposit = Math.max(0, depositRequired - depositPaid);

            return {
                ...s,
                leases,
                paymentHistory: paymentHistoryWithMonth,
                residenceName,
                room,
                billingPeriod,
                unpaidAdminFee,
                unpaidDeposit,
                application, // latest approved application
                applications: allAppsMap[s._id.toString()] || [] // all applications
            };
        }));

        const total = await User.countDocuments(query);

        res.json({
            students: studentsWithDetails,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            total
        });
    } catch (error) {
        console.error('Error fetching students for finance:', error);
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

module.exports = router; 