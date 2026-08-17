const multer = require('multer');
const path = require('path');

const ALLOWED_MIMES = new Set([
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'application/vnd.ms-excel.sheet.macroEnabled.12', // .xlsm
    'application/octet-stream', // some browsers send this for .xlsx
    'text/csv',
    'application/csv',
    'text/plain' // some browsers send CSV as text/plain
]);

const ALLOWED_EXTS = new Set(['.xlsx', '.xls', '.xlsm', '.xltm', '.csv']);

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
        cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) or CSV (.csv) files are allowed.'), false);
    }
});

module.exports = excelUpload;
