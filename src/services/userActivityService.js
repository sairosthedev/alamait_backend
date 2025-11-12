/**
 * User Activity Service
 * Comprehensive tracking of all user activities including navigation and actions
 */

const UserActivity = require('../models/UserActivity');
const { v4: uuidv4 } = require('uuid');

class UserActivityService {
    /**
     * Track user login
     */
    static async trackLogin(userId, req, deviceInfo = {}) {
        try {
            const sessionId = req.sessionID || uuidv4();
            
            return await UserActivity.create({
                user: userId,
                sessionId,
                activityType: 'login',
                page: '/login',
                pageTitle: 'Login',
                action: 'login',
                actionDetails: {
                    method: 'POST',
                    endpoint: '/api/auth/login',
                    success: true
                },
                ipAddress: req.ip || req.connection?.remoteAddress || null,
                userAgent: req.headers['user-agent'] || null,
                deviceInfo: {
                    deviceIp: deviceInfo.deviceIp || null,
                    deviceIdentifier: deviceInfo.deviceIdentifier || null,
                    deviceType: deviceInfo.deviceType || null,
                    deviceName: deviceInfo.deviceName || null,
                    ...deviceInfo
                },
                requestId: req.requestId || uuidv4(),
                status: 'success',
                timestamp: new Date()
            });
        } catch (error) {
            console.error('Error tracking login:', error);
            return null;
        }
    }

    /**
     * Track user logout
     */
    static async trackLogout(userId, req, sessionId = null) {
        try {
            const finalSessionId = sessionId || req.sessionID || uuidv4();
            
            return await UserActivity.create({
                user: userId,
                sessionId: finalSessionId,
                activityType: 'logout',
                page: req.path || '/logout',
                pageTitle: 'Logout',
                action: 'logout',
                actionDetails: {
                    method: req.method || 'POST',
                    endpoint: req.path || '/api/auth/logout'
                },
                ipAddress: req.ip || req.connection?.remoteAddress || null,
                userAgent: req.headers['user-agent'] || null,
                requestId: req.requestId || uuidv4(),
                status: 'success',
                timestamp: new Date()
            });
        } catch (error) {
            console.error('Error tracking logout:', error);
            return null;
        }
    }

    /**
     * Track page view/navigation
     */
    static async trackPageView(userId, req, pageData) {
        try {
            const {
                page,
                pageTitle,
                previousPage,
                duration,
                metadata = {}
            } = pageData;

            const sessionId = req.sessionID || req.headers['x-session-id'] || uuidv4();
            
            return await UserActivity.create({
                user: userId,
                sessionId,
                activityType: 'page_view',
                page: page || req.path || '/',
                pageTitle: pageTitle || '',
                previousPage: previousPage || null,
                action: 'view',
                duration: duration || null,
                ipAddress: req.ip || req.connection?.remoteAddress || null,
                userAgent: req.headers['user-agent'] || null,
                requestId: req.requestId || uuidv4(),
                metadata: {
                    ...metadata,
                    method: req.method,
                    query: req.query,
                    timestamp: new Date()
                },
                status: 'success',
                timestamp: new Date()
            });
        } catch (error) {
            console.error('Error tracking page view:', error);
            return null;
        }
    }

    /**
     * Track page navigation (moving from one page to another)
     */
    static async trackNavigation(userId, req, navigationData) {
        try {
            const {
                fromPage,
                toPage,
                fromPageTitle,
                toPageTitle,
                navigationMethod,
                metadata = {}
            } = navigationData;

            const sessionId = req.sessionID || req.headers['x-session-id'] || uuidv4();
            
            return await UserActivity.create({
                user: userId,
                sessionId,
                activityType: 'page_navigation',
                page: toPage || req.path || '/',
                pageTitle: toPageTitle || '',
                previousPage: fromPage || null,
                action: 'navigate',
                actionDetails: {
                    from: fromPage,
                    to: toPage,
                    method: navigationMethod || 'click', // click, back, forward, direct
                    fromTitle: fromPageTitle,
                    toTitle: toPageTitle
                },
                ipAddress: req.ip || req.connection?.remoteAddress || null,
                userAgent: req.headers['user-agent'] || null,
                requestId: req.requestId || uuidv4(),
                metadata: {
                    ...metadata,
                    timestamp: new Date()
                },
                status: 'success',
                timestamp: new Date()
            });
        } catch (error) {
            console.error('Error tracking navigation:', error);
            return null;
        }
    }

    /**
     * Track user action on a page
     */
    static async trackAction(userId, req, actionData) {
        try {
            const {
                page,
                pageTitle,
                action,
                elementId,
                elementType,
                elementLabel,
                data = {},
                recordId = null,
                collection = null,
                status = 'success',
                errorMessage = null,
                metadata = {}
            } = actionData;

            const sessionId = req.sessionID || req.headers['x-session-id'] || uuidv4();
            
            return await UserActivity.create({
                user: userId,
                sessionId,
                activityType: 'action',
                page: page || req.path || '/',
                pageTitle: pageTitle || '',
                action: action || 'unknown',
                elementId: elementId || null,
                elementType: elementType || null,
                elementLabel: elementLabel || null,
                actionDetails: {
                    action: action,
                    element: {
                        id: elementId,
                        type: elementType,
                        label: elementLabel
                    },
                    data: data
                },
                data: data,
                recordId: recordId,
                collection: collection,
                ipAddress: req.ip || req.connection?.remoteAddress || null,
                userAgent: req.headers['user-agent'] || null,
                requestId: req.requestId || uuidv4(),
                status: status,
                errorMessage: errorMessage,
                metadata: {
                    ...metadata,
                    method: req.method,
                    query: req.query,
                    timestamp: new Date()
                },
                timestamp: new Date()
            });
        } catch (error) {
            console.error('Error tracking action:', error);
            return null;
        }
    }

