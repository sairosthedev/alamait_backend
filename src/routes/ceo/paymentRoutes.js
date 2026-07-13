const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const { registerPaymentRoutes } = require('../shared/registerPaymentRoutes');

router.use(auth);
router.use(checkRole('ceo'));

registerPaymentRoutes(router, {
    readRoles: ['ceo'],
    createRoles: ['ceo'],
    updateRoles: ['ceo'],
    deleteRoles: ['ceo'],
    totalIncomeRoles: ['ceo']
});

module.exports = router;
