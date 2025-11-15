/**
 * User Activity Service
 * Comprehensive tracking of all user activities including navigation and actions
 * Also logs to AuditLog for unified audit trail
 */

const UserActivity = require('../models/UserActivity');
const { createAuditLog } = require('../utils/auditLogger');
const { v4: uuidv4 } = require('uuid');

class UserActivityService {
    /**
     * Track user login
     */
    static async trackLogin(userId, req, deviceInfo = {}) {
        try {
            const sessionId = req.sessionID || uuidv4();
            const requestId = req.requestId || uuidv4();
            const ipAddress = req.ip || req.connection?.remoteAddress || null;
            const userAgent = req.headers['user-agent'] || null;
            
            // Create UserActivity entry
            const activity = await UserActivity.create({
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
                ipAddress,
                userAgent,
                deviceInfo: {
                    deviceIp: deviceInfo.deviceIp || null,
                    deviceIdentifier: deviceInfo.deviceIdentifier || null,
                    deviceType: deviceInfo.deviceType || null,
                    deviceName: deviceInfo.deviceName || null,
                    ...deviceInfo
                },
                requestId,
                status: 'success',
                timestamp: new Date()
            });
            
            // Also log to AuditLog
            await createAuditLog({
                action: 'login',
                collection: 'User',
                recordId: userId,
                userId: userId,
                before: null,
                after: {
                    sessionId,
                    loginTime: new Date(),
                    deviceInfo: {
                        deviceIp: deviceInfo.deviceIp || ipAddress,
                        deviceIdentifier: deviceInfo.deviceIdentifier || null,
                        deviceType: deviceInfo.deviceType || null,
                        deviceName: deviceInfo.deviceName || null,
                        ...deviceInfo
                    }
                },
                details: JSON.stringify({
                    event: 'user_login',
                    sessionId,
                    deviceInfo: {
                        deviceIp: deviceInfo.deviceIp || ipAddress,
                        deviceIdentifier: deviceInfo.deviceIdentifier || null,
                        deviceType: deviceInfo.deviceType || null,
                        deviceName: deviceInfo.deviceName || null,
                        ...deviceInfo
                    },
                    activityId: activity._id
                }),
                ipAddress,
                userAgent,
                sessionId,
                requestId,
                statusCode: 200
            });
            
            return activity;
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
            const requestId = req.requestId || uuidv4();
            const ipAddress = req.ip || req.connection?.remoteAddress || null;
            const userAgent = req.headers['user-agent'] || null;
            
            // Create UserActivity entry
            const activity = await UserActivity.create({
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
                ipAddress,
                userAgent,
                requestId,
                status: 'success',
                timestamp: new Date()
            });
            
            // Also log to AuditLog
            await createAuditLog({
                action: 'logout',
                collection: 'User',
                recordId: userId,
                userId: userId,
                before: null,
                after: {
                    sessionId: finalSessionId,
                    logoutTime: new Date()
                },
                details: JSON.stringify({
                    event: 'user_logout',
                    sessionId: finalSessionId,
                    activityId: activity._id
                }),
                ipAddress,
                userAgent,
                sessionId: finalSessionId,
                requestId,
                statusCode: 200
            });
            
            return activity;
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
                metadata = {},
                // Enhanced detail fields
                url = null,
                referrer = null,
                screenResolution = null,
                viewportSize = null,
                browserInfo = {},
                operatingSystem = null,
                browserName = null,
                browserVersion = null,
                isMobile = false,
                isTablet = false,
                isDesktop = false,
                language = null,
                timezone = null,
                loadTime = null,
                renderTime = null,
                userRole = null,
                userEmail = null,
                queryParams = {},
                routeParams = {},
                componentName = null,
                componentProps = {},
                networkType = null,
                connectionSpeed = null
            } = pageData;

            const sessionId = req.sessionID || req.headers['x-session-id'] || uuidv4();
            const requestId = req.requestId || uuidv4();
            const ipAddress = req.ip || req.connection?.remoteAddress || null;
            const userAgent = req.headers['user-agent'] || null;
            const pagePath = page || req.path || '/';
            
            // Get user info if available
            let userInfo = {};
            try {
                const User = require('../models/User');
                const user = await User.findById(userId).select('email role firstName lastName').lean();
                if (user) {
                    userInfo = {
                        userRole: userRole || user.role || null,
                        userEmail: userEmail || user.email || null,
                        userName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : null
                    };
                }
            } catch (err) {
                // Ignore user fetch errors
            }
            
            // Create UserActivity entry with enhanced details
            const activity = await UserActivity.create({
                user: userId,
                sessionId,
                activityType: 'page_view',
                page: pagePath,
                pageTitle: pageTitle || '',
                previousPage: previousPage || null,
                action: 'view',
                duration: duration || null,
                ipAddress,
                userAgent,
                requestId,
                // Enhanced detail fields
                url: url || req.url || pagePath,
                referrer: referrer || req.headers['referer'] || req.headers['referrer'] || previousPage || null,
                screenResolution: screenResolution,
                viewportSize: viewportSize,
                browserInfo: {
                    ...browserInfo,
                    name: browserName,
                    version: browserVersion,
                    os: operatingSystem
                },
                operatingSystem: operatingSystem,
                browserName: browserName,
                browserVersion: browserVersion,
                isMobile: isMobile,
                isTablet: isTablet,
                isDesktop: isDesktop,
                language: language || req.headers['accept-language']?.split(',')[0] || null,
                timezone: timezone,
                loadTime: loadTime,
                renderTime: renderTime,
                userRole: userInfo.userRole,
                userEmail: userInfo.userEmail,
                queryParams: queryParams || req.query || {},
                routeParams: routeParams,
                componentName: componentName,
                componentProps: componentProps,
                networkType: networkType,
                connectionSpeed: connectionSpeed,
                metadata: {
                    ...metadata,
                    method: req.method,
                    query: req.query,
                    body: req.body,
                    headers: {
                        'content-type': req.headers['content-type'],
                        'accept': req.headers['accept'],
                        'referer': req.headers['referer']
                    },
                    timestamp: new Date(),
                    ...userInfo
                },
                status: 'success',
                timestamp: new Date()
            });
            
            // Also log to AuditLog
            await createAuditLog({
                action: 'read',
                collection: 'Page',
                recordId: null,
                userId: userId,
                before: null,
                after: {
                    page: pagePath,
                    pageTitle: pageTitle || '',
                    previousPage: previousPage || null,
                    duration: duration || null
                },
                details: JSON.stringify({
                    event: 'page_view',
                    page: pagePath,
                    pageTitle: pageTitle || '',
                    previousPage: previousPage || null,
                    duration: duration || null,
                    sessionId,
                    activityId: activity._id,
                    ...metadata
                }),
                ipAddress,
                userAgent,
                sessionId,
                requestId,
                duration: duration || null,
                statusCode: 200
            });
            
            return activity;
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
                metadata = {},
                // Enhanced detail fields
                url = null,
                referrer = null,
                screenResolution = null,
                viewportSize = null,
                browserInfo = {},
                operatingSystem = null,
                browserName = null,
                browserVersion = null,
                isMobile = false,
                isTablet = false,
                isDesktop = false,
                language = null,
                timezone = null,
                loadTime = null,
                renderTime = null,
                userRole = null,
                userEmail = null,
                queryParams = {},
                routeParams = {},
                componentName = null,
                componentProps = {},
                networkType = null,
                connectionSpeed = null,
                navigationDuration = null
            } = navigationData;

