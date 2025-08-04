const Receipt = require('../models/Receipt');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Residence = require('../models/Residence');
const Room = require('../models/Room');
const PDFDocument = require('pdfkit');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Configure AWS S3
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
    region: process.env.AWS_REGION
});

// Create receipt and generate PDF
exports.createReceipt = async (req, res) => {
    try {
        const {
            paymentId,
            items,
            notes,
            template = 'default'
        } = req.body;

        // Validate payment exists
        const payment = await Payment.findById(paymentId);
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        // Get student details
        const student = await User.findById(payment.student);
        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        // Get residence details
        const residence = await Residence.findById(student.residence);
        if (!residence) {
            return res.status(404).json({
                success: false,
                message: 'Residence not found'
            });
        }

        // Get room details if available
        let room = null;
        if (student.currentRoom) {
            room = await Room.findOne({ 
                roomNumber: student.currentRoom,
                residence: student.residence 
            });
        }

        // Create receipt
        const receipt = new Receipt({
            student: payment.student,
            payment: paymentId,
            residence: student.residence,
            room: room ? room._id : null,
            items: items || [{
                description: `Payment for ${payment.paymentMonth || 'accommodation'}`,
                quantity: 1,
                unitPrice: payment.amount,
                totalPrice: payment.amount
            }],
            subtotal: payment.amount,
            totalAmount: payment.amount,
            paymentMethod: payment.paymentMethod,
            paymentReference: payment.reference,
            notes,
            template,
            createdBy: req.user._id
        });

        // Calculate totals
        receipt.calculateTotals();
        await receipt.save();

        // Generate PDF
        const pdfBuffer = await generateReceiptPDF(receipt, student, residence, room);

        // Upload to S3
        const s3Key = `receipts/${receipt.receiptNumber}.pdf`;
        const uploadParams = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: s3Key,
            Body: pdfBuffer,
            ContentType: 'application/pdf',
            ACL: 'public-read'
        };

        const uploadResult = await s3.upload(uploadParams).promise();

        // Update receipt with S3 details
        receipt.pdfUrl = uploadResult.Location;
        receipt.s3Key = s3Key;
        await receipt.save();

        // Send email to student
        await sendReceiptEmail(receipt, student, uploadResult.Location);

        // Update receipt status
        receipt.status = 'sent';
        receipt.emailSent = true;
        receipt.emailSentAt = new Date();
        await receipt.save();

        // Populate receipt for response
        await receipt.populate([
            { path: 'student', select: 'firstName lastName email' },
            { path: 'residence', select: 'name address' },
            { path: 'payment', select: 'amount paymentMethod reference' }
        ]);

        res.status(201).json({
            success: true,
            message: 'Receipt created and sent successfully',
            data: {
                receipt,
                pdfUrl: uploadResult.Location
            }
        });

    } catch (error) {
        console.error('Error creating receipt:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating receipt',
            error: error.message
        });
    }
};

// Get all receipts with filtering
exports.getAllReceipts = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            student,
            status,
            startDate,
            endDate,
            search,
            sortBy = 'receiptDate',
            sortOrder = 'desc'
        } = req.query;

        const query = {};

        // Student filter
        if (student) {
            query.student = student;
        }

        // Status filter
        if (status) {
            query.status = status;
        }

        // Date range filter
        if (startDate || endDate) {
            query.receiptDate = {};
            if (startDate) query.receiptDate.$gte = new Date(startDate);
            if (endDate) query.receiptDate.$lte = new Date(endDate);
        }

        // Search filter
        if (search) {
            query.$or = [
                { receiptNumber: { $regex: search, $options: 'i' } },
                { paymentReference: { $regex: search, $options: 'i' } },
                { notes: { $regex: search, $options: 'i' } }
            ];
        }

        const options = {
            sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 },
            limit: parseInt(limit),
            skip: (parseInt(page) - 1) * parseInt(limit)
        };

        const receipts = await Receipt.find(query, null, options)
            .populate('student', 'firstName lastName email')
            .populate('residence', 'name')
            .populate('payment', 'amount paymentMethod reference')
            .populate('createdBy', 'firstName lastName');

        const total = await Receipt.countDocuments(query);

        res.status(200).json({
            success: true,
            data: receipts,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalReceipts: total,
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Error fetching receipts:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching receipts',
            error: error.message
        });
    }
};

