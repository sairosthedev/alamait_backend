# Frontend Quick Reference Guide

## 🚀 Essential API Endpoints

### Financial Reports
```javascript
// Monthly Income Statement
GET /api/financial-reports/monthly-income-statement?period=2025&basis=cash

// Monthly Balance Sheet  
GET /api/financial-reports/monthly-balance-sheet?period=2025&basis=cash

// Monthly Cash Flow
GET /api/financial-reports/monthly-cash-flow?period=2025&basis=cash

// Annual Income Statement
GET /api/financial-reports/income-statement?period=2025&basis=cash

// Annual Balance Sheet
GET /api/financial-reports/balance-sheet?asOf=2025-12-31&basis=cash

// Annual Cash Flow
GET /api/financial-reports/cash-flow?period=2025&basis=cash
```

### Transactions
```javascript
// Get all transactions
GET /api/finance/transactions

// Get transaction by ID
GET /api/finance/transactions/:id

// Get transaction entries
GET /api/finance/transactions/:id/entries
```

### Student Payments
```javascript
// Create student payment
POST /api/student/payments
{
  studentId: "student123",
  residenceId: "residence456", 
  amount: 300,
  method: "Cash", // Cash, Bank Transfer, Mobile Money
  date: "2025-01-15", // IMPORTANT: Use actual payment date
  description: "January 2025 Rent"
}
```

### Maintenance & Expenses
```javascript
// Approve maintenance request
POST /api/admin/maintenance/approve
{
  requestId: "request123",
  selectedQuotations: [...],
  approvedBy: "admin@alamait.com"
}

// Pay vendor expense
POST /api/finance/expenses/pay
{
  expenseId: "expense123",
  paymentMethod: "Bank Transfer",
  paidDate: "2025-01-20", // IMPORTANT: Use actual payment date
  amount: 500
}
```

### Invoices
```javascript
// Create invoice
POST /api/finance/invoices
{
  studentId: "student123",
  residenceId: "residence456",
  amount: 300,
  dueDate: "2025-02-15",
  description: "February 2025 Rent"
}

// Pay invoice
POST /api/finance/invoices/pay
{
  invoiceId: "invoice123",
  paymentMethod: "Mobile Money",
  amount: 300,
  paymentDate: "2025-01-25" // IMPORTANT: Use actual payment date
}
```

---

## 📊 Response Data Structures

### Monthly Income Statement Response
```javascript
{
  success: true,
  data: {
    period: "2025",
    basis: "cash",
    monthly_breakdown: {
      january: {
        revenue: 3000,
        expenses: 1500,
        net_income: 1500
      },
      february: {
        revenue: 3200,
        expenses: 1800,
        net_income: 1400
      }
      // ... other months
    },
    yearly_totals: {
      revenue: 36000,
      expenses: 20000,
      net_income: 16000
    }
  }
}
```

### Monthly Balance Sheet Response
```javascript
{
  success: true,
  data: {
    period: "2025",
    basis: "cash",
    monthly_breakdown: {
      january: {
        assets: 50000,
        liabilities: 15000,
        equity: 35000
      }
      // ... other months
    },
    yearly_totals: {
      assets: 60000,
      liabilities: 18000,
      equity: 42000
    }
  }
}
```

### Transaction Entry Structure
```javascript
{
  _id: "transaction123",
  transactionId: "TXN2025001",
  date: "2025-01-15T00:00:00.000Z",
  description: "Rent payment from John Doe",
  source: "payment",
  sourceId: "payment123",
  sourceModel: "Payment",
  entries: [
    {
      accountCode: "1001",
      accountName: "Cash on Hand",
      accountType: "Asset",
      debit: 300,
      credit: 0,
      description: "Rent payment via Cash"
    },
    {
      accountCode: "4001", 
      accountName: "Rent Income",
      accountType: "Income",
      debit: 0,
      credit: 300,
      description: "Rent income from John Doe"
    }
  ],
  totalDebit: 300,
  totalCredit: 300,
  createdBy: "admin@alamait.com",
  status: "posted"
}
```

---

## 🔧 Frontend Implementation Checklist

### ✅ Payment Forms
- [ ] Student selection dropdown
- [ ] Residence selection dropdown  
- [ ] Amount input with validation
- [ ] Payment method selection (Cash/Bank Transfer/Mobile Money)
- [ ] **Date picker (default to today but editable)**
- [ ] Description/notes field
- [ ] Form validation
- [ ] Loading state during submission
- [ ] Success/error messages

