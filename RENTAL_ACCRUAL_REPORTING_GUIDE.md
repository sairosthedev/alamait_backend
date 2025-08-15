# 📊 Rental Accrual Financial Reporting Guide

## 📋 **Overview**

This guide shows you exactly how rental accrual data appears in your financial reports and how to query the database to generate different types of reports. The rental accrual system creates proper double-entry accounting entries that automatically feed into all your financial statements.

## 🗄️ **Database Structure**

### **TransactionEntry Collection**
When rental accrual runs, it creates entries like this:

```json
{
  "_id": "ObjectId('...')",
  "transactionId": "RENTAL_ACCRUAL_LEASE123_1_1703123456789",
  "date": "2025-06-01T00:00:00.000Z",
  "description": "Rental income accrual: John Smith - 6/1/2025 to 6/30/2025",
  "reference": "LEASE123",
  "source": "rental_accrual",
  "sourceId": "ObjectId('LEASE123')",
  "sourceModel": "Lease",
  "status": "posted",
  "entries": [
    {
      "accountCode": "1100",
      "accountName": "Accounts Receivable",
      "accountType": "Asset",
      "debit": 200.00,
      "credit": 0,
      "description": "Rent due from John Smith for 6/1/2025 to 6/30/2025"
    },
    {
      "accountCode": "4000",
      "accountName": "Rental Income",
      "accountType": "Income",
      "debit": 0,
      "credit": 200.00,
      "description": "Rental income earned from John Smith for 6/1/2025 to 6/30/2025"
    }
  ],
  "totalDebit": 200.00,
  "totalCredit": 200.00,
  "residence": "ObjectId('RESIDENCE456')",
  "createdBy": "finance@alamait.com",
  "metadata": {
    "leaseId": "ObjectId('LEASE123')",
    "studentId": "ObjectId('STUDENT789')",
    "residenceId": "ObjectId('RESIDENCE456')",
    "roomId": "ObjectId('ROOM101')",
    "periodNumber": 1,
    "periodStart": "2025-06-01T00:00:00.000Z",
    "periodEnd": "2025-06-30T00:00:00.000Z",
    "billingCycle": "monthly",
    "accrualType": "rental_income"
  }
}
```

---

## 📊 **Financial Report Examples**

### **1. Income Statement (Monthly)**

#### **June 2025 Income Statement**
```
REVENUE
├── Rental Income: $200.00 (from accrual)
├── Other Income: $0.00
└── Total Revenue: $200.00

EXPENSES
├── Operating Expenses: $0.00
└── Total Expenses: $0.00

NET INCOME: $200.00
```

#### **July 2025 Income Statement**
```
REVENUE
├── Rental Income: $200.00 (from accrual)
├── Other Income: $0.00
└── Total Revenue: $200.00

EXPENSES
├── Operating Expenses: $0.00
└── Total Expenses: $0.00

NET INCOME: $200.00
```

#### **August 2025 Income Statement**
```
REVENUE
├── Rental Income: $0.00 (already accrued in June)
├── Other Income: $0.00
└── Total Revenue: $0.00

EXPENSES
├── Operating Expenses: $0.00
└── Total Expenses: $0.00

NET INCOME: $0.00
```

**Key Point:** Income appears in the month it's earned (June, July), not when paid (August).

---

### **2. Balance Sheet (Monthly)**

#### **June 30, 2025 Balance Sheet**
```
ASSETS
├── Current Assets
│   ├── Bank Account: $0.00
│   ├── Accounts Receivable: $200.00 (from June accrual)
│   └── Other Current Assets: $0.00
├── Total Current Assets: $200.00
└── Total Assets: $200.00

LIABILITIES: $0.00

EQUITY
├── Retained Earnings: $200.00
└── Total Equity: $200.00

TOTAL LIABILITIES & EQUITY: $200.00
```

#### **July 31, 2025 Balance Sheet**
```
ASSETS
├── Current Assets
│   ├── Bank Account: $0.00
│   ├── Accounts Receivable: $400.00 (June + July accruals)
│   └── Other Current Assets: $0.00
├── Total Current Assets: $400.00
└── Total Assets: $400.00

LIABILITIES: $0.00

EQUITY
├── Retained Earnings: $400.00
└── Total Equity: $400.00

TOTAL LIABILITIES & EQUITY: $400.00
```

#### **August 31, 2025 Balance Sheet (After Payment)**
```
ASSETS
├── Current Assets
│   ├── Bank Account: $200.00 (June payment received)
│   ├── Accounts Receivable: $200.00 (July still outstanding)
│   └── Other Current Assets: $0.00
├── Total Current Assets: $400.00
└── Total Assets: $400.00

LIABILITIES: $0.00

EQUITY
├── Retained Earnings: $400.00
└── Total Equity: $400.00

TOTAL LIABILITIES & EQUITY: $400.00
```

**Key Point:** Accounts Receivable shows outstanding amounts, Bank shows received payments.

---

### **3. Cash Flow Statement (Monthly)**