// Get receipt by ID
exports.getReceiptById = async (req, res) => {
    try {
        const { id } = req.params;

        const receipt = await Receipt.findById(id)
            .populate('student', 'firstName lastName email phone')
            .populate('residence', 'name address')
            .populate('payment', 'amount paymentMethod reference status')
            .populate('room', 'roomNumber type')
            .populate('createdBy', 'firstName lastName');

        if (!receipt) {
            return res.status(404).json({
                success: false,
                message: 'Receipt not found'
            });
        }

        res.status(200).json({
            success: true,
            data: receipt
        });

    } catch (error) {
        console.error('Error fetching receipt:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching receipt',
            error: error.message
        });
    }
};

// Get receipts by student
exports.getReceiptsByStudent = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const query = { student: studentId };
        const options = {
            sort: { receiptDate: -1 },
            limit: parseInt(limit),
            skip: (parseInt(page) - 1) * parseInt(limit)
        };

        const receipts = await Receipt.find(query, null, options)
            .populate('residence', 'name')
            .populate('payment', 'amount paymentMethod reference');

        const total = await Receipt.countDocuments(query);

        res.status(200).json({
            success: true,
            data: receipts,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalReceipts: total,
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Error fetching student receipts:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching student receipts',
            error: error.message
        });
    }
};

// Download receipt PDF
exports.downloadReceipt = async (req, res) => {
    try {
        const { id } = req.params;

        const receipt = await Receipt.findById(id);
        if (!receipt) {
            return res.status(404).json({
                success: false,
                message: 'Receipt not found'
            });
        }

        if (!receipt.pdfUrl) {
            return res.status(404).json({
                success: false,
                message: 'PDF not found for this receipt'
            });
        }

        // Redirect to S3 URL or stream the file
        res.redirect(receipt.pdfUrl);

    } catch (error) {
        console.error('Error downloading receipt:', error);
        res.status(500).json({
            success: false,
            message: 'Error downloading receipt',
            error: error.message
        });
    }
};

// Resend receipt email
exports.resendReceiptEmail = async (req, res) => {
    try {
        const { id } = req.params;

        const receipt = await Receipt.findById(id)
            .populate('student', 'firstName lastName email')
            .populate('residence', 'name address');

        if (!receipt) {
            return res.status(404).json({
                success: false,
                message: 'Receipt not found'
            });
        }

        if (!receipt.pdfUrl) {
            return res.status(400).json({
                success: false,
                message: 'PDF not available for this receipt'
            });
        }

        // Send email
        await sendReceiptEmail(receipt, receipt.student, receipt.pdfUrl);

        // Update status
        receipt.emailSent = true;
        receipt.emailSentAt = new Date();
        receipt.status = 'sent';
        await receipt.save();

        res.status(200).json({
            success: true,
            message: 'Receipt email sent successfully'
        });

    } catch (error) {
        console.error('Error resending receipt email:', error);
        res.status(500).json({
            success: false,
            message: 'Error resending receipt email',
            error: error.message
        });
    }
};

// Delete receipt
exports.deleteReceipt = async (req, res) => {
    try {
        const { id } = req.params;

        const receipt = await Receipt.findById(id);
        if (!receipt) {
            return res.status(404).json({
                success: false,
                message: 'Receipt not found'
            });
        }

        // Delete from S3 if exists
        if (receipt.s3Key) {
            try {
                await s3.deleteObject({
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Key: receipt.s3Key
                }).promise();
            } catch (s3Error) {
                console.error('Error deleting from S3:', s3Error);
            }
        }

        // Delete from database
        await Receipt.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'Receipt deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting receipt:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting receipt',
            error: error.message
        });
    }
};

