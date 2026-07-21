const cacheService = require('../services/cacheService');

const TTL = {
    REPORT: 600,
    DASHBOARD: 300,
    LIST: 120,
    PRECOMPUTE: 3600
};

function financialCacheKey(prefix, params = {}) {
    const parts = Object.keys(params)
        .sort()
        .map((key) => `${key}=${params[key] ?? 'all'}`);
    return `fin-report:${prefix}:${parts.join(':')}`;
}

async function getOrSetReport(cacheKey, ttlSeconds, fetchFn) {
    return cacheService.getOrSet(cacheKey, ttlSeconds, fetchFn);
}

function getCachedReport(cacheKey) {
    return cacheService.get(cacheKey);
}

function setCachedReport(cacheKey, data, ttlSeconds = TTL.REPORT) {
    cacheService.set(cacheKey, data, ttlSeconds);
}

function invalidateFinancialReports() {
    // Centralized cacheService (used by EnhancedCashFlowService + many reports)
    cacheService.deletePattern('^fin-report:');
    cacheService.deletePattern('^balance-sheet-');
    cacheService.deletePattern('^cashflow:');
    cacheService.deletePattern('^cashflow-statement:');
    cacheService.deletePattern('^residence-cashflow:');
    cacheService.deletePattern('^balancesheet:');
    cacheService.deletePattern('^executive-dashboard:');
    cacheService.deletePattern('^cash-flow:');
    cacheService.deletePattern('^debtors-list:');
    cacheService.deletePattern('^detailed-cashflow:');

    // Legacy SimpleCache used by financialReportsController monthly cash flow
    try {
        const { cache } = require('./cache');
        cache.deletePattern('^cashflow:');
        cache.deletePattern('^cashflow-statement:');
        cache.deletePattern('^residence-cashflow:');
        cache.deletePattern('^detailed-cashflow:');
        cache.deletePattern('^balancesheet:');
    } catch (err) {
        // Ignore if legacy cache module is unavailable
    }
}

module.exports = {
    TTL,
    financialCacheKey,
    getOrSetReport,
    getCachedReport,
    setCachedReport,
    invalidateFinancialReports
};