#### **June 2025 Cash Flow**
```
OPERATING ACTIVITIES
├── Net Income: $200.00
├── Adjustments for Non-Cash Items:
│   └── Increase in Accounts Receivable: -$200.00
└── Net Operating Cash Flow: $0.00

INVESTING ACTIVITIES: $0.00
FINANCING ACTIVITIES: $0.00

NET CHANGE IN CASH: $0.00
```

#### **August 2025 Cash Flow (Payment Received)**
```
OPERATING ACTIVITIES
├── Net Income: $0.00
├── Adjustments for Non-Cash Items:
│   └── Decrease in Accounts Receivable: +$200.00
└── Net Operating Cash Flow: +$200.00

INVESTING ACTIVITIES: $0.00
FINANCING ACTIVITIES: $0.00

NET CHANGE IN CASH: +$200.00
```

**Key Point:** Cash flow shows timing difference between income recognition and cash receipt.

---

## 🔍 **Database Queries for Reports**

### **1. Get All Rental Accruals for a Period**

```javascript
// Get all rental accruals for 2025
const accruals = await TransactionEntry.find({
  source: 'rental_accrual',
  date: { 
    $gte: new Date('2025-01-01'), 
    $lte: new Date('2025-12-31') 
  },
  status: 'posted'
}).sort({ date: 1 });

console.log(`Found ${accruals.length} rental accruals for 2025`);
```

### **2. Get Monthly Rental Income**

```javascript
// Get rental income by month for 2025
const monthlyIncome = await TransactionEntry.aggregate([
  { 
    $match: { 
      source: 'rental_accrual',
      date: { 
        $gte: new Date('2025-01-01'), 
        $lte: new Date('2025-12-31') 
      },
      status: 'posted'
    } 
  },
  {
    $group: {
      _id: { 
        year: { $year: '$date' }, 
        month: { $month: '$date' } 
      },
      totalIncome: { $sum: '$totalCredit' },
      accrualCount: { $sum: 1 }
    }
  },
  { $sort: { '_id.year': 1, '_id.month': 1 } }
]);

// Result format:
// [
//   { _id: { year: 2025, month: 6 }, totalIncome: 200.00, accrualCount: 1 },
//   { _id: { year: 2025, month: 7 }, totalIncome: 200.00, accrualCount: 1 },
//   ...
// ]
```

### **3. Get Outstanding Receivables by Student**

```javascript
// Get outstanding receivables grouped by student
const studentReceivables = await TransactionEntry.aggregate([
  { 
    $match: { 
      source: 'rental_accrual',
      status: 'posted'
    } 
  },
  { $unwind: '$entries' },
  { 
    $match: { 
      'entries.accountCode': '1100' // Accounts Receivable
    } 
  },
  {
    $group: {
      _id: '$metadata.studentId',
      studentName: { $first: '$metadata.studentName' },
      totalReceivable: { $sum: '$entries.debit' },
      accrualCount: { $sum: 1 }
    }
  },
  { $sort: { totalReceivable: -1 } }
]);

// Result format:
// [
//   { 
//     _id: 'STUDENT789', 
//     studentName: 'John Smith', 
//     totalReceivable: 400.00, 
//     accrualCount: 2 
//   },
//   ...
// ]
```

### **4. Get Rental Income by Residence**

```javascript
// Get rental income by residence for a period
const residenceIncome = await TransactionEntry.aggregate([
  { 
    $match: { 
      source: 'rental_accrual',
      date: { 
        $gte: new Date('2025-06-01'), 
        $lte: new Date('2025-12-31') 
      },
      status: 'posted'
    } 
  },
  {
    $group: {
      _id: '$residence',
      residenceName: { $first: '$metadata.residenceName' },
      totalIncome: { $sum: '$totalCredit' },
      studentCount: { $addToSet: '$metadata.studentId' }
    }
  },
  {
    $project: {
      residenceName: 1,
      totalIncome: 1,
      studentCount: { $size: '$studentCount' }
    }
  },
  { $sort: { totalIncome: -1 } }
]);
```

### **5. Get Accrual vs Payment Summary**

```javascript
// Compare accrued income vs received payments
const accrualSummary = await TransactionEntry.aggregate([
  {
    $facet: {
      // Get total accrued income
      totalAccrued: [
        { 
          $match: { 
            source: 'rental_accrual',
            status: 'posted'
          } 
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalCredit' }
          }
        }
      ],
      // Get total payments received
      totalPayments: [
        { 
          $match: { 
            source: 'payment',
            status: 'posted'
          } 
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalDebit' }
          }
        }
      ]
    }
  },
  {
    $project: {
      totalAccrued: { $ifNull: [{ $arrayElemAt: ['$totalAccrued.total', 0] }, 0] },
      totalPayments: { $ifNull: [{ $arrayElemAt: ['$totalPayments.total', 0] }, 0] },
      outstandingReceivables: {
        $subtract: [
          { $ifNull: [{ $arrayElemAt: ['$totalAccrued.total', 0] }, 0] },
          { $ifNull: [{ $arrayElemAt: ['$totalPayments.total', 0] }, 0] }
        ]
      }
    }
  }
]);

// Result format:
// [
//   {
//     totalAccrued: 1400.00,
//     totalPayments: 200.00,
//     outstandingReceivables: 1200.00
//   }
// ]
```

