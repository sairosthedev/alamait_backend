# Backend-Frontend Integration Guide

## Overview
This guide covers all backend changes made to the financial system and how the frontend must be updated to match the current backend API structure.

## 🏗️ Backend Changes Summary

### 1. Financial Reports API Structure
**New Endpoints Added:**
- Monthly reports: `/api/financial-reports/monthly-income-statement`, `/monthly-balance-sheet`, `/monthly-cash-flow`
- Residence filtering: All financial reports now support `?residence=residenceId` parameter
- Enhanced response format with detailed monthly breakdowns

### 2. Transaction Management
**Enhanced Features:**
- Residence tracking in all transactions
- Proper date handling (uses source document date, not system date)
- Comprehensive transaction history and summaries

### 3. Route Organization
**Fixed Conflicts:**
- Transaction routes moved to `/api/finance/transactions/*`
- Financial reports at `/api/financial-reports/*`
- No more route conflicts between generic and specific endpoints

## 📋 Frontend Requirements

### 1. Financial Reports Service (`src/services/financeService.js`)

```javascript
// REQUIRED: Update your financeService.js with these functions

// Monthly Reports
export const getMonthlyIncomeStatement = async (year, residence = null) => {
  const params = new URLSearchParams({ period: year });
  if (residence) params.append('residence', residence);
  
  const response = await axios.get(`/api/financial-reports/monthly-income-statement?${params}`);
  return response.data;
};

export const getMonthlyBalanceSheet = async (year, residence = null) => {
  const params = new URLSearchParams({ period: year });
  if (residence) params.append('residence', residence);
  
  const response = await axios.get(`/api/financial-reports/monthly-balance-sheet?${params}`);
  return response.data;
};

export const getMonthlyCashFlow = async (year, residence = null) => {
  const params = new URLSearchParams({ period: year });
  if (residence) params.append('residence', residence);
  
  const response = await axios.get(`/api/financial-reports/monthly-cash-flow?${params}`);
  return response.data;
};

// Annual Reports with Residence Filtering
export const getIncomeStatement = async (year, basis = 'cash', residence = null) => {
  const params = new URLSearchParams({ period: year, basis });
  if (residence) params.append('residence', residence);
  
  const response = await axios.get(`/api/financial-reports/income-statement?${params}`);
  return response.data;
};

export const getBalanceSheet = async (year, residence = null) => {
  const params = new URLSearchParams({ period: year });
  if (residence) params.append('residence', residence);
  
  const response = await axios.get(`/api/financial-reports/balance-sheet?${params}`);
  return response.data;
};

export const getCashFlowStatement = async (year, residence = null) => {
  const params = new URLSearchParams({ period: year });
  if (residence) params.append('residence', residence);
  
  const response = await axios.get(`/api/financial-reports/cash-flow?${params}`);
  return response.data;
};

// Transaction Management
export const getAllTransactions = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  const response = await axios.get(`/api/finance/transactions?${params}`);
  return response.data;
};

export const getTransactionEntries = async (transactionId) => {
  const response = await axios.get(`/api/finance/transactions/${transactionId}/entries`);
  return response.data;
};
```

### 2. Financial Reports Component Example

```javascript
// REQUIRED: Create/Update your FinancialReports component

import React, { useState, useEffect } from 'react';
import { 
  getMonthlyIncomeStatement, 
  getMonthlyBalanceSheet, 
  getMonthlyCashFlow,
  getIncomeStatement,
  getBalanceSheet,
  getCashFlowStatement
} from '../services/financeService';

const FinancialReports = () => {
  const [reportType, setReportType] = useState('income-statement');
  const [period, setPeriod] = useState('2025');
  const [basis, setBasis] = useState('cash');
  const [residence, setResidence] = useState('');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      let data;
      
      if (reportType === 'monthly-income-statement') {
        data = await getMonthlyIncomeStatement(period, residence || null);
      } else if (reportType === 'monthly-balance-sheet') {
        data = await getMonthlyBalanceSheet(period, residence || null);
      } else if (reportType === 'monthly-cash-flow') {
        data = await getMonthlyCashFlow(period, residence || null);
      } else if (reportType === 'income-statement') {
        data = await getIncomeStatement(period, basis, residence || null);
      } else if (reportType === 'balance-sheet') {
        data = await getBalanceSheet(period, residence || null);
      } else if (reportType === 'cash-flow') {
        data = await getCashFlowStatement(period, residence || null);
      }
      
      setReportData(data);
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, period, basis, residence]);

  const renderMonthlyTable = (data) => {
    if (!data || !data.data) return null;
    
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 
                   'july', 'august', 'september', 'october', 'november', 'december'];
    
    return (
      <table className="table">
        <thead>
          <tr>
            <th>Month</th>
            {months.map(month => (
              <th key={month}>{month.charAt(0).toUpperCase() + month.slice(1)}</th>
            ))}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(data.data).map(category => (
            <tr key={category}>
              <td><strong>{category.replace(/_/g, ' ').toUpperCase()}</strong></td>
              {months.map(month => (
                <td key={month}>
                  {data.data[category][month] ? 
                    `$${data.data[category][month].toLocaleString()}` : 
                    '$0'
                  }
                </td>
              ))}
              <td><strong>${data.data[category].total_revenue || data.data[category].total_expenses || 0}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="financial-reports">
      <div className="controls">
        <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
          <option value="income-statement">Annual Income Statement</option>
          <option value="monthly-income-statement">Monthly Income Statement</option>
          <option value="balance-sheet">Annual Balance Sheet</option>
          <option value="monthly-balance-sheet">Monthly Balance Sheet</option>
          <option value="cash-flow">Annual Cash Flow</option>
          <option value="monthly-cash-flow">Monthly Cash Flow</option>
        </select>
        
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="2024">2024</option>
          <option value="2025">2025</option>
          <option value="2026">2026</option>
        </select>
        
        {reportType === 'income-statement' && (
          <select value={basis} onChange={(e) => setBasis(e.target.value)}>
            <option value="cash">Cash Basis</option>
            <option value="accrual">Accrual Basis</option>
          </select>
        )}
        
        <select value={residence} onChange={(e) => setResidence(e.target.value)}>
          <option value="">All Residences</option>
          <option value="residence-id-1">Residence 1</option>
          <option value="residence-id-2">Residence 2</option>
        </select>
      </div>

      {loading ? (
        <div>Loading report...</div>
      ) : (
        <div className="report-content">
          {reportData && reportData.success && (
            <>
              <h3>{reportData.message}</h3>
              {reportType.includes('monthly') ? 
                renderMonthlyTable(reportData) : 
                <pre>{JSON.stringify(reportData.data, null, 2)}</pre>
              }
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default FinancialReports;
```

