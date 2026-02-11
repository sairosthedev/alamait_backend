const Payment = require('../../models/Payment');
const Refund = require('../../models/Refund');
const DoubleEntryAccountingService = require('../../services/doubleEntryAccountingService');

// GET /api/finance/refunds?search=&startDate=&endDate=&studentId=&paymentId=&page=1&limit=20
exports.listRefunds = async (req, res) => {
    try {
        const { 
            search, 
            startDate, 
            endDate, 
            studentId, 
            paymentId,
            status,
            page = 1, 
            limit = 20 
        } = req.query;

        const query = {};

        // Filter by student
        if (studentId) {
            query.student = studentId;
        }

        // Filter by payment
        if (paymentId) {
            query.payment = paymentId;
        }

        // Filter by status
        if (status) {
            query.status = status;
        }

        // Date range filter
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                query.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999); // Include the entire end date
                query.createdAt.$lte = end;
            }
        }

        // Search filter (searches in reason, reference, paymentId)
        if (search) {
            query.$or = [
                { reason: { $regex: search, $options: 'i' } },
                { reference: { $regex: search, $options: 'i' } }
            ];
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Get total count for pagination
        const total = await Refund.countDocuments(query);

        // Fetch refunds with pagination
        const refunds = await Refund.find(query)
            .populate({
                path: 'student',
                select: 'firstName lastName email studentId',
                model: 'User'
            })
            .populate({
                path: 'payment',
                select: 'paymentId totalAmount date method status user',
                populate: {
                    path: 'user',
                    select: 'firstName lastName email studentId',
                    model: 'User'
                }
            })
            .populate('createdBy', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        // Format refunds to include student name and date
        const formattedRefunds = await Promise.all(refunds.map(async (refund) => {
            // Try to get student name from refund.student first
            let studentName = 'Unknown Student';
            const studentId = refund.student && typeof refund.student === 'object' 
                ? refund.student._id 
                : refund.student;
            
            if (refund.student && typeof refund.student === 'object' && refund.student.firstName) {
                studentName = `${refund.student.firstName || ''} ${refund.student.lastName || ''}`.trim() || 'Unknown Student';
            } else if (refund.payment && typeof refund.payment === 'object' && refund.payment.user) {
                // If student is null, try to get from payment.user (if populated)
                if (typeof refund.payment.user === 'object' && refund.payment.user.firstName) {
                    studentName = `${refund.payment.user.firstName || ''} ${refund.payment.user.lastName || ''}`.trim() || 'Unknown Student';
                }
            }
            
            // If still unknown, fetch directly from User collection, ExpiredStudent, or Debtor
            if (studentName === 'Unknown Student' && studentId) {
                try {
                    const User = require('../../models/User');
                    const ExpiredStudent = require('../../models/ExpiredStudent');
                    const Debtor = require('../../models/Debtor');
                    const mongoose = require('mongoose');
                    const userId = typeof studentId === 'object' ? studentId.toString() : studentId;
                    
                    if (mongoose.Types.ObjectId.isValid(userId)) {
                        // Try User collection first
                        const user = await User.findById(userId).select('firstName lastName email').lean();
                        if (user) {
                            studentName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown Student';
                        } else {
                            // Try ExpiredStudent collection
                            const expiredStudent = await ExpiredStudent.findOne({
                                $or: [
                                    { 'student._id': new mongoose.Types.ObjectId(userId) },
                                    { 'student': new mongoose.Types.ObjectId(userId) },
                                    { 'application.student': new mongoose.Types.ObjectId(userId) }
                                ]
                            }).lean();
                            
                            if (expiredStudent && expiredStudent.student) {
                                const student = expiredStudent.student;
                                if (student.firstName && student.lastName) {
                                    studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unknown Student';
                                } else if (expiredStudent.application && expiredStudent.application.firstName) {
                                    studentName = `${expiredStudent.application.firstName || ''} ${expiredStudent.application.lastName || ''}`.trim() || 'Unknown Student';
                                }
                            }
                            
                            // If still unknown, try Debtor collection
                            if (studentName === 'Unknown Student') {
                                const debtor = await Debtor.findOne({ user: userId })
                                    .select('contactInfo debtorCode')
                                    .lean();
                                if (debtor) {
                                    if (debtor.contactInfo && debtor.contactInfo.name) {
                                        studentName = debtor.contactInfo.name;
                                    } else if (debtor.debtorCode) {
                                        studentName = `Debtor ${debtor.debtorCode}`;
                                    }
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.log(`Could not fetch student name for refund ${refund._id}:`, err.message);
                }
            }
            
            return {
                ...refund.toObject(),
                studentName: studentName,
                date: refund.refundDate || refund.createdAt,
                refundDate: refund.refundDate || refund.createdAt
            };
        }));

        res.json({
            success: true,
            refunds: formattedRefunds,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (err) {
        console.error('Error listing refunds:', err);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch refunds',
            message: err.message 
        });
    }
};

// GET /api/finance/refunds/payments?studentId=...&status=Confirmed
exports.listStudentPayments = async (req, res) => {
    try {
        const { studentId, status } = req.query;

        if (!studentId) {
            return res.status(400).json({ error: 'studentId is required' });
        }

        const filter = { user: studentId };
        if (status) {
            filter.status = status;
        }

        const payments = await Payment.find(filter)
            .sort({ date: -1 })
            .select('paymentId totalAmount date method status payments description paymentMonth');

        res.json({ payments });
    } catch (err) {
        console.error('Error listing student payments for refund:', err);
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
};

// POST /api/finance/refunds
// body: { paymentId (optional), studentId, amount, reason, method, reference, date, createTransaction }
// createTransaction: boolean - if true, automatically creates accounting transaction (default: true)
// If paymentId is not provided, will use the most recent payment for the student
exports.createRefund = async (req, res) => {
    try {
        const { 
            paymentId, 
            studentId, 
            amount, 
            reason, 
            method, 
            reference,
            date,
            createTransaction = true // Default to true to automatically create transaction
        } = req.body;

        // Validate required fields
        if (!studentId) {
            return res.status(400).json({ 
                success: false,
                error: 'studentId is required' 
            });
        }

        if (typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ 
                success: false,
                error: 'A valid numeric amount greater than 0 is required' 
            });
        }

        // Validate that student exists - check User, Debtor, and ExpiredStudent
        const User = require('../../models/User');
        const Debtor = require('../../models/Debtor');
        const ExpiredStudent = require('../../models/ExpiredStudent');
        const mongoose = require('mongoose');
        let student = null;
        let studentInfo = null; // Store student info for later use
        
        if (mongoose.Types.ObjectId.isValid(studentId)) {
            // First, try to find in active users
            student = await User.findById(studentId).select('firstName lastName email studentId');
            
            if (student) {
                // Active student found
                studentInfo = {
                    _id: student._id,
                    firstName: student.firstName,
                    lastName: student.lastName,
                    email: student.email,
                    isExpired: false
                };
            } else {
                // Student not in User collection - check Debtor (expired students still have debtor records)
                const debtor = await Debtor.findOne({ user: studentId })
                    .select('contactInfo user debtorCode');
                
                if (debtor && debtor.contactInfo) {
                    // Found in Debtor - extract name from contactInfo
                    const nameParts = (debtor.contactInfo.name || '').split(' ');
                    const firstName = nameParts[0] || '';
                    const lastName = nameParts.slice(1).join(' ') || '';
                    
                    studentInfo = {
                        _id: studentId,
                        firstName: firstName,
                        lastName: lastName,
                        email: debtor.contactInfo.email || null,
                        isExpired: true,
                        source: 'debtor'
                    };
                    console.log(`✅ Found expired student in Debtor: ${firstName} ${lastName}`);
                } else {
                    // Check ExpiredStudent as final fallback
                    const expiredStudent = await ExpiredStudent.findOne({
                        $or: [
                            { 'student._id': new mongoose.Types.ObjectId(studentId) },
                            { 'student': new mongoose.Types.ObjectId(studentId) },
                            { 'application.student': new mongoose.Types.ObjectId(studentId) }
                        ]
                    });
                    
                    if (expiredStudent) {
                        // Extract from expired student
                        let firstName = '';
                        let lastName = '';
                        let email = null;
                        
                        if (expiredStudent.application && expiredStudent.application.student) {
                            firstName = expiredStudent.application.student.firstName || '';
                            lastName = expiredStudent.application.student.lastName || '';
                            email = expiredStudent.application.student.email || null;
                        } else if (expiredStudent.student && typeof expiredStudent.student === 'object') {
                            firstName = expiredStudent.student.firstName || '';
                            lastName = expiredStudent.student.lastName || '';
                            email = expiredStudent.student.email || null;
                        }
                        
                        studentInfo = {
                            _id: studentId,
                            firstName: firstName,
                            lastName: lastName,
                            email: email,
                            isExpired: true,
                            source: 'expiredStudent'
                        };
                        console.log(`✅ Found expired student in ExpiredStudent: ${firstName} ${lastName}`);
                    }
                }
            }
        }
        
        if (!studentInfo) {
            return res.status(404).json({ 
                success: false,
                error: `Student not found with ID: ${studentId}. Student may have been deleted or never existed.` 
            });
        }
        
        // Use studentInfo for creating refund (even if student is expired, we still have the ID)
        // Create a minimal student object for compatibility
        student = {
            _id: studentInfo._id,
            firstName: studentInfo.firstName,
            lastName: studentInfo.lastName,
            email: studentInfo.email
        };
        
        if (studentInfo.isExpired) {
            console.log(`ℹ️  Student is expired but found in ${studentInfo.source || 'system'}. Proceeding with refund creation.`);
        }

        // Find payment - if paymentId provided, use it; otherwise find most recent payment
        let payment = null;

        if (paymentId) {
            // Try finding by paymentId first - use validated student._id
            payment = await Payment.findOne({ paymentId, user: student._id })
                .populate('user', 'firstName lastName email');
            if (!payment && mongoose.Types.ObjectId.isValid(paymentId)) {
                // Try finding by _id if paymentId didn't work
                payment = await Payment.findOne({ _id: paymentId, user: student._id })
                    .populate('user', 'firstName lastName email');
            }
        } else {
            // If no paymentId provided, find the most recent payment for this student
            payment = await Payment.findOne({ user: student._id })
                .populate('user', 'firstName lastName email')
                .sort({ date: -1, createdAt: -1 })
                .limit(1);
        }
        
        if (!payment) {
            return res.status(404).json({ 
                success: false,
                error: paymentId 
                    ? `Payment not found for student (paymentId: ${paymentId})` 
                    : 'No payments found for this student' 
            });
        }

        // Optional: cap refund to payment total
        const paymentTotal = payment.totalAmount || payment.amount || payment.calculatedAmount || 0;
        if (amount < 0 || amount > paymentTotal) {
            return res.status(400).json({ 
                error: `Refund amount must be between 0 and original payment total ($${paymentTotal})` 
            });
        }

        // Prepare refund date
        const refundDate = date ? new Date(date) : new Date();

        // Find debtor for this student (debtor exists even for expired students)
        let debtor = await Debtor.findOne({ user: student._id });
        
        // Create refund record - use student._id to ensure proper linking
        const refund = new Refund({
            payment: payment._id,
            student: student._id, // Use the validated student object's _id
            debtor: debtor ? debtor._id : null,
            amount,
            reason: reason || 'Cancelled lease',
            method: method || 'Bank Transfer',
            status: createTransaction ? 'Processed' : 'Pending', // Set to Processed if transaction will be created
            reference: reference || null,
            refundDate: refundDate,
            createdBy: req.user._id
        });

        await refund.save();

        // Populate student and payment information for response
        await refund.populate('student', 'firstName lastName email studentId');
        await refund.populate({
            path: 'payment',
            select: 'paymentId totalAmount date method status user',
            populate: {
                path: 'user',
                select: 'firstName lastName email'
            }
        });

        let transactionResult = null;

        // Automatically create accounting transaction if requested
        if (createTransaction) {
            try {
                const description = `Refund to student: ${reason || 'Cancelled lease'}`;

                console.log(`\n🔄 Creating refund transaction...`);
                console.log(`   Refund ID: ${refund._id}`);
                console.log(`   Payment ID: ${payment._id}`);
                console.log(`   Student ID: ${student._id}`);
                console.log(`   Student Name: ${student.firstName} ${student.lastName}`);
                console.log(`   Amount: $${amount}`);
                console.log(`   Date: ${refundDate}`);

                transactionResult = await DoubleEntryAccountingService.createRefundTransaction({
                    refundId: refund._id.toString(),
                    paymentId: payment._id.toString(),
                    studentId: student._id.toString(), // Use validated student's _id
                    amount: amount,
                    reason: reason || 'Cancelled lease',
                    description: description,
                    date: refundDate,
                    method: method || 'Bank Transfer',
                    createdBy: req.user._id,
                    residence: payment.residence || null
                });

                console.log(`✅ Refund transaction created successfully: ${transactionResult.transactionId}`);
                
                // Update refund status to Processed and link transaction
                refund.status = 'Processed';
                refund.transactionId = transactionResult.transactionId;
                refund.processedAt = new Date();
                await refund.save();
            } catch (transactionError) {
                console.error('❌ Error creating refund transaction:', transactionError);
                console.error('   Error details:', transactionError.stack);
                // Don't fail the refund creation if transaction fails - can be created manually later
                refund.status = 'Pending';
                refund.transactionError = transactionError.message;
                await refund.save();
                
                // Re-populate refund after saving to get fresh data
                await refund.populate('student', 'firstName lastName email studentId');
                await refund.populate({
                    path: 'payment',
                    select: 'paymentId totalAmount date method status user',
                    populate: {
                        path: 'user',
                        select: 'firstName lastName email'
                    }
                });
                
                // Get student name from multiple sources
                let studentName = 'Unknown Student';
                if (refund.student && typeof refund.student === 'object') {
                    studentName = `${refund.student.firstName || ''} ${refund.student.lastName || ''}`.trim() || 'Unknown Student';
                } else if (student && student.firstName) {
                    // Use the validated student object we fetched earlier
                    studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unknown Student';
                } else if (refund.payment && typeof refund.payment === 'object' && refund.payment.user) {
                    const paymentUser = refund.payment.user;
                    if (typeof paymentUser === 'object' && paymentUser.firstName) {
                        studentName = `${paymentUser.firstName || ''} ${paymentUser.lastName || ''}`.trim() || 'Unknown Student';
                    }
                }
                
                // If still unknown, try to fetch from User collection using validated student
                if (studentName === 'Unknown Student' && student) {
                    try {
                        // Use the validated student object we already have
                        studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unknown Student';
                    } catch (err) {
                        console.log('Could not fetch student name:', err.message);
                    }
                }
                
                // Return error details in response so user knows what went wrong
                return res.status(201).json({ 
                    success: true,
                    message: 'Refund created but transaction failed. You can process it manually.',
                    warning: `Transaction creation failed: ${transactionError.message}`,
                    refund: {
                        _id: refund._id,
                        payment: refund.payment,
                        student: refund.student,
                        studentName: studentName,
                        amount: refund.amount,
                        reason: refund.reason,
                        method: refund.method,
                        status: refund.status,
                        reference: refund.reference,
                        date: refund.refundDate || refund.createdAt,
                        refundDate: refund.refundDate || refund.createdAt,
                        createdAt: refund.createdAt,
                        updatedAt: refund.updatedAt,
                        transactionError: transactionError.message
                    },
                    transaction: null
                });
            }
        }

        // Get student name - try multiple sources (should be populated from validated student)
        let studentName = 'Unknown Student';
        const studentIdForLookup = refund.student && typeof refund.student === 'object' 
            ? (refund.student._id || refund.student)
            : (refund.student || student._id);
        
        if (refund.student && typeof refund.student === 'object' && refund.student.firstName) {
            studentName = `${refund.student.firstName || ''} ${refund.student.lastName || ''}`.trim() || 'Unknown Student';
        } else if (student && student.firstName) {
            // Use the validated student object we fetched earlier
            studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unknown Student';
        } else if (refund.payment && typeof refund.payment === 'object' && refund.payment.user) {
            // Try to get from payment.user if student is not populated
            const paymentUser = refund.payment.user;
            if (typeof paymentUser === 'object' && paymentUser.firstName) {
                studentName = `${paymentUser.firstName || ''} ${paymentUser.lastName || ''}`.trim() || 'Unknown Student';
            }
        }
        
        // If still unknown, try to fetch from User collection using studentId from refund or validated student
        if (studentName === 'Unknown Student') {
            try {
                const User = require('../../models/User');
                const mongoose = require('mongoose');
                const userIdToCheck = studentIdForLookup || student._id;
                if (userIdToCheck) {
                    const userId = typeof userIdToCheck === 'object' ? userIdToCheck.toString() : userIdToCheck;
                    if (mongoose.Types.ObjectId.isValid(userId)) {
                        const user = await User.findById(userId).select('firstName lastName email').lean();
                        if (user) {
                            studentName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown Student';
                            console.log(`✅ Found student name: ${studentName} for ID: ${userId}`);
                        } else {
                            console.log(`⚠️ User not found for ID: ${userId}`);
                        }
                    } else {
                        console.log(`⚠️ Invalid ObjectId format: ${userId}`);
                    }
                }
            } catch (err) {
                console.error('❌ Error fetching student name:', err.message);
            }
        }

        res.status(201).json({ 
            success: true,
            message: createTransaction && transactionResult 
                ? 'Refund created and transaction recorded' 
                : 'Refund created (transaction pending)',
            refund: {
                _id: refund._id,
                payment: refund.payment,
                student: refund.student,
                studentName: studentName,
                amount: refund.amount,
                reason: refund.reason,
                method: refund.method,
                status: refund.status,
                reference: refund.reference,
                date: refund.refundDate || refund.createdAt,
                refundDate: refund.refundDate || refund.createdAt,
                createdAt: refund.createdAt,
                updatedAt: refund.updatedAt
            },
            transaction: transactionResult ? {
                transactionId: transactionResult.transactionId,
                transactionEntryId: transactionResult.transactionEntryId,
                isAdvancePaymentRefund: transactionResult.isAdvancePaymentRefund
            } : null
        });
    } catch (err) {
        console.error('Error creating refund:', err);
        res.status(500).json({ 
            success: false,
            error: 'Failed to create refund',
            message: err.message 
        });
    }
};

// POST /api/finance/refunds/:refundId/process
// Process an existing refund (create transaction if not already created)
exports.processRefund = async (req, res) => {
    try {
        const { refundId } = req.params;
        const { date, method } = req.body;

        const refund = await Refund.findById(refundId)
            .populate('payment')
            .populate('student', 'firstName lastName email');

        if (!refund) {
            return res.status(404).json({ error: 'Refund not found' });
        }

        if (refund.status === 'Processed' && refund.transactionId) {
            return res.status(400).json({ 
                error: 'Refund already processed',
                transactionId: refund.transactionId
            });
        }

        const payment = refund.payment;
        const student = refund.student;

        // Handle null student case
        if (!student) {
            return res.status(400).json({ 
                success: false,
                error: 'Student not found for this refund. Cannot process refund without student information.' 
            });
        }

        if (!payment) {
            return res.status(400).json({ 
                success: false,
                error: 'Payment not found for this refund. Cannot process refund without payment information.' 
            });
        }

        const refundDate = date ? new Date(date) : new Date();
        const refundMethod = method || refund.method || 'Bank Transfer';
        const studentName = student.firstName && student.lastName 
            ? `${student.firstName} ${student.lastName}` 
            : 'Student';
        const description = `Refund to ${studentName}: ${refund.reason || 'Cancelled lease'}`;

        const transactionResult = await DoubleEntryAccountingService.createRefundTransaction({
            refundId: refund._id,
            paymentId: payment._id,
            studentId: student._id || student,
            amount: refund.amount,
            reason: refund.reason,
            description: description,
            date: refundDate,
            method: refundMethod,
            createdBy: req.user._id,
            residence: payment.residence || null
        });

        refund.status = 'Processed';
        refund.processedAt = new Date();
        refund.updatedBy = req.user._id;
        await refund.save();

        res.json({
            success: true,
            message: 'Refund processed and transaction created',
            refund: {
                _id: refund._id,
                status: refund.status,
                processedAt: refund.processedAt
            },
            transaction: {
                transactionId: transactionResult.transactionId,
                transactionEntryId: transactionResult.transactionEntryId,
                isAdvancePaymentRefund: transactionResult.isAdvancePaymentRefund
            }
        });
    } catch (err) {
        console.error('Error processing refund:', err);
        res.status(500).json({ 
            success: false,
            error: 'Failed to process refund',
            message: err.message 
        });
    }
};

// GET /api/finance/refunds/:refundId
// Get refund details by ID
exports.getRefundById = async (req, res) => {
    try {
        const { refundId } = req.params;

        const refund = await Refund.findById(refundId)
            .populate('student', 'firstName lastName email studentId')
            .populate({
                path: 'payment',
                select: 'paymentId totalAmount date method status user',
                populate: {
                    path: 'user',
                    select: 'firstName lastName email'
                }
            })
            .populate('createdBy', 'firstName lastName email');

        if (!refund) {
            return res.status(404).json({
                success: false,
                error: 'Refund not found'
            });
        }

        // Get student name from multiple sources
        let studentName = 'Unknown Student';
        const studentId = refund.student && typeof refund.student === 'object' 
            ? refund.student._id 
            : refund.student;
        
        if (refund.student && typeof refund.student === 'object' && refund.student.firstName) {
            studentName = `${refund.student.firstName || ''} ${refund.student.lastName || ''}`.trim() || 'Unknown Student';
        } else if (refund.payment && typeof refund.payment === 'object') {
            if (refund.payment.user && typeof refund.payment.user === 'object' && refund.payment.user.firstName) {
                studentName = `${refund.payment.user.firstName || ''} ${refund.payment.user.lastName || ''}`.trim() || 'Unknown Student';
            }
        }
        
        // If still unknown, try ExpiredStudent or Debtor
        if (studentName === 'Unknown Student' && studentId) {
            try {
                const ExpiredStudent = require('../../models/ExpiredStudent');
                const Debtor = require('../../models/Debtor');
                const mongoose = require('mongoose');
                const userId = typeof studentId === 'object' ? studentId.toString() : studentId;
                
                if (mongoose.Types.ObjectId.isValid(userId)) {
                    // Try ExpiredStudent collection
                    const expiredStudent = await ExpiredStudent.findOne({
                        $or: [
                            { 'student._id': new mongoose.Types.ObjectId(userId) },
                            { 'student': new mongoose.Types.ObjectId(userId) },
                            { 'application.student': new mongoose.Types.ObjectId(userId) }
                        ]
                    }).lean();
                    
                    if (expiredStudent && expiredStudent.student) {
                        const student = expiredStudent.student;
                        if (student.firstName && student.lastName) {
                            studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unknown Student';
                        } else if (expiredStudent.application && expiredStudent.application.firstName) {
                            studentName = `${expiredStudent.application.firstName || ''} ${expiredStudent.application.lastName || ''}`.trim() || 'Unknown Student';
                        }
                    }
                    
                    // If still unknown, try Debtor collection
                    if (studentName === 'Unknown Student') {
                        const debtor = await Debtor.findOne({ user: userId })
                            .select('contactInfo debtorCode')
                            .lean();
                        if (debtor) {
                            if (debtor.contactInfo && debtor.contactInfo.name) {
                                studentName = debtor.contactInfo.name;
                            } else if (debtor.debtorCode) {
                                studentName = `Debtor ${debtor.debtorCode}`;
                            }
                        }
                    }
                }
            } catch (err) {
                console.log('Could not fetch student name:', err.message);
            }
        }

        res.json({
            success: true,
            refund: {
                ...refund.toObject(),
                studentName: studentName,
                date: refund.refundDate || refund.createdAt,
                refundDate: refund.refundDate || refund.createdAt
            }
        });
    } catch (err) {
        console.error('Error getting refund by ID:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch refund',
            message: err.message
        });
    }
};



