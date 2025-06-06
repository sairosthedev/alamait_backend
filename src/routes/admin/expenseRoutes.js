const express = require('express');
const router = express.Router();
const { getExpenses, addExpense, updateExpenseStatus } = require('../../controllers/admin/expenseController');
const { auth, checkRole } = require('../../middleware/auth');

// Apply authentication middleware to all routes
router.use(auth);
router.use(checkRole('admin'));

// Route to handle GET and POST requests for expenses
router
    .route('/')
    .get(getExpenses) // Handle GET requests
    .post(addExpense); // Handle POST requests

// Route to handle expense status updates
router.put('/:expenseId/status', updateExpenseStatus);

module.exports = router;