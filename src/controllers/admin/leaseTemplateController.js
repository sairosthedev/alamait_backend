const multer = require('multer');
const path = require('path');
const Residence = require('../../models/Residence');
const mongoose = require('mongoose');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const residenceId = req.body.residenceId;
        // The filename will be lease_agreement_<residenceId>.docx
        cb(null, `lease_agreement_${residenceId}.docx`);
    }
});

// Export the multer middleware directly
exports.uploadMiddleware = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        // Correctly check for .docx mimetype and extension
        const isDocx = file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
                       path.extname(file.originalname).toLowerCase() === '.docx';

        if (isDocx) {
            return cb(null, true);
        }
        
        cb(new Error('File upload only supports .docx format'));
    }
}).single('leaseTemplate');

// A new handler for after the upload and validation are complete
exports.uploadLeaseTemplate = (req, res) => {
    if (!req.file) {
        // This check is a fallback, multer should catch this earlier.
        return res.status(400).json({ error: 'Please select a file' });
    }
    res.status(200).json({ 
        message: `Lease agreement template for residence ${req.body.residenceId} uploaded successfully` 
    });
}; 