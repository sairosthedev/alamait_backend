const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const { check, validationResult } = require('express-validator');
const maintenanceController = require('../../controllers/student/maintenanceController');

// Apply authentication and role middleware to all routes
router.use(auth);
router.use(checkRole('student'));

// Debug middleware to log request body
router.use((req, res, next) => {
    if (req.method === 'POST' && req.path === '/') {
        console.log('=== STUDENT MAINTENANCE ROUTE DEBUG ===');
        console.log('Request method:', req.method);
        console.log('Request path:', req.path);
        console.log('Request body:', req.body);
        console.log('Request headers:', req.headers);
        console.log('User:', req.user ? { id: req.user._id, email: req.user.email, role: req.user.role } : 'No user');
        
        // Normalize field names - handle both 'title' and 'issue'
        if (req.body.issue && !req.body.title) {
            console.log('NORMALIZING: Moving issue to title');
            req.body.title = req.body.issue;
            delete req.body.issue;
        } else if (req.body.issue && req.body.title) {
            console.log('NORMALIZING: Both issue and title present, using title, removing issue');
            delete req.body.issue;
        }
        
        // Temporary fix: Move priority from headers to body if it's incorrectly sent in headers
        if (req.headers.priority && !req.body.priority) {
            console.log('FIXING: Moving priority from headers to body');
            console.log('Headers priority:', req.headers.priority);
            req.body.priority = req.headers.priority;
            console.log('Body priority after fix:', req.body.priority);
        }
        
        // Check for other fields that might be in headers instead of body
        const fieldsToCheck = ['title', 'description', 'category', 'location', 'residenceId'];
        fieldsToCheck.forEach(field => {
            if (req.headers[field] && !req.body[field]) {
                console.log(`FIXING: Moving ${field} from headers to body`);
                console.log(`Headers ${field}:`, req.headers[field]);
                req.body[field] = req.headers[field];
                console.log(`Body ${field} after fix:`, req.body[field]);
            }
        });
        
        console.log('Final request body after normalization:', req.body);
    }
    next();
});

// Validation middleware for maintenance requests
const validateMaintenanceRequest = [
    check('title').trim().notEmpty().withMessage('Title is required'),
    check('description').trim().notEmpty().withMessage('Description is required'),
    check('category').isIn(['plumbing', 'electrical', 'hvac', 'appliance', 'structural', 'other'])
        .withMessage('Invalid category'),
    // Only validate priority from the body, not headers
    (req, res, next) => {
        if (req.body.priority !== undefined) {
            const allowed = ['low', 'medium', 'high'];
            if (!allowed.includes(req.body.priority)) {
                return res.status(400).json({
                    errors: [{
                        type: 'field',
                        value: req.body.priority,
                        msg: 'Invalid priority level',
                        path: 'priority',
                        location: 'body'
                    }],
                    debug: {
                        bodyPriority: req.body.priority,
                        message: 'Priority must be one of low, medium, high if provided.'
                    }
                });
            }
        }
        next();
    },
    check('location').trim().notEmpty().withMessage('Location is required'),
    // Debug middleware to log validation results
    (req, res, next) => {
        console.log('=== VALIDATION DEBUG ===');
        console.log('Request body:', req.body);
        console.log('Request headers:', req.headers);
        console.log('Title in body:', req.body.title);
        console.log('Issue in body:', req.body.issue);
        console.log('Priority in body:', req.body.priority);
        console.log('Priority in headers:', req.headers.priority);
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('=== VALIDATION ERRORS ===');
            console.log('Validation errors:', errors.array());
            console.log('Request body received:', req.body);
            return res.status(400).json({ 
                errors: errors.array(),
                debug: {
                    bodyPriority: req.body.priority,
                    headerPriority: req.headers.priority,
                    bodyTitle: req.body.title,
                    bodyIssue: req.body.issue,
                    message: 'Check field names and ensure data is in request body, not headers'
                }
            });
        }
        console.log('=== VALIDATION PASSED ===');
        next();
    }
];

// Get all maintenance requests
router.get('/', maintenanceController.getMaintenanceRequests);

// Create new maintenance request
router.post('/', validateMaintenanceRequest, maintenanceController.createMaintenanceRequest);

// Get single maintenance request details
router.get('/:requestId', maintenanceController.getMaintenanceRequestDetails);

// Update maintenance request
router.put('/:requestId', validateMaintenanceRequest, maintenanceController.updateMaintenanceRequest);

// Cancel maintenance request
router.delete('/:requestId', maintenanceController.cancelMaintenanceRequest);

module.exports = router; 