---

## 📈 **Report Generation Examples**

### **1. Monthly Income Statement Report**

```javascript
async function generateMonthlyIncomeStatement(year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  // Get rental income for the month
  const rentalIncome = await TransactionEntry.aggregate([
    { 
      $match: { 
        source: 'rental_accrual',
        date: { $gte: startDate, $lte: endDate },
        status: 'posted'
      } 
    },
    {
      $group: {
        _id: null,
        totalIncome: { $sum: '$totalCredit' }
      }
    }
  ]);
  
  // Get other income sources
  const otherIncome = await TransactionEntry.aggregate([
    { 
      $match: { 
        source: { $ne: 'rental_accrual' },
        date: { $gte: startDate, $lte: endDate },
        status: 'posted',
        'entries.accountCode': { $regex: '^4' } // Income accounts
      } 
    },
    {
      $group: {
        _id: null,
        totalIncome: { $sum: '$totalCredit' }
      }
    }
  ]);
  
  // Get expenses for the month
  const expenses = await TransactionEntry.aggregate([
    { 
      $match: { 
        date: { $gte: startDate, $lte: endDate },
        status: 'posted',
        'entries.accountCode': { $regex: '^5' } // Expense accounts
      } 
    },
    {
      $group: {
        _id: null,
        totalExpenses: { $sum: '$totalDebit' }
      }
    }
  ]);
  
  const totalRentalIncome = rentalIncome[0]?.totalIncome || 0;
  const totalOtherIncome = otherIncome[0]?.totalIncome || 0;
  const totalExpenses = expenses[0]?.totalExpenses || 0;
  const netIncome = totalRentalIncome + totalOtherIncome - totalExpenses;
  
  return {
    period: `${year}-${month.toString().padStart(2, '0')}`,
    revenue: {
      rentalIncome: totalRentalIncome,
      otherIncome: totalOtherIncome,
      totalRevenue: totalRentalIncome + totalOtherIncome
    },
    expenses: totalExpenses,
    netIncome: netIncome
  };
}
```

### **2. Balance Sheet Report**

```javascript
async function generateBalanceSheet(asOfDate) {
  // Get all assets (account codes starting with 1)
  const assets = await TransactionEntry.aggregate([
    { 
      $match: { 
        date: { $lte: asOfDate },
        status: 'posted',
        'entries.accountCode': { $regex: '^1' }
      } 
    },
    { $unwind: '$entries' },
    { 
      $match: { 
        'entries.accountCode': { $regex: '^1' }
      } 
    },
    {
      $group: {
        _id: '$entries.accountCode',
        accountName: { $first: '$entries.accountName' },
        balance: { 
          $sum: { $subtract: ['$entries.debit', '$entries.credit'] }
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  
  // Get all liabilities (account codes starting with 2)
  const liabilities = await TransactionEntry.aggregate([
    { 
      $match: { 
        date: { $lte: asOfDate },
        status: 'posted',
        'entries.accountCode': { $regex: '^2' }
      } 
    },
    { $unwind: '$entries' },
    { 
      $match: { 
        'entries.accountCode': { $regex: '^2' }
      } 
    },
    {
      $group: {
        _id: '$entries.accountCode',
        accountName: { $first: '$entries.accountName' },
        balance: { 
          $sum: { $subtract: ['$entries.credit', '$entries.debit'] }
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  
  // Calculate total assets and liabilities
  const totalAssets = assets.reduce((sum, asset) => sum + asset.balance, 0);
  const totalLiabilities = liabilities.reduce((sum, liability) => sum + liability.balance, 0);
  const totalEquity = totalAssets - totalLiabilities;
  
  return {
    asOfDate: asOfDate,
    assets: assets,
    totalAssets: totalAssets,
    liabilities: liabilities,
    totalLiabilities: totalLiabilities,
    equity: totalEquity,
    totalLiabilitiesAndEquity: totalLiabilities + totalEquity
  };
}
```

---

## 🎯 **Key Benefits of This Reporting System**

### **1. Accurate Period Recognition**
- ✅ Income appears in correct month (when earned)
- ✅ No more income appearing in wrong periods
- ✅ Proper accrual accounting compliance

### **2. Real-Time Visibility**
- ✅ See outstanding receivables instantly
- ✅ Track payment patterns
- ✅ Monitor cash flow timing

### **3. Comprehensive Reporting**
- ✅ All financial statements automatically updated
- ✅ Complete audit trail
- ✅ Easy to generate custom reports

### **4. Business Intelligence**
- ✅ Identify late-paying students
- ✅ Track residence performance
- ✅ Better cash flow planning

---

## 🚀 **Next Steps**

1. **Run the rental accrual system** to create database entries
2. **Test the reporting queries** to verify data accuracy
3. **Integrate with your frontend** to display reports
4. **Set up automated reporting** for regular financial reviews

Your rental accrual system now provides **enterprise-grade financial reporting** that automatically maintains proper double-entry accounting and gives you complete visibility into your student accommodation business finances! 🎉
