const fs = require('fs');
const path = require('path');

/**
 * Ensures that necessary upload directories exist
 * Creates them if they don't exist
 */
const ensureUploadDirectoriesExist = () => {
    // Base uploads directory
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
        console.log('Creating uploads directory');
        fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Proof of Payment uploads directory
    const popDir = path.join(uploadsDir, 'pop');
    if (!fs.existsSync(popDir)) {
        console.log('Creating uploads/pop directory');
        fs.mkdirSync(popDir, { recursive: true });
    }

    // Add other upload directories as needed
    // const otherDir = path.join(uploadsDir, 'other');
    // if (!fs.existsSync(otherDir)) {
    //     console.log('Creating uploads/other directory');
    //     fs.mkdirSync(otherDir, { recursive: true });
    // }

    console.log('Upload directories verified');
};

module.exports = {
    ensureUploadDirectoriesExist
}; 