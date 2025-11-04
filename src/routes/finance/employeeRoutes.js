const express = require('express');
const router = express.Router();
const controller = require('../../controllers/finance/employeeController');
const { auth, checkRole } = require('../../middleware/auth');

router.use(auth);
router.use(checkRole('admin', 'finance_admin', 'finance_user', 'ceo'));

// Debug middleware for salary-request-by-residence
router.post('/salary-request-by-residence', (req, res, next) => {
    console.log('🎯 Route middleware: salary-request-by-residence reached');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    next();
}, checkRole('admin', 'finance_admin'), controller.createSalaryRequestByResidence);

// CRUD
router.get('/', controller.list);
router.post('/', checkRole('admin', 'finance_admin'), controller.create);
router.get('/:id', controller.getById);
router.put('/:id', checkRole('admin', 'finance_admin'), controller.update);

// Salary requests
router.post('/salary-request', checkRole('admin', 'finance_admin'), controller.createSalaryRequest);
router.delete('/:id', checkRole('admin'), controller.remove);

// Salary request creation from selected employees
router.post('/salary-requests', checkRole('admin', 'finance_admin', 'finance_user', 'ceo'), controller.createSalaryRequest);

// Individual salary requests with detailed allocation handling
router.post('/individual-salary-requests', checkRole('admin', 'finance_admin', 'finance_user', 'ceo'), controller.createIndividualSalaryRequests);

module.exports = router;



