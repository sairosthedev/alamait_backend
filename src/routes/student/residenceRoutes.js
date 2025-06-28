const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../../middleware/auth');
const {
    getAvailableResidences,
    getResidenceDetails,
    getResidenceById
} = require('../../controllers/student/residenceController');

// All routes require student role
router.use(auth);
router.use(checkRole('student'));

// Get all available residences
router.get('/', getAvailableResidences);

// Get detailed information about a specific residence
router.get('/:id', getResidenceDetails);

// Get residence information by ID (for resolving residence names)
router.get('/id/:id', getResidenceById);

module.exports = router; 