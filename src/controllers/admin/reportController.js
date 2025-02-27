const Booking = require('../../models/Booking');
const Maintenance = require('../../models/Maintenance');
const Event = require('../../models/Event');
const User = require('../../models/User');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// Generate Excel file
const generateExcel = async (data, headers) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');
    
    worksheet.columns = headers.map(header => ({
        header: header.label,
        key: header.key,
        width: 20
    }));

    worksheet.addRows(data);
    
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
};

// Generate PDF file
const generatePDF = async (data, title) => {
    const doc = new PDFDocument();
    const buffers = [];
    
    doc.on('data', buffers.push.bind(buffers));
    doc.fontSize(25).text(title, { align: 'center' });
    doc.moveDown();
    
    data.forEach(item => {
        Object.entries(item).forEach(([key, value]) => {
            doc.fontSize(12).text(`${key}: ${value}`);
        });
        doc.moveDown();
    });
    
    doc.end();
    
    return Buffer.concat(buffers);
};

// Get occupancy report
exports.getOccupancyReport = async (req, res) => {
    try {
        const { format = 'json', startDate, endDate } = req.query;
        
        const bookings = await Booking.aggregate([
            {
                $match: {
                    startDate: { $gte: new Date(startDate) },
                    endDate: { $lte: new Date(endDate) }
                }
            },
            {
                $group: {
                    _id: '$residence',
                    totalBookings: { $sum: 1 },
                    occupiedDays: { $sum: { $subtract: ['$endDate', '$startDate'] } }
                }
            }
        ]);

        if (format === 'excel') {
            const headers = [
                { label: 'Residence', key: '_id' },
                { label: 'Total Bookings', key: 'totalBookings' },
                { label: 'Occupied Days', key: 'occupiedDays' }
            ];
            const buffer = await generateExcel(bookings, headers);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=occupancy_report.xlsx');
            return res.send(buffer);
        }

        if (format === 'pdf') {
            const buffer = await generatePDF(bookings, 'Occupancy Report');
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=occupancy_report.pdf');
            return res.send(buffer);
        }

        res.json(bookings);
    } catch (error) {
        console.error('Get occupancy report error:', error);
        res.status(500).json({ error: 'Error generating occupancy report' });
    }
};

// Get financial report
exports.getFinancialReport = async (req, res) => {
    try {
        const { format = 'json', startDate, endDate } = req.query;
        
        const financials = await Booking.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    totalRevenue: { $sum: '$totalAmount' },
                    paidAmount: { $sum: '$paidAmount' },
                    pendingAmount: { $sum: { $subtract: ['$totalAmount', '$paidAmount'] } },
                    bookingCount: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        if (format === 'excel') {
            const headers = [
                { label: 'Year', key: '_id.year' },
                { label: 'Month', key: '_id.month' },
                { label: 'Total Revenue', key: 'totalRevenue' },
                { label: 'Paid Amount', key: 'paidAmount' },
                { label: 'Pending Amount', key: 'pendingAmount' },
                { label: 'Booking Count', key: 'bookingCount' }
            ];
            const buffer = await generateExcel(financials, headers);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=financial_report.xlsx');
            return res.send(buffer);
        }

        if (format === 'pdf') {
            const buffer = await generatePDF(financials, 'Financial Report');
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=financial_report.pdf');
            return res.send(buffer);
        }

        res.json(financials);
    } catch (error) {
        console.error('Get financial report error:', error);
        res.status(500).json({ error: 'Error generating financial report' });
    }
};

// Get maintenance report
exports.getMaintenanceReport = async (req, res) => {
    try {
        const { format = 'json', startDate, endDate } = req.query;
        
        const maintenance = await Maintenance.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    }
                }
            },
            {
                $group: {
                    _id: {
                        status: '$status',
                        category: '$category'
                    },
                    count: { $sum: 1 },
                    avgResolutionTime: {
                        $avg: {
                            $cond: [
                                { $eq: ['$status', 'completed'] },
                                { $subtract: ['$completedDate', '$createdAt'] },
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        if (format === 'excel') {
            const headers = [
                { label: 'Status', key: '_id.status' },
                { label: 'Category', key: '_id.category' },
                { label: 'Count', key: 'count' },
                { label: 'Average Resolution Time (ms)', key: 'avgResolutionTime' }
            ];
            const buffer = await generateExcel(maintenance, headers);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=maintenance_report.xlsx');
            return res.send(buffer);
        }

        if (format === 'pdf') {
            const buffer = await generatePDF(maintenance, 'Maintenance Report');
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=maintenance_report.pdf');
            return res.send(buffer);
        }

        res.json(maintenance);
    } catch (error) {
        console.error('Get maintenance report error:', error);
        res.status(500).json({ error: 'Error generating maintenance report' });
    }
};

// Get student activity report
exports.getStudentActivityReport = async (req, res) => {
    try {
        const { format = 'json', startDate, endDate } = req.query;
        
        const activities = await Promise.all([
            // Event participation
            Event.aggregate([
                {
                    $match: {
                        date: {
                            $gte: new Date(startDate),
                            $lte: new Date(endDate)
                        }
                    }
                },
                {
                    $unwind: '$participants'
                },
                {
                    $group: {
                        _id: '$participants.student',
                        eventParticipation: { $sum: 1 }
                    }
                }
            ]),
            
            // Maintenance requests
            Maintenance.aggregate([
                {
                    $match: {
                        createdAt: {
                            $gte: new Date(startDate),
                            $lte: new Date(endDate)
                        }
                    }
                },
                {
                    $group: {
                        _id: '$student',
                        maintenanceRequests: { $sum: 1 }
                    }
                }
            ])
        ]);

        const [eventParticipation, maintenanceRequests] = activities;
        
        // Combine the data
        const studentActivity = await User.aggregate([
            {
                $match: { role: 'student' }
            },
            {
                $lookup: {
                    from: 'events',
                    localField: '_id',
                    foreignField: 'participants.student',
                    as: 'events'
                }
            },
            {
                $lookup: {
                    from: 'maintenances',
                    localField: '_id',
                    foreignField: 'student',
                    as: 'maintenance'
                }
            },
            {
                $project: {
                    _id: 1,
                    firstName: 1,
                    lastName: 1,
                    email: 1,
                    eventCount: { $size: '$events' },
                    maintenanceCount: { $size: '$maintenance' }
                }
            }
        ]);

        if (format === 'excel') {
            const headers = [
                { label: 'Student ID', key: '_id' },
                { label: 'First Name', key: 'firstName' },
                { label: 'Last Name', key: 'lastName' },
                { label: 'Email', key: 'email' },
                { label: 'Event Participation', key: 'eventCount' },
                { label: 'Maintenance Requests', key: 'maintenanceCount' }
            ];
            const buffer = await generateExcel(studentActivity, headers);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=student_activity_report.xlsx');
            return res.send(buffer);
        }

        if (format === 'pdf') {
            const buffer = await generatePDF(studentActivity, 'Student Activity Report');
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=student_activity_report.pdf');
            return res.send(buffer);
        }

        res.json(studentActivity);
    } catch (error) {
        console.error('Get student activity report error:', error);
        res.status(500).json({ error: 'Error generating student activity report' });
    }
}; 