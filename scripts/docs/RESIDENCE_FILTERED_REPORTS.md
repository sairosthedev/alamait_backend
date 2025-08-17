# Residence-Filtered Financial Reports

## 🏢 How to Fetch Financial Reports by Residence

### Current Situation
The `TransactionEntry` model doesn't have a direct `residence` field, but residence info is available through source documents (Payment, Expense, Invoice).

### Solution: Enhanced Queries with Population

```javascript
// Enhanced financial reports with residence filtering
static async generateResidenceFilteredIncomeStatement(period, residenceId, basis = 'cash') {
  const startDate = new Date(`${period}-01-01`);
  const endDate = new Date(`${period}-12-31`);
  
  // Get transaction entries with populated source documents
  const transactionEntries = await TransactionEntry.find({
    date: { $gte: startDate, $lte: endDate }
  })
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
    expenses
  };
}
```

### API Endpoints

```javascript
// GET /api/financial-reports/income-statement?period=2025&residence=residence123&basis=cash
// GET /api/financial-reports/balance-sheet?asOf=2025-12-31&residence=residence123&basis=cash
// GET /api/financial-reports/cash-flow?period=2025&residence=residence123&basis=cash
```

### Frontend Implementation

```javascript
const ResidenceFilteredReports = () => {
  const [selectedResidence, setSelectedResidence] = useState(null);
  const [year, setYear] = useState(2025);

  const fetchReports = async () => {
    const params = new URLSearchParams({
      period: year,
      basis: 'cash'
    });
    
    if (selectedResidence) {
      params.append('residence', selectedResidence);
    }

    const response = await fetch(`/api/financial-reports/income-statement?${params}`);
    const data = await response.json();
    // Handle response
  };

  return (
    <div>
      <select value={selectedResidence || ''} onChange={(e) => setSelectedResidence(e.target.value || null)}>
        <option value="">All Residences</option>
        {residences.map(residence => (
          <option key={residence._id} value={residence._id}>
            {residence.name}
          </option>
        ))}
      </select>
      
      {/* Display filtered reports */}
    </div>
  );
};
```

### Future Enhancement: Add Residence Field

```javascript
// Add to TransactionEntry schema
residence: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Residence',
  required: false
}

// Update DoubleEntryAccountingService
const transactionEntry = new TransactionEntry({
  // ... existing fields
  residence: payment.residence, // Add residence reference
  // ... rest of fields
});
```

This approach allows immediate residence filtering while planning for future optimizations. 