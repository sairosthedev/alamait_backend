const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { paymentRoleGateway } = require('../middleware/paymentRoleGateway');

// Backward-compatible entry: routes finance/ceo/admin to the correct payment API by role
router.use(auth);
router.use(paymentRoleGateway);

module.exports = router;