    /**
     * Track form submission
     */
    static async trackFormSubmit(userId, req, formData) {
        try {
            const {
                page,
                pageTitle,
                formId,
                formName,
                formData: submittedData = {},
                recordId = null,
                collection = null,
                status = 'success',
                errorMessage = null
            } = formData;

            const sessionId = req.sessionID || req.headers['x-session-id'] || uuidv4();
            
            return await UserActivity.create({
                user: userId,
                sessionId,
                activityType: 'form_submit',
                page: page || req.path || '/',
                pageTitle: pageTitle || '',
                action: 'submit',
                elementId: formId || null,
                elementType: 'form',
                elementLabel: formName || 'Form',
                actionDetails: {
                    formId: formId,
                    formName: formName,
                    data: submittedData
                },
                data: submittedData,
                recordId: recordId,
                collection: collection,
                ipAddress: req.ip || req.connection?.remoteAddress || null,
                userAgent: req.headers['user-agent'] || null,
                requestId: req.requestId || uuidv4(),
                status: status,
                errorMessage: errorMessage,
                timestamp: new Date()
            });
        } catch (error) {
            console.error('Error tracking form submit:', error);
            return null;
        }
    }

    /**
     * Track button click
     */
    static async trackButtonClick(userId, req, buttonData) {
        try {
            const {
                page,
                pageTitle,
                buttonId,
                buttonLabel,
                buttonType,
                data = {},
                recordId = null,
                collection = null
            } = buttonData;

            const sessionId = req.sessionID || req.headers['x-session-id'] || uuidv4();
            
            return await UserActivity.create({
                user: userId,
                sessionId,
                activityType: 'button_click',
                page: page || req.path || '/',
                pageTitle: pageTitle || '',
                action: 'click',
                elementId: buttonId || null,
                elementType: 'button',
                elementLabel: buttonLabel || 'Button',
                actionDetails: {
                    buttonId: buttonId,
                    buttonLabel: buttonLabel,
                    buttonType: buttonType,
                    data: data
                },
                data: data,
                recordId: recordId,
                collection: collection,
                ipAddress: req.ip || req.connection?.remoteAddress || null,
                userAgent: req.headers['user-agent'] || null,
                requestId: req.requestId || uuidv4(),
                status: 'success',
                timestamp: new Date()
            });
        } catch (error) {
            console.error('Error tracking button click:', error);
            return null;
        }
    }

    /**
     * Track data view
     */
    static async trackDataView(userId, req, viewData) {
        try {
            const {
                page,
                pageTitle,
                dataType,
                recordId = null,
                collection = null,
                filters = {},
                sort = {},
                metadata = {}
            } = viewData;

            const sessionId = req.sessionID || req.headers['x-session-id'] || uuidv4();
            
            return await UserActivity.create({
                user: userId,
                sessionId,
                activityType: 'data_view',
                page: page || req.path || '/',
                pageTitle: pageTitle || '',
                action: 'view_data',
                actionDetails: {
                    dataType: dataType,
                    filters: filters,
                    sort: sort
                },
                data: {
                    dataType: dataType,
                    filters: filters,
                    sort: sort
                },
                recordId: recordId,
                collection: collection,
                ipAddress: req.ip || req.connection?.remoteAddress || null,
                userAgent: req.headers['user-agent'] || null,
                requestId: req.requestId || uuidv4(),
                metadata: {
                    ...metadata,
                    timestamp: new Date()
                },
                status: 'success',
                timestamp: new Date()
            });
        } catch (error) {
            console.error('Error tracking data view:', error);
            return null;
        }
    }

    /**
     * Get user activity for a session
     */
    static async getUserSessionActivity(userId, sessionId) {
        try {
            return await UserActivity.find({
                user: userId,
                sessionId: sessionId
            })
            .sort({ timestamp: 1 })
            .lean();
        } catch (error) {
            console.error('Error getting user session activity:', error);
            return [];
        }
    }

    /**
     * Get user activity for a time period
     */
    static async getUserActivity(userId, startDate, endDate, limit = 1000) {
        try {
            const query = {
                user: userId
            };

            if (startDate || endDate) {
                query.timestamp = {};
                if (startDate) query.timestamp.$gte = new Date(startDate);
                if (endDate) query.timestamp.$lte = new Date(endDate);
            }

            return await UserActivity.find(query)
                .sort({ timestamp: -1 })
                .limit(limit)
                .lean();
        } catch (error) {
            console.error('Error getting user activity:', error);
            return [];
        }
    }

    /**
     * Get activity summary for a user
     */
    static async getActivitySummary(userId, startDate, endDate) {
        try {
            const query = {
                user: userId
            };

            if (startDate || endDate) {
                query.timestamp = {};
                if (startDate) query.timestamp.$gte = new Date(startDate);
                if (endDate) query.timestamp.$lte = new Date(endDate);
            }

            const activities = await UserActivity.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: '$activityType',
                        count: { $sum: 1 },
                        pages: { $addToSet: '$page' }
                    }
                }
            ]);

            const pageViews = await UserActivity.aggregate([
                { $match: { ...query, activityType: 'page_view' } },
                {
                    $group: {
                        _id: '$page',
                        count: { $sum: 1 },
                        totalDuration: { $sum: '$duration' }
                    }
                },
                { $sort: { count: -1 } }
            ]);

            return {
                activities,
                pageViews,
                totalActivities: await UserActivity.countDocuments(query)
            };
        } catch (error) {
            console.error('Error getting activity summary:', error);
            return { activities: [], pageViews: [], totalActivities: 0 };
        }
    }
}

module.exports = UserActivityService;

