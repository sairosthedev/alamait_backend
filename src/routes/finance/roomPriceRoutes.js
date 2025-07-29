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

// Get all room prices (finance admin, admin, and CEO)
router.get('/', checkRole('admin', 'finance_admin', 'finance_user', 'ceo'), getAllRoomPrices);

// Get room pricing statistics (finance admin, admin, and CEO)
router.get('/stats', checkRole('admin', 'finance_admin', 'finance_user', 'ceo'), getRoomPriceStats);

// Get room prices by residence (finance admin, admin, and CEO)
router.get('/residence/:residenceId', checkRole('admin', 'finance_admin', 'finance_user', 'ceo'), getRoomPricesByResidence);

// Get single room price (finance admin, admin, and CEO)
router.get('/:id', checkRole('admin', 'finance_admin', 'finance_user', 'ceo'), getRoomPrice);

module.exports = router; 