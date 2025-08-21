const { validationResult } = require('express-validator');
const Payment = require('../../models/Payment');
const User = require('../../models/User');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { s3, s3Configs, fileFilter, fileTypes } = require('../../config/s3');
const Booking = require('../../models/Booking');
const Application = require('../../models/Application');
const Residence = require('../../models/Residence');
const mongoose = require('mongoose');
const AuditLog = require('../../models/AuditLog');
const Transaction = require('../../models/Transaction');
const TransactionEntry = require('../../models/TransactionEntry');
const Account = require('../../models/Account');
const Debtor = require('../../models/Debtor');
const { sendEmail } = require('../../utils/email');
const EnhancedPaymentService = require('../../services/enhancedPaymentService');

// Configure multer for S3 file uploads
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: s3Configs.proofOfPayment.bucket,
        acl: s3Configs.proofOfPayment.acl,
        key: s3Configs.proofOfPayment.key
    }),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: fileFilter([...fileTypes.images, 'application/pdf'])
}).single('proofOfPayment');

// Configure multer for receipt uploads
const uploadReceipt = multer({
    storage: multerS3({
        s3: s3,
        bucket: s3Configs.receipts.bucket,
        acl: s3Configs.receipts.acl,
        key: s3Configs.receipts.key
    }),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit for PDFs
    },
    fileFilter: fileFilter(['application/pdf'])
}).single('file');

// Get all payments
const getPayments = async (req, res) => {
    try {
        const { status, residence, period, date } = req.query;
        
        // Build query based on filters
        const query = {};

        if (status) {
            query.status = status;
        }

        if (residence && residence !== 'all') {
            try {
                query.residence = new mongoose.Types.ObjectId(residence);
            } catch (error) {
                return res.status(400).json({
                    message: 'Invalid residence ID format',
                    field: 'residence'
                });
            }
        }

        if (date) {
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
            query.paymentDate = { $gte: startDate, $lte: endDate };
        }

        if (period === 'weekly') {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            query.paymentDate = { $gte: oneWeekAgo };
        } else if (period === 'monthly') {
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            query.paymentDate = { $gte: oneMonthAgo };
        }

        const payments = await Payment.find(query)
            .populate('residence', 'name')
            .populate('student', 'firstName lastName email')
            .sort({ paymentDate: -1 });

        res.status(200).json(payments);
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get payment by ID
const getPaymentById = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: 'Invalid payment ID format'
            });
        }

        const payment = await Payment.findById(id)
            .populate('residence', 'name')
            .populate('student', 'firstName lastName email');

        if (!payment) {
            return res.status(404).json({
                message: 'Payment not found'
            });
        }

        res.status(200).json(payment);
    } catch (error) {
        console.error('Error fetching payment:', error);
        res.status(500).json({ message: error.message });
    }
};

// Update payment status
const updatePaymentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: 'Invalid payment ID format'
            });
        }

        if (!status) {
            return res.status(400).json({
                message: 'Status is required'
            });
        }

        const validStatuses = ['Pending', 'Paid', 'Failed', 'Refunded'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                message: 'Invalid status value',
                validStatuses
            });
        }

        const payment = await Payment.findById(id);
        if (!payment) {
            return res.status(404).json({
                message: 'Payment not found'
            });
        }

        const before = payment.toObject();
        payment.status = status;
        payment.updatedBy = req.user._id;
        await payment.save();

        const updatedPayment = await Payment.findById(id)
            .populate('residence', 'name')
            .populate('student', 'firstName lastName email');

        // Auto-generate receipt when payment status is updated to successful
        if (status === 'Paid' || status === 'confirmed' || status === 'completed') {
            try {
                // Check if receipt already exists for this payment
                const existingReceipt = await require('../models/Receipt').findOne({ payment: payment._id });
                
                if (!existingReceipt) {
                    const { createReceipt } = require('../receiptController');
                    
                    // Create detailed receipt items based on payment breakdown
                    let receiptItems = [];
                    
                    if (payment.payments && payment.payments.length > 0) {
                        // Use the detailed payment breakdown
                        receiptItems = payment.payments.map(paymentItem => ({
                            description: `${paymentItem.type.charAt(0).toUpperCase() + paymentItem.type.slice(1)} Payment - ${payment.paymentMonth}`,
                            quantity: 1,
                            unitPrice: paymentItem.amount,
                            totalPrice: paymentItem.amount
                        }));
                    } else {
                        // Fallback to single item
                        receiptItems = [{
                            description: `Accommodation Payment - ${payment.paymentMonth}`,
                            quantity: 1,
                            unitPrice: payment.totalAmount,
                            totalPrice: payment.totalAmount
                        }];
                    }
                    
                    // Create receipt data
                    const receiptData = {
                        paymentId: payment._id,
                        items: receiptItems,
                        notes: `Payment status updated to ${status} for ${updatedPayment.student?.firstName} ${updatedPayment.student?.lastName} - ${payment.paymentMonth}`,
                        template: 'default'
                    };

                    // Create receipt
                    const receiptReq = {
                        body: receiptData,
                        user: req.user
                    };
                    
                    const receiptRes = {
                        status: (code) => ({
                            json: (data) => {
                                if (code === 201) {
                                    console.log(`✅ Receipt automatically generated for payment status update`);
                                    console.log(`   Payment ID: ${payment.paymentId}`);
                                    console.log(`   Student: ${updatedPayment.student?.firstName} ${updatedPayment.student?.lastName}`);
                                    console.log(`   Status: ${status}`);
                                    console.log(`   Receipt Number: ${data?.data?.receipt?.receiptNumber || 'N/A'}`);
                                } else {
                                    console.error('❌ Failed to generate receipt on status update:', data);
                                }
                            }
                        })
                    };

                    await createReceipt(receiptReq, receiptRes);
                } else {
                    console.log(`ℹ️  Receipt already exists for payment ${payment.paymentId}`);
                }
                
            } catch (receiptError) {
                console.error('❌ Error auto-generating receipt on status update:', receiptError);
                console.error('   Payment ID:', payment.paymentId);
                console.error('   Student:', updatedPayment.student?.firstName, updatedPayment.student?.lastName);
                // Don't fail the status update if receipt generation fails
            }
        }

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'update',
            collection: 'Payment',
            recordId: payment._id,
            before,
            after: updatedPayment.toObject()
        });

        res.status(200).json(updatedPayment);
    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({ message: error.message });
    }
};

