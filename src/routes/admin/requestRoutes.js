const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { auth, checkRole } = require('../../middleware/auth');
const requestController = require('../../controllers/admin/requestController');

// Validation middleware
const approvalValidation = [
    check('notes').optional().trim().notEmpty().withMessage('Notes cannot be empty if provided')
];

const rejectionValidation = [
    check('notes').notEmpty().trim().withMessage('Rejection notes are required')
];

// All routes require admin, finance, or CEO role
router.use(auth);
router.use(checkRole('admin', 'finance', 'finance_admin', 'finance_user', 'ceo'));

// Get all requests (view access for both admin and CEO)
router.get('/', requestController.getAllRequests);

// Get request by ID (view access for both admin and CEO)
router.get('/:id', requestController.getRequestById);

// Get request statistics (view access for both admin and CEO)
router.get('/stats/overview', requestController.getRequestStats);

// CEO approve request (CEO only)
router.patch('/:id/approve', 
    checkRole('ceo'),
    approvalValidation, 
    requestController.approveRequest
);

// CEO reject request (CEO only)
router.patch('/:id/reject', 
    checkRole('ceo'),
    rejectionValidation, 
    requestController.rejectRequest
);

module.exports = router; 