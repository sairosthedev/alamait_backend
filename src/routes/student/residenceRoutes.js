const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const {
    getAvailableResidences,
    getResidenceDetails
} = require('../../controllers/student/residenceController');

// All routes require student role
router.use(auth);
router.use(checkRole('student'));

// Get all available residences
router.get('/', getAvailableResidences);

// Get detailed information about a specific residence
router.get('/:id', getResidenceDetails);

module.exports = router; 