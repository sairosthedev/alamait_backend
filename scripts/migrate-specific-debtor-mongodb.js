// MongoDB Script to Migrate Specific Debtor with Enhanced Fields
// Run this in MongoDB shell or MongoDB Compass

// First, let's update the existing debtor with enhanced fields
db.debtors.updateOne(
  { "_id": ObjectId("689399b8beb18032feaddfc6") },
  {
    $set: {
      // Update accountCode to AR series
      "accountCode": "AR0007",
      
      // Add enhanced fields
      "paymentHistory": [
        {
          "_id": ObjectId(),
          "amount": 180,
          "paymentMethod": "bank_transfer",
          "paymentDate": new Date("2025-06-01"),
          "allocatedMonth": "2025-06",
          "components": {
            "rent": 180,
            "adminFee": 0,
            "deposit": 0,
            "utilities": 0,
            "other": 0
          },
          "status": "completed",
          "notes": "June rent payment",
          "createdAt": new Date("2025-06-01T10:00:00.000Z")
        },
        {
          "_id": ObjectId(),
          "amount": 200,
          "paymentMethod": "mobile_money",
          "paymentDate": new Date("2025-07-01"),
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
          "createdAt": new Date("2025-07-01T10:00:00.000Z")
        },
        {
          "_id": ObjectId(),
          "amount": 400,
          "paymentMethod": "cash",
          "paymentDate": new Date("2025-08-06"),
          "allocatedMonth": "2025-08",
          "components": {
            "rent": 180,
            "adminFee": 0,
            "deposit": 0,
            "utilities": 0,
            "other": 220
          },
          "status": "completed",
          "notes": "August rent + other charges",
          "createdAt": new Date("2025-08-06T21:15:29.470Z")
        }
      ],

      "monthlyPayments": [
        {
          "month": "2025-06",
          "expectedAmount": 180,
          "paidAmount": 180,
          "outstandingAmount": 0,
          "status": "paid",
          "dueDate": new Date("2025-06-01"),
          "lastPaymentDate": new Date("2025-06-01T10:00:00.000Z")
        },
        {
          "month": "2025-07",
          "expectedAmount": 180,
          "paidAmount": 200,
          "outstandingAmount": -20,
          "status": "paid",
          "dueDate": new Date("2025-07-01"),
          "lastPaymentDate": new Date("2025-07-01T10:00:00.000Z")
        },
        {
          "month": "2025-08",
          "expectedAmount": 180,
          "paidAmount": 400,
          "outstandingAmount": -220,
          "status": "paid",
          "dueDate": new Date("2025-08-01"),
          "lastPaymentDate": new Date("2025-08-06T21:15:29.470Z")
        }
      ],

      "transactionEntries": [
        {
          "_id": ObjectId(),
          "transactionId": "TXN-20250601-001",
          "date": new Date("2025-06-01"),
          "description": "June rent payment received",
          "debitAccount": "AR0007",
          "creditAccount": "100001",
          "amount": 180,
          "reference": "Payment for June 2025",
          "type": "payment_received",
          "createdAt": new Date("2025-06-01T10:00:00.000Z")
        },
        {
          "_id": ObjectId(),
          "transactionId": "TXN-20250701-001",
          "date": new Date("2025-07-01"),
          "description": "July rent and utilities payment received",
          "debitAccount": "AR0007",
          "creditAccount": "100001",
          "amount": 200,
          "reference": "Payment for July 2025",
          "type": "payment_received",
          "createdAt": new Date("2025-07-01T10:00:00.000Z")
        },
        {
          "_id": ObjectId(),
          "transactionId": "TXN-20250806-001",
          "date": new Date("2025-08-06"),
          "description": "August rent and other charges payment received",
          "debitAccount": "AR0007",
          "creditAccount": "100001",
          "amount": 400,
          "reference": "Payment for August 2025",
          "type": "payment_received",
          "createdAt": new Date("2025-08-06T21:15:29.470Z")
        }
      ],

      "invoices": [
        {
          "_id": ObjectId(),
          "invoiceNumber": "INV-2025-001",
          "date": new Date("2025-06-01"),
          "dueDate": new Date("2025-06-01"),
          "amount": 180,
          "description": "June 2025 Rent",
          "status": "paid",
          "items": [
            {
              "description": "Room M5 Rent",
              "amount": 180,
              "quantity": 1
            }
          ],
          "createdAt": new Date("2025-06-01T00:00:00.000Z")
        },
        {
          "_id": ObjectId(),
          "invoiceNumber": "INV-2025-002",
          "date": new Date("2025-07-01"),
          "dueDate": new Date("2025-07-01"),
          "amount": 200,
          "description": "July 2025 Rent + Utilities",
          "status": "paid",
          "items": [
            {
              "description": "Room M5 Rent",
              "amount": 180,
              "quantity": 1
            },
            {
              "description": "Utilities",
              "amount": 20,
              "quantity": 1
            }
          ],
          "createdAt": new Date("2025-07-01T00:00:00.000Z")
        },
        {
          "_id": ObjectId(),
          "invoiceNumber": "INV-2025-003",
          "date": new Date("2025-08-01"),
          "dueDate": new Date("2025-08-01"),
          "amount": 400,
          "description": "August 2025 Rent + Other Charges",
          "status": "paid",
          "items": [
            {
              "description": "Room M5 Rent",
              "amount": 180,
              "quantity": 1
            },
            {
              "description": "Other Charges",
              "amount": 220,
              "quantity": 1
            }
          ],
          "createdAt": new Date("2025-08-01T00:00:00.000Z")
        }
      ],

      "financialSummary": {
        "currentPeriod": {
          "totalPaid": 780,
          "totalOwed": 540,
          "outstandingBalance": -240,
          "overdueAmount": 0,
          "daysOverdue": 0
        },
        "yearToDate": {
          "totalPaid": 780,
          "totalOwed": 540,
          "outstandingBalance": -240
        },
        "historical": {
          "totalPaid": 780,
          "totalOwed": 1460,
          "lastPaymentAmount": 400,
          "lastPaymentDate": new Date("2025-08-06T21:15:29.470Z")
        }
      }
    }
  }
);

// Verify the update
print("✅ Debtor migration completed!");
print("📊 Updated debtor details:");

var debtor = db.debtors.findOne({ "_id": ObjectId("689399b8beb18032feaddfc6") });
print("   - Debtor Code: " + debtor.debtorCode);
print("   - Name: " + debtor.contactInfo.name);
print("   - Account Code: " + debtor.accountCode);
print("   - Current Balance: $" + debtor.currentBalance);
print("   - Total Paid: $" + debtor.totalPaid);
print("   - Payment History Entries: " + debtor.paymentHistory.length);
print("   - Monthly Payments: " + debtor.monthlyPayments.length);
print("   - Transaction Entries: " + debtor.transactionEntries.length);
print("   - Invoices: " + debtor.invoices.length);

print("\n💰 Payment History:");
debtor.paymentHistory.forEach(function(payment, index) {
  print("   " + (index + 1) + ". $" + payment.amount + " - " + payment.allocatedMonth + " (" + payment.paymentMethod + ")");
});

print("\n📅 Monthly Payment Summary:");
debtor.monthlyPayments.forEach(function(month) {
  print("   " + month.month + ": $" + month.paidAmount + "/$" + month.expectedAmount + " - " + month.status);
});

print("\n🎉 Migration completed successfully!");
