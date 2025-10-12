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

// Get monthly requests with enhanced filtering for templates and monthly approvals
router.get('/filtered', monthlyRequestController.getMonthlyRequestsWithFiltering);

// Get finance-specific monthly requests (only shows requests with changes in current month)
router.get('/finance/dashboard', 
    checkRole(['admin', 'finance', 'finance_admin', 'finance_user']), 
    monthlyRequestController.getFinanceMonthlyRequests
);

// Get finance pending approvals (only requests that need approval)
router.get('/finance/pending-approvals', 
    checkRole(['admin', 'finance', 'finance_admin', 'finance_user']), 
    monthlyRequestController.getFinancePendingApprovals
);

// Get finance pending count (for dashboard widgets)
router.get('/finance/pending-count', 
    checkRole(['admin', 'finance', 'finance_admin', 'finance_user']), 
    monthlyRequestController.getFinancePendingCount
);

// Get CEO monthly request dashboard
router.get('/ceo/dashboard', 
    checkRole(['ceo']), 
    monthlyRequestController.getCEOMonthlyRequests
);

// Get rejected monthly requests count (must be before /:id route)
router.get('/rejected-count', 
    checkRole(['admin', 'finance', 'finance_admin', 'finance_user']), 
    async (req, res) => {
        try {
            const MonthlyRequest = require('../models/MonthlyRequest');
            const count = await MonthlyRequest.countDocuments({ status: 'rejected' });
            res.json({ count });
        } catch (error) {
            console.error('Error getting rejected monthly requests count:', error);
            res.status(500).json({ error: 'Failed to get rejected monthly requests count' });
        }
    }
);

