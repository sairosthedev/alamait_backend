/**
 * User Activity Controller
 * Handles tracking of user activities including navigation and actions
 */

const UserActivityService = require('../services/userActivityService');
const { validationResult } = require('express-validator');

/**
 * Track page view
 * Works with or without authentication (anonymous tracking supported)
 */
exports.trackPageView = async (req, res) => {
    try {
        const userId = req.user?._id || null;
        
        if (!userId) {
            return res.json({ success: true, message: 'Page view tracking skipped (no user)', anonymous: true });
        }

        const { page, pageTitle, previousPage, duration, metadata } = req.body;

        await UserActivityService.trackPageView(userId, req, {
            page,
            pageTitle,
            previousPage,
            duration,
            metadata
        });

        res.json({ success: true, message: 'Page view tracked' });
    } catch (error) {
        console.error('Error tracking page view:', error);
        res.status(500).json({ error: 'Failed to track page view' });
    }
};

/**
 * Track page navigation
 * Works with or without authentication (anonymous tracking supported)
 */
exports.trackNavigation = async (req, res) => {
    try {
        const userId = req.user?._id || null;
        
        if (!userId) {
            return res.json({ success: true, message: 'Navigation tracking skipped (no user)', anonymous: true });
        }

        const { fromPage, toPage, fromPageTitle, toPageTitle, navigationMethod, metadata } = req.body;

        await UserActivityService.trackNavigation(userId, req, {
            fromPage,
            toPage,
            fromPageTitle,
            toPageTitle,
            navigationMethod,
            metadata
        });

        res.json({ success: true, message: 'Navigation tracked' });
    } catch (error) {
        console.error('Error tracking navigation:', error);
        res.status(500).json({ error: 'Failed to track navigation' });
    }
};

/**
 * Track user action
 * Works with or without authentication (anonymous tracking supported)
 */
exports.trackAction = async (req, res) => {
    try {
        const userId = req.user?._id || null;
        
        if (!userId) {
            return res.json({ success: true, message: 'Action tracking skipped (no user)', anonymous: true });
        }

        const {
            page,
            pageTitle,
            action,
            elementId,
            elementType,
            elementLabel,
            data,
            recordId,
            collection,
            status,
            errorMessage,
            metadata
        } = req.body;

        await UserActivityService.trackAction(userId, req, {
            page,
            pageTitle,
            action,
            elementId,
            elementType,
            elementLabel,
            data,
            recordId,
            collection,
            status,
            errorMessage,
            metadata
        });

        res.json({ success: true, message: 'Action tracked' });
    } catch (error) {
        console.error('Error tracking action:', error);
        res.status(500).json({ error: 'Failed to track action' });
    }
};

/**
 * Track form submission
 * Works with or without authentication (anonymous tracking supported)
 */
exports.trackFormSubmit = async (req, res) => {
    try {
        const userId = req.user?._id || null;
        
        if (!userId) {
            return res.json({ success: true, message: 'Form submission tracking skipped (no user)', anonymous: true });
        }

        const {
            page,
            pageTitle,
            formId,
            formName,
            formData,
            recordId,
            collection,
            status,
            errorMessage
        } = req.body;

        await UserActivityService.trackFormSubmit(userId, req, {
            page,
            pageTitle,
            formId,
            formName,
            formData,
            recordId,
            collection,
            status,
            errorMessage
        });

        res.json({ success: true, message: 'Form submission tracked' });
    } catch (error) {
        console.error('Error tracking form submit:', error);
        res.status(500).json({ error: 'Failed to track form submission' });
    }
};

/**
 * Track button click
 * Works with or without authentication (anonymous tracking supported)
 */
exports.trackButtonClick = async (req, res) => {
    try {
        const userId = req.user?._id || null;
        
        if (!userId) {
            return res.json({ success: true, message: 'Button click tracking skipped (no user)', anonymous: true });
        }

        const {
            page,
            pageTitle,
            buttonId,
            buttonLabel,
            buttonType,
            data,
            recordId,
            collection
        } = req.body;

        await UserActivityService.trackButtonClick(userId, req, {
            page,
            pageTitle,
            buttonId,
            buttonLabel,
            buttonType,
            data,
            recordId,
            collection
        });

        res.json({ success: true, message: 'Button click tracked' });
    } catch (error) {
        console.error('Error tracking button click:', error);
        res.status(500).json({ error: 'Failed to track button click' });
    }
};

/**
 * Track data view
 * Works with or without authentication (anonymous tracking supported)
 */
exports.trackDataView = async (req, res) => {
    try {
        const userId = req.user?._id || null;
        
        if (!userId) {
            return res.json({ success: true, message: 'Data view tracking skipped (no user)', anonymous: true });
        }

        const {
            page,
            pageTitle,
            dataType,
            recordId,
            collection,
            filters,
            sort,
            metadata
        } = req.body;

        await UserActivityService.trackDataView(userId, req, {
            page,
            pageTitle,
            dataType,
            recordId,
            collection,
            filters,
            sort,
            metadata
        });

        res.json({ success: true, message: 'Data view tracked' });
    } catch (error) {
        console.error('Error tracking data view:', error);
        res.status(500).json({ error: 'Failed to track data view' });
    }
};

/**
 * Generic track endpoint - handles all activity types
 * Routes to appropriate tracking method based on activityType or infers from data
 * Works with or without authentication (anonymous tracking supported)
 */
