const mongoose = require('mongoose');
const TransactionEntry = require('../models/TransactionEntry');
const Account = require('../models/Account');
const { normalizeAccountType, applyLineToBalance } = require('../utils/accountTypeUtils');

function endOfDayUtc(dateStr) {
    const s = String(dateStr).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T23:59:59.999Z`);
    return new Date(s);
}

function buildBalancesFromEntries(entries, coaMap = null) {
    const accountBalances = {};
    for (const tx of entries) {
        if (!tx.entries?.length) continue;
        for (const line of tx.entries) {
            const code = String(line.accountCode);
            const coaType = coaMap?.get(code);
            const accountType = normalizeAccountType(line.accountType, coaType);
            if (!accountBalances[code]) {
                accountBalances[code] = {
                    accountCode: code,
                    accountName: line.accountName,
                    accountType,
                    totalDebits: 0,
                    totalCredits: 0,
                    balance: 0
                };
            }
            const debit = line.debit || 0;
            const credit = line.credit || 0;
            accountBalances[code].totalDebits += debit;
            accountBalances[code].totalCredits += credit;
            accountBalances[code].balance = applyLineToBalance(
                accountBalances[code].balance,
                debit,
                credit,
                accountType
            );
        }
    }
    return accountBalances;
}

function sumByType(balances, type) {
    return Object.values(balances)
        .filter((a) => normalizeAccountType(a.accountType) === type)
        .reduce((s, a) => s + a.balance, 0);
}

async function findUnbalancedTransactions(asOfDate, residenceId) {
    const query = { date: { $lte: asOfDate }, status: 'posted' };
    if (residenceId) query.residence = new mongoose.Types.ObjectId(residenceId);

    const txs = await TransactionEntry.find(query)
        .select('transactionId date description source totalDebit totalCredit entries residence metadata')
        .lean();

    const bad = [];
    for (const tx of txs) {
        const lineDr = (tx.entries || []).reduce((s, e) => s + (e.debit || 0), 0);
        const lineCr = (tx.entries || []).reduce((s, e) => s + (e.credit || 0), 0);
        const headerGap = Math.abs((tx.totalDebit || 0) - (tx.totalCredit || 0));
        const lineGap = Math.abs(lineDr - lineCr);
        if (headerGap > 0.01 || lineGap > 0.01) {
            bad.push({
                _id: tx._id.toString(),
                transactionId: tx.transactionId,
                date: tx.date,
                source: tx.source,
                description: tx.description,
                totalDebit: tx.totalDebit,
                totalCredit: tx.totalCredit,
                lineDebit: lineDr,
                lineCredit: lineCr,
                gap: Math.max(headerGap, lineGap),
                lineGap,
                headerBalanced: headerGap <= 0.01,
                linesBalanced: lineGap <= 0.01,
                issueType: 'unbalanced_lines',
                entries: (tx.entries || []).map((e) => ({
                    _id: e._id?.toString(),
                    accountCode: e.accountCode,
                    accountName: e.accountName,
                    accountType: e.accountType,
                    debit: e.debit || 0,
                    credit: e.credit || 0,
                    description: e.description
                })),
                suggestedFix: buildSuggestedFix(tx, lineDr, lineCr)
            });
        }
    }
    return bad.sort((a, b) => b.gap - a.gap);
}

async function findMisclassifiedAccountTypes(asOfDate, coaMap, residenceId) {
    const query = { date: { $lte: asOfDate }, status: 'posted', voided: { $ne: true } };
    if (residenceId) query.residence = new mongoose.Types.ObjectId(residenceId);

    const txs = await TransactionEntry.find(query)
        .select('transactionId date description source entries')
        .lean();

    const issues = [];
    for (const tx of txs) {
        for (const line of tx.entries || []) {
            const raw = line.accountType || '';
            const code = String(line.accountCode);
            const coaType = coaMap.get(code);
            const normalized = normalizeAccountType(raw, coaType);
            const rawNormalized = raw.trim();
            const wrongCase = rawNormalized && normalized && rawNormalized !== normalized;
            const wrongVsCoa = coaType && normalized && normalizeAccountType(coaType) !== normalized;

            if (!wrongCase && !wrongVsCoa) continue;

            const debit = line.debit || 0;
            const credit = line.credit || 0;
            const wrongBalance = applyLineToBalance(0, debit, credit, raw);
            const correctBalance = applyLineToBalance(0, debit, credit, normalized);
            const impact = correctBalance - wrongBalance;
            if (Math.abs(impact) < 0.01) continue;

            issues.push({
                _id: tx._id.toString(),
                transactionId: tx.transactionId,
                date: tx.date,
                description: tx.description,
                source: tx.source,
                issueType: 'misclassified_account_type',
                entryId: line._id?.toString(),
                accountCode: code,
                accountName: line.accountName,
                accountType: raw,
                expectedAccountType: coaType ? normalizeAccountType(coaType) : normalized,
                debit,
                credit,
                equationImpact: impact,
                suggestedFix: {
                    action: 'fix_account_type',
                    accountType: normalized,
                    note: `Change accountType from "${raw}" to "${normalized}" on this journal line`
                }
            });
        }
    }

    return issues.sort((a, b) => Math.abs(b.equationImpact) - Math.abs(a.equationImpact));
}

function buildSuggestedFix(tx, lineDr, lineCr) {
    const diff = lineDr - lineCr;
    if (Math.abs(diff) < 0.01) return null;
    const cashLine = (tx.entries || []).find((e) => String(e.accountCode) === '1000' && (e.debit || 0) > 0);
    if (cashLine && diff < 0) {
        return {
            action: 'increase_cash_debit',
            accountCode: cashLine.accountCode,
            currentDebit: cashLine.debit,
            suggestedDebit: (cashLine.debit || 0) + Math.abs(diff),
            note: 'Cash debit is lower than total credits on other lines'
        };
    }
    if (diff > 0) {
        return {
            action: 'add_missing_credit',
            amount: diff,
            note: 'Add a credit line or increase an existing credit to match debits'
        };
    }
    return {
        action: 'add_missing_debit',
        amount: Math.abs(diff),
        note: 'Add a debit line or increase an existing debit to match credits'
    };
}

class BalanceSheetReconciliationService {
    static async reconcile(asOf, residence = null) {
        const asOfDate = endOfDayUtc(asOf);
        const postedQuery = {
            date: { $lte: asOfDate },
            status: 'posted',
            voided: { $ne: true }
        };
        if (residence) postedQuery.residence = new mongoose.Types.ObjectId(residence);

        const accounts = await Account.find({}).select('code type').lean();
        const coaMap = new Map(accounts.map((a) => [String(a.code), a.type]));

        const [unbalanced, misclassified, postedEntries] = await Promise.all([
            findUnbalancedTransactions(asOfDate, residence),
            findMisclassifiedAccountTypes(asOfDate, coaMap, residence),
            TransactionEntry.find(postedQuery).lean()
        ]);

        const balances = buildBalancesFromEntries(postedEntries, coaMap);
        let tbDebits = 0;
        let tbCredits = 0;
        for (const a of Object.values(balances)) {
            tbDebits += a.totalDebits;
            tbCredits += a.totalCredits;
        }
        const trialBalanceGap = tbDebits - tbCredits;

        const totalAssets = sumByType(balances, 'Asset');
        const totalLiabilities = sumByType(balances, 'Liability');
        const totalEquityLedger = sumByType(balances, 'Equity');
        const totalIncome = sumByType(balances, 'Income');
        const totalExpenses = sumByType(balances, 'Expense');
        const netIncome = totalIncome - totalExpenses;
        const rhs = totalLiabilities + totalEquityLedger + netIncome;
        const accountingEquationGap = totalAssets - rhs;

        const re3101 = Object.values(balances).find((a) => a.accountCode === '3101');
        const journalIssues = [...unbalanced, ...misclassified];

        return {
            asOf,
            residence: residence || null,
            summary: {
                balanced: Math.abs(accountingEquationGap) < 0.01
                    && unbalanced.length === 0
                    && misclassified.length === 0,
                trialBalanceGap,
                accountingEquationGap,
                unbalancedTransactionCount: unbalanced.length,
                misclassifiedLineCount: misclassified.length,
                journalIssueCount: journalIssues.length,
                totalAssets,
                totalLiabilities,
                totalEquityLedger,
                netIncome,
                retainedEarningsLedger: re3101?.balance || 0
            },
            unbalancedTransactions: unbalanced,
            misclassifiedLines: misclassified,
            journalIssues,
            remediationSteps: BalanceSheetReconciliationService.buildSteps(
                unbalanced,
                misclassified,
                trialBalanceGap,
                accountingEquationGap
            )
        };
    }

    static buildSteps(unbalanced, misclassified, trialBalanceGap, accountingEquationGap) {
        const steps = [];
        if (unbalanced.length) {
            steps.push({
                order: 1,
                title: 'Fix unbalanced journal entries',
                detail: `Edit ${unbalanced.length} transaction(s) in Finance → Transactions so line debits equal line credits.`,
                uiPath: '/finance/transactions'
            });
        }
        if (misclassified.length) {
            steps.push({
                order: steps.length + 1,
                title: 'Fix misclassified account types on journal lines',
                detail: `${misclassified.length} line(s) use wrong accountType casing (e.g. "asset" vs "Asset") — fix in Finance → Transactions. Total equation impact: $${misclassified.reduce((s, m) => s + Math.abs(m.equationImpact), 0).toFixed(2)}.`,
                uiPath: '/finance/transactions'
            });
        }
        if (Math.abs(trialBalanceGap) > 0.01) {
            steps.push({
                order: steps.length + 1,
                title: 'Verify trial balance',
                detail: `Trial balance gap is $${trialBalanceGap.toFixed(2)}. After fixing journals, re-check Financial Reports → Trial Balance.`,
                uiPath: '/finance/reports/trial-balance'
            });
        }
        if (Math.abs(accountingEquationGap) > 0.01 && unbalanced.length === 0 && misclassified.length === 0) {
            steps.push({
                order: steps.length + 1,
                title: 'Drill into accounts',
                detail: `Equation gap $${accountingEquationGap.toFixed(2)} with balanced journals — use balance sheet account drill-down on AR, cash, AP.`,
                uiPath: '/finance/reports/balance-sheet'
            });
        }
        steps.push({
            order: steps.length + 1,
            title: 'Re-run reconciliation',
            detail: 'Refresh this report after each fix until summary.balanced is true.',
            uiPath: '/finance/reports/balance-sheet-reconciliation'
        });
        return steps;
    }
}

module.exports = BalanceSheetReconciliationService;
