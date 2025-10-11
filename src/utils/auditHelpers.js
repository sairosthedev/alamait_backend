/**
 * Audit Helper Functions
 * Common audit logging patterns and utilities
 */

const { 
    createAuditLog, 
    logSystemOperation, 
    logAuthOperation,
    logFileOperation,
    logBulkOperation,
    logAPIOperation,
    logApprovalOperation,
    logFinancialOperation,
    logDataOperation,
    logErrorOperation
} = require('./auditLogger');

/**
 * Helper to log CRUD operations with before/after states
 */
exports.logCRUDOperation = async (action, model, record, userId, req = null) => {
    try {
        const before = req?.auditBefore || null;
        const after = record ? record.toObject() : null;
        
        return await createAuditLog({
            action,
            collection: model.modelName,
            recordId: record?._id || null,
            userId,
            before,
            after,
            details: `${action} operation on ${model.modelName}`,
            ipAddress: req?.ip || null,
            userAgent: req?.headers?.['user-agent'] || null,
            sessionId: req?.sessionID || null,
            requestId: req?.requestId || null
        });
    } catch (error) {
        console.error('Error logging CRUD operation:', error);
        return null;
    }
};

/**
 * Helper to log approval workflow operations
 */
exports.logApprovalWorkflow = async (action, record, userId, details = '', req = null) => {
    try {
        return await logApprovalOperation(
            action, 
            record, 
            userId, 
            details, 
            req?.auditBefore || null,
            req?.ip || null,
            req?.headers?.['user-agent'] || null
        );
    } catch (error) {
        console.error('Error logging approval workflow:', error);
        return null;
    }
};

/**
 * Helper to log financial operations
 */
exports.logFinancialWorkflow = async (action, record, userId, details = '', req = null) => {
    try {
        return await logFinancialOperation(
            action, 
            record, 
            userId, 
            details, 
            req?.auditBefore || null,
            req?.ip || null,
            req?.headers?.['user-agent'] || null
        );
    } catch (error) {
        console.error('Error logging financial workflow:', error);
        return null;
    }
};

/**
 * Helper to log user authentication events
 */
exports.logAuthEvent = async (action, userId, details = '', req = null) => {
    try {
        return await logAuthOperation(
            action,
            userId,
            details,
            req?.ip || null,
            req?.headers?.['user-agent'] || null
        );
    } catch (error) {
        console.error('Error logging auth event:', error);
        return null;
    }
};

/**
 * Helper to log file operations
 */
exports.logFileEvent = async (action, fileInfo, userId, details = '', req = null) => {
    try {
        return await logFileOperation(
            action,
            fileInfo,
            userId,
            details,
            req?.ip || null,
            req?.headers?.['user-agent'] || null
        );
    } catch (error) {
        console.error('Error logging file event:', error);
        return null;
    }
};

/**
 * Helper to log bulk operations
 */
exports.logBulkEvent = async (action, collection, userId, details = '', req = null) => {
    try {
        return await logBulkOperation(
            action,
            collection,
            userId,
            details,
            req?.ip || null,
            req?.headers?.['user-agent'] || null
        );
    } catch (error) {
        console.error('Error logging bulk event:', error);
        return null;
    }
};

/**
 * Helper to log data export/import operations
 */
exports.logDataEvent = async (action, collection, userId, details = '', req = null) => {
    try {
        return await logDataOperation(
            action,
            collection,
            userId,
            details,
            req?.ip || null,
            req?.headers?.['user-agent'] || null
        );
    } catch (error) {
        console.error('Error logging data event:', error);
        return null;
    }
};

/**
 * Helper to log system operations
 */
exports.logSystemEvent = async (action, collection, recordId, details = '', before = null, after = null) => {
    try {
        return await logSystemOperation(
            action,
            collection,
            recordId,
            details,
            before,
            after
        );
    } catch (error) {
        console.error('Error logging system event:', error);
        return null;
    }
};

/**
 * Helper to log API operations
 */
exports.logAPIEvent = async (req, res, action, collection, recordId = null, details = '') => {
    try {
        return await logAPIOperation(
            req,
            res,
            action,
            collection,
            recordId,
            details
        );
    } catch (error) {
        console.error('Error logging API event:', error);
        return null;
    }
};

/**
 * Helper to log errors
 */
exports.logErrorEvent = async (error, req, details = '') => {
    try {
        return await logErrorOperation(error, req, details);
    } catch (auditError) {
        console.error('Error logging error event:', auditError);
        return null;
    }
};

