const express = require('express');
const router = express.Router();
const multer = require('multer');
const monthlyRequestController = require('../controllers/monthlyRequestController');
const { auth, checkRole } = require('../middleware/auth');
const requestLogger = require('../middleware/requestLogger');

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

// Apply request logging middleware for debugging
router.use(requestLogger);

// Get all monthly requests (filtered by user role and residence)
router.get('/', monthlyRequestController.getAllMonthlyRequests);

// Get finance-specific monthly requests (only shows requests with changes in current month)
router.get('/finance/dashboard', 
    checkRole(['finance', 'finance_admin', 'finance_user']), 
    monthlyRequestController.getFinanceMonthlyRequests
);

// Get finance pending approvals (only requests that need approval)
router.get('/finance/pending-approvals', 
    checkRole(['finance', 'finance_admin', 'finance_user']), 
    monthlyRequestController.getFinancePendingApprovals
);

// Get CEO monthly request dashboard
router.get('/ceo/dashboard', 
    checkRole(['ceo']), 
    monthlyRequestController.getCEOMonthlyRequests
);

// Convert approved monthly requests to expenses
router.post('/convert-to-expenses', 
    checkRole(['finance', 'finance_admin', 'finance_user']), 
    monthlyRequestController.convertToExpenses
);

// Get monthly request by ID
router.get('/:id', monthlyRequestController.getMonthlyRequestById);

// Get monthly requests for a specific residence and month/year
router.get('/residence/:residenceId/:month/:year', monthlyRequestController.getMonthlyRequestsByResidence);

// Get templates for a residence
router.get('/templates/:residence', monthlyRequestController.getTemplates);

// Get available templates for a residence with enhanced information
router.get('/available-templates/:residence', monthlyRequestController.getAvailableTemplates);

// Get templates for residence selection (for monthly request creation)
router.get('/residence/:residenceId/templates', monthlyRequestController.getTemplatesForResidence);

// Get template items as table format
router.get('/templates/:templateId/table', monthlyRequestController.getTemplateItemsTable);

// Get templates with pending changes for finance approval
router.get('/templates/:residence/pending-changes', monthlyRequestController.getTemplatesWithPendingChanges);

// Create new monthly request
router.post('/', monthlyRequestController.createMonthlyRequest);

// Create monthly request from template
router.post('/templates/:templateId', monthlyRequestController.createFromTemplate);

// Template management routes (Admin only)
router.post('/templates/:templateId/items', monthlyRequestController.addTemplateItem);
router.put('/templates/:templateId/items/:itemIndex', monthlyRequestController.modifyTemplateItem);
router.delete('/templates/:templateId/items/:itemIndex', monthlyRequestController.removeTemplateItem);

// Template change approval routes (Finance only)
router.post('/templates/:templateId/changes/:changeIndex/approve', monthlyRequestController.approveTemplateChanges);
router.post('/templates/:templateId/changes/:changeIndex/reject', monthlyRequestController.rejectTemplateChanges);

// Update monthly request (admin or submitter only)
router.put('/:id', monthlyRequestController.updateMonthlyRequest);

// Submit monthly request for approval
router.patch('/:id/submit', monthlyRequestController.submitMonthlyRequest);

// Approve monthly request (finance only)
router.patch('/:id/approve', 
    checkRole(['finance', 'finance_admin', 'finance_user']), 
    monthlyRequestController.approveMonthlyRequest
);

// Add quotation to specific item (admin only)
router.post('/:id/items/:itemIndex/quotations', 
    checkRole(['admin']), 
    upload.single('quotation'), 
    monthlyRequestController.addItemQuotation
);

// Approve quotation for specific item (admin and finance users)
router.patch('/:id/items/:itemIndex/quotations/:quotationIndex/approve', 
    checkRole(['admin', 'finance', 'finance_admin', 'finance_user']), 
    monthlyRequestController.approveItemQuotation
);

// Update item quotation (admin only) - handles both FormData and JSON
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
    monthlyRequestController.updateItemQuotation
);

// Delete monthly request (admin or submitter only)
router.delete('/:id', monthlyRequestController.deleteMonthlyRequest);

module.exports = router; 