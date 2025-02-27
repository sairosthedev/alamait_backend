const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

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

// Admin routes
const adminUserRoutes = require('./routes/admin/userRoutes');
const adminReportRoutes = require('./routes/admin/reportRoutes');
const adminResidenceRoutes = require('./routes/admin/residenceRoutes');
const adminRoutes = require('./routes/admin/adminRoutes');
const adminStudentRoutes = require('./routes/admin/studentRoutes');
const adminApplicationRoutes = require('./routes/admin/applicationRoutes');
const adminPaymentRoutes = require('./routes/admin/paymentRoutes');
const adminProfileRoutes = require('./routes/admin/adminProfileRoutes');

// Student routes
const studentBookingRoutes = require('./routes/student/bookingRoutes');
const studentMaintenanceRoutes = require('./routes/student/maintenanceRoutes');
const studentEventRoutes = require('./routes/student/eventRoutes');
const studentMessageRoutes = require('./routes/student/messageRoutes');
const studentRoutes = require('./routes/student/studentRoutes');
const studentDashboardRoutes = require('./routes/student/dashboardRoutes');
const bookingDetailsRoutes = require('./routes/student/bookingDetailsRoutes');
const paymentHistoryRoutes = require('./routes/student/paymentHistoryRoutes');
const maintenanceRoutes = require('./routes/student/maintenanceRoutes');

// Property Manager routes
const propertyManagerResidenceRoutes = require('./routes/property_manager/residenceRoutes');
const propertyManagerMaintenanceRoutes = require('./routes/property_manager/maintenanceRoutes');
const propertyManagerEventRoutes = require('./routes/property_manager/eventRoutes');

const app = express();

// CORS configuration
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://alamait.vercel.app', 'https://alamait-admin.vercel.app']
        : 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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