/**
 * Helper to log salary request operations
 */
exports.logSalaryRequestOperation = async (action, request, userId, details = '', req = null) => {
    try {
        return await createAuditLog({
            action,
            collection: 'Request',
            recordId: request._id,
            userId,
            before: req?.auditBefore || null,
            after: request.toObject(),
            details: typeof details === 'string' ? details : JSON.stringify({
                type: 'salary_request',
                residence: request.residence,
                month: request.month,
                year: request.year,
                totalAmount: request.totalEstimatedCost,
                employeeCount: request.items?.length || 0,
                ...details
            }),
            ipAddress: req?.ip || null,
            userAgent: req?.headers?.['user-agent'] || null,
            sessionId: req?.sessionID || null,
            requestId: req?.requestId || null
        });
    } catch (error) {
        console.error('Error logging salary request operation:', error);
        return null;
    }
};

/**
 * Helper to log monthly request operations
 */
exports.logMonthlyRequestOperation = async (action, request, userId, details = '', req = null) => {
    try {
        return await createAuditLog({
            action,
            collection: 'MonthlyRequest',
            recordId: request._id,
            userId,
            before: req?.auditBefore || null,
            after: request.toObject(),
            details: typeof details === 'string' ? details : JSON.stringify({
                type: 'monthly_request',
                residence: request.residence,
                month: request.month,
                year: request.year,
                totalAmount: request.totalEstimatedCost,
                itemCount: request.items?.length || 0,
                isTemplate: request.isTemplate,
                ...details
            }),
            ipAddress: req?.ip || null,
            userAgent: req?.headers?.['user-agent'] || null,
            sessionId: req?.sessionID || null,
            requestId: req?.requestId || null
        });
    } catch (error) {
        console.error('Error logging monthly request operation:', error);
        return null;
    }
};

/**
 * Helper to log expense operations
 */
exports.logExpenseOperation = async (action, expense, userId, details = '', req = null) => {
    try {
        return await createAuditLog({
            action,
            collection: 'Expense',
            recordId: expense._id,
            userId,
            before: req?.auditBefore || null,
            after: expense.toObject(),
            details: typeof details === 'string' ? details : JSON.stringify({
                type: 'expense',
                amount: expense.amount,
                category: expense.category,
                paymentMethod: expense.paymentMethod,
                status: expense.status,
                ...details
            }),
            ipAddress: req?.ip || null,
            userAgent: req?.headers?.['user-agent'] || null,
            sessionId: req?.sessionID || null,
            requestId: req?.requestId || null
        });
    } catch (error) {
        console.error('Error logging expense operation:', error);
        return null;
    }
};

/**
 * Helper to log payment operations
 */
exports.logPaymentOperation = async (action, payment, userId, details = '', req = null) => {
    try {
        return await createAuditLog({
            action,
            collection: 'Payment',
            recordId: payment._id,
            userId,
            before: req?.auditBefore || null,
            after: payment.toObject(),
            details: typeof details === 'string' ? details : JSON.stringify({
                type: 'payment',
                amount: payment.amount,
                paymentMethod: payment.paymentMethod,
                status: payment.status,
                ...details
            }),
            ipAddress: req?.ip || null,
            userAgent: req?.headers?.['user-agent'] || null,
            sessionId: req?.sessionID || null,
            requestId: req?.requestId || null
        });
    } catch (error) {
        console.error('Error logging payment operation:', error);
        return null;
    }
};

/**
 * Helper to log transaction operations
 */
exports.logTransactionOperation = async (action, transaction, userId, details = '', req = null) => {
    try {
        return await createAuditLog({
            action,
            collection: 'Transaction',
            recordId: transaction._id,
            userId,
            before: req?.auditBefore || null,
            after: transaction.toObject(),
            details: typeof details === 'string' ? details : JSON.stringify({
                type: 'transaction',
                amount: transaction.amount,
                description: transaction.description,
                source: transaction.source,
                ...details
            }),
            ipAddress: req?.ip || null,
            userAgent: req?.headers?.['user-agent'] || null,
            sessionId: req?.sessionID || null,
            requestId: req?.requestId || null
        });
    } catch (error) {
        console.error('Error logging transaction operation:', error);
        return null;
    }
};

/**
 * Helper to log account operations
 */
