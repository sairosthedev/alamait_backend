const { auth } = require('./auth');
const { getExecutiveDashboard } = require('../controllers/admin/executiveDashboardController');

const ROLE_EXECUTIVE_ENDPOINTS = {
    admin: '/api/admin/dashboard/executive',
    finance: '/api/finance/dashboard/executive',
    finance_admin: '/api/finance/dashboard/executive',
    finance_user: '/api/finance/dashboard/executive',
    ceo: '/api/ceo/dashboard/executive'
};

const EXECUTIVE_ROLES = new Set(['admin', 'finance', 'finance_admin', 'finance_user', 'ceo']);

function executiveDashboardHandler(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            error: 'Please authenticate',
            hint: 'This API requires Authorization: Bearer <token>. Log in via the app, not the browser address bar.',
            endpoints: ROLE_EXECUTIVE_ENDPOINTS
        });
    }

    if (!EXECUTIVE_ROLES.has(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: `Role "${req.user.role}" cannot access the executive dashboard`,
            endpoints: ROLE_EXECUTIVE_ENDPOINTS
        });
    }

    return getExecutiveDashboard(req, res, next);
}

function createExecutiveDashboardRoute() {
    const router = require('express').Router();
    router.get('/', auth, executiveDashboardHandler);
    return router;
}

module.exports = {
    ROLE_EXECUTIVE_ENDPOINTS,
    executiveDashboardHandler,
    createExecutiveDashboardRoute
};
