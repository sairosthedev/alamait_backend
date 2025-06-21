const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Residence = require('../../models/Residence');
const mongoose = require('mongoose');

// Use memoryStorage to process the file in memory before saving
const storage = multer.memoryStorage();

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

// This handler now saves the file from memory to disk
exports.uploadLeaseTemplate = (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Please select a file' });
    }

    try {
        const residenceId = req.body.residenceId;
        const filename = `lease_agreement_${residenceId}.docx`;
        const outputPath = path.join(__dirname, '..', '..', '..', 'uploads', filename);

        // Manually write the file from the buffer to the disk
        fs.writeFileSync(outputPath, req.file.buffer);

        res.status(200).json({ 
            message: `Lease agreement template for residence ${residenceId} uploaded successfully` 
        });

    } catch (error) {
        console.error('Error saving lease template from memory:', error);
        res.status(500).json({ error: 'Failed to save the uploaded file.' });
    }
}; 