## 🔄 Transaction Process Requirements

### 1. Student Rent Payment Process

**Frontend Requirements:**
```javascript
// When student makes payment
const handleStudentPayment = async (paymentData) => {
  try {
    // 1. Create payment record
    const payment = await createPayment({
      student: paymentData.studentId,
      room: paymentData.roomId,
      residence: paymentData.residenceId, // REQUIRED
      amount: paymentData.amount,
      date: paymentData.paymentDate, // REQUIRED: Use actual payment date
      paymentMethod: paymentData.method,
      description: paymentData.description
    });

    // 2. Backend automatically creates double-entry transactions
    // - Debit: Cash/Bank Account
    // - Credit: Accounts Receivable
    // - Date: Uses payment.date (not current system date)
    // - Residence: Automatically populated from payment.residence

    // 3. Update UI to show transaction created
    showSuccessMessage('Payment recorded and transactions created');
    
  } catch (error) {
    console.error('Payment failed:', error);
  }
};
```

### 2. Maintenance Approval Process

**Frontend Requirements:**
```javascript
// When admin approves maintenance expense
const handleMaintenanceApproval = async (expenseData) => {
  try {
    // 1. Create expense record
    const expense = await createExpense({
      description: expenseData.description,
      amount: expenseData.amount,
      residence: expenseData.residenceId, // REQUIRED
      category: 'maintenance',
      date: expenseData.expenseDate, // REQUIRED: Use actual expense date
      approvedBy: expenseData.approvedBy,
      status: 'approved'
    });

    // 2. Backend automatically creates double-entry transactions
    // - Debit: Maintenance Expense
    // - Credit: Cash/Bank Account
    // - Date: Uses expense.date (not current system date)
    // - Residence: Automatically populated from expense.residence

    // 3. Update UI
    showSuccessMessage('Maintenance expense approved and transactions created');
    
  } catch (error) {
    console.error('Approval failed:', error);
  }
};
```

### 3. Vendor Payment Process

**Frontend Requirements:**
```javascript
// When paying vendor
const handleVendorPayment = async (paymentData) => {
  try {
    // 1. Create vendor payment record
    const vendorPayment = await createVendorPayment({
      vendor: paymentData.vendorId,
      amount: paymentData.amount,
      residence: paymentData.residenceId, // REQUIRED
      date: paymentData.paymentDate, // REQUIRED: Use actual payment date
      description: paymentData.description,
      invoiceNumber: paymentData.invoiceNumber
    });

    // 2. Backend automatically creates double-entry transactions
    // - Debit: Accounts Payable
    // - Credit: Cash/Bank Account
    // - Date: Uses vendorPayment.date (not current system date)
    // - Residence: Automatically populated from vendorPayment.residence

    // 3. Update UI
    showSuccessMessage('Vendor payment recorded and transactions created');
    
  } catch (error) {
    console.error('Vendor payment failed:', error);
  }
};
```

### 4. Invoice Issuance Process

**Frontend Requirements:**
```javascript
// When issuing invoice to student
const handleInvoiceIssuance = async (invoiceData) => {
  try {
    // 1. Create invoice record
    const invoice = await createInvoice({
      student: invoiceData.studentId,
      amount: invoiceData.amount,
      residence: invoiceData.residenceId, // REQUIRED
      date: invoiceData.invoiceDate, // REQUIRED: Use actual invoice date
      dueDate: invoiceData.dueDate,
      description: invoiceData.description,
      items: invoiceData.items
    });

    // 2. Backend automatically creates double-entry transactions
    // - Debit: Accounts Receivable
    // - Credit: Revenue Account
    // - Date: Uses invoice.date (not current system date)
    // - Residence: Automatically populated from invoice.residence

    // 3. Update UI
    showSuccessMessage('Invoice issued and transactions created');
    
  } catch (error) {
    console.error('Invoice creation failed:', error);
  }
};
```

