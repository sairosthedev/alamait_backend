const express = require('express');
const router = express.Router();
const multer = require('multer');
const requestController = require('../controllers/requestController');
const { auth, checkRole } = require('../middleware/auth');

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow PDF, DOC, DOCX, and image files
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/jpeg',
            'image/png',
            'image/gif'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and image files are allowed.'), false);
        }
    }
});

// Apply authentication middleware to all routes
router.use(auth);

// Get all requests (filtered by user role) - CEO can view all requests
router.get('/', requestController.getAllRequests);

// Get request by ID - CEO can view any request
router.get('/:id', requestController.getRequestById);

// Create new request
router.post('/', requestController.createRequest);

// Add update message to request
router.post('/:id/updates', requestController.addUpdate);

// Update request status (admin only - for maintenance requests)
router.patch('/:id/status', checkRole(['admin']), requestController.updateRequestStatus);

// Admin approval for admin requests
router.patch('/:id/admin-approval', checkRole(['admin']), requestController.adminApproval);

// Finance approval for admin requests
router.patch('/:id/finance-approval', checkRole(['finance', 'finance_admin', 'finance_user']), requestController.financeApproval);

// CEO approval for admin requests
router.patch('/:id/ceo-approval', checkRole(['ceo']), requestController.ceoApproval);

// Upload quotation (admin only)
router.post('/:id/quotations', 
    checkRole(['admin']), 
    upload.single('quotation'), 
    requestController.uploadQuotation
);

// Approve quotation (finance only)
router.patch('/:id/quotations/approve', 
    checkRole(['finance', 'finance_admin', 'finance_user']), 
    requestController.approveQuotation
);

// Delete request (only by submitter or admin)
router.delete('/:id', requestController.deleteRequest);

module.exports = router;