exports.track = async (req, res) => {
    try {
        // Allow tracking without authentication (for anonymous users)
        // If user is authenticated, use their ID; otherwise, track as anonymous
        const userId = req.user?._id || null;
        
        // For anonymous tracking, we still want to track the activity
        // but we'll use a special handling in the service layer
        if (!userId) {
            // Still allow tracking, but mark as anonymous
            // The service will handle this appropriately
            console.log('📊 Tracking anonymous activity');
        }

        const { activityType, ...activityData } = req.body;

        // If activityType is not provided, try to infer it from the data
        let inferredActivityType = activityType;
        
        if (!inferredActivityType) {
            // Infer from data structure
            if (activityData.fromPage && activityData.toPage) {
                inferredActivityType = 'navigation';
            } else if (activityData.previousPage !== undefined || activityData.duration !== undefined) {
                inferredActivityType = 'page_view';
            } else if (activityData.formId || activityData.formName || activityData.formData) {
                inferredActivityType = 'form_submit';
            } else if (activityData.buttonId || activityData.buttonLabel) {
                inferredActivityType = 'button_click';
            } else if (activityData.dataType || activityData.filters || activityData.sort) {
                inferredActivityType = 'data_view';
            } else if (activityData.action) {
                inferredActivityType = 'action';
            } else {
                // Default to action if we can't infer
                inferredActivityType = 'action';
            }
        }

        // If no user, skip tracking but return success (to avoid frontend errors)
        if (!userId) {
            return res.json({ 
                success: true, 
                message: `${inferredActivityType || 'activity'} tracking skipped (no user)`,
                activityType: inferredActivityType || 'action',
                activityId: null,
                anonymous: true
            });
        }

        let result;

        switch (inferredActivityType.toLowerCase()) {
            case 'page_view':
                result = await UserActivityService.trackPageView(userId, req, activityData);
                break;
            case 'page_navigation':
            case 'navigation':
                result = await UserActivityService.trackNavigation(userId, req, activityData);
                break;
            case 'action':
                result = await UserActivityService.trackAction(userId, req, activityData);
                break;
            case 'form_submit':
            case 'form_submission':
                result = await UserActivityService.trackFormSubmit(userId, req, activityData);
                break;
            case 'button_click':
            case 'button_clicked':
                result = await UserActivityService.trackButtonClick(userId, req, activityData);
                break;
            case 'data_view':
                result = await UserActivityService.trackDataView(userId, req, activityData);
                break;
            default:
                // Default to generic action tracking
                result = await UserActivityService.trackAction(userId, req, {
                    ...activityData,
                    action: inferredActivityType || 'unknown'
                });
        }

        res.json({ 
            success: true, 
            message: `${inferredActivityType} tracked successfully`,
            activityType: inferredActivityType,
            activityId: result?._id || null
        });
    } catch (error) {
        console.error('Error tracking activity:', error);
        res.status(500).json({ error: 'Failed to track activity', details: error.message });
    }
};

/**
 * Get user activity (non-paginated, for backward compatibility)
 * CEO and admin can view all activities
 */
exports.getUserActivity = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { startDate, endDate, limit, userId } = req.query;
        
        // CEO and admin can view all activities; other users only see their own
        const isCEOOrAdmin = req.user.role === 'ceo' || req.user.role === 'admin';
        const targetUserId = isCEOOrAdmin && userId ? userId : (isCEOOrAdmin ? null : req.user._id);

        const activities = await UserActivityService.getUserActivity(
            targetUserId,
            startDate,
            endDate,
            parseInt(limit) || 1000
        );

        res.json({ success: true, activities });
    } catch (error) {
        console.error('Error getting user activity:', error);
        res.status(500).json({ error: 'Failed to get user activity' });
    }
};

/**
 * Get paginated user activity list
 * Supports: ?page=1&limit=50&startDate=2025-01-01&endDate=2025-12-31&activityType=page_view&page=/dashboard
 * CEO and admin can view all activities across all dashboards
 */
exports.getUserActivities = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const {
            page = 1,
            limit = 50,
            startDate,
            endDate,
            activityType,
            pagePath, // Filter by page path (e.g., /dashboard)
            sortBy = 'timestamp',
            sortOrder = 'desc',
            userId // Optional: filter by specific user (only for CEO/admin)
        } = req.query;

        // CEO and admin can view all activities; other users only see their own
        const isCEOOrAdmin = req.user.role === 'ceo' || req.user.role === 'admin';
        const targetUserId = isCEOOrAdmin && userId ? userId : (isCEOOrAdmin ? null : req.user._id);

        const result = await UserActivityService.getPaginatedUserActivity(targetUserId, {
            page,
            limit,
            startDate,
            endDate,
            activityType,
            pagePath,
            sortBy,
            sortOrder
        });

        res.json({
            success: true,
            data: result.activities,
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Error getting paginated user activities:', error);
        res.status(500).json({ error: 'Failed to get user activities' });
    }
};

/**
 * Get activity summary
 * CEO and admin can view summary for all activities
 */
exports.getActivitySummary = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { startDate, endDate, userId } = req.query;
        
        // CEO and admin can view all activities; other users only see their own
        const isCEOOrAdmin = req.user.role === 'ceo' || req.user.role === 'admin';
        const targetUserId = isCEOOrAdmin && userId ? userId : (isCEOOrAdmin ? null : req.user._id);

        const summary = await UserActivityService.getActivitySummary(
            targetUserId,
            startDate,
            endDate
        );

        res.json({ success: true, summary });
    } catch (error) {
        console.error('Error getting activity summary:', error);
        res.status(500).json({ error: 'Failed to get activity summary' });
    }
};

/**
 * Get session activity
 */
exports.getSessionActivity = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { sessionId } = req.params;
        const userId = req.user._id;

        const activities = await UserActivityService.getUserSessionActivity(
            userId,
            sessionId
        );

        res.json({ success: true, activities });
    } catch (error) {
        console.error('Error getting session activity:', error);
        res.status(500).json({ error: 'Failed to get session activity' });
    }
};

