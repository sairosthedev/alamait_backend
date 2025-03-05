const Payment = require('../models/Payment');
const Maintenance = require('../models/Maintenance');
const Student = require('../models/Student');
const Booking = require('../models/Booking');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

class AnalyticsService {
    async getFinancialOverview(startDate, endDate) {
        const payments = await Payment.find({
            date: { $gte: startDate, $lte: endDate }
        });
        
        const income = payments.reduce((sum, p) => sum + p.amount, 0);
        const expenses = await this.calculateExpenses(startDate, endDate);
        const netProfit = income - expenses.total;
        const profitMargin = (netProfit / income) * 100;

        return {
            totalIncome: income,
            expenses: expenses,
            netProfit: netProfit,
            profitMargin: profitMargin
        };
    }

    async calculateExpenses(startDate, endDate) {
        const maintenance = await Maintenance.find({
            completedDate: { $gte: startDate, $lte: endDate }
        });
        
        const maintenanceCost = maintenance.reduce((sum, m) => sum + (m.cost || 0), 0);
        
        // Mock data for other expenses (replace with actual data)
        const utilities = maintenanceCost * 0.3;
        const staff = maintenanceCost * 0.4;
        const other = maintenanceCost * 0.1;

        return {
            maintenance: maintenanceCost,
            utilities: utilities,
            staff: staff,
            other: other,
            total: maintenanceCost + utilities + staff + other
        };
    }

    async getStudentStatistics() {
        const totalStudents = await Student.countDocuments();
        const activeBookings = await Booking.countDocuments({ status: 'active' });
        
        const monthlyStats = await Booking.aggregate([
            {
                $group: {
                    _id: { $month: "$startDate" },
                    count: { $sum: 1 }
                }
            }
        ]);

        return {
            totalStudents,
            activeBookings,
            monthlyStats
        };
    }

    async getMaintenanceOverview() {
        const stats = await Maintenance.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                    avgResolutionTime: {
                        $avg: {
                            $subtract: ["$completedDate", "$createdAt"]
                        }
                    }
                }
            }
        ]);

        return stats;
    }

    async exportTransactionsToExcel(startDate, endDate) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Transactions');

        worksheet.columns = [
            { header: 'Date', key: 'date' },
            { header: 'Student', key: 'student' },
            { header: 'Type', key: 'type' },
            { header: 'Amount', key: 'amount' },
            { header: 'Status', key: 'status' }
        ];

        const payments = await Payment.find({
            date: { $gte: startDate, $lte: endDate }
        }).populate('student');

        payments.forEach(payment => {
            worksheet.addRow({
                date: payment.date,
                student: `${payment.student.firstName} ${payment.student.lastName}`,
                type: payment.type,
                amount: payment.amount,
                status: payment.status
            });
        });

        return workbook;
    }

    async generateDashboardPDF(data) {
        const doc = new PDFDocument();
        
        // Add header
        doc.fontSize(25).text('Dashboard Report', { align: 'center' });
        doc.moveDown();

        // Financial Overview
        doc.fontSize(16).text('Financial Overview');
        doc.fontSize(12)
           .text(`Total Income: $${data.financial.totalIncome}`)
           .text(`Total Expenses: $${data.financial.expenses.total}`)
           .text(`Net Profit: $${data.financial.netProfit}`)
           .text(`Profit Margin: ${data.financial.profitMargin.toFixed(2)}%`);
        
        doc.moveDown();

        // Student Statistics
        doc.fontSize(16).text('Student Statistics');
        doc.fontSize(12)
           .text(`Total Students: ${data.students.totalStudents}`)
           .text(`Active Bookings: ${data.students.activeBookings}`);

        return doc;
    }
}

module.exports = new AnalyticsService(); 