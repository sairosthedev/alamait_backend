/**
 * User Activity Routes
 * Routes for tracking user activities
 */

const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const userActivityController = require('../controllers/userActivityController');

// Track activities - allow without authentication for anonymous tracking
// If user is authenticated, their ID will be used; otherwise, track as anonymous
router.post('/track', userActivityController.track); // Generic tracking endpoint - must be before specific routes
router.post('/page-view', userActivityController.trackPageView);
router.post('/navigation', userActivityController.trackNavigation);
router.post('/action', userActivityController.trackAction);
router.post('/form-submit', userActivityController.trackFormSubmit);
router.post('/button-click', userActivityController.trackButtonClick);
router.post('/data-view', userActivityController.trackDataView);

// Get activities - require authentication
router.use(auth);
router.get('/', userActivityController.getUserActivities); // Paginated list - must be before /activity
router.get('/activity', userActivityController.getUserActivity); // Non-paginated (backward compatibility)
router.get('/summary', userActivityController.getActivitySummary);
router.get('/session/:sessionId', userActivityController.getSessionActivity);

module.exports = router;

