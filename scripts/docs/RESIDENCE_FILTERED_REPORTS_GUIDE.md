# Residence-Filtered Financial Reports Guide

## 🏢 How to Fetch Financial Reports Filtered by Residence

### Overview
Currently, the `TransactionEntry` model doesn't have a direct `residence` field, but residence information is available through the source documents (Payment, Expense, Invoice). Here's how to implement residence filtering for financial reports.

---

## 🔍 Current Implementation Analysis

### 1. TransactionEntry Model Structure
```javascript
// Current TransactionEntry schema
{
  transactionId: String,
  date: Date,
  description: String,
  source: String, // 'payment', 'invoice', 'expense_payment', etc.
  sourceId: ObjectId, // References Payment, Expense, or Invoice
  sourceModel: String, // 'Payment', 'Expense', 'Invoice'
  entries: [...], // Double-entry accounting entries
  // NO direct residence field
}
```

### 2. Residence Information Sources
Residence information is stored in the source documents:

**Payment Model:**
```javascript
{
  _id: ObjectId,
  student: ObjectId,
  residence: ObjectId, // ✅ Residence reference
  room: ObjectId,
  amount: Number,
  date: Date
}
```

**Expense Model:**
```javascript
{
  _id: ObjectId,
  residence: ObjectId, // ✅ Residence reference
  vendorId: ObjectId,
  amount: Number,
  expenseDate: Date
}
```

**Invoice Model:**
```javascript
{
  _id: ObjectId,
  student: ObjectId,
  residence: ObjectId, // ✅ Residence reference
  amount: Number,
  date: Date
}
```

---

## 🛠️ Implementation Strategies

### Strategy 1: Enhanced Query with Population (Recommended)

**Backend Implementation:**
```javascript
// Enhanced financial reports with residence filtering
static async generateResidenceFilteredIncomeStatement(period, residenceId, basis = 'cash') {
  try {
    const startDate = new Date(`${period}-01-01`);
    const endDate = new Date(`${period}-12-31`);
    
    // Base query for transaction entries
    const baseQuery = {
      date: { $gte: startDate, $lte: endDate }
    };
    
    // Get all transaction entries for the period
    const transactionEntries = await TransactionEntry.find(baseQuery)
      .populate({
        path: 'sourceId',
        select: 'residence student amount date',
        populate: {
          path: 'residence',
          select: 'name address'
        }
      })
      .lean();
    
    // Filter by residence if specified
    let filteredEntries = transactionEntries;
    if (residenceId) {
      filteredEntries = transactionEntries.filter(entry => {
        // Check if source document has residence and it matches
        return entry.sourceId && 
               entry.sourceId.residence && 
               entry.sourceId.residence._id.toString() === residenceId;
      });
    }
    
    // Calculate revenue and expenses
    const revenue = {};
    const expenses = {};
    
    filteredEntries.forEach(entry => {
      entry.entries.forEach(accountEntry => {
        if (accountEntry.accountType === 'Income') {
          const month = new Date(entry.date).toLocaleString('default', { month: 'long' }).toLowerCase();
          if (!revenue[month]) revenue[month] = 0;
          revenue[month] += accountEntry.credit;
        } else if (accountEntry.accountType === 'Expense') {
          const month = new Date(entry.date).toLocaleString('default', { month: 'long' }).toLowerCase();
          if (!expenses[month]) expenses[month] = 0;
          expenses[month] += accountEntry.debit;
        }
      });
    });
    
    return {
      period,
      residence: residenceId ? await Residence.findById(residenceId).select('name address') : null,
      basis,
      revenue,
      expenses,
      netIncome: Object.keys(revenue).reduce((sum, month) => {
        return sum + (revenue[month] || 0) - (expenses[month] || 0);
      }, 0)
    };
    
  } catch (error) {
    console.error('Error generating residence-filtered income statement:', error);
    throw error;
  }
}
```

### Strategy 2: Add Residence Field to TransactionEntry (Future Enhancement)

**Enhanced TransactionEntry Schema:**
```javascript
// Add residence field to TransactionEntry model
const transactionEntrySchema = new mongoose.Schema({
  // ... existing fields ...
  
  // Add residence field
  residence: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Residence',
    required: false // Optional for backward compatibility
  },
  
  // ... rest of schema
});
```

