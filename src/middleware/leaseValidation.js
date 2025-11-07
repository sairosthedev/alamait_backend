const { body, param } = require('express-validator');

/**
 * Validation middleware for lease update endpoints
 */

// Validate student ID parameter
exports.validateStudentId = [
    param('studentId')
        .isMongoId()
        .withMessage('Student ID must be a valid MongoDB ObjectId')
];

// Validate lease date updates
exports.validateLeaseDates = [
    body('startDate')
        .notEmpty()
        .withMessage('Start date is required')
        .isISO8601()
        .withMessage('Start date must be a valid ISO 8601 date')
        .custom((value) => {
            const date = new Date(value);
            const now = new Date();
            const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
            
            if (date < oneYearAgo) {
                throw new Error('Start date cannot be more than one year in the past');
            }
            
            return true;
        }),
    
    body('endDate')
        .notEmpty()
        .withMessage('End date is required')
        .isISO8601()
        .withMessage('End date must be a valid ISO 8601 date')
        .custom((value) => {
            const date = new Date(value);
            const now = new Date();
            const twoYearsFromNow = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
            
            if (date > twoYearsFromNow) {
                throw new Error('End date cannot be more than two years in the future');
            }
            
            return true;
        })
        .custom((value, { req }) => {
            if (req.body.startDate) {
                const startDate = new Date(req.body.startDate);
                const endDate = new Date(value);
                
                if (startDate >= endDate) {
                    throw new Error('End date must be after start date');
                }
            }
            
            return true;
        })
];

// Validate bulk lease updates
exports.validateBulkLeaseUpdates = [
    body('updates')
        .isArray({ min: 1 })
        .withMessage('Updates must be a non-empty array'),
    
    body('updates.*.studentId')
        .isMongoId()
        .withMessage('Each student ID must be a valid MongoDB ObjectId'),
    
    body('updates.*.startDate')
        .notEmpty()
        .withMessage('Start date is required for each update')
        .isISO8601()
        .withMessage('Start date must be a valid ISO 8601 date'),
    
    body('updates.*.endDate')
        .notEmpty()
        .withMessage('End date is required for each update')
        .isISO8601()
        .withMessage('End date must be a valid ISO 8601 date')
        .custom((value, { req, path }) => {
            // Extract the index from the path (e.g., "updates.0.endDate" -> "0")
            const index = path.split('.')[1];
            const startDate = req.body.updates[index]?.startDate;
            
            if (startDate) {
                const start = new Date(startDate);
                const end = new Date(value);
                
                if (start >= end) {
                    throw new Error(`End date must be after start date for update ${index}`);
                }
            }
            
            return true;
        })
];





