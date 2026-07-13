const { auth } = require('./auth');

const ROLE_PAYMENT_ENDPOINTS = {
    admin: '/api/admin/payments',
    finance: '/api/finance/payments',
    finance_admin: '/api/finance/payments',
    finance_user: '/api/finance/payments',
    ceo: '/api/ceo/payments'
};

function getPaymentRouterForRole(role) {
    if (!getPaymentRouterForRole._cache) {
        getPaymentRouterForRole._cache = {
            admin: require('../routes/admin/paymentRoutes'),
            finance: require('../routes/finance/paymentRoutes'),
            finance_admin: require('../routes/finance/paymentRoutes'),
            finance_user: require('../routes/finance/paymentRoutes'),
            ceo: require('../routes/ceo/paymentRoutes')
        };
    }

    return getPaymentRouterForRole._cache[role] || null;
}

/**
 * Routes authenticated users to the payment API for their role.
 * Supports legacy /api/admin/payments calls from finance/ceo frontends.
 */
function paymentRoleGateway(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            error: 'Please authenticate',
            hint: 'Include Authorization: Bearer <token> header',
            endpoints: ROLE_PAYMENT_ENDPOINTS
        });
    }

    const role = req.user.role;
    const paymentRouter = getPaymentRouterForRole(role);

    if (!paymentRouter) {
        return res.status(403).json({
            success: false,
            message: `Role "${role}" does not have payment access`,
            endpoints: ROLE_PAYMENT_ENDPOINTS
        });
    }

    return paymentRouter(req, res, next);
}

function createAuthenticatedPaymentGateway() {
    const router = require('express').Router();
    router.use(auth);
    router.use(paymentRoleGateway);
    return router;
}

module.exports = {
    ROLE_PAYMENT_ENDPOINTS,
    getPaymentRouterForRole,
    paymentRoleGateway,
    createAuthenticatedPaymentGateway
};
