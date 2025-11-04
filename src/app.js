require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const { initCronJobs } = require('./utils/cronJobs');
const { auditMiddleware } = require('./middleware/auditMiddleware');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Load Swagger document
const swaggerDocument = YAML.load(path.join(__dirname, '../swagger.yaml'));

// Update Swagger host and schemes based on environment
if (process.env.NODE_ENV === 'production') {
    swaggerDocument.host = 'alamait-backend.onrender.com';
    swaggerDocument.schemes = ['https'];
} else {
    swaggerDocument.host = 'localhost:5000';
    swaggerDocument.schemes = ['http'];
}

// Import routes
const authRoutes = require('./routes/auth');
const publicApplicationRoutes = require('./routes/public/applicationRoutes');
const reapplicationRoutes = require('./routes/public/reapplicationRoutes');
const publicResidenceRoutes = require('./routes/public/residenceRoutes');
const residenceRoutes = require('./routes/residenceRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const maintenanceStaffRoutes = require('./routes/maintenanceStaffRoutes');
const maintenanceCategoryRoutes = require('./routes/maintenanceCategoryRoutes');

// Admin routes
const adminUserRoutes = require('./routes/admin/userRoutes');
const adminReportRoutes = require('./routes/admin/reportRoutes');
const adminResidenceRoutes = require('./routes/admin/residenceRoutes');
const adminRoutes = require('./routes/admin/adminRoutes');
const adminStudentRoutes = require('./routes/admin/studentRoutes');
const adminApplicationRoutes = require('./routes/admin/applicationRoutes');
const adminPaymentRoutes = require('./routes/admin/paymentRoutes');
const adminProfileRoutes = require('./routes/admin/adminProfileRoutes');
const adminMessageRoutes = require('./routes/admin/messageRoutes');
const adminEventRoutes = require('./routes/admin/eventRoutes');
const adminExpenseRoutes = require('./routes/admin/expenseRoutes');
const adminIncomeRoutes = require('./routes/admin/incomeRoutes');
const adminRequestRoutes = require('./routes/admin/requestRoutes');
const financeResidenceRoutes = require('./routes/finance/residenceRoutes');
const leaseTemplateRoutes = require('./routes/admin/leaseTemplateRoutes');
const adminLeaseRoutes = require('./routes/admin/leaseRoutes');
const studentStatusRoutes = require('./routes/admin/studentStatusRoutes');
const adminReportUploadRoutes = require('./routes/admin/reportUploadRoutes');
const adminDeletionLogRoutes = require('./routes/admin/deletionLogRoutes');

// CEO routes
const ceoRoutes = require('./routes/ceo/index');
const ceoReportUploadRoutes = require('./routes/ceo/reportUploadRoutes');
const ceoDeletionLogRoutes = require('./routes/ceo/deletionLogRoutes');

// Student routes
const studentBookingRoutes = require('./routes/student/bookingRoutes');
const studentMaintenanceRoutes = require('./routes/student/maintenanceRoutes');
const studentEventRoutes = require('./routes/student/eventRoutes');
const studentMessageRoutes = require('./routes/student/messageRoutes');
const studentRoutes = require('./routes/student/studentRoutes');
const studentDashboardRoutes = require('./routes/student/dashboardRoutes');
const bookingDetailsRoutes = require('./routes/student/bookingDetailsRoutes');
const paymentHistoryRoutes = require('./routes/student/paymentHistoryRoutes');
const studentResidenceRoutes = require('./routes/student/residenceRoutes');

// Property Manager routes
const propertyManagerResidenceRoutes = require('./routes/property_manager/residenceRoutes');
const propertyManagerMaintenanceRoutes = require('./routes/property_manager/maintenanceRoutes');
const propertyManagerEventRoutes = require('./routes/property_manager/eventRoutes');

// Finance routes
const financeExpenseRoutes = require('./routes/finance/expenseRoutes');
const financeBalanceSheetRoutes = require('./routes/finance/balanceSheetRoutes');
const financeIncomeStatementRoutes = require('./routes/finance/incomeStatementRoutes');
const financeDashboardRoutes = require('./routes/finance/dashboardRoutes');
const financePaymentRoutes = require('./routes/finance/paymentRoutes');
const financeLeaseRoutes = require('./routes/finance/leaseRoutes');
const financeApplicationRoutes = require('./routes/finance/applicationRoutes');
const financeRoomPriceRoutes = require('./routes/finance/roomPriceRoutes');
const financeOtherIncomeRoutes = require('./routes/finance/otherIncomeRoutes');
const financeOtherExpenseRoutes = require('./routes/finance/otherExpenseRoutes');
const financeReportUploadRoutes = require('./routes/finance/reportUploadRoutes');
const financeIndexRoutes = require('./routes/finance/index');
const financeUsersRoutes = require('./routes/finance/users');
const debtorRoutes = require('./routes/finance/debtorRoutes');
const refundRoutes = require('./routes/finance/refundRoutes');
const depreciationRoutes = require('./routes/finance/depreciationRoutes');

const monitoringRoutes = require('./routes/monitoring');
const accountRoutes = require('./routes/accountRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const reportRoutes = require('./routes/reportRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const requestRoutes = require('./routes/requestRoutes');
const monthlyRequestRoutes = require('./routes/monthlyRequestRoutes');

const app = express();

// Initialize cron jobs
initCronJobs();

// Initialize student status job
const StudentStatusJob = require('./jobs/studentStatusJob');
StudentStatusJob.initialize();

// Start monthly accrual cron service
const monthlyAccrualCronService = require('./services/monthlyAccrualCronService');

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://alamait-frontend.vercel.app',
  'https://alamait.vercel.app'
];

// Add environment variable origins if specified
if (process.env.FRONTEND_URL) {
  const envOrigins = process.env.FRONTEND_URL.split(',').map(url => url.trim());
  allowedOrigins.push(...envOrigins);
}

// Add any additional origins from environment
if (process.env.ALLOWED_ORIGINS) {
  const additionalOrigins = process.env.ALLOWED_ORIGINS.split(',').map(url => url.trim());
  allowedOrigins.push(...additionalOrigins);
}

console.log('🌐 CORS allowed origins:', allowedOrigins);

// CORS configuration object
const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      console.warn(`⚠️ CORS: Blocked origin: ${origin}`);
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    console.log(`✅ CORS: Allowed origin: ${origin}`);
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-CSRF-Token'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Enable CORS for all routes
app.use(cors(corsOptions));

// Manual CORS handler as fallback (especially for preflight requests)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Check if origin is allowed (normalize by removing trailing slashes)
  const normalizedOrigin = origin ? origin.replace(/\/$/, '') : null;
  const isAllowedOrigin = normalizedOrigin && allowedOrigins.some(allowed => 
    allowed.replace(/\/$/, '') === normalizedOrigin
  );
  
  if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, X-Content-Range');
    res.setHeader('Access-Control-Max-Age', '86400');
    
    // Handle preflight OPTIONS requests
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
  }
  
  next();
});

