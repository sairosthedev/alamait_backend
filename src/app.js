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

// Student routes
const studentBookingRoutes = require('./routes/student/bookingRoutes');
const studentMaintenanceRoutes = require('./routes/student/maintenanceRoutes');
const studentEventRoutes = require('./routes/student/eventRoutes');
const studentMessageRoutes = require('./routes/student/messageRoutes');
const studentRoutes = require('./routes/student/studentRoutes');
const studentDashboardRoutes = require('./routes/student/dashboardRoutes');
const bookingDetailsRoutes = require('./routes/student/bookingDetailsRoutes');
const paymentHistoryRoutes = require('./routes/student/paymentHistoryRoutes');

// Property Manager routes
const propertyManagerResidenceRoutes = require('./routes/property_manager/residenceRoutes');
const propertyManagerMaintenanceRoutes = require('./routes/property_manager/maintenanceRoutes');
const propertyManagerEventRoutes = require('./routes/property_manager/eventRoutes');

const app = express();

// Initialize cron jobs
initCronJobs();

// CORS configuration
const corsOptions = {
    origin: function(origin, callback) {
        const allowedOrigins = process.env.NODE_ENV === 'production'
            ? ['https://alamait.vercel.app', 'https://alamait-admin.vercel.app']
            : ['http://localhost:5173', 'http://localhost:3000'];
        
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204
};

// Middleware
app.use(cors(corsOptions));

// Add additional headers middleware
app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = process.env.NODE_ENV === 'production'
        ? ['https://alamait.vercel.app', 'https://alamait-admin.vercel.app']
        : ['http://localhost:5173', 'http://localhost:3000'];
    
    if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    
    next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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
app.use('/api/applications', publicApplicationRoutes);
app.use('/api/residences', publicResidenceRoutes);
app.use('/api/maintenance/staff', maintenanceStaffRoutes);
app.use('/api/maintenance/categories', maintenanceCategoryRoutes);
app.use('/api/maintenance', maintenanceRoutes);

// Health check route for booking details
app.get('/api/student/bookingdetails/health', (req, res) => {
    ('Health check requested for booking details service');
    res.json({ status: 'ok', message: 'Booking details service is running' });
});

// Auth routes (public)
app.use('/api/auth', authRoutes);

// Admin routes
app.use('/api/admin', adminRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/reports', adminReportRoutes);
app.use('/api/admin/residences', adminResidenceRoutes);
app.use('/api/admin/students', adminStudentRoutes);
app.use('/api/admin/applications', adminApplicationRoutes);
app.use('/api/admin/payments', adminPaymentRoutes);
app.use('/api/admin/profile', adminProfileRoutes);
app.use('/api/admin/messages', adminMessageRoutes);
app.use('/api/admin/events', adminEventRoutes);

// Student routes
app.use('/api/student', studentRoutes);
app.use('/api/student/bookings', studentBookingRoutes);
app.use('/api/student/maintenance', studentMaintenanceRoutes);
app.use('/api/student/events', studentEventRoutes);
app.use('/api/student/messages', studentMessageRoutes);
app.use('/api/student/dashboard', studentDashboardRoutes);
app.use('/api/student/bookingdetails', bookingDetailsRoutes);
app.use('/api/student/payments', paymentHistoryRoutes);


// Property Manager routes
app.use('/api/property-manager/residences', propertyManagerResidenceRoutes);
app.use('/api/property-manager/maintenance', propertyManagerMaintenanceRoutes);
app.use('/api/property-manager/events', propertyManagerEventRoutes);

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