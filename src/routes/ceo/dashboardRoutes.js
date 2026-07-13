const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const { executiveDashboardHandler } = require('../../middleware/dashboardExecutiveGateway');

router.use(auth);
router.use(checkRole('ceo'));
router.get('/executive', executiveDashboardHandler);

module.exports = router;
