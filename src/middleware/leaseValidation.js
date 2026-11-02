const mongoose = require('mongoose');
const { body, param, validationResult } = require('express-validator');

function isPlaceholderTenantId(value) {
    const s = String(value ?? '').trim();
    return !s || s === 'N/A' || s === 'null' || s === 'undefined';
}

exports.handleLeaseValidation = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: errors.array()[0]?.msg || 'Validation failed',
            errors: errors.array()
        });
    }
    next();
};

/**
 * Resolve application / debtor / student id for lease reconciliation (query or path).
 * Rejects placeholders like "N/A" when tenant has no User account.
 */
function pickReconciliationIdentifier(req) {
    const candidates = [
        req.params.applicationId,
        req.params.debtorId,
        req.params.studentId,
        req.params.id,
        req.query.applicationId,
        req.query.application,
        req.query.debtorId,
        req.query.debtor,
        req.query.id,
        req.query.tenantId,
        req.query.studentId
    ];

    for (const raw of candidates) {
        if (isPlaceholderTenantId(raw)) continue;
        const s = String(raw).trim();
        if (mongoose.Types.ObjectId.isValid(s)) return s;
    }
    return null;
}

exports.resolveReconciliationIdentifier = (req, res, next) => {
    const id = pickReconciliationIdentifier(req);

    if (!id) {
        const hadPlaceholderStudent =
            isPlaceholderTenantId(req.params.studentId) ||
            isPlaceholderTenantId(req.query.studentId);

        return res.status(400).json({
            success: false,
            message: hadPlaceholderStudent
                ? 'This tenant has no student login (studentId is N/A). Pass debtorId or applicationId on the request.'
                : 'Missing tenant identifier for lease reconciliation (debtorId or applicationId).',
            data: {
                financeExamples: [
                    '/api/finance/leases/debtors/{debtorId}/reconciliation',
                    '/api/finance/leases/applications/{applicationId}/reconciliation',
                    '/api/finance/leases/reconciliation?debtorId={debtorId}',
                    '/api/finance/leases/reconciliation?applicationId={applicationId}',
                    '/api/finance/debtors/{debtorId}/reconciliation'
                ]
            }
        });
    }

    req.reconciliationIdentifier = id;
    next();
};

/**
 * Validation middleware for lease update endpoints
 */

// Validate student ID parameter
exports.validateStudentId = [
    param('studentId')
        .isMongoId()
        .withMessage('Student ID must be a valid MongoDB ObjectId')
];

exports.validateApplicationId = [
    param('applicationId')
        .isMongoId()
        .withMessage('Application ID must be a valid MongoDB ObjectId')
];

exports.validateDebtorId = [
    param('debtorId')
        .isMongoId()
        .withMessage('Debtor ID must be a valid MongoDB ObjectId')
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











