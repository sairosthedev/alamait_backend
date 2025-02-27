const express = require('express');
const router = express.Router();
const residenceController = require('../../controllers/residenceController');

// Public route to get St Kilda residence
router.get('/st-kilda', residenceController.getStKildaResidence);

module.exports = router; 