### 5. Petty Cash Allocation Process

**Frontend Requirements:**
```javascript
// When finance gives admin petty cash
const handlePettyCashAllocation = async (allocationData) => {
  try {
    // 1. Create petty cash allocation record
    const pettyCashAllocation = await createPettyCashAllocation({
      amount: allocationData.amount,
      residence: allocationData.residenceId, // REQUIRED
      date: allocationData.allocationDate, // REQUIRED: Use actual allocation date
      allocatedBy: allocationData.financeUserId,
      receivedBy: allocationData.adminUserId,
      purpose: allocationData.purpose
    });

    // 2. Backend automatically creates double-entry transactions
    // - Debit: Petty Cash Account
    // - Credit: Bank Account
    // - Date: Uses pettyCashAllocation.date (not current system date)
    // - Residence: Automatically populated from pettyCashAllocation.residence

    // 3. Update UI
    showSuccessMessage('Petty cash allocated and transactions created');
    
  } catch (error) {
    console.error('Petty cash allocation failed:', error);
  }
};
```

## 🎯 Critical Frontend Changes Required

### 1. Date Handling
**CRITICAL:** Always send the actual transaction date, not the current system date:
```javascript
// ✅ CORRECT
const paymentData = {
  date: new Date('2025-01-15'), // Actual payment date
  // ... other fields
};

// ❌ WRONG
const paymentData = {
  date: new Date(), // Current system date
  // ... other fields
};
```

### 2. Residence Field
**REQUIRED:** All transaction-related forms must include residence:
```javascript
// ✅ REQUIRED in all forms
const formData = {
  residence: selectedResidenceId, // Always include
  // ... other fields
};
```

### 3. API Endpoint Updates
**UPDATE:** Change all financial report API calls to use new endpoints:
```javascript
// ✅ NEW ENDPOINTS
/api/financial-reports/income-statement
/api/financial-reports/balance-sheet
/api/financial-reports/cash-flow
/api/financial-reports/monthly-income-statement
/api/financial-reports/monthly-balance-sheet
/api/financial-reports/monthly-cash-flow

// ✅ TRANSACTION ENDPOINTS
/api/finance/transactions
/api/finance/transactions/:id
/api/finance/transactions/:id/entries
```

### 4. Response Format Handling
**UPDATE:** Handle new response format with residence info:
```javascript
// ✅ NEW RESPONSE FORMAT
{
  success: true,
  data: {
    period: "2025",
    residence: {
      _id: "residence-id",
      name: "Residence Name",
      address: "Residence Address"
    },
    revenue: { ... },
    expenses: { ... },
    net_income: 50000
  },
  message: "Income statement generated for 2025 (residence: Residence Name) (cash basis)"
}
```

## 🧪 Testing Checklist

### Frontend Testing Requirements:
1. **Date Validation:** Ensure all forms send actual transaction dates
2. **Residence Selection:** Verify residence is included in all transaction forms
3. **API Integration:** Test all new financial report endpoints
4. **Monthly Reports:** Verify monthly breakdown tables render correctly
5. **Residence Filtering:** Test filtering reports by specific residences
6. **Error Handling:** Test API error responses and display appropriate messages

### Backend Integration Testing:
```javascript
// Test script for frontend developers
const testEndpoints = async () => {
  const baseURL = 'http://localhost:3000/api';
  
  // Test monthly reports
  const monthlyIncome = await fetch(`${baseURL}/financial-reports/monthly-income-statement?period=2025`);
  console.log('Monthly Income:', await monthlyIncome.json());
  
  // Test residence filtering
  const filteredIncome = await fetch(`${baseURL}/financial-reports/income-statement?period=2025&residence=residence-id`);
  console.log('Filtered Income:', await filteredIncome.json());
  
  // Test transaction endpoints
  const transactions = await fetch(`${baseURL}/finance/transactions`);
  console.log('Transactions:', await transactions.json());
};
```

## 📝 Summary of Required Frontend Changes

1. **Update `financeService.js`** with new API functions
2. **Create/Update FinancialReports component** with monthly table rendering
3. **Add residence field** to all transaction forms
4. **Use actual transaction dates** instead of current system date
5. **Update API endpoints** to use new financial reports routes
6. **Handle new response format** with residence information
7. **Test all endpoints** and error scenarios
8. **Implement proper loading states** and error handling

## 🚨 Critical Notes

- **Date Accuracy:** Incorrect dates will break monthly reports
- **Residence Required:** Missing residence will cause transaction creation to fail
- **API Changes:** Old endpoints may not work with new backend structure
- **Testing Required:** All changes must be tested before deployment

This guide ensures your frontend matches the current backend structure and handles all transaction processes correctly. 