const express = require('express');
const router = express.Router();
const { auth, checkAdminOrFinance } = require('../../middleware/auth');
const User = require('../../models/User');
const Residence = require('../../models/Residence');
const Application = require('../../models/Application');

// Finance middleware - allow both admin and finance roles
router.use(auth);
router.use(checkAdminOrFinance);

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
            .populate('residence', 'name _id')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        // Add room and residenceName fields from application
        const studentsWithRoom = await Promise.all(students.map(async s => {
            // Find latest approved application for this student
            const application = await Application.findOne({ student: s._id, status: 'approved' }).sort({ createdAt: -1 }).lean();
            // Compute billing period (for now, use application.startDate's month/year if available)
            let billingPeriod = null;
            if (application && application.startDate) {
                const date = new Date(application.startDate);
                billingPeriod = date.toLocaleString('default', { month: 'long', year: 'numeric' });
            }
            return {
                ...s,
                room: application?.allocatedRoom || null,
                residenceName: s.residence?.name || null,
                billingPeriod
            };
        }));

        const total = await User.countDocuments(query);

        res.json({
            students: studentsWithRoom,
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

module.exports = router; 