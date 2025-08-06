# Payment Flow and Storage Guide

This guide explains exactly where payments received are stored and how they flow through the double-entry accounting system.

## 💰 **Where Payments Received Are Stored**

### **1. Primary Storage Locations**

#### **A. Payment Collection (Payment Model)**
- **Collection:** `Payment` collection in MongoDB
- **Purpose:** Stores the original payment record with all details
- **Fields Stored:**
  ```javascript
  {
    paymentId: "PAY-2024-001",
    student: "student_id",
    residence: "residence_id", 
    room: "Room 101",
    rentAmount: 500,
    adminFee: 50,
    deposit: 200,
    totalAmount: 750,
    paymentMonth: "2024-12",
    date: "2024-12-21",
    method: "Ecocash", // Where the money actually goes
    status: "Confirmed",
    proofOfPayment: {
      fileUrl: "s3://alamait-uploads/pop/payment-proof.pdf",
      fileName: "payment-proof.pdf"
    }
  }
  ```

#### **B. Transaction Entries (Double-Entry Accounting)**
- **Collection:** `TransactionEntry` collection
- **Purpose:** Creates balanced double-entry transactions
- **What Gets Stored:**
  ```javascript
  {
    transactionId: "TXN1703123456789ABC",
    date: "2024-12-21",
    description: "Rent payment from John Doe",
    reference: "PAY-2024-001",
    entries: [
      {
        accountCode: "1003", // Ecocash Wallet (DEBIT)
        accountName: "Ecocash Wallet", 
        accountType: "Asset",
        debit: 750,
        credit: 0,
        description: "Payment via Ecocash"
      },
      {
        accountCode: "4001", // Rent Income (CREDIT)
        accountName: "Rent Income",
        accountType: "Income", 
        debit: 0,
        credit: 750,
        description: "Rent income from John Doe"
      }
    ],
    totalDebit: 750,
    totalCredit: 750,
    source: "payment",
    sourceId: "payment_id",
    sourceModel: "Payment"
  }
  ```

## 🏦 **Payment Method Accounts (Where Money Actually Goes)**

### **Payment Method → Account Mapping:**

| Payment Method | Account Code | Account Name | Account Type |
|---------------|--------------|--------------|--------------|
| **Bank Transfer** | `1001` | Bank Account | Asset |
| **Cash** | `1002` | Cash on Hand | Asset |
| **Ecocash** | `1003` | Ecocash Wallet | Asset |
| **Innbucks** | `1004` | Innbucks Wallet | Asset |
| **Online Payment** | `1005` | Online Payment Account | Asset |
| **MasterCard/Visa** | `1006` | Credit Card Account | Asset |
| **PayPal** | `1007` | PayPal Account | Asset |
| **Petty Cash** | `1008` | Petty Cash | Asset |

## 📊 **Complete Payment Flow Example**

### **Scenario: Student pays $750 rent via Ecocash**

#### **Step 1: Payment Record Created**
```javascript
// Stored in Payment collection
{
  paymentId: "PAY-2024-001",
  student: "student_123",
  totalAmount: 750,
  method: "Ecocash",
  status: "Confirmed",
  date: "2024-12-21"
}
```

#### **Step 2: Double-Entry Transaction Created**
```javascript
// Stored in TransactionEntry collection
{
  transactionId: "TXN1703123456789ABC",
  entries: [
    // DEBIT: Money goes INTO Ecocash Wallet
    {
      accountCode: "1003",
      accountName: "Ecocash Wallet", 
      debit: 750,  // Money received
      credit: 0
    },
    // CREDIT: Rent Income increases
    {
      accountCode: "4001", 
      accountName: "Rent Income",
      debit: 0,
      credit: 750  // Income earned
    }
  ],
  totalDebit: 750,
  totalCredit: 750  // Must balance!
}
```

#### **Step 3: Financial Reports Show:**
- **Income Statement:** Rent Income = $750
- **Balance Sheet:** Ecocash Wallet = $750 (Asset)
- **Cash Flow:** Operating cash inflow = $750

## 🔄 **Different Payment Scenarios**

### **1. Bank Transfer Payment**
```javascript
// Money goes to Bank Account (1001)
{
  entries: [
    { accountCode: "1001", debit: 500, credit: 0 }, // Bank Account
    { accountCode: "4001", debit: 0, credit: 500 }  // Rent Income
  ]
}
```

### **2. Cash Payment**
```javascript
// Money goes to Cash on Hand (1002)
{
  entries: [
    { accountCode: "1002", debit: 300, credit: 0 }, // Cash on Hand
    { accountCode: "4001", debit: 0, credit: 300 }  // Rent Income
  ]
}
```

### **3. Credit Card Payment**
```javascript
// Money goes to Credit Card Account (1006)
{
  entries: [
    { accountCode: "1006", debit: 1000, credit: 0 }, // Credit Card Account
    { accountCode: "4001", debit: 0, credit: 1000 }  // Rent Income
  ]
}
```

## 📈 **How This Affects Financial Reports**

### **Income Statement (Profit & Loss)**
- **Rent Income** increases by payment amount
- Shows revenue earned in the period

### **Balance Sheet**
- **Current Assets** increase by payment amount
- Shows where the money is stored (Bank, Cash, Ecocash, etc.)

### **Cash Flow Statement**
- **Operating Activities** show cash received from customers
- Shows actual cash movement

## 🔍 **Querying Payment Data**

### **Get All Payments:**
```javascript
// From Payment collection
const payments = await Payment.find({ status: 'Confirmed' });
```

### **Get Payment Transactions:**
```javascript
// From TransactionEntry collection
const transactions = await TransactionEntry.find({ 
  source: 'payment',
  'entries.accountCode': '4001' // Rent Income
});
```

### **Get Account Balances:**
```javascript
// Calculate balance for any account
const ecocashBalance = await TransactionEntry.aggregate([
  { $unwind: '$entries' },
  { $match: { 'entries.accountCode': '1003' } },
  { $group: {
    _id: null,
    balance: { $sum: { $subtract: ['$entries.debit', '$entries.credit'] } }
  }}
]);
```

## 🎯 **Key Points**

1. **Payments are stored in TWO places:**
   - `Payment` collection (original record)
   - `TransactionEntry` collection (accounting entries)

2. **Money goes to different accounts based on payment method:**
   - Ecocash → Ecocash Wallet (1003)
   - Bank Transfer → Bank Account (1001)
   - Cash → Cash on Hand (1002)

3. **Double-entry ensures accuracy:**
   - Every payment creates balanced debits and credits
   - Total debits = Total credits

4. **Financial reports are generated from TransactionEntry data:**
   - Real-time calculations
   - Supports both cash and accrual basis

5. **Audit trail is maintained:**
   - All transactions include creation metadata
   - Payment proofs are stored in S3

This system ensures that every payment received is properly tracked, stored, and can be reported on for financial statements! 