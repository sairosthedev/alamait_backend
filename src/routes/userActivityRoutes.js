/**
 * User Activity Routes
 * Routes for tracking user activities
 */

const express = require('express');
const router = express.Router();
const { auth, optionalAuth } = require('../middleware/auth');
const userActivityController = require('../controllers/userActivityController');

// Track activities - use optional auth to support both authenticated and anonymous tracking
// If user is authenticated, their ID will be used; otherwise, track as anonymous
router.post('/track', optionalAuth, userActivityController.track); // Generic tracking endpoint - must be before specific routes
router.post('/page-view', optionalAuth, userActivityController.trackPageView);
router.post('/navigation', optionalAuth, userActivityController.trackNavigation);
router.post('/action', optionalAuth, userActivityController.trackAction);
router.post('/form-submit', optionalAuth, userActivityController.trackFormSubmit);
router.post('/button-click', optionalAuth, userActivityController.trackButtonClick);
router.post('/data-view', optionalAuth, userActivityController.trackDataView);

// Get activities - require authentication
router.use(auth);
router.get('/', userActivityController.getUserActivities); // Paginated list - must be before /activity
router.get('/activity', userActivityController.getUserActivity); // Non-paginated (backward compatibility)
router.get('/summary', userActivityController.getActivitySummary);
router.get('/session/:sessionId', userActivityController.getSessionActivity);

module.exports = router;