// Upload proof of payment
const uploadProofOfPayment = async (req, res) => {
    try {
        upload(req, res, async function(err) {
            if (err) {
                return res.status(400).json({ message: err.message });
            }

            const { paymentId } = req.params;
            
            if (!mongoose.Types.ObjectId.isValid(paymentId)) {
                return res.status(400).json({
                    message: 'Invalid payment ID format'
                });
            }

            const payment = await Payment.findById(paymentId);
            if (!payment) {
                return res.status(404).json({
                    message: 'Payment not found'
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    message: 'No file uploaded'
                });
            }

            payment.proofOfPayment = {
                fileUrl: req.file.location, // S3 URL
                fileName: req.file.originalname,
                uploadDate: new Date()
            };

            await payment.save();

            const updatedPayment = await Payment.findById(paymentId)
                .populate('residence', 'name')
                .populate('student', 'firstName lastName email');

            res.status(200).json(updatedPayment);
        });
    } catch (error) {
        console.error('Error uploading proof of payment:', error);
        res.status(500).json({ message: error.message });
    }
};

// Verify proof of payment
const verifyProofOfPayment = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { status, notes } = req.body;

        if (!mongoose.Types.ObjectId.isValid(paymentId)) {
            return res.status(400).json({
                message: 'Invalid payment ID format'
            });
        }

        const payment = await Payment.findById(paymentId);
        if (!payment) {
            return res.status(404).json({
                message: 'Payment not found'
            });
        }

        if (!payment.proofOfPayment) {
            return res.status(400).json({
                message: 'No proof of payment uploaded'
            });
        }

        // Set new PoP status and verification notes
        payment.proofOfPayment.status = status;
        payment.proofOfPayment.verificationNotes = notes;
        payment.proofOfPayment.verifiedBy = req.user._id;
        payment.proofOfPayment.verificationDate = new Date();

        // Optionally update main payment status for legacy compatibility
        if (status === 'Accepted') {
            payment.status = 'Verified';
        } else if (status === 'Rejected') {
            payment.status = 'Rejected';
        } else {
            payment.status = 'Pending';
        }

        await payment.save();

        const updatedPayment = await Payment.findById(paymentId)
            .populate('residence', 'name')
            .populate('student', 'firstName lastName email');

        res.status(200).json({
            ...updatedPayment.toObject(),
            studentComment: payment.proofOfPayment.studentComment
        });
    } catch (error) {
        console.error('Error verifying proof of payment:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get payment totals
const getPaymentTotals = async (req, res) => {
    try {
        const { period, residence, date } = req.query;
        
        // Build query based on filters
        const query = {};

        // Add residence filter if not 'all'
        if (residence && residence !== 'all') {
            try {
                query.residence = new mongoose.Types.ObjectId(residence);
            } catch (error) {
                return res.status(400).json({
                    message: 'Invalid residence ID format',
                    field: 'residence'
                });
            }
        }

        // Handle date filter
        if (date) {
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
            query.paymentDate = { $gte: startDate, $lte: endDate };
        }

        // Handle period filter
        if (period === 'weekly') {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            query.paymentDate = { $gte: oneWeekAgo };
        } else if (period === 'monthly') {
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            query.paymentDate = { $gte: oneMonthAgo };
        }

        // Get total payments
        const totalPayments = await Payment.aggregate([
            { $match: query },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // Get payments by status
        const paymentsByStatus = await Payment.aggregate([
            { $match: query },
            { $group: { _id: '$status', total: { $sum: '$amount' } } }
        ]);

        // Get payments by method
        const paymentsByMethod = await Payment.aggregate([
            { $match: query },
            { $group: { _id: '$paymentMethod', total: { $sum: '$amount' } } }
        ]);

        res.status(200).json({
            total: totalPayments[0]?.total || 0,
            byStatus: paymentsByStatus.reduce((acc, curr) => {
                acc[curr._id] = curr.total;
                return acc;
            }, {}),
            byMethod: paymentsByMethod.reduce((acc, curr) => {
                acc[curr._id] = curr.total;
                return acc;
            }, {})
        });
    } catch (error) {
        console.error('Error getting payment totals:', error);
        res.status(500).json({ message: error.message });
    }
};

// Create new payment with enhanced double-entry accounting
const createPayment = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        // Accept all required fields from frontend
        const {
            paymentId,
            student,
            residence,
            room,
            roomType,
            payments,
            totalAmount,
            paymentMonth,
            date,
            method,
            status,
            description
        } = req.body;

        // Validate required fields
        if (!paymentId || !student || !residence || !totalAmount || !paymentMonth || !date || !method) {
            return res.status(400).json({
                message: 'Missing required fields',
                required: ['paymentId', 'student', 'residence', 'totalAmount', 'paymentMonth', 'date', 'method']
            });
        }

        if (!mongoose.Types.ObjectId.isValid(student)) {
            return res.status(400).json({ message: 'Invalid student ID format' });
        }
        if (!mongoose.Types.ObjectId.isValid(residence)) {
            return res.status(400).json({ message: 'Invalid residence ID format' });
        }

        // 🚨 DUPLICATE PAYMENT PREVENTION
        // Check for existing payment with same paymentId (primary check)
        const existingPaymentById = await Payment.findOne({ paymentId });
        if (existingPaymentById) {
            console.log(`⚠️ Duplicate payment detected - Payment ID already exists: ${paymentId}`);
            return res.status(409).json({
                message: 'Payment already exists with this ID',
                error: 'DUPLICATE_PAYMENT_ID',
                existingPayment: {
                    id: existingPaymentById._id,
                    paymentId: existingPaymentById.paymentId,
                    status: existingPaymentById.status,
                    createdAt: existingPaymentById.createdAt
                }
            });
        }

        // Check for duplicate payment within last 5 minutes (secondary check)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const existingRecentPayment = await Payment.findOne({
            student,
            totalAmount,
            paymentMonth,
            method,
            createdAt: { $gte: fiveMinutesAgo }
        });

        if (existingRecentPayment) {
            console.log(`⚠️ Potential duplicate payment detected within 5 minutes`);
            console.log(`   Student: ${student}`);
            console.log(`   Amount: $${totalAmount}`);
            console.log(`   Month: ${paymentMonth}`);
            console.log(`   Method: ${method}`);
            console.log(`   Existing Payment ID: ${existingRecentPayment.paymentId}`);
            
            return res.status(409).json({
                message: 'A similar payment was recently created. Please check if this is a duplicate.',
                error: 'POTENTIAL_DUPLICATE_PAYMENT',
                existingPayment: {
                    id: existingRecentPayment._id,
                    paymentId: existingRecentPayment.paymentId,
                    status: existingRecentPayment.status,
                    createdAt: existingRecentPayment.createdAt,
                    totalAmount: existingRecentPayment.totalAmount,
                    paymentMonth: existingRecentPayment.paymentMonth
                },
                suggestion: 'If this is not a duplicate, please wait a few minutes and try again.'
            });
        }

        // Check if student exists
        const studentExists = await User.findOne({ _id: student, role: 'student' });
        if (!studentExists) {
            return res.status(404).json({ message: 'Student not found' });
        }
        
        // Check if residence exists
        const residenceExists = await Residence.findById(residence);
        if (!residenceExists) {
            return res.status(404).json({ message: 'Residence not found' });
        }

        // 🆕 NEW: Automatically fetch user ID for proper debtor mapping
        let userId = student; // Default to student ID
        let debtor = null;
        
        // Try to find existing debtor first
        debtor = await Debtor.findOne({ user: student });
        
        if (debtor) {
            console.log(`✅ Found existing debtor for student: ${studentExists.firstName} ${studentExists.lastName}`);
            console.log(`   Debtor ID: ${debtor._id}`);
            console.log(`   Debtor Code: ${debtor.debtorCode}`);
            console.log(`   User ID: ${debtor.user}`);
            userId = debtor.user; // Use the debtor's user ID
        } else {
            console.log(`🏗️  No existing debtor found, will create one during payment creation`);
            // userId remains as student ID for now
        }

        // Calculate top-level breakdown from payments array if present
        let rent = 0, admin = 0, deposit = 0;
        let parsedPayments = payments;
        if (payments) {
            if (typeof payments === 'string') {
                parsedPayments = JSON.parse(payments);
            }
            rent = parsedPayments.find(p => p.type === 'rent')?.amount || 0;
            admin = parsedPayments.find(p => p.type === 'admin')?.amount || 0;
            deposit = parsedPayments.find(p => p.type === 'deposit')?.amount || 0;
        }

        // 🆕 NEW: Create payment with user ID for proper mapping
        const payment = new Payment({
            paymentId,
            user: userId,                    // ← ALWAYS include user ID for proper mapping
            student,
            residence,
            room,
            roomType,
            payments: parsedPayments,
            totalAmount,
            paymentMonth,
            date,
            method,
            status,
            description,
            rentAmount: rent,
            adminFee: admin,
            deposit: deposit,
            createdBy: req.user._id
        });

        await payment.save();
        console.log(`✅ Payment created successfully with user ID: ${userId}`);

        // Update debtor account if exists, create if not
        if (!debtor) {
            try {
                console.log('🏗️  Creating new debtor account for student...');
                // Create debtor account automatically using enhanced service
                const { createDebtorForStudent } = require('../../services/debtorService');
                
                debtor = await createDebtorForStudent(studentExists, {
                    residenceId: residence,
                    roomNumber: room,
                    createdBy: req.user._id,
                    startDate: date, // Use payment date as start date
                    roomPrice: totalAmount // Use payment amount as room price reference
                });
                
                console.log(`✅ Created enhanced debtor account for student: ${studentExists.firstName} ${studentExists.lastName}`);
                console.log(`   Debtor ID: ${debtor._id}`);
                console.log(`   Debtor Code: ${debtor.debtorCode}`);
                
                // 🆕 NEW: Update payment with the correct user ID from the new debtor
                if (debtor.user && debtor.user.toString() !== userId.toString()) {
                    payment.user = debtor.user;
                    await payment.save();
                    console.log(`🔄 Updated payment user ID from ${userId} to ${debtor.user}`);
                    userId = debtor.user;
                }
                
            } catch (debtorCreationError) {
                console.error('❌ Error creating debtor account:', debtorCreationError);
                console.error('   Error details:', debtorCreationError.message);
                console.error('   Stack trace:', debtorCreationError.stack);
                // Continue with payment creation even if debtor creation fails
            }
        }

        // Add payment to debtor account
        if (debtor) {
            try {
                console.log('💰 Updating debtor account...');
                console.log(`   Debtor ID: ${debtor._id}`);
                console.log(`   Current Balance: $${debtor.currentBalance}`);
                console.log(`   Total Owed: $${debtor.totalOwed}`);
                console.log(`   Total Paid: $${debtor.totalPaid}`);
                
                // 🆕 ENHANCED: Ensure payment month is properly formatted
                const formattedPaymentMonth = paymentMonth.includes('-') ? paymentMonth : 
                    `${new Date(date).getFullYear()}-${String(new Date(date).getMonth() + 1).padStart(2, '0')}`;
                
                // 🆕 ENHANCED: Call addPayment with proper data structure and error handling
                await debtor.addPayment({
                    paymentId: payment._id.toString(), // Use MongoDB ObjectId, not paymentId string
                    amount: totalAmount,
                    allocatedMonth: formattedPaymentMonth,
                    components: {
                        rent: rent,
                        adminFee: admin, // Fix: use adminFee to match schema
                        deposit: deposit
                    },
                    paymentMethod: method,
                    paymentDate: payment.date || new Date(),
                    status: status === 'Paid' ? 'Confirmed' : status, // Map status correctly
                    notes: `Payment ${paymentId} - ${formattedPaymentMonth}`,
                    createdBy: req.user._id
                });
                
                console.log('✅ Debtor account updated successfully');
                console.log(`   New Balance: $${debtor.currentBalance}`);
                console.log(`   New Total Paid: $${debtor.totalPaid}`);
                console.log(`   Payment History Count: ${debtor.paymentHistory.length}`);
                console.log(`   Monthly Payments Count: ${debtor.monthlyPayments.length}`);
                
            } catch (debtorError) {
                console.error('❌ Error updating debtor account:', debtorError);
                console.error('   Error details:', debtorError.message);
                console.error('   Stack trace:', debtorError.stack);
                
                // 🆕 ENHANCED: Try to recover from debtor update failure
                try {
                    console.log('🔄 Attempting to recover debtor update...');
                    
                    // Refresh debtor from database
                    const refreshedDebtor = await Debtor.findById(debtor._id);
                    if (refreshedDebtor) {
                        await refreshedDebtor.addPayment({
                            paymentId: payment._id.toString(),
                            amount: totalAmount,
                            allocatedMonth: paymentMonth,
                            components: {
                                rent: rent,
                                adminFee: admin,
                                deposit: deposit
                            },
                            paymentMethod: method,
                            paymentDate: payment.date || new Date(),
                            status: status === 'Paid' ? 'Confirmed' : status,
                            notes: `Payment ${paymentId} - ${paymentMonth} (Recovery)`,
                            createdBy: req.user._id
                        });
                        console.log('✅ Debtor update recovered successfully');
                    }
                } catch (recoveryError) {
                    console.error('❌ Debtor update recovery failed:', recoveryError.message);
                    // Log but don't fail the payment creation
                }
            }
        } else {
            console.log('⚠️  No debtor account available for payment update');
            
            // 🆕 ENHANCED: Try to create debtor account as fallback
            try {
                console.log('🔄 Attempting to create debtor account as fallback...');
                const { createDebtorForStudent } = require('../../services/debtorService');
                
                const fallbackDebtor = await createDebtorForStudent(studentExists, {
                    residenceId: residence,
                    roomNumber: room,
                    createdBy: req.user._id,
                    startDate: date,
                    roomPrice: totalAmount
                });
                
                if (fallbackDebtor) {
                    console.log('✅ Fallback debtor account created successfully');
                    
                    // Now add the payment to the new debtor
                    await fallbackDebtor.addPayment({
                        paymentId: payment._id.toString(),
                        amount: totalAmount,
                        allocatedMonth: paymentMonth,
                        components: {
                            rent: rent,
                            adminFee: admin,
                            deposit: deposit
                        },
                        paymentMethod: method,
                        paymentDate: payment.date || new Date(),
                        status: status === 'Paid' ? 'Confirmed' : status,
                        notes: `Payment ${paymentId} - ${paymentMonth} (Fallback)`,
                        createdBy: req.user._id
                    });
                    
                    console.log('✅ Payment added to fallback debtor account');
                }
            } catch (fallbackError) {
                console.error('❌ Fallback debtor creation failed:', fallbackError.message);
                // Continue with payment creation even if debtor creation fails
            }
        }

        // 🆕 NEW: Validate payment mapping
        try {
            const mappingValidation = await payment.validateMapping();
            console.log(`✅ Payment mapping validated successfully`);
            console.log(`   Debtor Code: ${mappingValidation.debtorCode}`);
            console.log(`   Room Number: ${mappingValidation.roomNumber}`);
            console.log(`   Residence: ${mappingValidation.residence}`);
        } catch (mappingError) {
            console.warn(`⚠️  Payment mapping validation failed: ${mappingError.message}`);
            // This is a warning, not an error - payment was created successfully
        }

        // Record double-entry accounting transaction
        try {
            const EnhancedPaymentService = require('../../services/enhancedPaymentService');
            
            console.log('💰 Creating double-entry accounting transaction...');
            console.log(`   Payment ID: ${payment.paymentId}`);
            console.log(`   Student: ${payment.student}`);
            console.log(`   User ID: ${payment.user}`);
            console.log(`   Residence: ${payment.residence}`);
            console.log(`   Amount: $${payment.totalAmount}`);
            console.log(`   Method: ${payment.method}`);
            console.log(`   Date: ${payment.date}`);
            console.log(`   Date Type: ${typeof payment.date}`);
            console.log(`   Date Valid: ${payment.date instanceof Date ? 'Yes' : 'No'}`);
            
            // Debug: Log the exact payment object being sent
            console.log('🔍 Payment object being sent to EnhancedPaymentService:', {
                _id: payment._id,
                paymentId: payment.paymentId,
                student: payment.student,
                totalAmount: payment.totalAmount,
                rentAmount: payment.rentAmount,
                adminFee: payment.adminFee,
                deposit: payment.deposit,
                method: payment.method,
                date: payment.date,
                paymentMonth: payment.paymentMonth,
                residence: payment.residence
            });
            
            // Use the enhanced payment service for proper double-entry accounting
            const accountingResult = await EnhancedPaymentService.recordStudentPayment(payment, req.user);
            
            if (accountingResult && accountingResult.transaction && accountingResult.transactionEntry) {
                console.log('✅ Double-entry accounting transaction created for payment');
                console.log(`   Transaction ID: ${accountingResult.transaction.transactionId}`);
                console.log(`   Transaction Entry ID: ${accountingResult.transactionEntry._id}`);
                console.log(`   Amount: $${accountingResult.transactionEntry.totalDebit}`);
                
                // Verify transaction entry was created
                const TransactionEntry = require('../../models/TransactionEntry');
                const createdEntry = await TransactionEntry.findById(accountingResult.transactionEntry._id);
                if (createdEntry) {
                    console.log(`   ✅ Transaction entry verified in database`);
                    console.log(`   Total Debit: $${createdEntry.totalDebit}`);
                    console.log(`   Total Credit: $${createdEntry.totalCredit}`);
                    console.log(`   Entries Count: ${createdEntry.entries?.length || 0}`);
                } else {
                    console.log(`   ⚠️ Transaction entry not found in database after creation`);
                }
            } else {
                console.log(`   ⚠️ Accounting service returned incomplete result`);
            }
        } catch (accountingError) {
            console.error('❌ Error creating accounting transaction:', accountingError);
            console.error('   Error details:', accountingError.message);
            console.error('   Stack trace:', accountingError.stack);
            console.error('   Payment data:', {
                paymentId: payment.paymentId,
                student: payment.student,
                residence: payment.residence,
                totalAmount: payment.totalAmount,
                method: payment.method,
                date: payment.date,
                dateType: typeof payment.date
            });
            // Don't fail the payment creation, but log the error
        }

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'create',
            collection: 'Payment',
            recordId: payment._id,
            before: null,
            after: payment.toObject()
        });

        // Auto-generate receipt for all successful payments
        if (status === 'confirmed' || status === 'completed' || status === 'paid') {
            try {
                const { createReceipt } = require('../receiptController');
                
                // Create detailed receipt items based on payment breakdown
                let receiptItems = [];
                
                if (parsedPayments && parsedPayments.length > 0) {
                    // Use the detailed payment breakdown
                    receiptItems = parsedPayments.map(paymentItem => ({
                        description: `${paymentItem.type.charAt(0).toUpperCase() + paymentItem.type.slice(1)} Payment - ${paymentMonth}`,
                        quantity: 1,
                        unitPrice: paymentItem.amount,
                        totalPrice: paymentItem.amount
                    }));
                } else {
                    // Fallback to single item
                    receiptItems = [{
                        description: `Accommodation Payment - ${paymentMonth}`,
                        quantity: 1,
                        unitPrice: totalAmount,
                        totalPrice: totalAmount
                    }];
                }
                
                // Create receipt data
                const receiptData = {
                    paymentId: payment._id,
                    items: receiptItems,
                    notes: `Payment received for ${studentExists.firstName} ${studentExists.lastName} - ${paymentMonth}`,
                    template: 'default'
                };

                // Create receipt (we'll call the controller function directly)
                const receiptReq = {
                    body: receiptData,
                    user: req.user
                };
                
                const receiptRes = {
                    status: (code) => ({
                        json: (data) => {
                            if (code === 201) {
                                console.log(`✅ Receipt automatically generated for payment ${payment.paymentId}`);
                                console.log(`   Student: ${studentExists.firstName} ${studentExists.lastName}`);
                                console.log(`   Amount: $${totalAmount}`);
                                console.log(`   Receipt Number: ${data?.data?.receipt?.receiptNumber || 'N/A'}`);
                            } else {
                                console.error('❌ Failed to generate receipt:', data);
                            }
                        }
                    })
                };

                await createReceipt(receiptReq, receiptRes);
                
            } catch (receiptError) {
                console.error('❌ Error auto-generating receipt:', receiptError);
                console.error('   Payment ID:', payment.paymentId);
                console.error('   Student:', studentExists.firstName, studentExists.lastName);
                // Don't fail the payment creation if receipt generation fails
            }
        } else {
            console.log(`ℹ️  Receipt not generated for payment ${payment.paymentId} - Status: ${status}`);
        }

        // --- Payment Transaction for Rentals Received ---
        // Always create a transaction for every payment
        let receivingAccount = null;
        if (method && method.toLowerCase().includes('bank')) {
            receivingAccount = await Account.findOne({ code: '1000' }); // Bank
        } else if (method && method.toLowerCase().includes('cash')) {
            receivingAccount = await Account.findOne({ code: '1000' }); // Bank
        } else if (method && method.toLowerCase().includes('cash')) {
            receivingAccount = await Account.findOne({ code: '1015' }); // Cash
        }
        // Add more payment methods as needed
        let rentAccount = await Account.findOne({ code: '4000' }); // Rental Income - Residential
        if (residenceExists && residenceExists.name && residenceExists.name.toLowerCase().includes('school')) {
            const schoolRent = await Account.findOne({ code: '4001' });
            if (schoolRent) rentAccount = schoolRent;
        }
        const studentAccount = await Account.findOne({ code: '1100' }); // Accounts Receivable - Tenants
        const studentName = studentExists ? `${studentExists.firstName} ${studentExists.lastName}` : 'Student';
        
        if (receivingAccount && rentAccount && studentAccount && totalAmount > 0) {
            // Check if student has accrued rental income (from rental accrual system)
            const accruedRentals = await TransactionEntry.find({
                source: 'rental_accrual',
                'metadata.studentId': payment.student,
                status: 'posted'
            }).sort({ date: 1 });

            // Calculate total accrued vs. total paid to determine payment type
            const totalAccrued = accruedRentals.reduce((sum, entry) => sum + entry.totalDebit, 0);
            const totalPaid = debtor ? debtor.totalPaid : 0;
            const outstandingAccrued = totalAccrued - totalPaid;
            
            // Analyze payment month vs current month to determine payment type
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth(); // 0-11
            const currentYear = currentDate.getFullYear();
            
            // Parse payment month if provided
            let paymentMonthDate = null;
            let isAdvancePayment = false;
            let isCurrentPeriodPayment = false;
            let isPastDuePayment = false;
            
            if (payment.paymentMonth) {
                try {
                    // Try to parse payment month (e.g., "September 2025", "Sep 2025", "09/2025")
                    const monthNames = [
                        'january', 'february', 'march', 'april', 'may', 'june',
                        'july', 'august', 'september', 'october', 'november', 'december'
                    ];
                    const monthAbbr = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
                    
                    let month = -1;
                    let year = currentYear;
                    
                    // Check for month names or abbreviations
                    const lowerPaymentMonth = payment.paymentMonth.toLowerCase();
                    month = monthNames.findIndex(m => lowerPaymentMonth.includes(m));
                    if (month === -1) {
                        month = monthAbbr.findIndex(m => lowerPaymentMonth.includes(m));
                    }
                    
                    // Check for year
                    const yearMatch = payment.paymentMonth.match(/\b(20\d{2})\b/);
                    if (yearMatch) {
                        year = parseInt(yearMatch[1]);
                    }
                    
                    if (month !== -1) {
                        paymentMonthDate = new Date(year, month, 1);
                        
                        // Determine payment type based on month comparison
                        const currentMonthDate = new Date(currentYear, currentMonth, 1);
                        
                        if (paymentMonthDate > currentMonthDate) {
                            isAdvancePayment = true;
                            console.log(`💰 ADVANCE PAYMENT: ${studentName} paying for ${payment.paymentMonth} (future month)`);
                        } else if (paymentMonthDate.getTime() === currentMonthDate.getTime()) {
                            isCurrentPeriodPayment = true;
                            console.log(`💰 CURRENT PERIOD PAYMENT: ${studentName} paying for ${payment.paymentMonth} (current month)`);
                        } else {
                            isPastDuePayment = true;
                            console.log(`💰 PAST DUE PAYMENT: ${studentName} paying for ${payment.paymentMonth} (past month)`);
                        }
                    }
                } catch (error) {
                    console.log(`⚠️  Could not parse payment month: ${payment.paymentMonth}`);
                }
            }
            
            // Determine if this is a debt settlement or current period payment
            const studentHasOutstandingDebt = debtor && debtor.currentBalance > 0;
            const hasAccruedRentals = accruedRentals.length > 0;
            
            // Create the main transaction
            const txn = await Transaction.create({
                date: payment.date,
                description: `Payment: ${studentName} (${payment.paymentId}, ${payment.paymentMonth || ''})`,
                reference: payment.paymentId,
                residence: payment.residence,
                residenceName: residenceExists ? residenceExists.name : undefined
            });

            let entries = [];
            let transactionType = 'current_payment';

            // Get Deferred Income account for advance payments
            const deferredIncomeAccount = await Account.findOne({ code: '2030' }); // Deferred Income - Tenant Advances
            const adminFeeAccount = await Account.findOne({ code: '4100' }); // Administrative Income
            const depositAccount = await Account.findOne({ code: '2020' }); // Tenant Deposits Held
            
            // Handle payment breakdown if available
            if (parsedPayments && parsedPayments.length > 0) {
                // Process each payment component separately
                entries = [
                    {
                        transaction: txn._id,
                        account: receivingAccount._id,
                        debit: totalAmount,
                        credit: 0,
                        type: receivingAccount.type || 'asset',
                        description: `Payment received from ${studentName} (${method}, ${payment.paymentId}, ${payment.paymentMonth || ''})`
                    }
                ];
                
                // Process each payment component
                for (const paymentItem of parsedPayments) {
                    const amount = paymentItem.amount || 0;
                    if (amount <= 0) continue;
                    
                    switch (paymentItem.type) {
                        case 'admin':
                            // Admin fee is always revenue (earned immediately)
                            if (adminFeeAccount) {
                                entries.push({
                                    transaction: txn._id,
                                    account: adminFeeAccount._id,
                                    debit: 0,
                                    credit: amount,
                                    type: adminFeeAccount.type || 'income',
                                    description: `Admin fee from ${studentName} (${payment.paymentId})`
                                });
                                console.log(`💰 ADMIN FEE: $${amount.toFixed(2)} recorded as Administrative Income`);
                            }
                            break;
                            
                        case 'deposit':
                            // Deposit is always a liability (held until lease end)
                            if (depositAccount) {
                                entries.push({
                                    transaction: txn._id,
                                    account: depositAccount._id,
                                    debit: 0,
                                    credit: amount,
                                    type: depositAccount.type || 'liability',
                                    description: `Security deposit from ${studentName} (${payment.paymentId})`
                                });
                                console.log(`💰 DEPOSIT: $${amount.toFixed(2)} recorded as Tenant Deposit Liability`);
                            }
                            break;
                            
                        case 'rent':
                            // Rent handling depends on payment month logic
                            if (isAdvancePayment && deferredIncomeAccount) {
                                // Future rent - use Deferred Income
                                entries.push({
                                    transaction: txn._id,
                                    account: deferredIncomeAccount._id,
                                    debit: 0,
                                    credit: amount,
                                    type: deferredIncomeAccount.type || 'liability',
                                    description: `Deferred rent income from ${studentName} for ${payment.paymentMonth} (${payment.paymentId})`
                                });
                                console.log(`💰 ADVANCE RENT: $${amount.toFixed(2)} recorded as Deferred Income for ${payment.paymentMonth}`);
                            } else if (isPastDuePayment || studentHasOutstandingDebt || hasAccruedRentals) {
                                // Past due rent - settle debt
                                entries.push({
                                    transaction: txn._id,
                                    account: studentAccount._id,
                                    debit: 0,
                                    credit: amount,
                                    type: studentAccount.type || 'asset',
                                    description: `Rent payment settles debt from ${studentName} for ${payment.paymentMonth || 'past period'} (${payment.paymentId})`
                                });
                                console.log(`💰 PAST DUE RENT: $${amount.toFixed(2)} settles debt for ${payment.paymentMonth || 'past period'}`);
                            } else {
                                // Current period rent - recognize as income
                                entries.push({
                                    transaction: txn._id,
                                    account: rentAccount._id,
                                    debit: 0,
                                    credit: amount,
                                    type: rentAccount.type || 'income',
                                    description: `Rent income from ${studentName} for ${payment.paymentMonth || 'current period'} (${payment.paymentId})`
                                });
                                console.log(`💰 CURRENT RENT: $${amount.toFixed(2)} recorded as Rental Income`);
                            }
                            break;
                            
                        default:
                            // Unknown payment type - treat as general income
                            entries.push({
                                transaction: txn._id,
                                account: rentAccount._id,
                                debit: 0,
                                credit: amount,
                                type: rentAccount.type || 'income',
                                description: `${paymentItem.type} payment from ${studentName} (${payment.paymentId})`
                            });
                            console.log(`💰 UNKNOWN TYPE: $${amount.toFixed(2)} recorded as general income`);
                    }
                }
                
                // Set transaction type based on what we processed
                if (isAdvancePayment) {
                    transactionType = 'advance_payment';
                } else if (isPastDuePayment || studentHasOutstandingDebt || hasAccruedRentals) {
                    transactionType = 'debt_settlement';
                } else {
                    transactionType = 'current_payment';
                }
                
            } else {
                // Fallback to old logic for payments without breakdown
                if (studentHasOutstandingDebt || hasAccruedRentals || isPastDuePayment) {
                    // Student has outstanding debt, accrued rentals, or paying for past month - this payment settles the debt
                    transactionType = 'debt_settlement';
                    
                    entries = [
                        {
                            transaction: txn._id,
                            account: receivingAccount._id,
                            debit: totalAmount,
                            credit: 0,
                            type: receivingAccount.type || 'asset',
                            description: `Payment received from ${studentName} (${method}, ${payment.paymentId}, ${payment.paymentMonth || ''})`
                        },
                        {
                            transaction: txn._id,
                            account: studentAccount._id,
                            debit: 0,
                            credit: totalAmount,
                            type: studentAccount.type || 'asset',
                            description: `Settlement of outstanding debt by ${studentName} (${method}, ${payment.paymentId}, ${payment.paymentMonth || ''})`
                        }
                    ];

                    // If this payment settles accrued rentals, create additional entry to recognize income
                    if (hasAccruedRentals && outstandingAccrued > 0) {
                        const amountToRecognize = Math.min(totalAmount, outstandingAccrued);
                        
                        if (amountToRecognize > 0) {
                            // Add rental income recognition entry
                            entries.push({
                                transaction: txn._id,
                                account: rentAccount._id,
                                debit: 0,
                                credit: amountToRecognize,
                                type: rentAccount.type || 'income',
                                description: `Rental income recognized from ${studentName} for accrued period (${payment.paymentId})`
                            });

                            // Adjust the Accounts Receivable entry to balance
                            const arEntry = entries.find(e => e.account.toString() === studentAccount._id.toString());
                            if (arEntry) {
                                arEntry.credit = arEntry.credit - amountToRecognize;
                            }

                            console.log(`💰 Payment ${amountToRecognize.toFixed(2)} recognized as rental income from accrued rentals`);
                        }
                    }
                } else if (isAdvancePayment && deferredIncomeAccount) {
                    // This is an advance payment for future rent - use Deferred Income
                    transactionType = 'advance_payment';
                    
                    entries = [
                        {
                            transaction: txn._id,
                            account: receivingAccount._id,
                            debit: totalAmount,
                            credit: 0,
                            type: receivingAccount.type || 'asset',
                            description: `Advance payment received from ${studentName} (${method}, ${payment.paymentId}, ${payment.paymentMonth || ''})`
                        },
                        {
                            transaction: txn._id,
                            account: deferredIncomeAccount._id,
                            debit: 0,
                            credit: totalAmount,
                            type: deferredIncomeAccount.type || 'liability',
                            description: `Deferred income from ${studentName} for ${payment.paymentMonth} (${payment.paymentId})`
                        }
                    ];
                    
                    console.log(`💰 ADVANCE PAYMENT: ${totalAmount.toFixed(2)} recorded as Deferred Income for ${payment.paymentMonth}`);
                    
                } else {
                    // Student has no outstanding debt and this is current period payment
                    transactionType = 'current_payment';
                    
                    entries = [
                        {
                            transaction: txn._id,
                            account: receivingAccount._id,
                            debit: totalAmount,
                            credit: 0,
                            type: receivingAccount.type || 'asset',
                            description: `Payment received from ${studentName} (${method}, ${payment.paymentId}, ${payment.paymentMonth || ''})`
                        },
                        {
                            transaction: txn._id,
                            account: rentAccount._id,
                            debit: 0,
                            credit: totalAmount,
                            type: rentAccount.type || 'income',
                            description: `Rental income from ${studentName} for ${payment.paymentMonth || 'current period'} (${payment.paymentId})`
                        }
                    ];
                    
                    console.log(`💰 CURRENT PERIOD PAYMENT: ${totalAmount.toFixed(2)} recorded as Rental Income`);
                }
            }

            // Validate that debits equal credits
            const totalDebits = entries.reduce((sum, entry) => sum + entry.debit, 0);
            const totalCredits = entries.reduce((sum, entry) => sum + entry.credit, 0);

            if (totalDebits !== totalCredits) {
                throw new Error(`Double-entry imbalance: Debits (${totalDebits}) != Credits (${totalCredits})`);
            }

            // Insert all transaction entries into the TransactionEntry collection
            const createdEntries = await TransactionEntry.insertMany(entries.map(entry => ({
                ...entry,
                residence: payment.residence, // Add residence information to each entry
                metadata: {
                    ...entry.metadata,
                    residenceId: payment.residence,
                    residenceName: residenceExists ? residenceExists.name : 'Unknown',
                    studentId: payment.student,
                    paymentId: payment.paymentId,
                    paymentMonth: payment.paymentMonth,
                    paymentMethod: method,
                    transactionType: transactionType,
                    hasAccruedRentals: hasAccruedRentals,
                    totalAccrued: totalAccrued,
                    outstandingAccrued: outstandingAccrued,
                    amountRecognized: hasAccruedRentals ? Math.min(totalAmount, outstandingAccrued) : 0
                }
            })));
            
            // Link the created entries to the main transaction
            await Transaction.findByIdAndUpdate(
                txn._id,
                { $push: { entries: { $each: createdEntries.map(e => e._id) } } }
            );

            // Audit log for the conversion
            await AuditLog.create({
                user: req.user._id,
                action: `convert_to_${transactionType}_${receivingAccount.code === '1000' ? 'bank' : (receivingAccount.code === '1015' ? 'cash' : 'other')}`,
                collection: 'Transaction',
                recordId: txn._id,
                before: null,
                after: txn.toObject(),
                timestamp: new Date(),
                details: {
                    source: 'Payment',
                    sourceId: payment._id,
                    transactionType: transactionType,
                    studentHasOutstandingDebt: studentHasOutstandingDebt,
                    hasAccruedRentals: hasAccruedRentals,
                    totalAccrued: totalAccrued,
                    outstandingAccrued: outstandingAccrued,
                    studentBalance: debtor ? debtor.currentBalance : 0,
                    description: `Admin payment converted to ${receivingAccount.name} as ${transactionType === 'debt_settlement' ? 'Debt Settlement' : 'Current Payment'} for ${studentName}`,
                    entriesCreated: createdEntries.length,
                    accountingNotes: hasAccruedRentals ? 
                        `Payment settles ${Math.min(totalAmount, outstandingAccrued).toFixed(2)} of accrued rental income` : 
                        'Standard payment processing'
                }
            });

            console.log(`Payment ${payment.paymentId} converted to transaction ${txn._id} with ${createdEntries.length} entries (${transactionType})`);
            if (hasAccruedRentals) {
                console.log(`💰 Integrated with rental accrual system: ${outstandingAccrued.toFixed(2)} outstanding accrued rentals`);
            }
        } else {
            console.log(`Skipping transaction creation for payment ${payment.paymentId} - missing accounts or zero amount`);
        }
        // --- End Payment Transaction ---

        // Populate the response
        const populatedPayment = await Payment.findById(payment._id)
            .populate('student', 'firstName lastName email')
            .populate('residence', 'name');

        // Include accounting information in response
        const response = {
            success: true,
            message: 'Payment created successfully with double-entry accounting',
            payment: populatedPayment,
            accounting: {
                transactionCreated: true,
                message: 'Double-entry accounting transaction created'
            }
        };

        res.status(201).json(response);
    } catch (error) {
        console.error('Error creating payment:', error);
        res.status(500).json({ message: error.message });
    }
};

