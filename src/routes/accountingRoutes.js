const express = require('express');
const router = express.Router();
const AccountingController = require('../controllers/accountingController');

// Create monthly accruals
router.post('/monthly-accruals', AccountingController.createMonthlyAccruals);

// Get monthly financial reports
router.get('/income-statement', AccountingController.getMonthlyIncomeStatement);
router.get('/balance-sheet', AccountingController.getMonthlyBalanceSheet);
router.get('/balance-sheet-breakdown', AccountingController.getMonthlyBreakdownBalanceSheet);
router.get('/balance-sheet-monthly', AccountingController.getMonthlyBalanceSheetWithCodes);

// Get monthly progression for all residences
router.get('/income-statement/residences/monthly', AccountingController.getMonthlyProgressionIncomeStatement);
router.get('/cash-flow/residences/monthly', AccountingController.getMonthlyProgressionCashFlow);

// Get balance sheet by residence
router.get('/balance-sheet/residence/:residenceId', AccountingController.getBalanceSheetByResidence);
router.get('/balance-sheet/residences', AccountingController.getBalanceSheetAllResidences);
router.get('/balance-sheet/residences/monthly', AccountingController.getMonthlyProgressionAllResidences);

router.get('/cash-flow', AccountingController.getMonthlyCashFlow);
router.get('/financial-reports', AccountingController.getMonthlyFinancialReports);

module.exports = router;
