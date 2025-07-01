const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const User = require('../../models/User');
const Residence = require('../../models/Residence');
const balanceSheetRoutes = require('./balanceSheetRoutes');
const maintenanceRoutes = require('./maintenanceRoutes');
const residenceRoutes = require('./residenceRoutes');
const leaseRoutes = require('./leaseRoutes');
const applicationRoutes = require('./applicationRoutes');
const roomPriceRoutes = require('./roomPriceRoutes');

// Finance middleware - all routes require finance role
router.use(auth);
router.use(checkRole('finance'));

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

        const total = await User.countDocuments(query);

        res.json({
            students,
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

// Mount routes
router.use('/balance-sheets', balanceSheetRoutes);
router.use('/maintenance', maintenanceRoutes);
router.use('/residences', residenceRoutes);
router.use('/leases', leaseRoutes);
router.use('/applications', applicationRoutes);
router.use('/room-prices', roomPriceRoutes);

module.exports = router; 