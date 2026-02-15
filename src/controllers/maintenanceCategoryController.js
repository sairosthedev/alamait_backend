const MaintenanceCategory = require('../models/MaintenanceCategory');

// Seed default categories
const seedDefaultCategories = async () => {
    try {
        const defaultCategories = [
            {
                name: 'Plumbing',
                description: 'All plumbing related maintenance issues',
                priority: 'High',
                estimatedTime: 2,
                amount: 150
            },
            {
                name: 'Electrical',
                description: 'Electrical system maintenance and repairs',
                priority: 'High',
                estimatedTime: 3,
                amount: 200
            },
            {
                name: 'HVAC',
                description: 'Heating, ventilation, and air conditioning issues',
                priority: 'Medium',
                estimatedTime: 4,
                amount: 300
            },
            {
                name: 'Appliance',
                description: 'Maintenance and repairs for room appliances',
                priority: 'Medium',
                estimatedTime: 2,
                amount: 100
            },
            {
                name: 'Structural',
                description: 'Building structure and integrity issues',
                priority: 'High',
                estimatedTime: 6,
                amount: 500
            },
            {
                name: 'Cleaning',
                description: 'Cleaning and sanitation services',
                priority: 'Low',
                estimatedTime: 1,
                amount: 50
            },
            {
                name: 'Pest Control',
                description: 'Pest control and extermination services',
                priority: 'Medium',
                estimatedTime: 3,
                amount: 200
            },
            {
                name: 'Security',
                description: 'Security system maintenance and repairs',
                priority: 'High',
                estimatedTime: 2,
                amount: 150
            },
            {
                name: 'Furniture',
                description: 'Furniture repairs and maintenance',
                priority: 'Low',
                estimatedTime: 1,
                amount: 75
            },
            {
                name: 'Fire Safety',
                description: 'Fire safety equipment and systems',
                priority: 'High',
                estimatedTime: 2,
                amount: 200
            },
            {
                name: 'Emergency',
                description: 'Urgent safety and emergency issues',
                priority: 'High',
                estimatedTime: 1,
                amount: 300
            },
            {
                name: 'Landscaping',
                description: 'Garden and outdoor maintenance',
                priority: 'Low',
                estimatedTime: 4,
                amount: 150
            },
            {
                name: 'Internet/IT',
                description: 'Internet, WiFi, and technology issues',
                priority: 'Medium',
                estimatedTime: 2,
                amount: 100
            },
            {
                name: 'Accessibility',
                description: 'ADA compliance and accessibility',
                priority: 'Medium',
                estimatedTime: 3,
                amount: 250
            },
            {
                name: 'Parking',
                description: 'Parking lot and garage maintenance',
                priority: 'Medium',
                estimatedTime: 2,
                amount: 120
            },
            {
                name: 'Exterior',
                description: 'Building exterior and facade',
                priority: 'Medium',
                estimatedTime: 4,
                amount: 300
            },
            {
                name: 'Communication',
                description: 'Intercom and communication systems',
                priority: 'Low',
                estimatedTime: 1,
                amount: 80
            },
            {
                name: 'General Maintenance',
                description: 'General maintenance and repairs',
                priority: 'Low',
                estimatedTime: 1,
                amount: 50
            },
            {
                name: 'Other',
                description: 'Other maintenance issues',
                priority: 'Low',
                estimatedTime: 1,
                amount: 50
            }
        ];

        // Check if categories already exist
        const existingCategories = await MaintenanceCategory.find();
        if (existingCategories.length === 0) {
            console.log('Seeding default categories...');
            await MaintenanceCategory.insertMany(defaultCategories);
            console.log('Default categories seeded successfully');
        } else {
            console.log('Categories already exist, skipping seed');
        }
    } catch (error) {
        console.error('Error seeding categories:', error);
    }
};

// Call seed function after database connection is established
// Use setImmediate to defer execution until after database connection
setImmediate(async () => {
    // Wait for database connection before seeding
    const mongoose = require('mongoose');
    let attempts = 0;
    const maxAttempts = 30;
    
    while (mongoose.connection.readyState !== 1 && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
    }
    
    if (mongoose.connection.readyState === 1) {
        await seedDefaultCategories();
    } else {
        console.error('⚠️ Database not connected, skipping category seed. Will retry on next request.');
    }
});

// Get all maintenance categories
exports.getAllCategories = async (req, res) => {
    try {
        console.log('Fetching all maintenance categories...');
        const categories = await MaintenanceCategory.find()
            .sort({ name: 1 });
        console.log('Found categories:', categories);
        res.status(200).json(categories);
    } catch (error) {
        console.error('Error in getAllCategories:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get active maintenance categories
exports.getActiveCategories = async (req, res) => {
    try {
        const categories = await MaintenanceCategory.find({ isActive: true })
            .sort({ name: 1 });
        res.status(200).json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get category by ID
exports.getCategoryById = async (req, res) => {
    try {
        const category = await MaintenanceCategory.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }
        res.status(200).json(category);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Create new category
exports.createCategory = async (req, res) => {
    try {
        const category = new MaintenanceCategory(req.body);
        const savedCategory = await category.save();
        res.status(201).json(savedCategory);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Update category
exports.updateCategory = async (req, res) => {
    try {
        const category = await MaintenanceCategory.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }
        res.status(200).json(category);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Delete category
exports.deleteCategory = async (req, res) => {
    try {
        const category = await MaintenanceCategory.findByIdAndDelete(req.params.id);
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }
        res.status(200).json({ message: 'Category deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get categories by priority
exports.getCategoriesByPriority = async (req, res) => {
    try {
        const categories = await MaintenanceCategory.find({ 
            priority: req.params.priority,
            isActive: true 
        }).sort({ name: 1 });
        res.status(200).json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}; 