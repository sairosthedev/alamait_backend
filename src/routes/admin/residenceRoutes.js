const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { auth, checkRole } = require('../../middleware/auth');

// Import controllers
const {
    addResidence,
    getAllResidences,
    getResidence,
    updateResidence,
    deleteResidence
} = require('../../controllers/admin/residenceController');

// Validation middleware
const residenceValidation = [
    body('name').notEmpty().trim().withMessage('Name is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('address').notEmpty().withMessage('Address is required'),
    body('location.coordinates').isArray().withMessage('Location coordinates are required'),
    body('rooms').isArray().withMessage('Rooms information is required'),
    body('rooms.*.roomNumber').notEmpty().withMessage('Room number is required'),
    body('rooms.*.type').isIn(['single', 'double', 'studio', 'apartment']).withMessage('Invalid room type'),
    body('rooms.*.price').isNumeric().withMessage('Room price must be a number')
];

// Apply auth middleware to all routes
router.use(auth);
router.use(checkRole('admin', 'finance_admin', 'finance_user'));

// Routes
router.post('/', residenceValidation, addResidence);
router.get('/', getAllResidences);
router.get('/:id', getResidence);
router.put('/:id', residenceValidation, updateResidence);
router.delete('/:id', deleteResidence);

module.exports = router; 