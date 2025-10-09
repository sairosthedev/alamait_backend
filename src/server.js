const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config({ path: require('path').resolve(__dirname, '../.env') });
const path = require('path');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin/adminRoutes');
const studentRoutes = require('./routes/student');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const maintenanceStaffRoutes = require('./routes/maintenanceStaffRoutes');
const maintenanceCategoryRoutes = require('./routes/maintenanceCategoryRoutes');
const expenseRoutes = require('./routes/admin/expenseRoutes');
const connectDB = require('./config/database');

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'https://alamait.vercel.app', process.env.FRONTEND_URL].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

// Connect to MongoDB
connectDB().catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/admin', expenseRoutes);

// Redirect /api/admin/staff to /api/maintenance/maintenance_staff
app.use('/api/admin/staff', (req, res, next) => {
    console.log('Admin staff route hit:', req.method, req.path);
    req.url = '/api/maintenance/maintenance_staff' + req.url;
    next();
}, maintenanceStaffRoutes);

// Maintenance routes with debugging
// Define specific routes first
app.use('/api/maintenance/maintenance_staff', (req, res, next) => {
    console.log('Maintenance staff route hit:', req.method, req.path);
    next();
}, maintenanceStaffRoutes);

app.use('/api/maintenance/categories', (req, res, next) => {
    console.log('Categories route hit:', req.method, req.path);
    next();
}, maintenanceCategoryRoutes);

// Define specific maintenance routes before generic routes
app.use('/api/maintenance/status/:status', (req, res, next) => {
    console.log('Status route hit:', req.method, req.path);
    next();
}, maintenanceRoutes);

app.use('/api/maintenance/room/:room', (req, res, next) => {
    console.log('Room route hit:', req.method, req.path);
    next();
}, maintenanceRoutes);

app.use('/api/maintenance/priority/:priority', (req, res, next) => {
    console.log('Priority route hit:', req.method, req.path);
    next();
}, maintenanceRoutes);

// Generic maintenance routes last
app.use('/api/maintenance', (req, res, next) => {
    console.log('Maintenance route hit:', req.method, req.path);
    // Skip if the path is 'maintenance_staff' or 'categories'
    if (req.path === '/maintenance_staff' || req.path === '/categories') {
        return next('route');
    }
    next();
}, maintenanceRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error stack:', err.stack);
  console.error('Error details:', {
    message: err.message,
    name: err.name,
    code: err.code
  });
  res.status(500).json({ 
    error: 'Something went wrong!',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 