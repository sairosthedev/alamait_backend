const Invoice = require('../models/Invoice');
const User = require('../models/User');
const Residence = require('../models/Residence');
const Payment = require('../models/Payment');
const mongoose = require('mongoose');

class InvoiceReportingService {
    // Generate dashboard report
    async generateDashboardReport() {
        try {
            const currentDate = new Date();
            const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

            // Overall statistics
            const overallStats = await Invoice.aggregate([
                {
                    $group: {
                        _id: null,
                        totalInvoices: { $sum: 1 },
                        totalAmount: { $sum: '$totalAmount' },
                        totalPaid: { $sum: '$amountPaid' },
                        totalOutstanding: { $sum: '$balanceDue' },
                        overdueAmount: {
                            $sum: {
                                $cond: [
                                    { $and: [{ $gt: ['$balanceDue', 0] }, { $lt: ['$dueDate', currentDate] }] },
                                    '$balanceDue',
                                    0
                                ]
                            }
                        }
                    }
                }
            ]);

            // Monthly statistics
            const monthlyStats = await Invoice.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startOfMonth }
                    }
                },
                {
                    $group: {
                        _id: null,
                        monthlyInvoices: { $sum: 1 },
                        monthlyAmount: { $sum: '$totalAmount' },
                        monthlyPaid: { $sum: '$amountPaid' },
                        monthlyOutstanding: { $sum: '$balanceDue' }
                    }
                }
            ]);

            // Status breakdown
            const statusBreakdown = await Invoice.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        totalAmount: { $sum: '$totalAmount' }
                    }
                }
            ]);

            // Top overdue students
            const topOverdueStudents = await Invoice.aggregate([
                {
                    $match: {
                        balanceDue: { $gt: 0 },
                        dueDate: { $lt: currentDate },
                        status: { $nin: ['paid', 'cancelled'] }
                    }
                },
                {
                    $group: {
                        _id: '$student',
                        totalOverdue: { $sum: '$balanceDue' },
                        invoiceCount: { $sum: 1 }
                    }
                },
                {
                    $sort: { totalOverdue: -1 }
                },
                {
                    $limit: 10
                }
            ]);

            // Populate student details
            const overdueStudentsWithDetails = await User.populate(topOverdueStudents, {
                path: '_id',
                select: 'firstName lastName email phone'
            });

            return {
                overall: overallStats[0] || {
                    totalInvoices: 0,
                    totalAmount: 0,
                    totalPaid: 0,
                    totalOutstanding: 0,
                    overdueAmount: 0
                },
                monthly: monthlyStats[0] || {
                    monthlyInvoices: 0,
                    monthlyAmount: 0,
                    monthlyPaid: 0,
                    monthlyOutstanding: 0
                },
                statusBreakdown,
                topOverdueStudents: overdueStudentsWithDetails,
                generatedAt: currentDate
            };
        } catch (error) {
            console.error('Error generating dashboard report:', error);
            throw error;
        }
    }

    // Generate overdue report
    async generateOverdueReport() {
        try {
            const currentDate = new Date();

            const overdueSummary = await Invoice.aggregate([
                {
                    $match: {
                        balanceDue: { $gt: 0 },
                        dueDate: { $lt: currentDate },
                        status: { $nin: ['paid', 'cancelled'] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalOverdueInvoices: { $sum: 1 },
                        totalOverdueAmount: { $sum: '$balanceDue' },
                        averageDaysOverdue: {
                            $avg: {
                                $divide: [
                                    { $subtract: [currentDate, '$dueDate'] },
                                    1000 * 60 * 60 * 24
                                ]
                            }
                        }
                    }
                }
            ]);

            const overdueByResidence = await Invoice.aggregate([
                {
                    $match: {
                        balanceDue: { $gt: 0 },
                        dueDate: { $lt: currentDate },
                        status: { $nin: ['paid', 'cancelled'] }
                    }
                },
                {
                    $group: {
                        _id: '$residence',
                        overdueInvoices: { $sum: 1 },
                        overdueAmount: { $sum: '$balanceDue' }
                    }
                }
            ]);

            const overdueByResidenceWithDetails = await Residence.populate(overdueByResidence, {
                path: '_id',
                select: 'name address'
            });

            return {
                summary: overdueSummary[0] || {
                    totalOverdueInvoices: 0,
                    totalOverdueAmount: 0,
                    averageDaysOverdue: 0
                },
                byResidence: overdueByResidenceWithDetails,
                generatedAt: currentDate
            };
        } catch (error) {
            console.error('Error generating overdue report:', error);
            throw error;
        }
    }

    // Generate student financial report
    async generateStudentReport(studentId, startDate, endDate) {
        try {
            const student = await User.findById(studentId);
            if (!student) {
                throw new Error('Student not found');
            }

            const invoiceHistory = await Invoice.find({
                student: studentId,
                billingStartDate: { $gte: startDate, $lte: endDate }
            }).sort({ billingStartDate: -1 });

            const paymentHistory = await Payment.find({
                student: studentId,
                date: { $gte: startDate, $lte: endDate }
            }).sort({ date: -1 });

            const financialSummary = await Invoice.aggregate([
                {
                    $match: {
                        student: new mongoose.Types.ObjectId(studentId),
                        billingStartDate: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalInvoices: { $sum: 1 },
                        totalAmount: { $sum: '$totalAmount' },
                        totalPaid: { $sum: '$amountPaid' },
                        totalOutstanding: { $sum: '$balanceDue' }
                    }
                }
            ]);

            return {
                student: {
                    id: student._id,
                    name: `${student.firstName} ${student.lastName}`,
                    email: student.email,
                    phone: student.phone
                },
                period: { startDate, endDate },
                financialSummary: financialSummary[0] || {
                    totalInvoices: 0,
                    totalAmount: 0,
                    totalPaid: 0,
                    totalOutstanding: 0
                },
                invoiceHistory,
                paymentHistory,
                generatedAt: new Date()
            };
        } catch (error) {
            console.error('Error generating student report:', error);
            throw error;
        }
    }
}

module.exports = new InvoiceReportingService(); 