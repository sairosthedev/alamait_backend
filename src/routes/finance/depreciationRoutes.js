const express = require('express');
const router = express.Router();
const { auth, checkAdminOrFinance } = require('../../middleware/auth');
const DepreciationController = require('../../controllers/finance/depreciationController');

// Auth + Finance/Admin required
router.use(auth);
router.use(checkAdminOrFinance);

// Record monthly depreciation
router.post('/record', DepreciationController.recordDepreciation);

// Get depreciation schedule for an asset
router.get('/schedule', DepreciationController.getDepreciationSchedule);

// Get all fixed assets with depreciation status
router.get('/assets', DepreciationController.getFixedAssets);

module.exports = router;




