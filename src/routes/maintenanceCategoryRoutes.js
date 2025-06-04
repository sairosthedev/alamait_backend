const express = require('express');
const router = express.Router();
const maintenanceCategoryController = require('../controllers/maintenanceCategoryController');

// Logging middleware
router.use((req, res, next) => {
    console.log('Maintenance Category Route hit:', req.method, req.path);
    next();
});

// Get all categories
router.get('/', maintenanceCategoryController.getAllCategories);

// Get active categories
router.get('/active', maintenanceCategoryController.getActiveCategories);

// Get categories by priority
router.get('/priority/:priority', maintenanceCategoryController.getCategoriesByPriority);

// Get category by ID
router.get('/:id', maintenanceCategoryController.getCategoryById);

// Create new category
router.post('/', maintenanceCategoryController.createCategory);

// Update category
router.put('/:id', maintenanceCategoryController.updateCategory);

// Delete category
router.delete('/:id', maintenanceCategoryController.deleteCategory);

module.exports = router; 