**Updated DoubleEntryAccountingService:**
```javascript
// Update transaction creation to include residence
static async recordStudentRentPayment(payment, user) {
  try {
    // ... existing code ...
    
    const transactionEntry = new TransactionEntry({
      transactionId: transaction.transactionId,
      date: payment.date || new Date(),
      description: `Rent payment from ${payment.student?.firstName || 'Student'}`,
      residence: payment.residence, // ✅ Add residence reference
      source: 'payment',
      sourceId: payment._id,
      sourceModel: 'Payment',
      // ... rest of fields
    });
    
    // ... rest of method
  } catch (error) {
    console.error('❌ Error recording student rent payment:', error);
    throw error;
  }
}
```

---

## 📊 API Endpoints for Residence-Filtered Reports

### 1. Residence-Filtered Income Statement
```javascript
// GET /api/financial-reports/income-statement?period=2025&residence=residence123&basis=cash
router.get('/income-statement', async (req, res) => {
  try {
    const { period, residence, basis = 'cash' } = req.query;
    
    if (!period) {
      return res.status(400).json({
        success: false,
        message: 'Period parameter is required'
      });
    }
    
    const incomeStatement = await FinancialReportingService
      .generateResidenceFilteredIncomeStatement(period, residence, basis);
    
    res.json({
      success: true,
      data: incomeStatement
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating income statement',
      error: error.message
    });
  }
});
```

### 2. Residence-Filtered Balance Sheet
```javascript
// GET /api/financial-reports/balance-sheet?asOf=2025-12-31&residence=residence123&basis=cash
router.get('/balance-sheet', async (req, res) => {
  try {
    const { asOf, residence, basis = 'cash' } = req.query;
    
    if (!asOf) {
      return res.status(400).json({
        success: false,
        message: 'asOf parameter is required'
      });
    }
    
    const balanceSheet = await FinancialReportingService
      .generateResidenceFilteredBalanceSheet(asOf, residence, basis);
    
    res.json({
      success: true,
      data: balanceSheet
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating balance sheet',
      error: error.message
    });
  }
});
```

### 3. Residence-Filtered Cash Flow
```javascript
// GET /api/financial-reports/cash-flow?period=2025&residence=residence123&basis=cash
router.get('/cash-flow', async (req, res) => {
  try {
    const { period, residence, basis = 'cash' } = req.query;
    
    if (!period) {
      return res.status(400).json({
        success: false,
        message: 'Period parameter is required'
      });
    }
    
    const cashFlow = await FinancialReportingService
      .generateResidenceFilteredCashFlow(period, residence, basis);
    
    res.json({
      success: true,
      data: cashFlow
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating cash flow statement',
      error: error.message
    });
  }
});
```

---

## 🔧 Frontend Implementation

### 1. Residence Selection Component
```javascript
const ResidenceFilter = ({ selectedResidence, onResidenceChange }) => {
  const [residences, setResidences] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResidences = async () => {
      try {
        const response = await fetch('/api/residences');
        const data = await response.json();
        setResidences(data.residences);
      } catch (error) {
        console.error('Error fetching residences:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchResidences();
  }, []);

  return (
    <div className="residence-filter">
      <label htmlFor="residence-select">Filter by Residence:</label>
      <select
        id="residence-select"
        value={selectedResidence || ''}
        onChange={(e) => onResidenceChange(e.target.value || null)}
        disabled={loading}
      >
        <option value="">All Residences</option>
        {residences.map(residence => (
          <option key={residence._id} value={residence._id}>
            {residence.name} - {residence.address}
          </option>
        ))}
      </select>
    </div>
  );
};
```

