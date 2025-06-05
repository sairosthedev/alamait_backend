const express = require('express');
const router = express.Router();
const { getExpenses, addExpense } = require('../../controllers/admin/expenseController');

// Route to handle GET and POST requests for expenses
router
    .route('/expenses')
    .get(getExpenses) // Handle GET requests
    .post(addExpense); // Handle POST requests

exports.addExpense = async (req, res) => {
    try {
        console.log('Adding new expense:', req.body);
        // ...existing code...
    } catch (error) {
        console.error('Error adding expense:', error);
        res.status(400).json({ message: error.message });
    }
};

module.exports = router;