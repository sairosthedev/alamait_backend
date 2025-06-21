const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const { uploadMiddleware, uploadLeaseTemplate } = require('../../controllers/admin/leaseTemplateController');
const Residence = require('../../models/Residence');
const mongoose = require('mongoose');

// This validation now runs AFTER multer has parsed the body
const validateResidence = async (req, res, next) => {
    const { residenceId } = req.body;

    if (!residenceId) {
        return res.status(400).json({ error: 'residenceId is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(residenceId)) {
        return res.status(400).json({ error: 'Invalid residenceId format' });
    }

    try {
        const residence = await Residence.findById(residenceId);
        if (!residence) {
            return res.status(404).json({ error: 'Residence not found' });
        }
        req.residence = residence;
        next();
    } catch (error) {
        console.error('Error validating residence:', error);
        res.status(500).json({ error: 'Server error while validating residence' });
    }
};

router.post(
    '/upload-lease-template', 
    auth, 
    checkRole('admin'), 
    uploadMiddleware,      // 1. Multer runs and parses form-data
    validateResidence,     // 2. Validation runs on the parsed body
    uploadLeaseTemplate    // 3. Final response is sent
);

module.exports = router; 