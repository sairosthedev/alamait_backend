const multer = require('multer');
const path = require('path');

const ALLOWED_MIMES = new Set([
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'application/vnd.ms-excel.sheet.macroEnabled.12', // .xlsm
    'application/octet-stream' // some browsers send this for .xlsx
]);

const ALLOWED_EXTS = new Set(['.xlsx', '.xls', '.xlsm', '.xltm']);

const excelUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (ALLOWED_EXTS.has(ext) || ALLOWED_MIMES.has(file.mimetype)) {
            return cb(null, true);
        }
        cb(new Error('Invalid file type. Only Excel files (.xlsx, .xls) are allowed.'), false);
    }
});

module.exports = excelUpload;
