const multer = require('multer');

// Configure multer for Excel file uploads
const excelUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow Excel files
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'application/vnd.ms-excel.sheet.macroEnabled.12', // .xlsm
            'application/vnd.ms-excel.template.macroEnabled.12' // .xltm
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only Excel files (.xlsx, .xls, .xlsm, .xltm) are allowed.'), false);
        }
    }
});

module.exports = excelUpload;