// Force backfill monthly accruals (admin only) - URGENT VERSION
router.post('/force-backfill', 
    checkRole(['admin']), 
    async (req, res) => {
        try {
            const RentalAccrualService = require('../services/rentalAccrualService');
            console.log('🚨 URGENT: Admin requested forced backfill - Job is at stake!');
            
            // Force run backfill immediately without any throttling
            const result = await RentalAccrualService.backfillMissingAccruals();
            
            console.log(`✅ URGENT BACKFILL COMPLETED:`, result);
            
            res.json({
                success: true,
                message: 'URGENT Backfill completed successfully - Job saved!',
                result: result,
                urgent: true,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('❌ URGENT BACKFILL FAILED:', error);
            res.status(500).json({ 
                success: false,
                error: 'URGENT Backfill failed - Job still at risk!',
                details: error.message,
                urgent: true,
                timestamp: new Date().toISOString()
            });
        }
    }
);

// Convert approved monthly requests to expenses
router.post('/convert-to-expenses', 
    checkRole(['admin', 'finance', 'finance_admin', 'finance_user']), 
    monthlyRequestController.convertToExpenses
);

// Template routes (must come before /:id to avoid conflicts)
// Get all templates (general endpoint)
router.get('/templates', monthlyRequestController.getAllTemplates);

// Get template items as table format
router.get('/templates/:templateId/table', monthlyRequestController.getTemplateItemsTable);

// Get templates with pending changes for finance approval
router.get('/templates/:residence/pending-changes', monthlyRequestController.getTemplatesWithPendingChanges);

// Get templates for a residence
router.get('/templates/:residence', monthlyRequestController.getTemplates);

// Get available templates for a residence with enhanced information
router.get('/available-templates/:residence', monthlyRequestController.getAvailableTemplates);

// Get templates for residence selection (for monthly request creation)
router.get('/residence/:residenceId/templates', monthlyRequestController.getTemplatesForResidence);

// Analyze historical data for template creation
router.get('/residence/:residenceId/analyze-historical', monthlyRequestController.analyzeHistoricalData);

// Create template from historical data
router.post('/residence/:residenceId/create-template-from-historical', monthlyRequestController.createTemplateFromHistorical);

// Route for creating template with manual historical data
router.post('/residence/:residenceId/create-template-with-history', auth, checkRole(['admin', 'finance']), monthlyRequestController.createTemplateWithHistory);

// Add the missing /approvals route that redirects to finance/pending-approvals
// Allow all authenticated users to access approvals
router.get('/approvals', 
    (req, res) => {
        // Redirect to the correct endpoint
        req.url = '/finance/pending-approvals' + req.url.replace('/approvals', '');
        monthlyRequestController.getFinancePendingApprovals(req, res);
    }
);

// Get monthly request by ID
router.get('/:id', monthlyRequestController.getMonthlyRequestById);

// Get monthly requests for a specific residence and month/year
router.get('/residence/:residenceId/:month/:year', monthlyRequestController.getMonthlyRequestsByResidence);

// Create new monthly request
router.post('/', monthlyRequestController.createMonthlyRequest);

// Create monthly request from template
router.post('/templates/:templateId', monthlyRequestController.createFromTemplate);

// Template management routes (Admin only)
router.post('/templates/:templateId/items', monthlyRequestController.addTemplateItem);
router.put('/templates/:templateId/items/:itemIndex', monthlyRequestController.modifyTemplateItem);
router.delete('/templates/:templateId/items/:itemIndex', monthlyRequestController.removeTemplateItem);

// Update entire template (Admin only)
router.put('/templates/:templateId', monthlyRequestController.updateTemplate);

// Template change approval routes (Finance and Admin)
router.post('/templates/:templateId/changes/:changeIndex/approve', 
    checkRole(['admin', 'finance', 'finance_admin', 'finance_user']), 
    monthlyRequestController.approveTemplateChanges
);
router.post('/templates/:templateId/changes/:changeIndex/reject', 
    checkRole(['admin', 'finance', 'finance_admin', 'finance_user']), 
    monthlyRequestController.rejectTemplateChanges
);

// Update monthly request (admin or submitter only)
router.put('/:id', monthlyRequestController.updateMonthlyRequest);

// Submit monthly request for approval
router.patch('/:id/submit', monthlyRequestController.submitMonthlyRequest);

// Send monthly request to finance (admin only) - support both PUT and POST
router.put('/:id/send-to-finance', 
    checkRole(['admin']), 
    monthlyRequestController.sendToFinance
);

router.post('/:id/send-to-finance', 
    checkRole(['admin']), 
    monthlyRequestController.sendToFinance
);

// Send template to finance for specific month approval (admin only)
router.post('/templates/:templateId/send-to-finance', 
    checkRole(['admin']), 
    monthlyRequestController.sendToFinance
);

// Finance approve monthly request with expense creation
router.patch('/:id/finance-approve', 
    checkRole(['admin', 'finance', 'finance_admin', 'finance_user']), 
    monthlyRequestController.financeApproveMonthlyRequest
);

// Get monthly requests pending finance approval
router.get('/finance/pending', 
    checkRole(['admin', 'finance', 'finance_admin', 'finance_user']), 
    monthlyRequestController.getPendingFinanceApproval
);

// Approve monthly request (finance and admin)
router.patch('/:id/approve', 
    checkRole(['admin', 'finance', 'finance_admin', 'finance_user']), 
    monthlyRequestController.approveMonthlyRequest
);

// Submit template for specific month approval (admin only)
router.post('/:id/submit-month', 
    checkRole(['admin']), 
    monthlyRequestController.submitTemplateForMonth
);

// Approve/reject template for specific month (finance and admin)
router.post('/:id/approve-month', 
    checkRole(['admin', 'finance', 'finance_admin', 'finance_user']), 
    monthlyRequestController.approveTemplateForMonth
);

// Get monthly approval status for specific month
router.get('/:id/approval-status/:month/:year', 
    monthlyRequestController.getMonthlyApprovalStatus
);

// Reject monthly request (finance and admin)
router.patch('/:id/reject', 
    checkRole(['admin', 'finance', 'finance_admin', 'finance_user']), 
    monthlyRequestController.rejectMonthlyRequest
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