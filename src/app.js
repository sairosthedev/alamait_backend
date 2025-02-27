const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Import routes
const authRoutes = require('./routes/auth');

// Admin routes
const adminUserRoutes = require('./routes/admin/userRoutes');
const adminReportRoutes = require('./routes/admin/reportRoutes');

// Student routes
const studentBookingRoutes = require('./routes/student/bookingRoutes');
const studentMaintenanceRoutes = require('./routes/student/maintenanceRoutes');
const studentEventRoutes = require('./routes/student/eventRoutes');
const studentMessageRoutes = require('./routes/student/messageRoutes');

// Property Manager routes
const propertyManagerResidenceRoutes = require('./routes/property_manager/residenceRoutes');
const propertyManagerMaintenanceRoutes = require('./routes/property_manager/maintenanceRoutes');
const propertyManagerEventRoutes = require('./routes/property_manager/eventRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auth routes (public)
app.use('/api/auth', authRoutes);

// Admin routes
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/reports', adminReportRoutes);

// Student routes
app.use('/api/student/bookings', studentBookingRoutes);
app.use('/api/student/maintenance', studentMaintenanceRoutes);
app.use('/api/student/events', studentEventRoutes);
app.use('/api/student/messages', studentMessageRoutes);

// Property Manager routes
app.use('/api/property-manager/residences', propertyManagerResidenceRoutes);
app.use('/api/property-manager/maintenance', propertyManagerMaintenanceRoutes);
app.use('/api/property-manager/events', propertyManagerEventRoutes);

// Health check route
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

module.exports = app;