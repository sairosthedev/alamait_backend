const express = require('express');
const router = express.Router();
const multer = require('multer');
const monthlyRequestController = require('../controllers/monthlyRequestController');
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

// Get all monthly requests (filtered by user role and residence)
router.get('/', monthlyRequestController.getAllMonthlyRequests);

// Get monthly request by ID
router.get('/:id', monthlyRequestController.getMonthlyRequestById);

// Get monthly requests for a specific residence and month/year
router.get('/residence/:residenceId/:month/:year', monthlyRequestController.getMonthlyRequestsByResidence);

// Get templates for a residence
router.get('/templates/:residence', monthlyRequestController.getTemplates);

// Create new monthly request
router.post('/', monthlyRequestController.createMonthlyRequest);

// Create monthly request from template
router.post('/templates/:templateId', monthlyRequestController.createFromTemplate);

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

// Delete monthly request (admin or submitter only)
router.delete('/:id', monthlyRequestController.deleteMonthlyRequest);

module.exports = router; 