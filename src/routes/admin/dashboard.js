const express = require('express');
const router = express.Router();
const analyticsService = require('../../services/analyticsService');
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');

// Get dashboard overview
router.get('/overview', [auth, admin], async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
        const end = endDate ? new Date(endDate) : new Date();

        const [financial, students, maintenance] = await Promise.all([
            analyticsService.getFinancialOverview(start, end),
            analyticsService.getStudentStatistics(),
            analyticsService.getMaintenanceOverview()
        ]);

        res.json({
            financial,
            students,
            maintenance
        });
    } catch (error) {
        console.error('Dashboard overview error:', error);
        res.status(500).json({ message: 'Error fetching dashboard overview' });
    }
});

// Export transactions to Excel
router.get('/export/transactions', [auth, admin], async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
        const end = endDate ? new Date(endDate) : new Date();

        const workbook = await analyticsService.exportTransactionsToExcel(start, end);
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=transactions.xlsx');
        
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Transaction export error:', error);
        res.status(500).json({ message: 'Error exporting transactions' });
    }
});

// Generate dashboard PDF report
router.get('/export/report', [auth, admin], async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
        const end = endDate ? new Date(endDate) : new Date();

        const [financial, students] = await Promise.all([
            analyticsService.getFinancialOverview(start, end),
            analyticsService.getStudentStatistics()
        ]);

        const doc = await analyticsService.generateDashboardPDF({
            financial,
            students
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=dashboard-report.pdf');

        doc.pipe(res);
        doc.end();
    } catch (error) {
        console.error('PDF report generation error:', error);
        res.status(500).json({ message: 'Error generating PDF report' });
    }
});

module.exports = router; 