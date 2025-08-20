const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const ReapplicationService = require('../../services/reapplicationService');

// Validation middleware for re-application
const reapplicationValidation = [
    check('email', 'Please include a valid email').isEmail().normalizeEmail(),
    check('firstName', 'First name is required').notEmpty().trim(),
    check('lastName', 'Last name is required').notEmpty().trim(),
    check('phone', 'Phone number is required').notEmpty().trim(),
    check('preferredRoom', 'Preferred room is required').notEmpty().trim(),
    check('startDate', 'Start date is required').isISO8601().toDate(),
    check('endDate', 'End date is required').isISO8601().toDate(),
    check('residence', 'Residence ID is required').isMongoId()
];

// Check if a student can re-apply
router.get('/check-eligibility/:email', async (req, res) => {
    try {
        const { email } = req.params;
        
        if (!email) {
            return res.status(400).json({ 
                error: 'Email parameter is required' 
            });
        }
        
        const eligibility = await ReapplicationService.checkReapplicationEligibility(email);
        
        res.json({
            success: true,
            data: eligibility
        });
        
    } catch (error) {
        console.error('Error checking re-application eligibility:', error);
        res.status(500).json({ 
            error: 'Failed to check eligibility',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Submit a re-application
router.post('/submit', reapplicationValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed',
                details: errors.array() 
            });
        }
        
        const reapplicationData = {
            email: req.body.email,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            phone: req.body.phone,
            preferredRoom: req.body.preferredRoom,
            startDate: req.body.startDate,
            endDate: req.body.endDate,
            residence: req.body.residence,
            reason: req.body.reason || 'Renewal application',
            alternateRooms: req.body.alternateRooms || [],
            additionalInfo: req.body.additionalInfo || {}
        };
        
        const result = await ReapplicationService.createReapplication(reapplicationData);
        
        res.status(201).json({
            success: true,
            message: result.message,
            data: {
                applicationCode: result.reapplication.applicationCode,
                email: result.reapplication.email,
                status: result.reapplication.status,
                isReapplication: result.reapplication.isReapplication,
                previousFinancialSummary: result.reapplication.previousFinancialSummary
            }
        });
        
    } catch (error) {
        console.error('Error submitting re-application:', error);
        res.status(500).json({ 
            error: 'Failed to submit re-application',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get re-application summary
router.get('/summary/:applicationId', async (req, res) => {
    try {
        const { applicationId } = req.params;
        
        if (!applicationId) {
            return res.status(400).json({ 
                error: 'Application ID is required' 
            });
        }
        
        const summary = await ReapplicationService.getReapplicationSummary(applicationId);
        
        res.json({
            success: true,
            data: summary
        });
        
    } catch (error) {
        console.error('Error getting re-application summary:', error);
        res.status(500).json({ 
            error: 'Failed to get re-application summary',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Link re-application to financial history (admin only)
router.post('/link/:applicationId', async (req, res) => {
    try {
        const { applicationId } = req.params;
        
        if (!applicationId) {
            return res.status(400).json({ 
                error: 'Application ID is required' 
            });
        }
        
        const result = await ReapplicationService.linkToFinancialHistory(applicationId);
        
        res.json({
            success: true,
            message: result.message,
            data: {
                debtorCode: result.debtorCode,
                applicationId: applicationId
            }
        });
        
    } catch (error) {
        console.error('Error linking re-application:', error);
        res.status(500).json({ 
            error: 'Failed to link re-application',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;