// Helper function to generate PDF
async function generateReceiptPDF(receipt, student, residence, room) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50
            });

            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));

            // Header
            doc.fontSize(24)
               .font('Helvetica-Bold')
               .text('ALAMAIT STUDENT ACCOMMODATION', { align: 'center' });
            
            doc.fontSize(16)
               .font('Helvetica')
               .text('RECEIPT', { align: 'center' });
            
            doc.moveDown();

            // Receipt details
            doc.fontSize(12)
               .font('Helvetica-Bold')
               .text(`Receipt Number: ${receipt.receiptNumber}`);
            
            doc.font('Helvetica')
               .text(`Date: ${receipt.receiptDate.toLocaleDateString()}`);
            
            doc.moveDown();

            // Student information
            doc.fontSize(14)
               .font('Helvetica-Bold')
               .text('Student Information');
            
            doc.fontSize(12)
               .font('Helvetica')
               .text(`Name: ${student.firstName} ${student.lastName}`);
            doc.text(`Email: ${student.email}`);
            doc.text(`Phone: ${student.phone}`);
            
            if (room) {
                doc.text(`Room: ${room.roomNumber}`);
            }
            
            doc.text(`Residence: ${residence.name}`);
            doc.moveDown();

            // Payment information
            doc.fontSize(14)
               .font('Helvetica-Bold')
               .text('Payment Information');
            
            doc.fontSize(12)
               .font('Helvetica')
               .text(`Payment Method: ${receipt.paymentMethod.replace('_', ' ').toUpperCase()}`);
            doc.text(`Reference: ${receipt.paymentReference}`);
            doc.moveDown();

            // Items table
            doc.fontSize(14)
               .font('Helvetica-Bold')
               .text('Items');
            
            // Table header
            doc.fontSize(10)
               .font('Helvetica-Bold')
               .text('Description', 50, doc.y)
               .text('Qty', 300, doc.y - 15)
               .text('Unit Price', 350, doc.y - 15)
               .text('Total', 450, doc.y - 15);
            
            doc.moveDown(0.5);

            // Table rows
            receipt.items.forEach(item => {
                doc.font('Helvetica')
                   .text(item.description, 50, doc.y, { width: 240 })
                   .text(item.quantity.toString(), 300, doc.y - 15)
                   .text(`$${item.unitPrice.toFixed(2)}`, 350, doc.y - 15)
                   .text(`$${item.totalPrice.toFixed(2)}`, 450, doc.y - 15);
                
                doc.moveDown(0.5);
            });

            // Total
            doc.moveDown()
               .fontSize(12)
               .font('Helvetica-Bold')
               .text(`Total Amount: $${receipt.totalAmount.toFixed(2)}`, { align: 'right' });

            // Footer
            doc.moveDown(2)
               .fontSize(10)
               .font('Helvetica')
               .text('Thank you for your payment!', { align: 'center' })
               .text('This receipt serves as proof of payment for your accommodation.', { align: 'center' });

            doc.end();

        } catch (error) {
            reject(error);
        }
    });
}

// Helper function to send email
async function sendReceiptEmail(receipt, student, pdfUrl) {
    try {
        // Import email service
        const { sendEmail } = require('../utils/emailService');
        
        const emailData = {
            to: student.email,
            subject: `Payment Receipt - ${receipt.receiptNumber}`,
            template: 'receipt',
            context: {
                studentName: `${student.firstName} ${student.lastName}`,
                receiptNumber: receipt.receiptNumber,
                amount: receipt.totalAmount,
                date: receipt.receiptDate.toLocaleDateString(),
                pdfUrl: pdfUrl
            }
        };

        await sendEmail(emailData);
        
        console.log(`Receipt email sent to ${student.email}`);
        
    } catch (error) {
        console.error('Error sending receipt email:', error);
        throw error;
    }
}

module.exports = {
    createReceipt: exports.createReceipt,
    getAllReceipts: exports.getAllReceipts,
    getReceiptById: exports.getReceiptById,
    getReceiptsByStudent: exports.getReceiptsByStudent,
    downloadReceipt: exports.downloadReceipt,
    resendReceiptEmail: exports.resendReceiptEmail,
    deleteReceipt: exports.deleteReceipt
}; 