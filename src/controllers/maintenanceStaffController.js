const MaintenanceStaff = require('../models/MaintenanceStaff');
const User = require('../models/User');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Create new maintenance staff
exports.createMaintenanceStaff = async (req, res) => {
    try {
        console.log('Received request to create maintenance staff:', req.body);
        
        // Validate required fields
        const requiredFields = ['name', 'surname', 'email', 'contact'];
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

        // Create new maintenance staff
        const staff = new MaintenanceStaff({
            name: req.body.name,
            surname: req.body.surname,
            email: req.body.email.toLowerCase(),
            contact: req.body.contact,
            speciality: req.body.speciality || 'general',
            location: req.body.location || 'main',
            isActive: true
        });

            const savedStaff = await staff.save();
            console.log('Successfully saved staff to database:', savedStaff);
            
            res.status(201).json(savedStaff);
    } catch (error) {
        console.error('Error creating maintenance staff:', error);
        res.status(400).json({ 
            message: error.message
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
            .sort({ name: 1 });
            
        console.log(`Found ${staff.length} staff members`);
        
        res.status(200).json(staff);
    } catch (error) {
        console.error('Error fetching maintenance staff:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get maintenance staff by ID
exports.getMaintenanceStaffById = async (req, res) => {
    try {
        const staff = await User.findOne({ 
            _id: req.params.id,
            role: 'maintenance_staff'
        }).select('firstName lastName email phone role');
            
        if (!staff) {
            return res.status(404).json({ message: 'Maintenance staff not found' });
        }

        // Transform the data to match the expected format
        const transformedStaff = {
            _id: staff._id,
            name: staff.firstName,
            surname: staff.lastName,
            email: staff.email,
            contact: staff.phone,
            role: staff.role,
            isActive: true
        };

        res.status(200).json(transformedStaff);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update maintenance staff
exports.updateMaintenanceStaff = async (req, res) => {
    try {
        // If email is being updated, check if it's already in use
        if (req.body.email) {
            const existingStaff = await User.findOne({ 
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

        // Transform the request body to match User model fields
        const updateData = {
            firstName: req.body.name,
            lastName: req.body.surname,
            email: req.body.email?.toLowerCase(),
            phone: req.body.contact
        };

        const staff = await User.findOneAndUpdate(
            { _id: req.params.id, role: 'maintenance_staff' },
            updateData,
            { new: true, runValidators: true }
        );

        if (!staff) {
            return res.status(404).json({ message: 'Maintenance staff not found' });
        }

        // Transform the response to match expected format
        const transformedStaff = {
            _id: staff._id,
            name: staff.firstName,
            surname: staff.lastName,
            email: staff.email,
            contact: staff.phone,
            role: staff.role,
            isActive: true
        };

        res.status(200).json(transformedStaff);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Delete maintenance staff
exports.deleteMaintenanceStaff = async (req, res) => {
    try {
        const staff = await User.findOneAndDelete({ 
            _id: req.params.id,
            role: 'maintenance_staff'
        });

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
        const staff = await User.find({ 
            role: 'maintenance_staff',
            speciality: req.params.speciality
        })
        .select('firstName lastName email phone role')
        .sort({ firstName: 1 });
        
        // Transform the data to match the expected format
        const transformedStaff = staff.map(staffMember => ({
            _id: staffMember._id,
            name: staffMember.firstName,
            surname: staffMember.lastName,
            email: staffMember.email,
            contact: staffMember.phone,
            role: staffMember.role,
            isActive: true
        }));
        
        res.status(200).json(transformedStaff);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get maintenance staff by location
exports.getMaintenanceStaffByLocation = async (req, res) => {
    try {
        const staff = await User.find({ 
            role: 'maintenance_staff',
            location: req.params.location
        })
        .select('firstName lastName email phone role')
        .sort({ firstName: 1 });
        
        // Transform the data to match the expected format
        const transformedStaff = staff.map(staffMember => ({
            _id: staffMember._id,
            name: staffMember.firstName,
            surname: staffMember.lastName,
            email: staffMember.email,
            contact: staffMember.phone,
            role: staffMember.role,
            isActive: true
        }));
        
        res.status(200).json(transformedStaff);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update staff performance
exports.updateStaffPerformance = async (req, res) => {
    try {
        const staff = await User.findOne({ 
            _id: req.params.id,
            role: 'maintenance_staff'
        });

        if (!staff) {
            return res.status(404).json({ message: 'Maintenance staff not found' });
        }

        const { completedTasks, averageResponseTime, rating } = req.body;
        
        // Update performance metrics in the staff document
        staff.performance = {
            completedTasks: completedTasks || staff.performance?.completedTasks || 0,
            averageResponseTime: averageResponseTime || staff.performance?.averageResponseTime || 0,
            rating: rating || staff.performance?.rating || 0
        };

        const updatedStaff = await staff.save();

        // Transform the response to match expected format
        const transformedStaff = {
            _id: updatedStaff._id,
            name: updatedStaff.firstName,
            surname: updatedStaff.lastName,
            email: updatedStaff.email,
            contact: updatedStaff.phone,
            role: updatedStaff.role,
            isActive: true,
            performance: updatedStaff.performance
        };

        res.status(200).json(transformedStaff);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
}; 