### 2. Enhanced Financial Reports Component
```javascript
const ResidenceFilteredReports = () => {
  const [reports, setReports] = useState({
    incomeStatement: null,
    balanceSheet: null,
    cashFlow: null
  });
  const [selectedResidence, setSelectedResidence] = useState(null);
  const [year, setYear] = useState(2025);
  const [loading, setLoading] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        period: year,
        basis: 'cash'
      });
      
      if (selectedResidence) {
        params.append('residence', selectedResidence);
      }

      const [income, balance, cash] = await Promise.all([
        fetch(`/api/financial-reports/income-statement?${params}`),
        fetch(`/api/financial-reports/balance-sheet?asOf=${year}-12-31&${params}`),
        fetch(`/api/financial-reports/cash-flow?${params}`)
      ]);

      const [incomeData, balanceData, cashData] = await Promise.all([
        income.json(),
        balance.json(),
        cash.json()
      ]);

      setReports({
        incomeStatement: incomeData.data,
        balanceSheet: balanceData.data,
        cashFlow: cashData.data
      });
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [year, selectedResidence]);

  return (
    <div className="residence-filtered-reports">
      <div className="filters">
        <ResidenceFilter
          selectedResidence={selectedResidence}
          onResidenceChange={setSelectedResidence}
        />
        
        <select value={year} onChange={(e) => setYear(e.target.value)}>
          <option value={2025}>2025</option>
          <option value={2024}>2024</option>
        </select>
      </div>

      {loading ? (
        <div>Loading reports...</div>
      ) : (
        <div className="reports">
          {selectedResidence && (
            <div className="residence-info">
              <h3>Reports for: {reports.incomeStatement?.residence?.name}</h3>
              <p>Address: {reports.incomeStatement?.residence?.address}</p>
            </div>
          )}
          
          <IncomeStatement data={reports.incomeStatement} />
          <BalanceSheet data={reports.balanceSheet} />
          <CashFlow data={reports.cashFlow} />
        </div>
      )}
    </div>
  );
};
```

---

## 📋 Migration Script for Existing Data

### Add Residence Field to Existing TransactionEntries
```javascript
// migrate-add-residence-to-transactions.js
const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');
const Payment = require('./src/models/Payment');
const Expense = require('./src/models/finance/Expense');
const Invoice = require('./src/models/Invoice');

async function migrateAddResidenceToTransactions() {
  try {
    console.log('🔄 Starting residence migration for TransactionEntries...');
    
    const transactionEntries = await TransactionEntry.find({});
    console.log(`📊 Found ${transactionEntries.length} transaction entries to process`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const entry of transactionEntries) {
      try {
        let residenceId = null;
        
        // Get residence from source document
        switch (entry.sourceModel) {
          case 'Payment':
            const payment = await Payment.findById(entry.sourceId);
            if (payment && payment.residence) {
              residenceId = payment.residence;
            }
            break;
            
          case 'Expense':
            const expense = await Expense.findById(entry.sourceId);
            if (expense && expense.residence) {
              residenceId = expense.residence;
            }
            break;
            
          case 'Invoice':
            const invoice = await Invoice.findById(entry.sourceId);
            if (invoice && invoice.residence) {
              residenceId = invoice.residence;
            }
            break;
        }
        
        if (residenceId) {
          await TransactionEntry.findByIdAndUpdate(entry._id, {
            residence: residenceId
          });
          console.log(`✅ Updated entry ${entry._id} with residence ${residenceId}`);
          updatedCount++;
        } else {
          console.log(`⚠️ No residence found for entry ${entry._id}`);
          skippedCount++;
        }
        
      } catch (error) {
        console.error(`❌ Error processing entry ${entry._id}:`, error.message);
        skippedCount++;
      }
    }
    
    console.log('\n📈 Migration Summary:');
    console.log(`✅ Updated: ${updatedCount} entries`);
    console.log(`⏭️ Skipped: ${skippedCount} entries`);
    console.log(`📊 Total processed: ${transactionEntries.length} entries`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    mongoose.connection.close();
  }
}

migrateAddResidenceToTransactions();
```

---

## 🎯 Quick Implementation Steps

### Phase 1: Immediate Solution (Strategy 1)
1. **Implement enhanced queries** with population
2. **Add residence filter parameters** to existing endpoints
3. **Update frontend** to include residence selection
4. **Test with existing data**

### Phase 2: Enhanced Solution (Strategy 2)
1. **Add residence field** to TransactionEntry schema
2. **Run migration script** to populate existing data
3. **Update DoubleEntryAccountingService** to include residence
4. **Optimize queries** for better performance

### Phase 3: Advanced Features
1. **Multi-residence selection** for comparative reports
2. **Residence-specific dashboards**
3. **Export functionality** by residence
4. **Performance optimization** with indexes

This approach ensures you can immediately start filtering financial reports by residence while planning for future enhancements. 