// Send receipt email
const sendReceiptEmail = async (req, res) => {
    try {
        const { to, subject, html } = req.body;

        if (!to || !subject || !html) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: to, subject, html'
            });
        }

        // Send email using the email utility
        await sendEmail({
            to,
            subject,
            html
        });

        res.status(200).json({
            success: true,
            message: 'Receipt email sent successfully'
        });
    } catch (error) {
        console.error('Error sending receipt email:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send receipt email',
            error: error.message
        });
    }
};

// Upload receipt to S3
const uploadReceiptHandler = async (req, res) => {
    uploadReceipt(req, res, async function(err) {
        if (err) {
            return res.status(400).json({ 
                success: false,
                error: err.message 
            });
        }

        try {
            if (!req.file) {
                return res.status(400).json({ 
                    success: false,
                    error: 'No file uploaded' 
                });
            }

            // The file is already uploaded to S3 by multer-s3
            const fileUrl = req.file.location;

            res.status(200).json({
                success: true,
                message: 'Receipt uploaded successfully',
                url: fileUrl,
                fileName: req.file.originalname
            });
        } catch (error) {
            console.error('Error uploading receipt:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to upload receipt',
                error: error.message
            });
        }
    });
};

// Export all functions
module.exports = {
    getPayments,
    getPaymentById,
    updatePaymentStatus,
    uploadProofOfPayment,
    verifyProofOfPayment,
    getPaymentTotals,
    createPayment,
    sendReceiptEmail,
    uploadReceipt: uploadReceiptHandler
}; 