exports.logAccountOperation = async (action, account, userId, details = '', req = null) => {
    try {
        return await createAuditLog({
            action,
            collection: 'Account',
            recordId: account._id,
            userId,
            before: req?.auditBefore || null,
            after: account.toObject(),
            details: typeof details === 'string' ? details : JSON.stringify({
                type: 'account',
                code: account.code,
                name: account.name,
                accountType: account.type,
                category: account.category,
                ...details
            }),
            ipAddress: req?.ip || null,
            userAgent: req?.headers?.['user-agent'] || null,
            sessionId: req?.sessionID || null,
            requestId: req?.requestId || null
        });
    } catch (error) {
        console.error('Error logging account operation:', error);
        return null;
    }
};

/**
 * Helper to log student operations
 */
exports.logStudentOperation = async (action, student, userId, details = '', req = null) => {
    try {
        return await createAuditLog({
            action,
            collection: 'User',
            recordId: student._id,
            userId,
            before: req?.auditBefore || null,
            after: student.toObject(),
            details: typeof details === 'string' ? details : JSON.stringify({
                type: 'student',
                email: student.email,
                firstName: student.firstName,
                lastName: student.lastName,
                status: student.status,
                ...details
            }),
            ipAddress: req?.ip || null,
            userAgent: req?.headers?.['user-agent'] || null,
            sessionId: req?.sessionID || null,
            requestId: req?.requestId || null
        });
    } catch (error) {
        console.error('Error logging student operation:', error);
        return null;
    }
};

/**
 * Helper to log application operations
 */
exports.logApplicationOperation = async (action, application, userId, details = '', req = null) => {
    try {
        return await createAuditLog({
            action,
            collection: 'Application',
            recordId: application._id,
            userId,
            before: req?.auditBefore || null,
            after: application.toObject(),
            details: typeof details === 'string' ? details : JSON.stringify({
                type: 'application',
                applicationCode: application.applicationCode,
                status: application.status,
                residence: application.residence,
                room: application.room,
                ...details
            }),
            ipAddress: req?.ip || null,
            userAgent: req?.headers?.['user-agent'] || null,
            sessionId: req?.sessionID || null,
            requestId: req?.requestId || null
        });
    } catch (error) {
        console.error('Error logging application operation:', error);
        return null;
    }
};

/**
 * Helper to log lease operations
 */
exports.logLeaseOperation = async (action, lease, userId, details = '', req = null) => {
    try {
        return await createAuditLog({
            action,
            collection: 'Lease',
            recordId: lease._id,
            userId,
            before: req?.auditBefore || null,
            after: lease.toObject(),
            details: typeof details === 'string' ? details : JSON.stringify({
                type: 'lease',
                startDate: lease.startDate,
                endDate: lease.endDate,
                monthlyRent: lease.monthlyRent,
                status: lease.status,
                ...details
            }),
            ipAddress: req?.ip || null,
            userAgent: req?.headers?.['user-agent'] || null,
            sessionId: req?.sessionID || null,
            requestId: req?.requestId || null
        });
    } catch (error) {
        console.error('Error logging lease operation:', error);
        return null;
    }
};

/**
 * Helper to log vendor operations
 */
exports.logVendorOperation = async (action, vendor, userId, details = '', req = null) => {
    try {
        return await createAuditLog({
            action,
            collection: 'Vendor',
            recordId: vendor._id,
            userId,
            before: req?.auditBefore || null,
            after: vendor.toObject(),
            details: typeof details === 'string' ? details : JSON.stringify({
                type: 'vendor',
                name: vendor.name,
                email: vendor.email,
                phone: vendor.phone,
                status: vendor.status,
                ...details
            }),
            ipAddress: req?.ip || null,
            userAgent: req?.headers?.['user-agent'] || null,
            sessionId: req?.sessionID || null,
            requestId: req?.requestId || null
        });
    } catch (error) {
        console.error('Error logging vendor operation:', error);
        return null;
    }
};

/**
 * Helper to log debtor operations
 */
exports.logDebtorOperation = async (action, debtor, userId, details = '', req = null) => {
    try {
        return await createAuditLog({
            action,
            collection: 'Debtor',
            recordId: debtor._id,
            userId,
            before: req?.auditBefore || null,
            after: debtor.toObject(),
            details: typeof details === 'string' ? details : JSON.stringify({
                type: 'debtor',
                debtorCode: debtor.debtorCode,
                studentName: debtor.studentName,
                balance: debtor.balance,
                status: debtor.status,
                ...details
            }),
            ipAddress: req?.ip || null,
            userAgent: req?.headers?.['user-agent'] || null,
            sessionId: req?.sessionID || null,
            requestId: req?.requestId || null
        });
    } catch (error) {
        console.error('Error logging debtor operation:', error);
        return null;
    }
};

