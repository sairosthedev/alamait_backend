/**
 * User Activity Routes
 * Routes for tracking user activities
 */

const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const userActivityController = require('../controllers/userActivityController');

// All routes require authentication
router.use(auth);

// Track activities
router.post('/page-view', userActivityController.trackPageView);
router.post('/navigation', userActivityController.trackNavigation);
router.post('/action', userActivityController.trackAction);
router.post('/form-submit', userActivityController.trackFormSubmit);
router.post('/button-click', userActivityController.trackButtonClick);
router.post('/data-view', userActivityController.trackDataView);

// Get activities
router.get('/activity', userActivityController.getUserActivity);
router.get('/summary', userActivityController.getActivitySummary);
router.get('/session/:sessionId', userActivityController.getSessionActivity);

module.exports = router;