// Handle preflight requests explicitly with the same CORS configuration
app.options('*', cors(corsOptions));

// Log all incoming requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  next();
});

// Parse JSON bodies with increased limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Add audit middleware to log all API requests
app.use(auditMiddleware);

// Add timeout middleware for file upload routes
app.use('/api/student/payments', (req, res, next) => {
  // Set longer timeout for file upload routes
  if (req.method === 'POST' && (req.path.includes('upload-pop') || req.path.includes('upload'))) {
    req.setTimeout(60000); // 60 seconds for file uploads
    res.setTimeout(60000);
  }
  next();
});

app.use('/api/student/lease', (req, res, next) => {
  // Set longer timeout for lease upload routes
  if (req.method === 'POST' && req.path.includes('upload')) {
    req.setTimeout(60000); // 60 seconds for file uploads
    res.setTimeout(60000);
  }
  next();
});

// Add timeout middleware for lease-agreement endpoint
app.use('/api/student/lease-agreement', (req, res, next) => {
  // Set longer timeout for lease agreement routes
  if (req.method === 'POST' && req.path.includes('upload')) {
    req.setTimeout(60000); // 60 seconds for file uploads
    res.setTimeout(60000);
  }
  next();
});

// Add timeout middleware for request routes
app.use('/api/requests', (req, res, next) => {
  // Generic extended timeout for creating requests (covers heavy processing)
  if (req.method === 'POST') {
    req.setTimeout(300000); // 5 minutes for all request creations
    res.setTimeout(300000);
  }
  // Keep a specific note for finance requests
  if (req.method === 'POST' && req.body && req.body.type === 'financial') {
    console.log('🕐 Extended timeout for finance request via /requests endpoint');
  }
  next();
});

// Add timeout middleware for salary request routes
app.use('/api/finance/employees', (req, res, next) => {
  // Set longer timeout for salary request creation
  if (req.method === 'POST' && (req.path.includes('salary-requests') || req.path.includes('salary-request'))) {
    req.setTimeout(300000); // 5 minutes for salary request operations
    res.setTimeout(300000);
  }
  next();
});

// Basic route for root path
app.get('/', (req, res) => {
    res.json({ 
        message: 'Welcome to Alamait Property Management System API',
        documentation: '/api-docs',
        health: '/health'
    });
});

// Health check route
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok',
        timestamp: new Date(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV
    });
});

// Swagger UI with custom options
const swaggerOptions = {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "Alamait API Documentation",
    customfavIcon: "/favicon.ico"
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));

