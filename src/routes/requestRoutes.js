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
        console.log('Multer fileFilter called with file:', {
            fieldname: file.fieldname,
            originalname: file.originalname,
            mimetype: file.mimetype
        });
        
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

// Error handling middleware for multer
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        console.error('Multer error:', error);
        return res.status(400).json({ 
            message: 'File upload error', 
            error: error.message 
        });
    } else if (error) {
        console.error('Other error:', error);
        return res.status(400).json({ 
            message: error.message 
        });
    }
    next();
});

// Get all requests (filtered by user role) - CEO can view all requests
router.get('/', requestController.getAllRequests);

// Get request by ID - CEO can view any request
router.get('/:id', requestController.getRequestById);

// Get quotations for a request (CEO and Finance can view)
router.get('/:id/quotations', requestController.getRequestQuotations);

// Create new request
router.post('/', 
    (req, res, next) => {
        // Check if this is a multipart request (file upload)
        if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
            // Use multer for file uploads
            upload.any()(req, res, next);
        } else {
            // Skip multer for JSON requests
            next();
        }
    },
    requestController.createRequest
);

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

// Upload quotation (admin only) - handles both FormData and JSON
router.post('/:id/quotations', 
    checkRole(['admin']), 
    (req, res, next) => {
        // Check if this is a multipart request (file upload)
        if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
            // Use multer for file uploads
            upload.single('quotation')(req, res, next);
        } else {
            // Skip multer for JSON requests
            next();
        }
    },
    requestController.uploadQuotation
);

// Approve quotation (finance only)
router.patch('/:id/quotations/approve', 
    checkRole(['finance', 'finance_admin', 'finance_user']), 
    requestController.approveQuotation
);

// Add quotation to specific item (admin only) - handles both FormData and JSON
router.post('/:id/items/:itemIndex/quotations', 
    checkRole(['admin']), 
    (req, res, next) => {
        // Check if this is a multipart request (file upload)
        if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
            // Use multer for file uploads
            upload.single('quotation')(req, res, next);
        } else {
            // Skip multer for JSON requests
            next();
        }
    },
    requestController.addItemQuotation
);

// Approve quotation for specific item (admin and finance users)
router.patch('/:id/items/:itemIndex/quotations/:quotationIndex/approve', 
    checkRole(['admin', 'finance', 'finance_admin', 'finance_user']), 
    requestController.approveItemQuotation
);

// Update request-level quotation (admin only) - handles both FormData and JSON
router.put('/:id/quotations/:quotationId', 
    checkRole(['admin']), 
    (req, res, next) => {
        // Check if this is a multipart request (file upload)
        if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
            // Use multer for file uploads
            upload.single('quotation')(req, res, next);
        } else {
            // Skip multer for JSON requests
            next();
        }
    },
    requestController.updateRequestQuotation
);

// Update item-level quotation (admin only) - handles both FormData and JSON
router.put('/:id/items/:itemIndex/quotations/:quotationIndex', 
    checkRole(['admin']), 
    (req, res, next) => {
        // Check if this is a multipart request (file upload)
        if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
            // Use multer for file uploads
            upload.single('quotation')(req, res, next);
        } else {
            // Skip multer for JSON requests
            next();
        }
    },
    requestController.updateItemQuotation
);

// Delete request (only by submitter or admin)
router.delete('/:id', requestController.deleteRequest);

// Download quotation file
router.get('/:id/items/:itemIndex/quotations/:quotationIndex/download', 
    checkRole(['admin', 'finance', 'finance_admin', 'finance_user', 'ceo']), 
    requestController.downloadQuotationFile
);

// Quotation selection routes
router.post('/:requestId/items/:itemIndex/quotations/:quotationIndex/select', 
    checkRole(['admin']), 
    requestController.selectItemQuotation
);

router.post('/:requestId/quotations/:quotationIndex/select', 
    checkRole(['admin']), 
    requestController.selectRequestQuotation
);

router.post('/:requestId/items/:itemIndex/quotations/:quotationIndex/override', 
    checkRole(['finance', 'finance_admin', 'finance_user']), 
    requestController.overrideQuotationSelection
);

// Mark expense as paid
router.post('/expenses/:expenseId/mark-paid', 
    checkRole(['finance', 'finance_admin', 'finance_user']), 
    requestController.markExpenseAsPaid
);

module.exports = router;