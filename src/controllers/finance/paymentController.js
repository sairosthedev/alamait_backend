const { validationResult } = require('express-validator');
const Payment = require('../../models/Payment');
const User = require('../../models/User');
const { Residence } = require('../../models/Residence');
const Application = require('../../models/Application');
const Lease = require('../../models/Lease');
const Debtor = require('../../models/Debtor');

/**
 * Get all student payments with pagination and filtering
 */
exports.getStudentPayments = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            status, 
            residence, 
            startDate, 
            endDate,
            student,
            paymentType
        } = req.query;
        
        const query = {};
        
        // Apply filters
        if (status) {
            query.status = status;
        }
        
        if (residence) {
            // Find residence by name first
            try {
                const residenceObj = await Residence.findOne({ 
                    name: { $regex: new RegExp(residence, 'i') } 
                });
                
                if (residenceObj) {
                    // If found, filter by residence ID
                    query.residence = residenceObj._id;
                } else {
                    // If not found, try to filter by residence ID directly
                    // This allows flexibility in case the ID is passed directly
                    query.residence = residence;
                }
            } catch (error) {
                console.error('Error finding residence by name:', error);
                // In case of error, try to use the provided value directly
                query.residence = residence;
            }
        }
        
        if (student) {
            const studentUser = await User.findOne({
                $or: [
                    { _id: student },
                    { email: student },
                    { 
                        $expr: { 
                            $regexMatch: { 
                                input: { $concat: ["$firstName", " ", "$lastName"] }, 
                                regex: student, 
                                options: "i" 
                            } 
                        } 
                    }
                ]
            });
            
            if (studentUser) {
                query.student = studentUser._id;
            }
        }
        
        // Date filtering
        if (startDate || endDate) {
            query.date = {};
            
            if (startDate) {
                query.date.$gte = new Date(startDate);
            }
            
            if (endDate) {
                query.date.$lte = new Date(endDate);
            }
        }

        // Query the database directly without pagination to better match admin method
        const payments = await Payment.find(query)
            .populate('residence', 'name location')
            .populate('createdBy', 'firstName lastName')
            .populate('updatedBy', 'firstName lastName')
            .populate('proofOfPayment.verifiedBy', 'firstName lastName')
            .sort({ date: -1 });
            
        // Transform payments data and handle expired students
        const formattedPayments = await Promise.all(payments.map(async (payment) => {
            // Get student information (including expired students)
            let studentInfo = null;
            if (payment.student || payment.user) {
                const studentId = payment.student || payment.user;
                const studentResult = await findStudentById(studentId);
                if (studentResult) {
                    studentInfo = studentResult.student;
                }
            }
            let paymentType = 'Other';
            
            // Improved payment type detection
            if (payment.rentAmount > 0 && payment.adminFee === 0 && payment.deposit === 0) {
                paymentType = 'Rent';
            } else if (payment.deposit > 0 && payment.rentAmount === 0 && payment.adminFee === 0) {
                paymentType = 'Deposit';
            } else if (payment.adminFee > 0 && payment.rentAmount === 0 && payment.deposit === 0) {
                paymentType = 'Admin Fee';
            } else if (payment.rentAmount > 0 && payment.adminFee > 0 && payment.deposit === 0) {
                paymentType = 'Rent + Admin Fee';
            } else if (payment.rentAmount > 0 && payment.deposit > 0 && payment.adminFee === 0) {
                paymentType = 'Rent + Deposit';
            } else if (payment.rentAmount > 0 && payment.adminFee > 0 && payment.deposit > 0) {
                paymentType = 'Rent + Admin Fee + Deposit';
            } else if (payment.adminFee > 0 && payment.deposit > 0 && payment.rentAmount === 0) {
                paymentType = 'Admin Fee + Deposit';
            }
            
            const admin = payment.createdBy ? 
                `${payment.createdBy.firstName} ${payment.createdBy.lastName}` : 
                'System';
                
            return {
                id: payment.paymentId,
                student: studentInfo ? `${studentInfo.firstName} ${studentInfo.lastName}` : 'Unknown',
                admin: admin,
                residence: payment.residence ? payment.residence.name : 'Unknown',
                room: payment.room || 'Not Assigned',
                roomType: payment.roomType || '',
                paymentMonth: payment.paymentMonth || '',
                rentAmount: payment.rentAmount || 0,
                adminFee: payment.adminFee || 0,
                deposit: payment.deposit || 0,
                amount: payment.totalAmount,
                datePaid: safeDateFormat(payment.date),
                paymentType: paymentType,
                status: payment.status,
                proof: payment.proofOfPayment?.fileUrl || null,
                method: payment.method || '',
                description: payment.description || '',
                studentId: studentInfo ? studentInfo._id : null,
                residenceId: payment.residence ? payment.residence._id : null,
                applicationStatus: payment.applicationStatus || null,
                clarificationRequests: payment.clarificationRequests || [],
                studentInfo: studentInfo // Include full student info for expired students
            };
        }));
        
        const total = formattedPayments.length;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedPayments = formattedPayments.slice(startIndex, endIndex);
        
        res.json({
            payments: paginatedPayments,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            totalPayments: total
        });
    } catch (error) {
        console.error('Error in getStudentPayments:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Update payment status (confirm or reject)
 */
exports.updatePaymentStatus = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { status } = req.body;
        const payment = await Payment.findOne({ paymentId: req.params.paymentId })
            .populate('student', 'firstName lastName email');

        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        payment.status = status;
        payment.updatedBy = req.user._id;
        await payment.save();

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
                        notes: `Payment status updated to ${status} for ${payment.student?.firstName} ${payment.student?.lastName} - ${payment.paymentMonth}`,
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
                                    console.log(`✅ Receipt automatically generated for payment status update (Finance)`);
                                    console.log(`   Payment ID: ${payment.paymentId}`);
                                    console.log(`   Student: ${payment.student?.firstName} ${payment.student?.lastName}`);
                                    console.log(`   Status: ${status}`);
                                    console.log(`   Receipt Number: ${data?.data?.receipt?.receiptNumber || 'N/A'}`);
                                } else {
                                    console.error('❌ Failed to generate receipt on status update (Finance):', data);
                                }
                            }
                        })
                    };

                    await createReceipt(receiptReq, receiptRes);
                } else {
                    console.log(`ℹ️  Receipt already exists for payment ${payment.paymentId} (Finance)`);
                }
                
            } catch (receiptError) {
                console.error('❌ Error auto-generating receipt on status update (Finance):', receiptError);
                console.error('   Payment ID:', payment.paymentId);
                console.error('   Student:', payment.student?.firstName, payment.student?.lastName);
                // Don't fail the status update if receipt generation fails
            }
        }

        // Return updated payment
        res.json({
            message: `Payment ${status.toLowerCase()} successfully`,
            payment: {
                id: payment.paymentId,
                status: payment.status
            }
        });
    } catch (error) {
        console.error('Error in updatePaymentStatus:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Request clarification for a payment
 */
exports.requestClarification = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { message } = req.body;
        const payment = await Payment.findOne({ paymentId: req.params.paymentId })
            .populate('student', 'firstName lastName email');

        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        // Set payment status to 'Clarification Requested'
        payment.status = 'Clarification Requested';
        payment.updatedBy = req.user._id;
        
        // Add clarification request
        if (!payment.clarificationRequests) {
            payment.clarificationRequests = [];
        }
        
        payment.clarificationRequests.push({
            message: message,
            requestedBy: req.user._id,
            requestDate: new Date()
        });
        
        await payment.save();

        // In a real app, this would also send an email notification to the student

        res.json({
            message: 'Clarification requested successfully',
            payment: {
                id: payment.paymentId,
                status: payment.status
            }
        });
    } catch (error) {
        console.error('Error in requestClarification:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Get payments for a specific student (for finance)
 */
exports.getPaymentsByStudent = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { page = 1, limit = 10, status, startDate, endDate } = req.query;
        
        // Validate student ID
        if (!studentId) {
            return res.status(400).json({ error: 'Student ID is required' });
        }

        console.log('Looking up student with ID:', studentId);

        // Use the robust student lookup
        const studentResult = await findStudentById(studentId);
        if (!studentResult) {
            console.log('Student not found for ID:', studentId);
            return res.status(404).json({ error: 'Student not found' });
        }

        const { student, source } = studentResult;
        console.log('Found student:', student.firstName, student.lastName, 'from source:', source);

        // Build query - try multiple ways to find payments for this student
        let query = { student: student._id };
        
        // If no payments found with student._id, try with the original studentId
        const paymentsWithStudentId = await Payment.countDocuments({ student: student._id });
        if (paymentsWithStudentId === 0) {
            query = { student: studentId };
        }
        
        if (status) {
            query.status = status;
        }
        
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        // Get payments with pagination
        const skip = (page - 1) * limit;
        const total = await Payment.countDocuments(query);
        
        const payments = await Payment.find(query)
            .populate('residence', 'name location')
            .populate('createdBy', 'firstName lastName')
            .populate('updatedBy', 'firstName lastName')
            .populate('proofOfPayment.verifiedBy', 'firstName lastName')
            .sort({ date: -1 })
            .skip(skip)
            .limit(parseInt(limit));
            
        // Transform payments data and handle expired students
        const formattedPayments = await Promise.all(payments.map(async (payment) => {
            // Get student information (including expired students)
            let studentInfo = null;
            if (payment.student || payment.user) {
                const studentId = payment.student || payment.user;
                const studentResult = await findStudentById(studentId);
                if (studentResult) {
                    studentInfo = studentResult.student;
                }
            }
            let paymentType = 'Other';
            
            // Improved payment type detection
            if (payment.rentAmount > 0 && payment.adminFee === 0 && payment.deposit === 0) {
                paymentType = 'Rent';
            } else if (payment.deposit > 0 && payment.rentAmount === 0 && payment.adminFee === 0) {
                paymentType = 'Deposit';
            } else if (payment.adminFee > 0 && payment.rentAmount === 0 && payment.deposit === 0) {
                paymentType = 'Admin Fee';
            } else if (payment.rentAmount > 0 && payment.adminFee > 0 && payment.deposit === 0) {
                paymentType = 'Rent + Admin Fee';
            } else if (payment.rentAmount > 0 && payment.deposit > 0 && payment.adminFee === 0) {
                paymentType = 'Rent + Deposit';
            } else if (payment.rentAmount > 0 && payment.adminFee > 0 && payment.deposit > 0) {
                paymentType = 'Rent + Admin Fee + Deposit';
            } else if (payment.adminFee > 0 && payment.deposit > 0 && payment.rentAmount === 0) {
                paymentType = 'Admin Fee + Deposit';
            }
            
            const admin = payment.createdBy ? 
                `${payment.createdBy.firstName} ${payment.createdBy.lastName}` : 
                'System';
                
            return {
                id: payment.paymentId,
                student: studentInfo ? `${studentInfo.firstName} ${studentInfo.lastName}` : 'Unknown',
                admin: admin,
                residence: payment.residence ? payment.residence.name : 'Unknown',
                room: payment.room || 'Not Assigned',
                roomType: payment.roomType || '',
                paymentMonth: payment.paymentMonth || '',
                rentAmount: payment.rentAmount || 0,
                adminFee: payment.adminFee || 0,
                deposit: payment.deposit || 0,
                amount: payment.totalAmount,
                datePaid: safeDateFormat(payment.date),
                paymentType: paymentType,
                status: payment.status,
                proof: payment.proofOfPayment?.fileUrl || null,
                method: payment.method || '',
                description: payment.description || '',
                studentId: studentInfo ? studentInfo._id : null,
                residenceId: payment.residence ? payment.residence._id : null,
                applicationStatus: payment.applicationStatus || null,
                clarificationRequests: payment.clarificationRequests || [],
                studentInfo: studentInfo // Include full student info for expired students
            };
        }));

        // Calculate summary statistics
        const totalPaid = payments
            .filter(p => ['Confirmed', 'Verified'].includes(p.status))
            .reduce((sum, p) => sum + p.totalAmount, 0);
        
        const totalPending = payments
            .filter(p => p.status === 'Pending')
            .reduce((sum, p) => sum + p.totalAmount, 0);

        const totalRejected = payments
            .filter(p => p.status === 'Rejected')
            .reduce((sum, p) => sum + p.totalAmount, 0);
        
        res.json({
            student: {
                id: student._id,
                name: `${student.firstName} ${student.lastName}`,
                email: student.email
            },
            payments: formattedPayments,
            summary: {
                totalPayments: total,
                totalPaid,
                totalPending,
                totalRejected,
                totalAmount: totalPaid + totalPending + totalRejected
            },
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                total,
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error in getPaymentsByStudent:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Helper function to find student by ID across multiple collections
const findStudentById = async (studentId) => {
    try {
        // First, try to find in User collection
        let student = await User.findById(studentId).select('firstName lastName email role');
        if (student) {
            return { student, source: 'User' };
        }

        // If not found in User, try ExpiredStudent collection
        const ExpiredStudent = require('../../models/ExpiredStudent');
        const expiredStudent = await ExpiredStudent.findOne({
            $or: [
                { 'student._id': studentId },
                { 'student': studentId },
                { 'student': new (require('mongoose').Types.ObjectId)(studentId) }
            ]
        });

        if (expiredStudent) {
            // Handle different formats of student data in ExpiredStudent
            let studentData;
            
            // First, try to get student data from application.student (most complete)
            if (expiredStudent.application && expiredStudent.application.student) {
                const appStudent = expiredStudent.application.student;
                studentData = {
                    _id: studentId,
                    firstName: appStudent.firstName,
                    lastName: appStudent.lastName,
                    email: appStudent.email,
                    phone: appStudent.phone,
                    role: appStudent.role,
                    isExpired: true,
                    expiredAt: expiredStudent.archivedAt,
                    expirationReason: expiredStudent.reason
                };
            }
            // If no application.student, check if student field is a full object
            else if (expiredStudent.student && typeof expiredStudent.student === 'object' && expiredStudent.student.constructor.name !== 'ObjectId') {
                studentData = {
                    _id: studentId,
                    firstName: expiredStudent.student.firstName,
                    lastName: expiredStudent.student.lastName,
                    email: expiredStudent.student.email,
                    phone: expiredStudent.student.phone,
                    role: expiredStudent.student.role,
                    isExpired: true,
                    expiredAt: expiredStudent.archivedAt,
                    expirationReason: expiredStudent.reason
                };
            }
            // If student is just an ObjectId, try to get name from transaction metadata
            else {
                const TransactionEntry = require('../../models/TransactionEntry');
                const transactionWithName = await TransactionEntry.findOne({
                    'metadata.studentId': studentId,
                    'metadata.studentName': { $exists: true, $ne: null }
                }).sort({ date: -1 });

                let firstName = 'Unknown';
                let lastName = 'Student';
                if (transactionWithName && transactionWithName.metadata.studentName) {
                    const nameParts = transactionWithName.metadata.studentName.split(' ');
                    firstName = nameParts[0] || 'Unknown';
                    lastName = nameParts.slice(1).join(' ') || 'Student';
                }

                studentData = {
                    _id: studentId,
                    firstName,
                    lastName,
                    email: 'expired@student.com',
                    role: 'student',
                    isExpired: true,
                    expiredAt: expiredStudent.archivedAt,
                    expirationReason: expiredStudent.reason
                };
            }

            return { student: studentData, source: 'ExpiredStudent' };
        }

        // If not found in ExpiredStudent, try Application collection
        const application = await Application.findById(studentId).select('firstName lastName email');
        if (application) {
            return { 
                student: { 
                    _id: application._id,
                    firstName: application.firstName,
                    lastName: application.lastName,
                    email: application.email
                }, 
                source: 'Application' 
            };
        }

        // If not found in Application, try to find by email in User collection
        if (studentId.includes('@')) {
            student = await User.findOne({ email: studentId }).select('firstName lastName email role');
            if (student) {
                return { student, source: 'User (by email)' };
            }
        }

        // If not found by email, try to find in Application collection by email
        if (studentId.includes('@')) {
            const appByEmail = await Application.findOne({ email: studentId }).select('firstName lastName email');
            if (appByEmail) {
                return { 
                    student: { 
                        _id: appByEmail._id,
                        firstName: appByEmail.firstName,
                        lastName: appByEmail.lastName,
                        email: appByEmail.email
                    }, 
                    source: 'Application (by email)' 
                };
            }
        }

        // If still not found, try to find by looking up payments for this student ID
        const payment = await Payment.findOne({ student: studentId }).populate('student', 'firstName lastName email role');
        if (payment && payment.student) {
            return { student: payment.student, source: 'Payment' };
        }

        // If not found in payments, try to find by looking up leases for this student ID
        const lease = await Lease.findOne({ studentId }).populate('studentId', 'firstName lastName email role');
        if (lease && lease.studentId) {
            return { student: lease.studentId, source: 'Lease' };
        }

        // If still not found, try to find by looking up payments where student field matches
        const paymentByStudentField = await Payment.findOne({ student: studentId });
        if (paymentByStudentField) {
            // Try to find the actual student record
            const actualStudent = await User.findById(studentId).select('firstName lastName email role');
            if (actualStudent) {
                return { student: actualStudent, source: 'Payment -> User' };
            }
            
            // If not found in User, try Application
            const actualApp = await Application.findById(studentId).select('firstName lastName email');
            if (actualApp) {
                return { 
                    student: { 
                        _id: actualApp._id,
                        firstName: actualApp.firstName,
                        lastName: actualApp.lastName,
                        email: actualApp.email
                    }, 
                    source: 'Application' 
                };
            }
            
            // If we have a payment but no student record, create a minimal student object
            return { 
                student: { 
                    _id: studentId,
                    firstName: 'Unknown',
                    lastName: 'Student',
                    email: 'unknown@student.com'
                }, 
                source: 'Payment (no student record)' 
            };
        }

        return null;
    } catch (error) {
        console.error('Error in findStudentById:', error);
        return null;
    }
}; 

// Helper function to safely format dates
const safeDateFormat = (date) => {
    if (!date) return null;
    
    try {
        // If it's already a Date object
        if (date instanceof Date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        
        // If it's a string, try to parse it
        if (typeof date === 'string') {
            const parsedDate = new Date(date);
            if (!isNaN(parsedDate.getTime())) {
                const year = parsedDate.getFullYear();
                const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
                const day = String(parsedDate.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
        }
        
        // If it's a number (timestamp), try to parse it
        if (typeof date === 'number') {
            const parsedDate = new Date(date);
            if (!isNaN(parsedDate.getTime())) {
                const year = parsedDate.getFullYear();
                const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
                const day = String(parsedDate.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
        }
        
        return null;
    } catch (error) {
        console.error('Error formatting date:', error);
        return null;
    }
};

// Export the findStudentById function for use in other modules
module.exports.findStudentById = findStudentById;

/**
 * Process payment using admin payment creation method
 * POST /api/finance/payments/process-payment
 */
exports.processPayment = async (req, res) => {
    try {
        console.log('💰 Finance payment processing - delegating to admin payment system');

        // Handle student data - support both object and ID formats
        const { student, studentData } = req.body;
        if (student) {
            const User = require('../../models/User');
            const Application = require('../../models/Application');
            
            let studentId = student;
            let studentInfo = studentData;
            
            // If student is an object, extract ID and use object as studentInfo
            if (typeof student === 'object' && student._id) {
                studentId = student._id;
                studentInfo = student;
            }
            
            // Check if student exists in User collection with role 'student'
            let studentExists = await User.findOne({ _id: studentId, role: 'student' });
            
            if (!studentExists) {
                console.log('🔍 Student not found in User collection, creating/updating User record...');
                
                // If we have student info from frontend, use it
                if (studentInfo) {
                    console.log('✅ Using student data from frontend request...');
                    
                    const newUser = new User({
                        _id: studentId,
                        firstName: studentInfo.firstName,
                        lastName: studentInfo.lastName,
                        email: studentInfo.email,
                        phone: studentInfo.phone,
                        role: 'student',
                        isActive: true,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                    
                    try {
                        await newUser.save();
                        console.log('✅ Created User record from frontend data');
                        studentExists = newUser;
                    } catch (userError) {
                        console.log('⚠️ Could not create User record, trying Application collection...');
                    }
                }
                
                // If still not found and no frontend data, try Application collection
                if (!studentExists) {
                    console.log('🔍 Checking Application collection...');
                    const application = await Application.findById(studentId);
                    if (application) {
                        console.log('✅ Found student in Application collection, creating User record...');
                        
                        const newUser = new User({
                            _id: application._id,
                            firstName: application.firstName,
                            lastName: application.lastName,
                            email: application.email,
                            phone: application.phone,
                            role: 'student',
                            isActive: true,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        });
                        
                        try {
                            await newUser.save();
                            console.log('✅ Created User record from Application');
                            studentExists = newUser;
                        } catch (userError) {
                            console.log('⚠️ Could not create User record, but continuing with payment...');
                        }
                    } else {
                        console.log('⚠️ Student not found in Application collection either');
                    }
                }
            }
            
            // Update req.body to ensure student is just the ID for admin payment system
            req.body.student = studentId;
        }

        // Ensure student has proper debtor setup before delegating to admin system
        const { student: studentIdForDebtor, residence, room, date, totalAmount } = req.body;
        if (studentIdForDebtor) {
            const Debtor = require('../../models/Debtor');
            const User = require('../../models/User');
            
            // Check if student has a debtor record
            let debtor = await Debtor.findOne({ user: studentIdForDebtor });
            
            if (!debtor) {
                console.log('🏗️ No debtor record found - creating one like admin system does...');
                
                try {
                    // Get student info (could be from User or Application)
                    let studentInfo = await User.findById(studentIdForDebtor);
                    if (!studentInfo) {
                        const Application = require('../../models/Application');
                        studentInfo = await Application.findById(studentIdForDebtor);
                    }
                    
                    if (studentInfo) {
                        // Create debtor using the same service as admin system
                        const { createDebtorForStudent } = require('../../services/debtorService');
                        
                        // Ensure we have the right user object format
                        const userForDebtor = {
                            _id: studentInfo._id,
                            firstName: studentInfo.firstName,
                            lastName: studentInfo.lastName,
                            email: studentInfo.email,
                            phone: studentInfo.phone || '',
                            role: 'student'
                        };
                        
                        console.log('📝 Creating debtor with user object:', userForDebtor);
                        
                        debtor = await createDebtorForStudent(userForDebtor, {
                            residenceId: residence,
                            roomNumber: room,
                            createdBy: req.user._id,
                            startDate: date || new Date(),
                            roomPrice: totalAmount, // Use payment amount as room price reference
                            application: studentInfo._id // Pass application ID if it's an Application object
                        });
                        
                        console.log('✅ Created debtor account for student');
                        console.log(`   Debtor ID: ${debtor._id}`);
                        console.log(`   Debtor Code: ${debtor.debtorCode}`);
                        console.log(`   Account Code: ${debtor.accountCode}`);
                    } else {
                        console.log('⚠️ Could not find student info for debtor creation');
                    }
                } catch (debtorError) {
                    console.log('⚠️ Could not create debtor record, but continuing with payment...');
                    console.log('   Error:', debtorError.message);
                }
            } else {
                console.log('✅ Found existing debtor record');
                console.log(`   Debtor Code: ${debtor.debtorCode}`);
                console.log(`   Account Code: ${debtor.accountCode}`);
            }
        }

        // Create payment directly in finance endpoint to ensure proper allocation
        console.log('🏗️ Creating payment directly in finance endpoint...');
        
        const Payment = require('../../models/Payment');
        const { paymentId, student: studentIdForPayment, residence: residenceForPayment, room: roomForPayment, roomType, payments, totalAmount: totalAmountForPayment, paymentMonth, date: dateForPayment, method, status, description, rentAmount, adminFee, deposit } = req.body;
        
        // Create payment record
        const payment = new Payment({
            paymentId,
            user: studentIdForPayment,
            student: studentIdForPayment,
            residence: residenceForPayment,
            room: roomForPayment,
            roomType,
            payments: payments || [],
            totalAmount: totalAmountForPayment,
            paymentMonth,
            date: dateForPayment,
            method,
            status: status || 'Confirmed',
            description,
            rentAmount: rentAmount || 0,
            adminFee: adminFee || 0,
            deposit: deposit || 0,
            createdBy: req.user._id
        });
        
        await payment.save();
        console.log(`✅ Payment created: ${payment.paymentId}`);

        // Log payment creation in audit logs
        try {
            const { logPaymentOperation } = require('../../utils/auditLogger');
            await logPaymentOperation('payment_create', payment, req.user._id, {
                paymentId: payment.paymentId,
                amount: payment.totalAmount,
                method: payment.method,
                student: studentIdForPayment,
                residence: residenceForPayment,
                room: roomForPayment,
                paymentMonth: payment.paymentMonth,
                breakdown: {
                    rent: payment.rentAmount,
                    admin: payment.adminFee,
                    deposit: payment.deposit
                },
                source: 'Finance Controller'
            });
            console.log(`📝 Payment audit logged: ${payment.paymentId} - $${payment.totalAmount} by ${req.user.email}`);
        } catch (auditError) {
            console.error('❌ Failed to log payment audit:', auditError.message);
        }
        
        // Always trigger Smart FIFO allocation
        try {
            console.log('🎯 Starting Smart FIFO allocation...');
            
            const EnhancedPaymentAllocationService = require('../../services/enhancedPaymentAllocationService');
            
            const allocationData = {
                paymentId: payment._id.toString(),
                studentId: payment.student,
                totalAmount: payment.totalAmount,
                payments: payment.payments || [],
                residence: payment.residence,
                paymentMonth: payment.paymentMonth,
                rentAmount: payment.rentAmount || 0,
                adminFee: payment.adminFee || 0,
                deposit: payment.deposit || 0,
                method: payment.method,
                date: payment.date
            };
            
            console.log('📝 Allocation data:', allocationData);
            
            const allocationResult = await EnhancedPaymentAllocationService.smartFIFOAllocation(allocationData);
            
                        if (allocationResult.success) {
                            console.log('✅ Smart FIFO allocation completed successfully');
                            console.log('📊 Allocation summary:', allocationResult.allocation.summary);
                            
                            // Update payment with allocation results
                            payment.allocation = allocationResult.allocation;
                            await payment.save();
                            
                            console.log('✅ Payment updated with allocation breakdown');
                            
                            // Update the response with the new allocation data
                            if (res.locals && res.locals.payment) {
                                res.locals.payment.allocation = allocationResult.allocation;
                            }
                        } else {
                            console.error('❌ Smart FIFO allocation failed:', allocationResult.error);
                        }
        } catch (allocationError) {
            console.error('❌ Error in Smart FIFO allocation:', allocationError.message);
            console.error('   Stack:', allocationError.stack);
        }
        
        // Refresh payment from database to get latest allocation data
        const updatedPayment = await Payment.findById(payment._id);
        
        // Send payment confirmation email (non-blocking with fallback)
        setTimeout(async () => {
            try {
                console.log('📧 Sending payment confirmation email...');
                
                const EmailNotificationService = require('../../services/emailNotificationService');
                
                // Get student details for email
                const User = require('../../models/User');
                const student = await User.findById(updatedPayment.student);
                
                if (student && student.email) {
                    try {
                        // Use same method as invoice emails (reliable queue system)
                        await EmailNotificationService.sendPaymentConfirmation({
                            studentEmail: student.email,
                            studentName: `${student.firstName} ${student.lastName}`,
                            amount: updatedPayment.totalAmount,
                            paymentId: updatedPayment.paymentId,
                            method: updatedPayment.method,
                            date: updatedPayment.date,
                            allocation: updatedPayment.allocation
                        });
                        console.log(`✅ Payment confirmation email sent successfully to ${student.email}`);
                    } catch (emailError) {
                        console.error(`❌ Error sending payment confirmation email to ${student.email}:`, emailError.message);
                    }
                } else {
                    console.log('⚠️ Student email not found, skipping payment confirmation email');
                }
                
                // Send notification to finance team
                try {
                    console.log('📧 Sending payment notification to finance team...');
                    
                    const User = require('../../models/User');
                    const financeUsers = await User.find({ role: 'finance' });
                    
                    if (financeUsers && financeUsers.length > 0) {
                        const sendEmail = require('../../utils/email');
                        
                        for (const financeUser of financeUsers) {
                            if (financeUser.email && financeUser.email.includes('@')) {
                                try {
                                    // Generate allocation breakdown HTML for finance team
                                    let allocationHtml = '';
                                    if (updatedPayment.allocation && updatedPayment.allocation.monthlyBreakdown && updatedPayment.allocation.monthlyBreakdown.length > 0) {
                                        allocationHtml = `
                                            <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 15px 0;">
                                                <h3 style="color: #007bff; margin-top: 0;">Payment Allocation Details</h3>
                                                <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                                                    <div>
                                                        <p><strong>Total Allocated:</strong> $${updatedPayment.allocation.summary?.totalAllocated?.toFixed(2) || '0.00'}</p>
                                                        <p><strong>Remaining Balance:</strong> $${updatedPayment.allocation.summary?.remainingBalance?.toFixed(2) || '0.00'}</p>
                                                    </div>
                                                    <div>
                                                        <p><strong>Months Covered:</strong> ${updatedPayment.allocation.summary?.monthsCovered || 0}</p>
                                                        <p><strong>Method:</strong> ${updatedPayment.allocation.summary?.allocationMethod || 'N/A'}</p>
                                                    </div>
                                                </div>
                                                ${updatedPayment.allocation.summary?.advancePaymentAmount > 0 ? `<p><strong>Advance Payment:</strong> $${updatedPayment.allocation.summary.advancePaymentAmount.toFixed(2)}</p>` : ''}
                                                
                                                <h4 style="color: #007bff; margin-bottom: 10px;">Monthly Allocation Breakdown:</h4>
                                                <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                                                    <thead>
                                                        <tr style="background-color: #f8f9fa;">
                                                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Month</th>
                                                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Type</th>
                                                            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Amount</th>
                                                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Status</th>
                                                            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Outstanding</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        ${updatedPayment.allocation.monthlyBreakdown.map(item => `
                                                            <tr>
                                                                <td style="border: 1px solid #ddd; padding: 8px;">${item.monthName || item.month}</td>
                                                                <td style="border: 1px solid #ddd; padding: 8px;">${item.paymentType || 'N/A'}</td>
                                                                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${item.amountAllocated?.toFixed(2) || '0.00'}</td>
                                                                <td style="border: 1px solid #ddd; padding: 8px;">
                                                                    <span style="color: ${item.allocationType === 'rent_settlement' ? '#28a745' : '#007bff'}; font-weight: bold;">
                                                                        ${item.allocationType === 'rent_settlement' ? 'Settled' : 'Advance'}
                                                                    </span>
                                                                </td>
                                                                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${item.newOutstanding?.toFixed(2) || '0.00'}</td>
                                                            </tr>
                                                        `).join('')}
                                                    </tbody>
                                                </table>
                                            </div>
                                        `;
                                    }

                                    const emailContent = `
                                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
                                                <h2 style="color: #007bff;">New Payment Processed</h2>
                                                <p>Dear Finance Team,</p>
                                                <p>A new payment has been processed through the finance endpoint:</p>
                                                <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
                                                    <ul style="list-style: none; padding: 0;">
                                                        <li><strong>Payment ID:</strong> ${updatedPayment.paymentId}</li>
                                                        <li><strong>Student:</strong> ${student ? `${student.firstName} ${student.lastName}` : 'Unknown'}</li>
                                                        <li><strong>Amount:</strong> $${updatedPayment.totalAmount.toFixed(2)}</li>
                                                        <li><strong>Payment Method:</strong> ${updatedPayment.method}</li>
                                                        <li><strong>Date:</strong> ${new Date(updatedPayment.date).toLocaleDateString()}</li>
                                                        <li><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">Confirmed</span></li>
                                                        <li><strong>Allocation:</strong> $${updatedPayment.allocation?.summary?.totalAllocated || 0} allocated</li>
                                                    </ul>
                                                </div>
                                                ${allocationHtml}
                                                <p>Please review the payment details in the finance dashboard.</p>
                                                <hr style="margin: 20px 0;">
                                                <p style="font-size: 12px; color: #666;">
                                                    This is an automated message from Alamait Student Accommodation Finance System.
                                                </p>
                                            </div>
                                        </div>
                                    `;
                                    
                                    await sendEmail({
                                        to: financeUser.email,
                                        subject: `New Payment Processed - ${updatedPayment.paymentId}`,
                                        html: emailContent
                                    });
                                    
                                    console.log(`✅ Finance notification sent to: ${financeUser.email}`);
                                } catch (emailError) {
                                    console.error(`❌ Failed to send finance notification to ${financeUser.email}:`, emailError.message);
                                }
                            }
                        }
                    }
                } catch (financeEmailError) {
                    console.error('❌ Error sending finance team notification:', financeEmailError.message);
                }
                
                console.log('✅ Payment confirmation email sent successfully');
            } catch (emailError) {
                console.error('❌ Error sending payment confirmation email:', emailError.message);
                // Don't fail the payment if email fails
            }
        }, 1000); // Send email 1 second after response
        
        // Return success response
        return res.status(201).json({
            success: true,
            message: "Payment created successfully with double-entry accounting",
            payment: updatedPayment,
            accounting: {
                transactionCreated: true,
                message: "Double-entry accounting transaction created"
            }
        });

    } catch (error) {
        console.error('❌ Error processing payment:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to process payment',
            error: error.message
        });
    }
};