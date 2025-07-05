require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const { initCronJobs } = require('./utils/cronJobs');

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
const financeResidenceRoutes = require('./routes/finance/residenceRoutes');
const leaseTemplateRoutes = require('./routes/admin/leaseTemplateRoutes');
const adminLeaseRoutes = require('./routes/admin/leaseRoutes');

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
const financeIndexRoutes = require('./routes/finance/index');

const monitoringRoutes = require('./routes/monitoring');

const app = express();

// Initialize cron jobs
initCronJobs();

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://alamait-frontend.vercel.app',
  'https://alamait.vercel.app'
];

// Enable CORS for all routes
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-CSRF-Token'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // 24 hours
}));

// Handle preflight requests
app.options('*', cors());

// Log all incoming requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  next();
});

// Parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/applications', publicApplicationRoutes);

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
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/reports', adminReportRoutes);
app.use('/api/admin/residences', adminResidenceRoutes);
app.use('/api/admin/students', adminStudentRoutes);
app.use('/api/admin/applications', adminApplicationRoutes);
app.use('/api/admin/payments', adminPaymentRoutes);
app.use('/api/admin/profile', adminProfileRoutes);
app.use('/api/admin/messages', adminMessageRoutes);
app.use('/api/admin/events', adminEventRoutes);
app.use('/api/admin/lease-templates', leaseTemplateRoutes);
app.use('/api/admin/leases', adminLeaseRoutes);
// Generic admin routes last
app.use('/api/admin', adminRoutes);

// General lease routes
const leaseRoutes = require('./routes/leaseRoutes');
app.use('/api/leases', leaseRoutes);

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

// Finance maintenance routes
const financeMaintenanceRoutes = require('./routes/finance/maintenanceRoutes');
app.use('/api/finance/maintenance', financeMaintenanceRoutes);

// Finance index routes (for student-specific endpoints) - last to avoid conflicts
app.use('/api/finance', financeIndexRoutes);

// Monitoring routes
app.use('/api/monitoring', monitoringRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Not Found',
        path: req.path
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

module.exports = app;