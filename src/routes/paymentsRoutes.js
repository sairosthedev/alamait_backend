const express = require('express');
const router = express.Router();
const { createAuthenticatedPaymentGateway } = require('../../middleware/paymentRoleGateway');

// Role-aware entry point: /api/payments
const gateway = createAuthenticatedPaymentGateway();
router.use('/', gateway);

module.exports = router;
