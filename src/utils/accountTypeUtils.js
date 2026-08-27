/**
 * Normalize journal line accountType for reporting (case-insensitive).
 */
function normalizeAccountType(rawType, fallbackFromCoa) {
    const t = String(rawType || fallbackFromCoa || '').trim();
    if (!t) return '';
    const lower = t.toLowerCase();
    const map = {
        asset: 'Asset',
        liability: 'Liability',
        equity: 'Equity',
        income: 'Income',
        expense: 'Expense',
        revenue: 'Income'
    };
    return map[lower] || t;
}

function isDebitNormalType(accountType) {
    const t = normalizeAccountType(accountType);
    return t === 'Asset' || t === 'Expense';
}

function applyLineToBalance(balance, debit, credit, accountType) {
    if (isDebitNormalType(accountType)) {
        return balance + debit - credit;
    }
    if (['Liability', 'Equity', 'Income'].includes(normalizeAccountType(accountType))) {
        return balance + credit - debit;
    }
    return balance + debit - credit;
}

module.exports = {
    normalizeAccountType,
    isDebitNormalType,
    applyLineToBalance
};