// Public routes
app.use('/api/public/applications', publicApplicationRoutes);
app.use('/api/public/residences', publicResidenceRoutes);

// Specific residence routes (must come before generic routes)
app.use('/api/residences', publicResidenceRoutes);

// Generic residence routes (for ID-based lookups)
app.use('/api/residences', residenceRoutes);

// Alias routes for frontend compatibility
app.use('/api/applications/public', publicApplicationRoutes);

// Add alias routes for dashboard endpoints
app.use('/api/applications', adminApplicationRoutes);
app.use('/api/messages', adminMessageRoutes);

// Re-application routes for existing students
app.use('/api/reapplications', reapplicationRoutes);

// Maintenance routes with debugging
// Define specific routes first
app.use('/api/maintenance/staff', (req, res, next) => {
    console.log('Maintenance staff route hit:', req.method, req.path);
    next();
}, maintenanceStaffRoutes);

app.use('/api/maintenance/categories', (req, res, next) => {
    console.log('Maintenance categories route hit:', req.method, req.path);
    next();
}, maintenanceCategoryRoutes);

// Then define the generic maintenance routes
app.use('/api/maintenance', (req, res, next) => {
    console.log('Maintenance route hit:', req.method, req.path);
    next();
}, maintenanceRoutes);

// Health check route for booking details
app.get('/api/student/bookingdetails/health', (req, res) => {
    ('Health check requested for booking details service');
    res.json({ status: 'ok', message: 'Booking details service is running' });
});

// Auth routes (public)
app.use('/api/auth', authRoutes);