            const sessionId = req.sessionID || req.headers['x-session-id'] || uuidv4();
            const requestId = req.requestId || uuidv4();
            const ipAddress = req.ip || req.connection?.remoteAddress || null;
            const userAgent = req.headers['user-agent'] || null;
            const toPagePath = toPage || req.path || '/';
            
            // Get user info if available
            let userInfo = {};
            try {
                const User = require('../models/User');
                const user = await User.findById(userId).select('email role firstName lastName').lean();
                if (user) {
                    userInfo = {
                        userRole: userRole || user.role || null,
                        userEmail: userEmail || user.email || null,
                        userName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : null
                    };
                }
            } catch (err) {
                // Ignore user fetch errors
            }
            
            // Create UserActivity entry with enhanced details
            const activity = await UserActivity.create({
                user: userId,
                sessionId,
                activityType: 'page_navigation',
                page: toPagePath,
                pageTitle: toPageTitle || '',
                previousPage: fromPage || null,
                action: 'navigate',
                actionDetails: {
                    from: fromPage,
                    to: toPagePath,
                    method: navigationMethod || 'click', // click, back, forward, direct
                    fromTitle: fromPageTitle,
                    toTitle: toPageTitle,
                    duration: navigationDuration
                },
                duration: navigationDuration,
                ipAddress,
                userAgent,
                requestId,
                // Enhanced detail fields
                url: url || req.url || toPagePath,
                referrer: referrer || req.headers['referer'] || req.headers['referrer'] || fromPage || null,
                screenResolution: screenResolution,
                viewportSize: viewportSize,
                browserInfo: {
                    ...browserInfo,
                    name: browserName,
                    version: browserVersion,
                    os: operatingSystem
                },
                operatingSystem: operatingSystem,
                browserName: browserName,
                browserVersion: browserVersion,
                isMobile: isMobile,
                isTablet: isTablet,
                isDesktop: isDesktop,
                language: language || req.headers['accept-language']?.split(',')[0] || null,
                timezone: timezone,
                loadTime: loadTime,
                renderTime: renderTime,
                userRole: userInfo.userRole,
                userEmail: userInfo.userEmail,
                queryParams: queryParams || req.query || {},
                routeParams: routeParams,
                componentName: componentName,
                componentProps: componentProps,
                networkType: networkType,
                connectionSpeed: connectionSpeed,
                metadata: {
                    ...metadata,
                    method: req.method,
                    query: req.query,
                    body: req.body,
                    headers: {
                        'content-type': req.headers['content-type'],
                        'accept': req.headers['accept'],
                        'referer': req.headers['referer']
                    },
                    navigationMethod: navigationMethod || 'click',
                    timestamp: new Date(),
                    ...userInfo
                },
                status: 'success',
                timestamp: new Date()
            });
            
