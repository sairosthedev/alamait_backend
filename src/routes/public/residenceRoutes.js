const express = require('express');
const router = express.Router();
const residenceController = require('../../controllers/residenceController');

// Public route to get St Kilda residence
router.get('/st-kilda', residenceController.getStKildaResidence);

// Public route to get Belvedere residence
router.get('/belvedere', residenceController.getBelvedereResidence);

// Public route to get Newlands residence
router.get('/newlands', residenceController.getNewlandsResidence);

// Public route to get 1ACP residence
router.get('/1ACP', residenceController.getOneACPResidence);

// Public route to get residence by name
router.get('/name/:name', residenceController.getResidenceByName);

module.exports = router; 