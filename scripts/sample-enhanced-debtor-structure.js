// Sample Enhanced Debtor Document Structure
// This shows what a newly created debtor would look like with all enhanced fields

const sampleNewDebtor = {
  "_id": "689399b8beb18032feaddfc6",
  "debtorCode": "DR0007",
  "user": "689399b6beb18032feaddfbf",
  "accountCode": "AR0007", // Updated to AR series instead of 110 series
  "status": "active",
  "currentBalance": 680,
  "totalOwed": 1460,
  "totalPaid": 780,
  "creditLimit": 360,
  "paymentTerms": "monthly",
  "overdueAmount": 680,
  "daysOverdue": 0,
  "lastPaymentAmount": 380,
  "residence": "67d723cf20f89c4ae69804f3",
  "roomNumber": "M5",
  "roomPrice": 180,
  
  // ENHANCED FIELDS - NEW STRUCTURE
  "paymentHistory": [
    {
      "_id": "payment_id_1",
      "amount": 180,
      "paymentMethod": "bank_transfer",
      "paymentDate": "2025-06-01T00:00:00.000Z",
      "allocatedMonth": "2025-06", // YYYY-MM format
      "components": {
        "rent": 180,
        "adminFee": 0,
        "deposit": 0,
        "utilities": 0,
        "other": 0
      },
      "status": "completed",
      "notes": "June rent payment",
      "originalPayment": "payment_collection_id", // Reference to Payment collection
      "createdAt": "2025-06-01T10:00:00.000Z"
    },
    {
      "_id": "payment_id_2",
      "amount": 200,
      "paymentMethod": "mobile_money",
      "paymentDate": "2025-07-01T00:00:00.000Z",
      "allocatedMonth": "2025-07",
      "components": {
        "rent": 180,
        "adminFee": 0,
        "deposit": 0,
        "utilities": 20,
        "other": 0
      },
      "status": "completed",
      "notes": "July rent + utilities",
      "originalPayment": "payment_collection_id_2",
      "createdAt": "2025-07-01T10:00:00.000Z"
    }
  ],

  "monthlyPayments": [
    {
      "month": "2025-06",
      "expectedAmount": 180,
      "paidAmount": 180,
      "outstandingAmount": 0,
      "status": "paid", // paid, partial, unpaid, overdue
      "dueDate": "2025-06-01T00:00:00.000Z",
      "lastPaymentDate": "2025-06-01T10:00:00.000Z"
    },
    {
      "month": "2025-07",
      "expectedAmount": 180,
      "paidAmount": 200,
      "outstandingAmount": -20, // Negative means overpayment
      "status": "paid",
      "dueDate": "2025-07-01T00:00:00.000Z",
      "lastPaymentDate": "2025-07-01T10:00:00.000Z"
    },
    {
      "month": "2025-08",
      "expectedAmount": 180,
      "paidAmount": 0,
      "outstandingAmount": 180,
      "status": "unpaid",
      "dueDate": "2025-08-01T00:00:00.000Z",
      "lastPaymentDate": null
    }
  ],

  "transactionEntries": [
    {
      "_id": "transaction_entry_id_1",
      "transactionId": "TXN-1234567890",
      "date": "2025-06-01T00:00:00.000Z",
      "description": "June rent payment received",
      "debitAccount": "AR0007", // Debtor's AR account
      "creditAccount": "100001", // Cash/Bank account
      "amount": 180,
      "reference": "Payment for June 2025",
      "type": "payment_received",
      "originalTransactionEntry": "transaction_entry_collection_id", // Reference to TransactionEntry collection
      "createdAt": "2025-06-01T10:00:00.000Z"
    },
    {
      "_id": "transaction_entry_id_2",
      "transactionId": "TXN-1234567891",
      "date": "2025-07-01T00:00:00.000Z",
      "description": "July rent and utilities payment received",
      "debitAccount": "AR0007",
      "creditAccount": "100001",
      "amount": 200,
      "reference": "Payment for July 2025",
      "type": "payment_received",
      "originalTransactionEntry": "transaction_entry_collection_id_2",
      "createdAt": "2025-07-01T10:00:00.000Z"
    }
  ],

  "invoices": [
    {
      "_id": "invoice_id_1",
      "invoiceNumber": "INV-2025-001",
      "date": "2025-06-01T00:00:00.000Z",
      "dueDate": "2025-06-01T00:00:00.000Z",
      "amount": 180,
      "description": "June 2025 Rent",
      "status": "paid", // paid, unpaid, overdue, cancelled
      "items": [
        {
          "description": "Room M5 Rent",
          "amount": 180,
          "quantity": 1
        }
      ],
      "createdAt": "2025-06-01T00:00:00.000Z"
    }
  ],

  "financialSummary": {
    "currentPeriod": {
      "totalPaid": 380,
      "totalOwed": 540,
      "outstandingBalance": 160,
      "overdueAmount": 160,
      "daysOverdue": 15
    },
    "yearToDate": {
      "totalPaid": 380,
      "totalOwed": 540,
      "outstandingBalance": 160
    },
    "historical": {
      "totalPaid": 780,
      "totalOwed": 1460,
      "lastPaymentAmount": 200,
      "lastPaymentDate": "2025-07-01T10:00:00.000Z"
    }
  },

  // ORIGINAL FIELDS (preserved)
  "contactInfo": {
    "name": "Kudzai Cindyrella Pemhiwa",
    "email": "kudzaicindyrellapemhiwa@gmail.com",
    "phone": "0786209200"
  },
  "createdBy": "67c023adae5e27657502e887",
  "createdAt": "2025-08-06T18:06:48.925Z",
  "updatedAt": "2025-08-06T21:15:29.472Z",
  "billingPeriod": {
    "type": "custom",
    "duration": {
      "value": 8,
      "unit": "months"
    },
    "startDate": "2025-05-30T00:00:00.000Z",
    "endDate": "2025-12-31T00:00:00.000Z",
    "billingCycle": {
      "frequency": "monthly",
      "dayOfMonth": 1,
      "gracePeriod": 5
    },
    "amount": {
      "monthly": 180,
      "total": 1440,
      "currency": "USD"
    },
    "status": "active",
    "description": "Billing period for DR0007",
    "notes": "Migrated from legacy format: \"8 months\"",
    "autoRenewal": {
      "enabled": false,
      "renewalType": "same_period",
      "customRenewalPeriod": null
    }
  },
  "endDate": "2025-12-31T00:00:00.000Z",
  "startDate": "2025-05-30T00:00:00.000Z",
  "lastPaymentDate": "2025-08-06T21:15:29.470Z",
  "billingPeriodLegacy": "8 months",
  "__v": 0
};

// Key Benefits of This Enhanced Structure:

// 1. PAYMENT HISTORY
// - All payments are stored with month allocation (YYYY-MM format)
// - Detailed breakdown of payment components (rent, utilities, etc.)
// - Payment method tracking
// - Reference to original Payment collection for audit trail

// 2. MONTHLY PAYMENTS SUMMARY
// - Quick overview of payment status per month
// - Easy to see which months are paid/unpaid/overdue
// - Calculated outstanding amounts per month

// 3. TRANSACTION ENTRIES
// - Double-entry accounting records embedded
// - Complete audit trail of financial transactions
// - Reference to original TransactionEntry collection

// 4. INVOICES
// - Invoice tracking within debtor document
// - Invoice status and payment tracking
// - Detailed invoice items

// 5. FINANCIAL SUMMARY
// - Current period, year-to-date, and historical summaries
// - Quick access to key financial metrics
// - Calculated automatically when payments are added

// 6. BACKWARD COMPATIBILITY
// - All original fields are preserved
// - Existing code continues to work
// - Gradual migration possible

module.exports = { sampleNewDebtor };