            // Also log to AuditLog
            await createAuditLog({
                action: 'read',
                collection: 'Page',
                recordId: null,
                userId: userId,
                before: {
                    page: fromPage,
                    pageTitle: fromPageTitle
                },
                after: {
                    page: toPagePath,
                    pageTitle: toPageTitle
                },
                details: JSON.stringify({
                    event: 'page_navigation',
                    from: fromPage,
                    to: toPagePath,
                    fromTitle: fromPageTitle,
                    toTitle: toPageTitle,
                    method: navigationMethod || 'click',
                    sessionId,
                    activityId: activity._id,
                    ...metadata
                }),
                ipAddress,
                userAgent,
                sessionId,
                requestId,
                statusCode: 200
            });
            
            return activity;
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
                metadata = {},
                // Enhanced detail fields
                url = null,
                referrer = null,
                screenResolution = null,
                viewportSize = null,
                browserInfo = {},
                operatingSystem = null,
                browserName = null,
                browserVersion = null,
                isMobile = false,
                isTablet = false,
                isDesktop = false,
                language = null,
                timezone = null,
                actionContext = {},
                relatedRecords = [],
                loadTime = null,
                renderTime = null,
                interactionTime = null,
                userRole = null,
                userEmail = null,
                queryParams = {},
                routeParams = {},
                componentName = null,
                componentProps = {},
                errorDetails = null,
                result = null,
                networkType = null,
                connectionSpeed = null
            } = actionData;

            const sessionId = req.sessionID || req.headers['x-session-id'] || uuidv4();
            const requestId = req.requestId || uuidv4();
            const ipAddress = req.ip || req.connection?.remoteAddress || null;
            const userAgent = req.headers['user-agent'] || null;
            const pagePath = page || req.path || '/';
            const actionName = action || 'unknown';
            
            // Get user info if available
            let userInfo = {};
            try {
                const User = require('../models/User');
                const user = await User.findById(userId).select('email role firstName lastName').lean();
                if (user) {
                    userInfo = {
                        userRole: userRole || user.role || null,
                        userEmail: userEmail || user.email || null,
                        userName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : null
                    };
                }
            } catch (err) {
                // Ignore user fetch errors
            }
            
            // Create UserActivity entry with enhanced details
            const activity = await UserActivity.create({
                user: userId,
                sessionId,
                activityType: 'action',
                page: pagePath,
                pageTitle: pageTitle || '',
                action: actionName,
                elementId: elementId || null,
                elementType: elementType || null,
                elementLabel: elementLabel || null,
                actionDetails: {
                    action: actionName,
                    element: {
                        id: elementId,
                        type: elementType,
                        label: elementLabel
                    },
                    data: data,
                    context: actionContext,
                    relatedRecords: relatedRecords
                },
                data: data,
                recordId: recordId,
                collection: collection,
                ipAddress,
                userAgent,
                requestId,
                status: status,
                errorMessage: errorMessage,
                // Enhanced detail fields
                url: url || req.url || pagePath,
                referrer: referrer || req.headers['referer'] || req.headers['referrer'] || null,
                screenResolution: screenResolution,
                viewportSize: viewportSize,
                browserInfo: {
                    ...browserInfo,
                    name: browserName,
                    version: browserVersion,
                    os: operatingSystem
                },
                operatingSystem: operatingSystem,
                browserName: browserName,
                browserVersion: browserVersion,
                isMobile: isMobile,
                isTablet: isTablet,
                isDesktop: isDesktop,
                language: language || req.headers['accept-language']?.split(',')[0] || null,
                timezone: timezone,
                actionContext: actionContext,
                relatedRecords: relatedRecords,
                loadTime: loadTime,
                renderTime: renderTime,
                interactionTime: interactionTime,
                userRole: userInfo.userRole,
                userEmail: userInfo.userEmail,
                queryParams: queryParams || req.query || {},
                routeParams: routeParams,
                componentName: componentName,
                componentProps: componentProps,
                errorDetails: errorDetails || (errorMessage ? { message: errorMessage } : null),
                result: result,
                networkType: networkType,
                connectionSpeed: connectionSpeed,
                metadata: {
                    ...metadata,
                    method: req.method,
                    query: req.query,
                    body: req.body,
                    headers: {
                        'content-type': req.headers['content-type'],
                        'accept': req.headers['accept']
                    },
                    timestamp: new Date(),
                    ...userInfo
                },
                timestamp: new Date()
            });
            
            // Also log to AuditLog - map action to audit log action type
            let auditAction = actionName;
            if (actionName.includes('create') || actionName.includes('add')) {
                auditAction = 'create';
            } else if (actionName.includes('update') || actionName.includes('edit')) {
                auditAction = 'update';
            } else if (actionName.includes('delete') || actionName.includes('remove')) {
                auditAction = 'delete';
            } else if (actionName.includes('view') || actionName.includes('read')) {
                auditAction = 'read';
            }
            
            await createAuditLog({
                action: auditAction,
                collection: collection || 'UserActivity',
                recordId: recordId,
                userId: userId,
                before: null,
                after: {
                    action: actionName,
                    page: pagePath,
                    pageTitle: pageTitle || '',
                    element: {
                        id: elementId,
                        type: elementType,
                        label: elementLabel
                    },
                    data: data
                },
                details: JSON.stringify({
                    event: 'user_action',
                    action: actionName,
                    page: pagePath,
                    pageTitle: pageTitle || '',
                    elementId: elementId,
                    elementType: elementType,
                    elementLabel: elementLabel,
                    recordId: recordId,
                    collection: collection,
                    sessionId,
                    activityId: activity._id,
                    ...metadata
                }),
                ipAddress,
                userAgent,
                sessionId,
                requestId,
                statusCode: status === 'success' ? 200 : 400,
                errorMessage: errorMessage
            });
            
            return activity;
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
                errorMessage = null,
                // Enhanced detail fields
                formFields = [],
                formValues = {},
                url = null,
                referrer = null,
                screenResolution = null,
                viewportSize = null,
                browserInfo = {},
                operatingSystem = null,
                browserName = null,
                browserVersion = null,
                isMobile = false,
                isTablet = false,
                isDesktop = false,
                language = null,
                timezone = null,
                loadTime = null,
                renderTime = null,
                interactionTime = null,
                userRole = null,
                userEmail = null,
                queryParams = {},
                routeParams = {},
                componentName = null,
                componentProps = {},
                errorDetails = null,
                result = null,
                networkType = null,
                connectionSpeed = null,
                metadata = {}
            } = formData;

            const sessionId = req.sessionID || req.headers['x-session-id'] || uuidv4();
            const requestId = req.requestId || uuidv4();
            const ipAddress = req.ip || req.connection?.remoteAddress || null;
            const userAgent = req.headers['user-agent'] || null;
            const pagePath = page || req.path || '/';
            
            // Get user info if available
            let userInfo = {};
            try {
                const User = require('../models/User');
                const user = await User.findById(userId).select('email role firstName lastName').lean();
                if (user) {
                    userInfo = {
                        userRole: userRole || user.role || null,
                        userEmail: userEmail || user.email || null,
                        userName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : null
                    };
                }
            } catch (err) {
                // Ignore user fetch errors
            }
            
            // Extract form fields if not provided
            const extractedFormFields = formFields.length > 0 ? formFields : Object.keys(submittedData || {});
            const extractedFormValues = formValues && Object.keys(formValues).length > 0 ? formValues : submittedData;
            
            // Create UserActivity entry with enhanced details
            const activity = await UserActivity.create({
                user: userId,
                sessionId,
                activityType: 'form_submit',
                page: pagePath,
                pageTitle: pageTitle || '',
                action: 'submit',
                elementId: formId || null,
                elementType: 'form',
                elementLabel: formName || 'Form',
                actionDetails: {
                    formId: formId,
                    formName: formName,
                    data: submittedData,
                    fields: extractedFormFields,
                    values: extractedFormValues
                },
                data: submittedData,
                recordId: recordId,
                collection: collection,
                ipAddress,
                userAgent,
                requestId,
                status: status,
                errorMessage: errorMessage,
                // Enhanced detail fields
                url: url || req.url || pagePath,
                referrer: referrer || req.headers['referer'] || req.headers['referrer'] || null,
                screenResolution: screenResolution,
                viewportSize: viewportSize,
                browserInfo: {
                    ...browserInfo,
                    name: browserName,
                    version: browserVersion,
                    os: operatingSystem
                },
                operatingSystem: operatingSystem,
                browserName: browserName,
                browserVersion: browserVersion,
                isMobile: isMobile,
                isTablet: isTablet,
                isDesktop: isDesktop,
                language: language || req.headers['accept-language']?.split(',')[0] || null,
                timezone: timezone,
                formFields: extractedFormFields,
                formValues: extractedFormValues,
                loadTime: loadTime,
                renderTime: renderTime,
                interactionTime: interactionTime,
                userRole: userInfo.userRole,
                userEmail: userInfo.userEmail,
                queryParams: queryParams || req.query || {},
                routeParams: routeParams,
                componentName: componentName,
                componentProps: componentProps,
                errorDetails: errorDetails || (errorMessage ? { message: errorMessage } : null),
                result: result,
                networkType: networkType,
                connectionSpeed: connectionSpeed,
                metadata: {
                    ...metadata,
                    method: req.method,
                    query: req.query,
                    body: req.body,
                    headers: {
                        'content-type': req.headers['content-type'],
                        'accept': req.headers['accept']
                    },
                    timestamp: new Date(),
                    ...userInfo
                },
                timestamp: new Date()
            });
            
            // Also log to AuditLog
            await createAuditLog({
                action: 'create', // Form submissions typically create records
                collection: collection || 'Form',
                recordId: recordId,
                userId: userId,
                before: null,
                after: {
                    formId: formId,
                    formName: formName,
                    data: submittedData
                },
                details: JSON.stringify({
                    event: 'form_submit',
                    formId: formId,
                    formName: formName,
                    page: pagePath,
                    pageTitle: pageTitle || '',
                    recordId: recordId,
                    collection: collection,
                    sessionId,
                    activityId: activity._id
                }),
                ipAddress,
                userAgent,
                sessionId,
                requestId,
                statusCode: status === 'success' ? 200 : 400,
                errorMessage: errorMessage
            });
            
            return activity;
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
                collection = null,
                // Enhanced detail fields
                url = null,
                referrer = null,
                screenResolution = null,
                viewportSize = null,
                browserInfo = {},
                operatingSystem = null,
                browserName = null,
                browserVersion = null,
                isMobile = false,
                isTablet = false,
                isDesktop = false,
                language = null,
                timezone = null,
                actionContext = {},
                relatedRecords = [],
                loadTime = null,
                renderTime = null,
                interactionTime = null,
                userRole = null,
                userEmail = null,
                queryParams = {},
                routeParams = {},
                componentName = null,
                componentProps = {},
                result = null,
                networkType = null,
                connectionSpeed = null,
                metadata = {}
            } = buttonData;

            const sessionId = req.sessionID || req.headers['x-session-id'] || uuidv4();
            const requestId = req.requestId || uuidv4();
            const ipAddress = req.ip || req.connection?.remoteAddress || null;
            const userAgent = req.headers['user-agent'] || null;
            const pagePath = page || req.path || '/';
            
            // Get user info if available
            let userInfo = {};
            try {
                const User = require('../models/User');
                const user = await User.findById(userId).select('email role firstName lastName').lean();
                if (user) {
                    userInfo = {
                        userRole: userRole || user.role || null,
                        userEmail: userEmail || user.email || null,
                        userName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : null
                    };
                }
            } catch (err) {
                // Ignore user fetch errors
            }
            
            // Create UserActivity entry with enhanced details
            const activity = await UserActivity.create({
                user: userId,
                sessionId,
                activityType: 'button_click',
                page: pagePath,
                pageTitle: pageTitle || '',
                action: 'click',
                elementId: buttonId || null,
                elementType: 'button',
                elementLabel: buttonLabel || 'Button',
                actionDetails: {
                    buttonId: buttonId,
                    buttonLabel: buttonLabel,
                    buttonType: buttonType,
                    data: data,
                    context: actionContext
                },
                data: data,
                recordId: recordId,
                collection: collection,
                ipAddress,
                userAgent,
                requestId,
                // Enhanced detail fields
                url: url || req.url || pagePath,
                referrer: referrer || req.headers['referer'] || req.headers['referrer'] || null,
                screenResolution: screenResolution,
                viewportSize: viewportSize,
                browserInfo: {
                    ...browserInfo,
                    name: browserName,
                    version: browserVersion,
                    os: operatingSystem
                },
                operatingSystem: operatingSystem,
                browserName: browserName,
                browserVersion: browserVersion,
                isMobile: isMobile,
                isTablet: isTablet,
                isDesktop: isDesktop,
                language: language || req.headers['accept-language']?.split(',')[0] || null,
                timezone: timezone,
                actionContext: actionContext,
                relatedRecords: relatedRecords,
                loadTime: loadTime,
                renderTime: renderTime,
                interactionTime: interactionTime,
                userRole: userInfo.userRole,
                userEmail: userInfo.userEmail,
                queryParams: queryParams || req.query || {},
                routeParams: routeParams,
                componentName: componentName,
                componentProps: componentProps,
                result: result,
                networkType: networkType,
                connectionSpeed: connectionSpeed,
                metadata: {
                    ...metadata,
                    method: req.method,
                    query: req.query,
                    body: req.body,
                    headers: {
                        'content-type': req.headers['content-type'],
                        'accept': req.headers['accept']
                    },
                    timestamp: new Date(),
                    ...userInfo
                },
                status: 'success',
                timestamp: new Date()
            });
            
            // Also log to AuditLog
            await createAuditLog({
                action: 'read', // Button clicks are typically read/view actions
                collection: collection || 'Button',
                recordId: recordId,
                userId: userId,
                before: null,
                after: {
                    buttonId: buttonId,
                    buttonLabel: buttonLabel,
                    buttonType: buttonType,
                    data: data
                },
                details: JSON.stringify({
                    event: 'button_click',
                    buttonId: buttonId,
                    buttonLabel: buttonLabel,
                    buttonType: buttonType,
                    page: pagePath,
                    pageTitle: pageTitle || '',
                    recordId: recordId,
                    collection: collection,
                    sessionId,
                    activityId: activity._id
                }),
                ipAddress,
                userAgent,
                sessionId,
                requestId,
                statusCode: 200
            });
            
            return activity;
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
                metadata = {},
                // Enhanced detail fields
                url = null,
                referrer = null,
                screenResolution = null,
                viewportSize = null,
                browserInfo = {},
                operatingSystem = null,
                browserName = null,
                browserVersion = null,
                isMobile = false,
                isTablet = false,
                isDesktop = false,
                language = null,
                timezone = null,
                loadTime = null,
                renderTime = null,
                userRole = null,
                userEmail = null,
                queryParams = {},
                routeParams = {},
                componentName = null,
                componentProps = {},
                networkType = null,
                connectionSpeed = null,
                recordCount = null,
                totalRecords = null
            } = viewData;

            const sessionId = req.sessionID || req.headers['x-session-id'] || uuidv4();
            const requestId = req.requestId || uuidv4();
            const ipAddress = req.ip || req.connection?.remoteAddress || null;
            const userAgent = req.headers['user-agent'] || null;
            const pagePath = page || req.path || '/';
            
            // Get user info if available
            let userInfo = {};
            try {
                const User = require('../models/User');
                const user = await User.findById(userId).select('email role firstName lastName').lean();
                if (user) {
                    userInfo = {
                        userRole: userRole || user.role || null,
                        userEmail: userEmail || user.email || null,
                        userName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : null
                    };
                }
            } catch (err) {
                // Ignore user fetch errors
            }
            
            // Create UserActivity entry with enhanced details
            const activity = await UserActivity.create({
                user: userId,
                sessionId,
                activityType: 'data_view',
                page: pagePath,
                pageTitle: pageTitle || '',
                action: 'view_data',
                actionDetails: {
                    dataType: dataType,
                    filters: filters,
                    sort: sort,
                    recordCount: recordCount,
                    totalRecords: totalRecords
                },
                data: {
                    dataType: dataType,
                    filters: filters,
                    sort: sort,
                    recordCount: recordCount,
                    totalRecords: totalRecords
                },
                recordId: recordId,
                collection: collection,
                ipAddress,
                userAgent,
                requestId,
                // Enhanced detail fields
                url: url || req.url || pagePath,
                referrer: referrer || req.headers['referer'] || req.headers['referrer'] || null,
                screenResolution: screenResolution,
                viewportSize: viewportSize,
                browserInfo: {
                    ...browserInfo,
                    name: browserName,
                    version: browserVersion,
                    os: operatingSystem
                },
                operatingSystem: operatingSystem,
                browserName: browserName,
                browserVersion: browserVersion,
                isMobile: isMobile,
                isTablet: isTablet,
                isDesktop: isDesktop,
                language: language || req.headers['accept-language']?.split(',')[0] || null,
                timezone: timezone,
                loadTime: loadTime,
                renderTime: renderTime,
                userRole: userInfo.userRole,
                userEmail: userInfo.userEmail,
                queryParams: queryParams || req.query || {},
                routeParams: routeParams,
                componentName: componentName,
                componentProps: componentProps,
                networkType: networkType,
                connectionSpeed: connectionSpeed,
                metadata: {
                    ...metadata,
                    method: req.method,
                    query: req.query,
                    body: req.body,
                    headers: {
                        'content-type': req.headers['content-type'],
                        'accept': req.headers['accept']
                    },
                    recordCount: recordCount,
                    totalRecords: totalRecords,
                    timestamp: new Date(),
                    ...userInfo
                },
                status: 'success',
                timestamp: new Date()
            });
            
            // Also log to AuditLog
            await createAuditLog({
                action: 'read',
                collection: collection || 'Data',
                recordId: recordId,
                userId: userId,
                before: null,
                after: {
                    dataType: dataType,
                    filters: filters,
                    sort: sort
                },
                details: JSON.stringify({
                    event: 'data_view',
                    dataType: dataType,
                    page: pagePath,
                    pageTitle: pageTitle || '',
                    filters: filters,
                    sort: sort,
                    recordId: recordId,
                    collection: collection,
                    sessionId,
                    activityId: activity._id,
                    ...metadata
                }),
                ipAddress,
                userAgent,
                sessionId,
                requestId,
                statusCode: 200
            });
            
            return activity;
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
     * If userId is null, returns all activities (for CEO/admin)
     */
    static async getUserActivity(userId, startDate, endDate, limit = 1000) {
        try {
            // If userId is null, return all activities (for CEO/admin viewing all activities)
            const query = userId ? { user: userId } : {};

            if (startDate || endDate) {
                query.timestamp = {};
                if (startDate) query.timestamp.$gte = new Date(startDate);
                if (endDate) query.timestamp.$lte = new Date(endDate);
            }

            return await UserActivity.find(query)
                .populate('user', 'firstName lastName email role')
                .sort({ timestamp: -1 })
                .limit(limit)
                .lean();
        } catch (error) {
            console.error('Error getting user activity:', error);
            return [];
        }
    }

    /**
     * Get paginated user activity
     */
    static async getPaginatedUserActivity(userId, options = {}) {
        try {
            const {
                page = 1,
                limit = 50,
                startDate = null,
                endDate = null,
                activityType = null,
                pagePath = null, // Filter by page path (renamed to avoid conflict with pagination)
                sortBy = 'timestamp',
                sortOrder = 'desc'
            } = options;

            // If userId is null, return all activities (for CEO/admin viewing all activities)
            const query = userId ? { user: userId } : {};

            // Date range filter
            if (startDate || endDate) {
                query.timestamp = {};
                if (startDate) query.timestamp.$gte = new Date(startDate);
                if (endDate) query.timestamp.$lte = new Date(endDate);
            }

            // Activity type filter
            if (activityType) {
                query.activityType = activityType;
            }

            // Page path filter
            if (pagePath) {
                query.page = pagePath;
            }

            // Calculate pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);
            const sortOptions = {};
            sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

            // Get total count for pagination
            const total = await UserActivity.countDocuments(query);

            // Get paginated results
            const activities = await UserActivity.find(query)
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit))
                .populate('user', 'firstName lastName email role')
                .lean();

            return {
                activities,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / parseInt(limit)),
                    hasNextPage: skip + parseInt(limit) < total,
                    hasPrevPage: parseInt(page) > 1
                }
            };
        } catch (error) {
            console.error('Error getting paginated user activity:', error);
            return {
                activities: [],
                pagination: {
                    page: 1,
                    limit: 50,
                    total: 0,
                    totalPages: 0,
                    hasNextPage: false,
                    hasPrevPage: false
                }
            };
        }
    }

    /**
     * Get activity summary for a user
     */
    static async getActivitySummary(userId, startDate, endDate) {
        try {
            // If userId is null, return summary for all activities (for CEO/admin)
            const query = userId ? { user: userId } : {};

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