// Admin routes - more specific routes first
app.use('/api/admin/expenses', adminExpenseRoutes);
app.use('/api/admin/income', adminIncomeRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/reports', adminReportRoutes);
app.use('/api/admin/residences', adminResidenceRoutes);

// Residence Payment Configuration routes
const residencePaymentRoutes = require('./routes/admin/residencePaymentRoutes');
app.use('/api/admin/residence-payments', residencePaymentRoutes);
app.use('/api/admin/students', adminStudentRoutes);
app.use('/api/admin/applications', adminApplicationRoutes);
app.use('/api/admin/payments', adminPaymentRoutes);
app.use('/api/admin/profile', adminProfileRoutes);
app.use('/api/admin/messages', adminMessageRoutes);
app.use('/api/admin/events', adminEventRoutes);
app.use('/api/admin/requests', adminRequestRoutes);
app.use('/api/admin/lease-templates', leaseTemplateRoutes);
app.use('/api/admin/leases', adminLeaseRoutes);
app.use('/api/admin/students', studentStatusRoutes);

// Payment Allocation routes (FIFO-based payment allocation system)
const adminPaymentAllocationRoutes = require('./routes/admin/paymentAllocationRoutes');
app.use('/api/admin/payment-allocation', adminPaymentAllocationRoutes);

// Generic admin routes last
app.use('/api/admin', adminRoutes);

// Admin report upload routes
app.use('/api/admin/reports', adminReportUploadRoutes);

// Admin deletion log routes
app.use('/api/admin/deletions', adminDeletionLogRoutes);

// CEO routes
app.use('/api/ceo', ceoRoutes);

// CEO report upload routes
app.use('/api/ceo/reports', ceoReportUploadRoutes);

// CEO deletion log routes
app.use('/api/ceo/deletions', ceoDeletionLogRoutes);

// General lease routes
const leaseRoutes = require('./routes/leaseRoutes');
app.use('/api/leases', leaseRoutes);

// Lease download routes (for ZIP downloads)
const leaseDownloadRoutes = require('./routes/leaseDownloadRoutes');
app.use('/api/lease-downloads', leaseDownloadRoutes);

// Student routes - specific routes first
app.use('/api/student/dashboard', studentDashboardRoutes);
app.use('/api/student/residences', studentResidenceRoutes);
app.use('/api/student/messages', studentMessageRoutes);
app.use('/api/student/maintenance', studentMaintenanceRoutes);
app.use('/api/student/events', studentEventRoutes);
app.use('/api/student/payments', paymentHistoryRoutes);
app.use('/api/student/bookings', studentBookingRoutes);
app.use('/api/student/bookingdetails', bookingDetailsRoutes);
// General student routes last
app.use('/api/student', studentRoutes);

// Property Manager routes
app.use('/api/property-manager/residences', propertyManagerResidenceRoutes);
app.use('/api/property-manager/maintenance', propertyManagerMaintenanceRoutes);
app.use('/api/property-manager/events', propertyManagerEventRoutes);

// Finance routes - specific routes first, then index routes
app.use('/api/finance/expenses', financeExpenseRoutes);
app.use('/api/finance/balance-sheets', financeBalanceSheetRoutes);
app.use('/api/finance/income-statements', financeIncomeStatementRoutes);
app.use('/api/finance/dashboard', financeDashboardRoutes);
app.use('/api/finance/payments', financePaymentRoutes);
app.use('/api/finance/residences', financeResidenceRoutes);
app.use('/api/finance/leases', financeLeaseRoutes);
app.use('/api/finance/applications', financeApplicationRoutes);
app.use('/api/finance/room-prices', financeRoomPriceRoutes);
app.use('/api/finance/other-income', financeOtherIncomeRoutes);
app.use('/api/finance/other-expenses', financeOtherExpenseRoutes);
app.use('/api/finance/reports', financeReportUploadRoutes);
app.use('/api/finance/users', financeUsersRoutes);

// Refunds endpoints
app.use('/api/finance/refunds', refundRoutes);

// Depreciation endpoints
app.use('/api/finance/depreciation', depreciationRoutes);

// NEW: Proper Accounting Routes (GAAP-compliant financial statements)
const properAccountingRoutes = require('./routes/finance/properAccountingRoutes');
app.use('/api/finance/proper-accounting', properAccountingRoutes);

// NEW: Separate financial reporting routes
const financeCashFlowRoutes = require('./routes/finance/cashFlowRoutes');
const financeTrialBalanceRoutes = require('./routes/finance/trialBalanceRoutes');
const financeIncomeRoutes = require('./routes/finance/incomeRoutes');
app.use('/api/finance/cash-flow', financeCashFlowRoutes);
app.use('/api/finance/trial-balance', financeTrialBalanceRoutes);
app.use('/api/finance/income', financeIncomeRoutes);

// Financial Reports routes
const financialReportsRoutes = require('./routes/financialReportsRoutes');
app.use('/api/financial-reports', financialReportsRoutes);

// Rental Accrual routes
const rentalAccrualRoutes = require('./routes/rentalAccrualRoutes');
app.use('/api/rental-accrual', rentalAccrualRoutes);

// Accounting routes (Accrual vs Cash Basis)
const accountingRoutes = require('./routes/accountingRoutes');
app.use('/api/accounting', accountingRoutes);

// Transaction creation routes
const transactionCreationRoutes = require('./routes/finance/transactionRoutes');
app.use('/api/finance/transactions', transactionCreationRoutes);

// General expense routes (alias for frontend compatibility)
app.use('/api/expenses', financeExpenseRoutes);

// Debtor routes (Accounts Receivable) - must be before finance index routes
app.use('/api/finance/debtors', debtorRoutes);

// Finance student account management routes
const studentAccountRoutes = require('./routes/finance/studentAccountRoutes');
app.use('/api/finance/student-accounts', studentAccountRoutes);

// Finance account management routes
const financeAccountRoutes = require('./routes/finance/accountRoutes');
const { auth } = require('./middleware/auth');
app.use('/api/finance/accounts', auth, financeAccountRoutes);

// Petty Cash routes
const pettyCashRoutes = require('./routes/finance/pettyCashRoutes');
app.use('/api/finance/petty-cash', pettyCashRoutes);

// Finance index routes (for student-specific endpoints) - last to avoid conflicts
app.use('/api/finance', financeIndexRoutes);

// Finance maintenance routes - mounted after index routes to ensure specific routes take precedence
const financeMaintenanceRoutes = require('./routes/finance/maintenanceRoutes');
app.use('/api/finance/maintenance', financeMaintenanceRoutes);

// Monitoring routes
app.use('/api/monitoring', monitoringRoutes);

// Accounts routes
app.use('/api/accounts', accountRoutes);

// Transactions routes
app.use('/api/transactions', transactionRoutes);

// Invoices routes
app.use('/api/invoices', invoiceRoutes);

// Request routes
app.use('/api/requests', requestRoutes);
app.use('/api/maintenance-requests', requestRoutes); // Alias for frontend compatibility
app.use('/api/monthly-requests', monthlyRequestRoutes);

// Installment Payment routes (for installment-based monthly request payments)
const installmentPaymentRoutes = require('./routes/installmentPaymentRoutes');
app.use('/api/installment-payments', installmentPaymentRoutes);

// Monthly Request Deduction routes (for admin to create maintenance requests from approved monthly requests)
const monthlyRequestDeductionRoutes = require('./routes/monthlyRequestDeductionRoutes');
app.use('/api/monthly-request-deductions', monthlyRequestDeductionRoutes);

// Vendor routes
const vendorRoutes = require('./routes/vendorRoutes');
app.use('/api/vendors', vendorRoutes);


// 404 handler
app.use(notFoundHandler);

// Error handling middleware
app.use(errorHandler);

// Monthly accrual cron service will be started in index.js after database connection

module.exports = app;