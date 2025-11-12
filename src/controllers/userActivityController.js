/**
 * User Activity Controller
 * Handles tracking of user activities including navigation and actions
 */

const UserActivityService = require('../services/userActivityService');
const { validationResult } = require('express-validator');

/**
 * Track page view
 */
exports.trackPageView = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { page, pageTitle, previousPage, duration, metadata } = req.body;

        await UserActivityService.trackPageView(req.user._id, req, {
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
 */
exports.trackNavigation = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { fromPage, toPage, fromPageTitle, toPageTitle, navigationMethod, metadata } = req.body;

        await UserActivityService.trackNavigation(req.user._id, req, {
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
 */
exports.trackAction = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: 'Unauthorized' });
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

        await UserActivityService.trackAction(req.user._id, req, {
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
 */
exports.trackFormSubmit = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: 'Unauthorized' });
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

        await UserActivityService.trackFormSubmit(req.user._id, req, {
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
 */
exports.trackButtonClick = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: 'Unauthorized' });
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

        await UserActivityService.trackButtonClick(req.user._id, req, {
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
 */
exports.trackDataView = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: 'Unauthorized' });
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

        await UserActivityService.trackDataView(req.user._id, req, {
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
 * Get user activity
 */
exports.getUserActivity = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { startDate, endDate, limit } = req.query;
        const userId = req.user._id;

        const activities = await UserActivityService.getUserActivity(
            userId,
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
 * Get activity summary
 */
exports.getActivitySummary = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { startDate, endDate } = req.query;
        const userId = req.user._id;

        const summary = await UserActivityService.getActivitySummary(
            userId,
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

