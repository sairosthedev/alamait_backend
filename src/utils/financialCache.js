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
    cacheService.deletePattern('^fin-report:');
    cacheService.deletePattern('^balance-sheet-');
    cacheService.deletePattern('^cashflow:');
    cacheService.deletePattern('^executive-dashboard:');
    cacheService.deletePattern('^cash-flow:');
    cacheService.deletePattern('^debtors-list:');
    cacheService.deletePattern('^detailed-cashflow:');
}

module.exports = {
    TTL,
    financialCacheKey,
    getOrSetReport,
    getCachedReport,
    setCachedReport,
    invalidateFinancialReports
};
