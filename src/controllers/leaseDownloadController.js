const Lease = require('../models/Lease');
const AWS = require('aws-sdk');
const archiver = require('archiver');

// Configure AWS S3
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
    region: process.env.AWS_REGION || 'eu-north-1'
});

// Download a single lease file
exports.downloadLease = async (req, res) => {
    try {
        const { leaseId } = req.params;
        const user = req.user;

        // Find the lease by ID
        const lease = await Lease.findById(leaseId);
        
        if (!lease) {
            return res.status(404).json({ error: 'Lease not found' });
        }

        // Check if the user has permission to download this lease
        if (user.role !== 'admin' && user.role !== 'finance' && user.role !== 'finance_admin' && user.role !== 'finance_user' && user.role !== 'ceo') {
            if (lease.studentId.toString() !== user._id.toString()) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        // Check if lease has a valid S3 path
        if (!lease.path || !lease.path.startsWith('http')) {
            return res.status(404).json({ error: 'Lease file not available' });
        }

        // Extract S3 key from the URL
        const urlParts = lease.path.split('/');
        const s3Key = urlParts.slice(3).join('/'); // Remove protocol, bucket, and region

        // Get file from S3
        const s3Params = {
            Bucket: process.env.AWS_S3_BUCKET || 'alamait-uploads',
            Key: s3Key
        };

        const s3Object = await s3.getObject(s3Params).promise();
        
        // Set response headers
        res.setHeader('Content-Type', lease.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${lease.originalname || lease.filename}"`);
        res.setHeader('Content-Length', s3Object.ContentLength);

        // Send the file
        res.send(s3Object.Body);

    } catch (error) {
        console.error('Error downloading lease:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Download multiple leases as ZIP
exports.downloadMultipleLeases = async (req, res) => {
    try {
        const { leaseIds } = req.body;
        const user = req.user;

        console.log('🔍 Multiple lease download request:', {
            requestedIds: leaseIds,
            count: leaseIds?.length || 0,
            user: user.email
        });

        if (!leaseIds || !Array.isArray(leaseIds) || leaseIds.length === 0) {
            return res.status(400).json({ error: 'Please provide an array of lease IDs' });
        }

        // Find all requested leases
        const leases = await Lease.find({ _id: { $in: leaseIds } });
        
        console.log('📊 Found leases in database:', {
            requested: leaseIds.length,
            found: leases.length,
            leaseIds: leases.map(l => l._id.toString())
        });

        if (leases.length === 0) {
            return res.status(404).json({ error: 'No leases found' });
        }

        // Check permissions for all leases
        for (const lease of leases) {
            if (user.role !== 'admin' && user.role !== 'finance' && user.role !== 'finance_admin' && user.role !== 'finance_user' && user.role !== 'ceo') {
                if (lease.studentId.toString() !== user._id.toString()) {
                    return res.status(403).json({ error: 'Access denied to one or more leases' });
                }
            }
        }

        // Set response headers for ZIP download
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="leases_${Date.now()}.zip"`);

        // Create ZIP archive
        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(res);

        let addedFiles = 0;
        let skippedFiles = 0;

        // Add each lease to the ZIP
        for (const lease of leases) {
            console.log(`📁 Processing lease ${lease._id}:`, {
                hasPath: !!lease.path,
                pathStartsWithHttp: lease.path?.startsWith('http'),
                pathStartsWithSlash: lease.path?.startsWith('/'),
                filename: lease.originalname || lease.filename,
                studentName: lease.studentName
            });

            if (lease.path) {
                try {
                    let fileBuffer;
                    let s3Key;

                    if (lease.path.startsWith('http')) {
                        // S3 path - extract key and fetch from S3
                        const urlParts = lease.path.split('/');
                        s3Key = urlParts.slice(3).join('/');
                        console.log(`   📤 Fetching from S3: ${s3Key}`);

                        const s3Params = {
                            Bucket: process.env.AWS_S3_BUCKET || 'alamait-uploads',
                            Key: s3Key
                        };

                        const s3Object = await s3.getObject(s3Params).promise();
                        fileBuffer = s3Object.Body;

                    } else if (lease.path.startsWith('/uploads/')) {
                        // Local file path - read from local filesystem
                        const fs = require('fs');
                        const path = require('path');
                        
                        // Convert relative path to absolute path
                        const localPath = path.join(__dirname, '..', '..', lease.path);
                        console.log(`   📁 Reading local file: ${localPath}`);

                        if (fs.existsSync(localPath)) {
                            fileBuffer = fs.readFileSync(localPath);
                        } else {
                            console.log(`   ❌ Local file not found: ${localPath}`);
                            skippedFiles++;
                            continue;
                        }
                    } else {
                        console.log(`   ⚠️ Unknown path format: ${lease.path}`);
                        skippedFiles++;
                        continue;
                    }

                    // Create a meaningful filename for the ZIP
                    const fileName = `${lease.studentName || 'Student'}_${lease.residenceName || 'Residence'}_${lease.originalname || lease.filename}`;
                    
                    console.log(`   ✅ Adding to ZIP: ${fileName}`);
                    
                    // Add file to archive
                    archive.append(fileBuffer, { name: fileName });
                    addedFiles++;

                } catch (error) {
                    console.error(`❌ Error processing lease ${lease._id}:`, error.message);
                    skippedFiles++;
                    // Continue with other files even if one fails
                }
            } else {
                console.log(`   ⚠️ Skipping lease ${lease._id} - no path`);
                skippedFiles++;
            }
        }

        console.log(`📦 ZIP Summary: ${addedFiles} files added, ${skippedFiles} files skipped`);

        // Finalize the archive
        await archive.finalize();

    } catch (error) {
        console.error('❌ Error creating ZIP download:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Download all leases for a specific residence
exports.downloadResidenceLeases = async (req, res) => {
    try {
        const { residenceId } = req.params;
        const user = req.user;

        // Check if user has permission to download residence leases
        if (user.role !== 'admin' && user.role !== 'finance' && user.role !== 'finance_admin' && user.role !== 'finance_user' && user.role !== 'ceo') {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Find all leases for the residence
        const leases = await Lease.find({ residence: residenceId });

        if (leases.length === 0) {
            return res.status(404).json({ error: 'No leases found for this residence' });
        }

        // Set response headers for ZIP download
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="residence_leases_${Date.now()}.zip"`);

        // Create ZIP archive
        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(res);

        let addedFiles = 0;
        let skippedFiles = 0;

        // Add each lease to the ZIP
        for (const lease of leases) {
            if (lease.path) {
                try {
                    let fileBuffer;

                    if (lease.path.startsWith('http')) {
                        // S3 path - extract key and fetch from S3
                        const urlParts = lease.path.split('/');
                        const s3Key = urlParts.slice(3).join('/');

                        const s3Params = {
                            Bucket: process.env.AWS_S3_BUCKET || 'alamait-uploads',
                            Key: s3Key
                        };

                        const s3Object = await s3.getObject(s3Params).promise();
                        fileBuffer = s3Object.Body;

                    } else if (lease.path.startsWith('/uploads/')) {
                        // Local file path - read from local filesystem
                        const fs = require('fs');
                        const path = require('path');
                        
                        const localPath = path.join(__dirname, '..', '..', lease.path);

                        if (fs.existsSync(localPath)) {
                            fileBuffer = fs.readFileSync(localPath);
                        } else {
                            skippedFiles++;
                            continue;
                        }
                    } else {
                        skippedFiles++;
                        continue;
                    }

                    // Create a meaningful filename for the ZIP
                    const fileName = `${lease.studentName || 'Student'}_${lease.originalname || lease.filename}`;
                    
                    // Add file to archive
                    archive.append(fileBuffer, { name: fileName });
                    addedFiles++;

                } catch (error) {
                    console.error(`Error processing lease ${lease._id}:`, error.message);
                    skippedFiles++;
                    // Continue with other files even if one fails
                }
            } else {
                skippedFiles++;
            }
        }

        // Finalize the archive
        await archive.finalize();

    } catch (error) {
        console.error('Error creating residence ZIP download:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Download all leases (admin/finance only)
exports.downloadAllLeases = async (req, res) => {
    try {
        const user = req.user;

        // Check if user has permission
        if (user.role !== 'admin' && user.role !== 'finance' && user.role !== 'finance_admin' && user.role !== 'finance_user' && user.role !== 'ceo') {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Find all leases
        const leases = await Lease.find({});

        if (leases.length === 0) {
            return res.status(404).json({ error: 'No leases found' });
        }

        // Set response headers for ZIP download
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="all_leases_${Date.now()}.zip"`);

        // Create ZIP archive
        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(res);

        let addedFiles = 0;
        let skippedFiles = 0;

        // Add each lease to the ZIP
        for (const lease of leases) {
            if (lease.path) {
                try {
                    let fileBuffer;

                    if (lease.path.startsWith('http')) {
                        // S3 path - extract key and fetch from S3
                        const urlParts = lease.path.split('/');
                        const s3Key = urlParts.slice(3).join('/');

                        const s3Params = {
                            Bucket: process.env.AWS_S3_BUCKET || 'alamait-uploads',
                            Key: s3Key
                        };

                        const s3Object = await s3.getObject(s3Params).promise();
                        fileBuffer = s3Object.Body;

                    } else if (lease.path.startsWith('/uploads/')) {
                        // Local file path - read from local filesystem
                        const fs = require('fs');
                        const path = require('path');
                        
                        const localPath = path.join(__dirname, '..', '..', lease.path);

                        if (fs.existsSync(localPath)) {
                            fileBuffer = fs.readFileSync(localPath);
                        } else {
                            skippedFiles++;
                            continue;
                        }
                    } else {
                        skippedFiles++;
                        continue;
                    }

                    // Create a meaningful filename for the ZIP
                    const fileName = `${lease.residenceName || 'Residence'}/${lease.studentName || 'Student'}_${lease.originalname || lease.filename}`;
                    
                    // Add file to archive
                    archive.append(fileBuffer, { name: fileName });
                    addedFiles++;

                } catch (error) {
                    console.error(`Error processing lease ${lease._id}:`, error.message);
                    skippedFiles++;
                    // Continue with other files even if one fails
                }
            } else {
                skippedFiles++;
            }
        }

        // Finalize the archive
        await archive.finalize();

    } catch (error) {
        console.error('Error creating all leases ZIP download:', error);
        res.status(500).json({ error: 'Server error' });
    }
}; 