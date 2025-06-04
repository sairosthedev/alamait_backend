const MaintenanceStaff = require('../models/MaintenanceStaff');
const mongoose = require('mongoose');

// Create new maintenance staff
exports.createMaintenanceStaff = async (req, res) => {
    try {
        console.log('Received request to create maintenance staff:', req.body);
        console.log('MongoDB connection state:', mongoose.connection.readyState);
        console.log('Current database:', mongoose.connection.db.databaseName);
        
        // Validate required fields
        const requiredFields = ['name', 'surname', 'email', 'speciality', 'location', 'contact'];
        const missingFields = requiredFields.filter(field => !req.body[field]);
        
        if (missingFields.length > 0) {
            console.error('Missing required fields:', missingFields);
            return res.status(400).json({ 
                message: 'Missing required fields', 
                fields: missingFields 
            });
        }

        // Check if email already exists
        const existingStaff = await MaintenanceStaff.findOne({ email: req.body.email.toLowerCase() });
        if (existingStaff) {
            return res.status(400).json({
                message: 'Email already registered',
                field: 'email'
            });
        }

        const staff = new MaintenanceStaff(req.body);
        console.log('Created new staff object:', staff);
        console.log('Collection name:', staff.collection.name);

        try {
            const savedStaff = await staff.save();
            console.log('Successfully saved staff to database:', savedStaff);
            console.log('Document ID:', savedStaff._id);
            console.log('Collection:', savedStaff.collection.name);
            
            res.status(201).json(savedStaff);
        } catch (saveError) {
            console.error('Error saving to database:', {
                message: saveError.message,
                code: saveError.code,
                name: saveError.name,
                stack: saveError.stack
            });
            throw saveError;
        }
    } catch (error) {
        console.error('Error creating maintenance staff:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code
        });
        res.status(400).json({ 
            message: error.message,
            details: error.stack
        });
    }
};

// Get all maintenance staff
exports.getAllMaintenanceStaff = async (req, res) => {
    try {
        console.log('Fetching all maintenance staff');
        console.log('MongoDB connection state:', mongoose.connection.readyState);
        console.log('Current database:', mongoose.connection.db.databaseName);
        
        const staff = await MaintenanceStaff.find()
            .select('name surname email speciality location contact isActive performance assignedTasks')
            .sort({ createdAt: -1 });
            
        console.log(`Found ${staff.length} staff members`);
        console.log('Collection name:', MaintenanceStaff.collection.name);
        
        res.status(200).json(staff);
    } catch (error) {
        console.error('Error fetching maintenance staff:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get maintenance staff by ID
exports.getMaintenanceStaffById = async (req, res) => {
    try {
        const staff = await MaintenanceStaff.findById(req.params.id)
            .select('name surname email speciality location contact isActive performance assignedTasks');
            
        if (!staff) {
            return res.status(404).json({ message: 'Maintenance staff not found' });
        }
        res.status(200).json(staff);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update maintenance staff
exports.updateMaintenanceStaff = async (req, res) => {
    try {
        // If email is being updated, check if it's already in use
        if (req.body.email) {
            const existingStaff = await MaintenanceStaff.findOne({ 
                email: req.body.email.toLowerCase(),
                _id: { $ne: req.params.id }
            });
            if (existingStaff) {
                return res.status(400).json({
                    message: 'Email already registered',
                    field: 'email'
                });
            }
        }

        const staff = await MaintenanceStaff.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!staff) {
            return res.status(404).json({ message: 'Maintenance staff not found' });
        }
        res.status(200).json(staff);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Delete maintenance staff
exports.deleteMaintenanceStaff = async (req, res) => {
    try {
        const staff = await MaintenanceStaff.findByIdAndDelete(req.params.id);
        if (!staff) {
            return res.status(404).json({ message: 'Maintenance staff not found' });
        }
        res.status(200).json({ message: 'Maintenance staff deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get maintenance staff by speciality
exports.getMaintenanceStaffBySpeciality = async (req, res) => {
    try {
        const staff = await MaintenanceStaff.find({ 
            speciality: req.params.speciality,
            isActive: true 
        })
        .select('name surname email speciality location contact isActive performance assignedTasks')
        .sort({ createdAt: -1 });
        
        res.status(200).json(staff);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get maintenance staff by location
exports.getMaintenanceStaffByLocation = async (req, res) => {
    try {
        const staff = await MaintenanceStaff.find({ 
            location: req.params.location,
            isActive: true 
        })
        .select('name surname email speciality location contact isActive performance assignedTasks')
        .sort({ createdAt: -1 });
        
        res.status(200).json(staff);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update staff performance
exports.updateStaffPerformance = async (req, res) => {
    try {
        const staff = await MaintenanceStaff.findById(req.params.id);
        if (!staff) {
            return res.status(404).json({ message: 'Maintenance staff not found' });
        }

        const { completedTasks, averageResponseTime, rating } = req.body;
        
        if (completedTasks) staff.performance.completedTasks = completedTasks;
        if (averageResponseTime) staff.performance.averageResponseTime = averageResponseTime;
        if (rating) staff.performance.rating = rating;

        const updatedStaff = await staff.save();
        res.status(200).json(updatedStaff);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
}; 