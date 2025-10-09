const express = require('express');
const router = express.Router();
const controller = require('../../controllers/finance/employeeController');
const { auth, checkRole } = require('../../middleware/auth');

router.use(auth);
router.use(checkRole('admin', 'finance_admin', 'finance_user'));

// CRUD
router.get('/', controller.list);
router.post('/', checkRole('admin', 'finance_admin'), controller.create);
router.get('/:id', controller.getById);
router.put('/:id', checkRole('admin', 'finance_admin'), controller.update);
router.delete('/:id', checkRole('admin'), controller.remove);

// Salary request creation from selected employees
router.post('/salary-requests', checkRole('admin', 'finance_admin', 'finance_user'), controller.createSalaryRequest);

module.exports = router;