/**
 * Helper to log residence operations
 */
exports.logResidenceOperation = async (action, residence, userId, details = '', req = null) => {
    try {
        return await createAuditLog({
            action,
            collection: 'Residence',
            recordId: residence._id,
            userId,
            before: req?.auditBefore || null,
            after: residence.toObject(),
            details: typeof details === 'string' ? details : JSON.stringify({
                type: 'residence',
                name: residence.name,
                address: residence.address,
                status: residence.status,
                ...details
            }),
            ipAddress: req?.ip || null,
            userAgent: req?.headers?.['user-agent'] || null,
            sessionId: req?.sessionID || null,
            requestId: req?.requestId || null
        });
    } catch (error) {
        console.error('Error logging residence operation:', error);
        return null;
    }
};

/**
 * Helper to log room operations
 */
exports.logRoomOperation = async (action, room, userId, details = '', req = null) => {
    try {
        return await createAuditLog({
            action,
            collection: 'Room',
            recordId: room._id,
            userId,
            before: req?.auditBefore || null,
            after: room.toObject(),
            details: typeof details === 'string' ? details : JSON.stringify({
                type: 'room',
                roomNumber: room.roomNumber,
                residence: room.residence,
                status: room.status,
                ...details
            }),
            ipAddress: req?.ip || null,
            userAgent: req?.headers?.['user-agent'] || null,
            sessionId: req?.sessionID || null,
            requestId: req?.requestId || null
        });
    } catch (error) {
        console.error('Error logging room operation:', error);
        return null;
    }
};

/**
 * Helper to log quotation operations
 */
exports.logQuotationOperation = async (action, quotation, userId, details = '', req = null) => {
    try {
        return await createAuditLog({
            action,
            collection: 'Quotation',
            recordId: quotation._id,
            userId,
            before: req?.auditBefore || null,
            after: quotation.toObject(),
            details: typeof details === 'string' ? details : JSON.stringify({
                type: 'quotation',
                provider: quotation.provider,
                amount: quotation.amount,
                status: quotation.status,
                ...details
            }),
            ipAddress: req?.ip || null,
            userAgent: req?.headers?.['user-agent'] || null,
            sessionId: req?.sessionID || null,
            requestId: req?.requestId || null
        });
    } catch (error) {
        console.error('Error logging quotation operation:', error);
        return null;
    }
};

/**
 * Helper to log invoice operations
 */
exports.logInvoiceOperation = async (action, invoice, userId, details = '', req = null) => {
    try {
        return await createAuditLog({
            action,
            collection: 'Invoice',
            recordId: invoice._id,
            userId,
            before: req?.auditBefore || null,
            after: invoice.toObject(),
            details: typeof details === 'string' ? details : JSON.stringify({
                type: 'invoice',
                invoiceNumber: invoice.invoiceNumber,
                amount: invoice.amount,
                status: invoice.status,
                ...details
            }),
            ipAddress: req?.ip || null,
            userAgent: req?.headers?.['user-agent'] || null,
            sessionId: req?.sessionID || null,
            requestId: req?.requestId || null
        });
    } catch (error) {
        console.error('Error logging invoice operation:', error);
        return null;
    }
};

/**
 * Helper to log user operations
 */
exports.logUserOperation = async (action, user, userId, details = '', req = null) => {
    try {
        return await createAuditLog({
            action,
            collection: 'User',
            recordId: user._id,
            userId,
            before: req?.auditBefore || null,
            after: user.toObject(),
            details: typeof details === 'string' ? details : JSON.stringify({
                type: 'user',
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                status: user.status,
                ...details
            }),
            ipAddress: req?.ip || null,
            userAgent: req?.headers?.['user-agent'] || null,
            sessionId: req?.sessionID || null,
            requestId: req?.requestId || null
        });
    } catch (error) {
        console.error('Error logging user operation:', error);
        return null;
    }
};

/**
 * Helper to log any generic operation
 */
exports.logGenericOperation = async (action, collection, recordId, userId, details = '', req = null) => {
    try {
        return await createAuditLog({
            action,
            collection,
            recordId,
            userId,
            before: req?.auditBefore || null,
            after: null,
            details: typeof details === 'string' ? details : JSON.stringify(details),
            ipAddress: req?.ip || null,
            userAgent: req?.headers?.['user-agent'] || null,
            sessionId: req?.sessionID || null,
            requestId: req?.requestId || null
        });
    } catch (error) {
        console.error('Error logging generic operation:', error);
        return null;
    }
};