### ✅ Financial Reports Display
- [ ] Year selector dropdown
- [ ] Report type tabs (Income Statement, Balance Sheet, Cash Flow)
- [ ] Monthly breakdown tables
- [ ] Yearly totals summary
- [ ] Loading states
- [ ] Error handling
- [ ] Export functionality (optional)

### ✅ Transaction History
- [ ] Date range filters
- [ ] Transaction type filters
- [ ] Search functionality
- [ ] Pagination
- [ ] Transaction details modal
- [ ] Export to CSV/PDF (optional)

### ✅ Maintenance Interface
- [ ] Request creation form
- [ ] Quotation comparison view
- [ ] Approval workflow
- [ ] Payment processing
- [ ] Status tracking

---

## ⚠️ Critical Implementation Notes

### 1. Date Handling
```javascript
// ALWAYS use actual transaction dates, not current date
const paymentData = {
  // ... other fields
  date: selectedDate, // User-selected date, not new Date()
  // ... other fields
};
```

### 2. Required Fields Validation
```javascript
// Validate all required fields before submission
const validatePaymentData = (data) => {
  if (!data.studentId) return "Student is required";
  if (!data.residenceId) return "Residence is required";
  if (!data.amount || data.amount <= 0) return "Valid amount is required";
  if (!data.method) return "Payment method is required";
  if (!data.date) return "Payment date is required";
  return null; // Valid
};
```

### 3. Error Handling
```javascript
const handlePaymentSubmit = async (paymentData) => {
  try {
    setLoading(true);
    const response = await createPayment(paymentData);
    
    if (response.success) {
      setSuccessMessage("Payment recorded successfully");
      // Refresh financial reports
      await refreshReports();
    } else {
      setErrorMessage(response.message || "Payment failed");
    }
  } catch (error) {
    setErrorMessage("Network error. Please try again.");
  } finally {
    setLoading(false);
  }
};
```

### 4. Real-time Updates
```javascript
// Refresh reports after successful transactions
const refreshReports = async () => {
  const [income, balance, cash] = await Promise.all([
    getMonthlyIncomeStatement(currentYear),
    getMonthlyBalanceSheet(currentYear),
    getMonthlyCashFlow(currentYear)
  ]);
  
  setReports({
    incomeStatement: income.data,
    balanceSheet: balance.data,
    cashFlow: cash.data
  });
};
```

---

## 🎯 Quick Start Example

```javascript
// 1. Create payment form component
const PaymentForm = () => {
  const [formData, setFormData] = useState({
    studentId: '',
    residenceId: '',
    amount: 0,
    method: 'Cash',
    date: new Date().toISOString().split('T')[0], // Today's date
    description: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const error = validatePaymentData(formData);
    if (error) {
      alert(error);
      return;
    }
    
    try {
      const response = await fetch('/api/student/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const result = await response.json();
      if (result.success) {
        alert('Payment recorded successfully!');
        // Refresh reports
      } else {
        alert(result.message);
      }
    } catch (error) {
      alert('Error recording payment');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <input
        type="date"
        value={formData.date}
        onChange={(e) => setFormData({...formData, date: e.target.value})}
        required
      />
      <button type="submit">Record Payment</button>
    </form>
  );
};

// 2. Display monthly reports
const MonthlyReports = () => {
  const [reports, setReports] = useState(null);
  const [year, setYear] = useState(2025);

  useEffect(() => {
    const fetchReports = async () => {
      const response = await fetch(
        `/api/financial-reports/monthly-income-statement?period=${year}&basis=cash`
      );
      const data = await response.json();
      setReports(data.data);
    };
    
    fetchReports();
  }, [year]);

  return (
    <div>
      <select value={year} onChange={(e) => setYear(e.target.value)}>
        <option value={2025}>2025</option>
        <option value={2024}>2024</option>
      </select>
      
      {reports && (
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Revenue</th>
              <th>Expenses</th>
              <th>Net Income</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(reports.monthly_breakdown).map(([month, data]) => (
              <tr key={month}>
                <td>{month}</td>
                <td>${data.revenue}</td>
                <td>${data.expenses}</td>
                <td>${data.net_income}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
```

This quick reference provides everything the frontend team needs to implement the financial system correctly! 