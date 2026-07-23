/**
 * Shared chart-of-accounts helpers for sargable queries (avoid $regex COLLSCAN).
 */

/** Cash / bank GL codes used in cashflow opening/closing balances */
const CASH_ACCOUNT_CODES = [
    '1000', '1001', '1002', '1003', '1004', '1005', '1006', '1007', '1008', '1009',
    '1010', '1011', '1012', '1013', '1014', '1015', '1016', '1017', '1018', '1019',
    '10003' // CBZ Vault
];

/** Match student AR sub-accounts 1100-{id} without regex */
function arAccountCodeMatch() {
    return { $gte: '1100-', $lt: '1101' };
}

function cashAccountCodeMatch() {
    return { $in: CASH_ACCOUNT_CODES };
}

/** Production-safe debug logger — silent unless DEBUG=true */
function debugLog(...args) {
    if (process.env.DEBUG === 'true' || process.env.VERBOSE_LOGS === 'true') {
        console.log(...args);
    }
}

module.exports = {
    CASH_ACCOUNT_CODES,
    arAccountCodeMatch,
    cashAccountCodeMatch,
    debugLog
};
