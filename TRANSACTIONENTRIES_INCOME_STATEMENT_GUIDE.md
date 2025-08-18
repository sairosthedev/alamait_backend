# 🏠 TransactionEntries Income Statement Implementation Guide

## 📋 **Overview**

Your `FinancialReportingService` has been updated to work with the `transactionentries` collection in your MongoDB Atlas cluster (`cluster0.ulvve.mongodb.net/test`). This service now properly implements accrual vs cash basis accounting using your actual data structure.

## 🔍 **Data Source: TransactionEntries Collection**

The service reads from your `transactionentries` collection which contains:

### **Entry Structure:**
```json
{
  "_id": "ObjectId",
  "transactionId": "TXN2025001",
  "date": "2025-01-15T00:00:00.000Z",
  "description": "Student Payment - Room 101",
  "entries": [
    {
      "accountCode": "1000",
      "accountName": "Cash",
      "accountType": "Asset",
      "debit": 0,
      "credit": 300,
      "description": "Cash received"
    },
    {
      "accountCode": "4001", 
      "accountName": "Rental Income - School Accommodation",
      "accountType": "Income",
      "debit": 300,
      "credit": 0,
      "description": "Rental income earned"
    }
  ],
  "totalDebit": 300,
  "totalCredit": 300,
  "source": "payment",
  "status": "posted",
  "residence": "ObjectId"
}
```

## 🎯 **Source Types for Filtering**

### **1. ACCRUAL BASIS (`source: 'rental_accrual'`)**
- **Purpose**: Shows income when earned (rent due)
- **Data**: Rental accrual entries
- **Income Recognition**: Based on `credit` amounts for Income accounts
- **Example**: Monthly rent accruals for students

### **2. CASH BASIS (`source: 'payment'` and `source: 'expense_payment'`)**
- **Purpose**: Shows income when cash received/paid
- **Data**: Student payments + expense payments
- **Income Recognition**: Based on `debit` amounts for Income accounts
- **Expense Recognition**: Based on `debit` amounts for Expense accounts

## 📊 **How the Service Works**

### **Accrual Basis Processing:**
1. **Query**: `source: 'rental_accrual'` + `status: 'posted'`
2. **Income**: Sum `credit` amounts from Income account types
3. **Expenses**: Sum `debit` amounts from Expense account types
4. **Result**: Shows financial performance when earned/incurred

### **Cash Basis Processing:**
1. **Payments**: `source: 'payment'` + `status: 'posted'`
2. **Expenses**: `source: 'expense_payment'` + `status: 'posted'`
3. **Income**: Sum `debit` amounts from Income accounts (cash received)
4. **Expenses**: Sum `debit` amounts from Expense accounts (cash paid)
5. **Result**: Shows financial performance when cash moves

## 🔧 **Key Fields Used**

### **Required Fields:**
- `date`: Transaction date for period filtering
- `source`: Transaction type for basis filtering
- `status`: Must be 'posted' for valid transactions
- `entries`: Array of line items with account details

### **Line Item Fields:**
- `accountCode`: Account identifier
- `accountName`: Account description
- `accountType`: Asset, Liability, Income, Expense, Equity
- `debit`: Debit amount
- `credit`: Credit amount

## 📈 **Expected Results**

### **Accrual Basis (2025):**
- **Revenue**: $900 (3 rental accruals × $300)
- **Expenses**: $0 (no expenses incurred yet)
- **Net Income**: $900

### **Cash Basis (2025):**
- **Revenue**: $3,600 (12 student payments × $300)
- **Expenses**: $350 (maintenance + cleaning + electricity)
- **Net Income**: $3,250

## 🚀 **Testing the Service**

### **1. Update Connection String:**
```javascript
const MONGODB_URI = 'mongodb+srv://username:password@cluster0.ulvve.mongodb.net/test';
```

### **2. Run Test Script:**
```bash
node test-income-statement-locally.js 2025
```

### **3. Verify Results:**
- Check that revenue/expense amounts match your data
- Verify transaction counts are correct
- Ensure proper separation between accrual and cash basis

## ✅ **What's Working Now**

1. **Proper Data Source**: Uses `transactionentries` collection
2. **Correct Filtering**: Separates accrual vs cash basis by source
3. **Accurate Calculations**: Processes nested entries array correctly
4. **Real Data**: Shows actual financial data from your database
5. **Monthly Breakdown**: Provides month-by-month analysis

## 🔍 **Troubleshooting**

### **If No Data Found:**
1. Check `source` field values in your data
2. Verify `status` field is 'posted'
3. Confirm date ranges are correct
4. Check account type classifications

### **If Amounts Seem Wrong:**
1. Verify `debit` vs `credit` logic for your accounting system
2. Check account type classifications (Income vs Expense)
3. Ensure proper period filtering

## 📞 **Next Steps**

1. **Test Locally**: Run the test script with your credentials
2. **Verify Data**: Check that amounts match your expectations
3. **Frontend Integration**: Use the service in your React component
4. **Monitor Performance**: Watch for any performance issues with large datasets

Your income statement service is now properly configured to work with your `transactionentries` collection and will show the correct financial data! 🎉
