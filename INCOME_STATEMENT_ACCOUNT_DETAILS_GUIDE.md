# Income Statement Account Details Guide

## 📋 Overview

The Income Statement now includes account details functionality, similar to the Balance Sheet and Cash Flow statements. This allows users to drill down into specific income and expense accounts to see detailed transaction information.

## 🔗 API Endpoint

```
GET /api/financial-reports/income-statement/account-details
```

## 📝 Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `period` | string | Yes | The year (e.g., "2025") |
| `month` | string | Yes | The month name (e.g., "july", "january") |
| `accountCode` | string | Yes | The account code (e.g., "4001", "5001") |
| `residenceId` | string | No | Filter by specific residence |
| `sourceType` | string | No | Filter by source type (e.g., "rental", "admin", "utilities") |

## 💰 Supported Account Codes

### Income Accounts (4000s)
- `4001` - Rental Income - School Accommodation
- `4002` - Rental Income - Private Accommodation
- `4003` - Admin Fees Income
- `4004` - Utilities Income
- `4005` - Forfeit Income
- `4006` - Other Income

### Expense Accounts (5000s)
- `5001` - Maintenance Expenses
- `5002` - Cleaning Expenses
- `5003` - Utilities - Electricity
- `5004` - Utilities - Water
- `5005` - Utilities - Gas
- `5006` - Utilities - Internet
- `5007` - Security Expenses
- `5008` - Administrative Expenses
- `5009` - Other Operating Expenses
- `5010` - Marketing Expenses
- `5011` - Legal Expenses
- `5012` - Insurance Expenses

## 🔍 Source Type Filters

| Source Type | Description | Matches |
|-------------|-------------|---------|
| `rental` | Rental income transactions | rent, rental, accommodation |
| `admin` | Admin fee transactions | admin, fee |
| `utilities` | Utilities income/expenses | utilities, electricity, water, gas |
| `expenses` | General operating expenses | expense, maintenance, cleaning |
| `maintenance` | Maintenance expenses | maintenance, repair, fix |
| `cleaning` | Cleaning expenses | cleaning, housekeeping |

## 📊 Response Structure

```json
{
  "success": true,
  "data": {
    "accountCode": "4001",
    "accountName": "Rental Income - School Accommodation",
    "month": "july",
    "period": "2025",
    "dateRange": {
      "start": "2025-07-01",
      "end": "2025-07-31"
    },
    "sourceType": null,
    "summary": {
      "totalTransactions": 15,
      "totalAmount": 1500.00,
      "totalDebits": 0.00,
      "totalCredits": 1500.00,
      "finalBalance": 1500.00,
      "uniqueStudents": 8,
      "dateRange": {
        "start": "2025-07-01",
        "end": "2025-07-31"
      },
      "hasChildAccounts": false,
      "childAccountCount": 0,
      "childAccountSummary": [],
      "accountBreakdown": {}
    },
    "transactions": [
      {
        "transactionId": "TXN123456789",
        "date": "2025-07-15T10:30:00.000Z",
        "amount": 100.00,
        "type": "credit",
        "description": "Rent payment for July 2025",
        "accountCode": "4001",
        "accountName": "Rental Income - School Accommodation",
        "debtorName": "John Doe",
        "studentName": "John Doe",
        "reference": "PAY-2025-001",
        "source": "Payment",
        "netAmount": 100.00,
        "debit": 0.00,
        "credit": 100.00,
        "isChildAccount": false,
        "childAccountName": null,
        "parentAccountCode": null,
        "residence": "Main Residence",
        "metadata": {},
        "runningBalance": 100.00
      }
    ],
    "childAccounts": []
  },
  "message": "Account details retrieved for Rental Income - School Accommodation in july 2025"
}
```

## 🧪 Example Usage

### Basic Request
```bash
curl "http://localhost:3000/api/financial-reports/income-statement/account-details?period=2025&month=july&accountCode=4001"
```

### With Residence Filter
```bash
curl "http://localhost:3000/api/financial-reports/income-statement/account-details?period=2025&month=july&accountCode=4001&residenceId=67d723cf20f89c4ae69804f3"
```

### With Source Type Filter
```bash
curl "http://localhost:3000/api/financial-reports/income-statement/account-details?period=2025&month=july&accountCode=4001&sourceType=rental"
```

## 🔄 Key Features

1. **Monthly Data**: Shows transactions for the specific month only (not cumulative like balance sheet)
2. **Account Hierarchy**: Supports parent-child account relationships
3. **Student Tracking**: Links transactions to specific students
4. **Running Balance**: Calculates running balance for each transaction
5. **Source Filtering**: Filter transactions by source type
6. **Residence Filtering**: Filter by specific residence
7. **Detailed Metadata**: Includes transaction metadata and references

## 📈 Balance Calculation

- **Income Accounts**: Credit increases balance, Debit decreases balance
- **Expense Accounts**: Debit increases balance, Credit decreases balance
- **Running Balance**: Calculated chronologically from oldest to newest transaction

## 🚀 Integration

This functionality integrates seamlessly with the existing financial reporting system and follows the same patterns as the Balance Sheet and Cash Flow account details features.

## 🔧 Testing

Use the provided test script to verify functionality:

```bash
node test_income_statement_account_details.js
```

The test script will:
1. Test the basic endpoint functionality
2. Test multiple account codes
3. Validate response structure
4. Display sample transaction data
