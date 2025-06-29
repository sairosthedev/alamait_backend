const express = require('express');
const router = express.Router();
const { auth, checkRole, financeAccess } = require('../../middleware/auth');
const { 
    getAllRoomPrices, 
    getRoomPrice, 
    getRoomPriceStats, 
    getRoomPricesByResidence 
} = require('../../controllers/finance/roomPriceController');

// Apply auth middleware to all routes
router.use(auth);
// Apply finance access middleware to all routes
router.use(financeAccess);

// Get all room prices (finance admin and admin)
router.get('/', checkRole('admin', 'finance_admin', 'finance_user'), getAllRoomPrices);

// Get room pricing statistics (finance admin and admin)
router.get('/stats', checkRole('admin', 'finance_admin', 'finance_user'), getRoomPriceStats);

// Get room prices by residence (finance admin and admin)
router.get('/residence/:residenceId', checkRole('admin', 'finance_admin', 'finance_user'), getRoomPricesByResidence);

// Get single room price (finance admin and admin)
router.get('/:id', checkRole('admin', 'finance_admin', 'finance_user'), getRoomPrice);

module.exports = router; 