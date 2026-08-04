const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const User = require('../../models/User');
const { Residence } = require('../../models/Residence');

// Get list of admin users
router.get('/admins', auth, async (req, res) => {
    try {
        const adminUsers = await User.find({
            role: { $in: ['admin', 'finance_admin', 'finance_user', 'property_manager'] }
        })
        .select('firstName lastName role')
        .sort('firstName');
        
        res.json(adminUsers);
    } catch (error) {
        console.error('Error fetching admin users:', error);
        res.status(500).json({ error: 'Error fetching admin users' });
    }
});

// Get all students with residence information (for finance) — from debtors (same as Add Payment)
router.get('/students', auth, checkRole('finance_admin', 'finance_user'), async (req, res) => {
    try {
        const Debtor = require('../../models/Debtor');
        const { page = 1, limit = 1000, search, status, residence } = req.query;
        const query = {};
        if (status && String(status).toLowerCase() !== 'all') query.status = status;
        if (residence) query.residence = residence;
        if (search) {
            query.$or = [
                { 'contactInfo.name': { $regex: search, $options: 'i' } },
                { 'contactInfo.email': { $regex: search, $options: 'i' } },
                { debtorCode: { $regex: search, $options: 'i' } }
            ];
        }
        const limitNum = Math.min(2000, Math.max(1, parseInt(limit, 10) || 1000));
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const [total, debtors] = await Promise.all([
            Debtor.countDocuments(query),
            Debtor.find(query)
                .select('debtorCode accountCode status contactInfo residence user roomNumber isExpired expiredAt')
                .populate('residence', 'name _id')
                .sort({ 'contactInfo.name': 1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .lean()
        ]);
        const students = debtors.map((d) => {
            const parts = String(d.contactInfo?.name || '').trim().split(/\s+/).filter(Boolean);
            const studentId = d.user || d._id;
            return {
                _id: studentId,
                id: studentId,
                firstName: parts[0] || 'Tenant',
                lastName: parts.slice(1).join(' ') || '',
                name: d.contactInfo?.name || d.debtorCode,
                email: d.contactInfo?.email || '',
                status: d.isExpired ? 'expired' : d.status,
                isExpired: Boolean(d.isExpired),
                residence: d.residence,
                debtorId: d._id,
                debtorCode: d.debtorCode,
                accountCode: d.accountCode,
                source: 'debtor'
            };
        });
        res.json({
            students,
            currentPage: pageNum,
            totalPages: Math.max(1, Math.ceil(total / limitNum) || 1),
            total,
            source: 'debtors',
            includesExpired: true
        });
    } catch (error) {
        console.error('Error fetching students for finance:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get student details by ID (for finance)
router.get('/students/:studentId', auth, checkRole('finance_admin', 'finance_user'), async (req, res) => {
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

module.exports = router; 