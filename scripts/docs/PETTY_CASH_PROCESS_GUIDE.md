# Petty Cash Process Guide

## 💰 When Finance Gives Admin Petty Cash from Bank

### Overview
When finance allocates petty cash to an admin from the bank, it creates a specific double-entry accounting transaction that moves money from the bank account to the petty cash account.

---

## 🔄 Process Flow

### 1. Frontend Action (Finance User)

**Petty Cash Allocation Form:**
```javascript
// Finance user allocates petty cash to admin
const allocationData = {
  userId: "admin123", // Admin user ID
  amount: 1000, // Amount to allocate
  description: "Monthly petty cash for office supplies",
  allocatedBy: "finance@alamait.com", // Finance user
  allocationDate: "2025-01-15" // IMPORTANT: Use actual allocation date
};

// Frontend calls petty cash allocation API
const response = await fetch('/api/finance/petty-cash/allocate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(allocationData)
});
```

### 2. Backend Process

**Step 1: Finance Controller receives allocation request**
```javascript
// Finance controller validates and processes
const { userId, amount, description, allocatedBy, allocationDate } = req.body;

// Validate required fields
if (!userId || !amount || !description) {
  return res.status(400).json({
    success: false,
    message: 'User ID, amount, and description are required'
  });
}
```

**Step 2: Calls DoubleEntryAccountingService.allocatePettyCash()**
```javascript
// Creates the double-entry transaction
const result = await DoubleEntryAccountingService.allocatePettyCash(
  userId,
  amount,
  description,
  allocatedBy
);
```

### 3. Double-Entry Accounting Entries

**TransactionEntry Created:**
```javascript
{
  transactionId: "TXN2025001",
  date: "2025-01-15T00:00:00.000Z", // Allocation date
  description: "Petty cash allocation: Monthly petty cash for office supplies",
  source: "petty_cash_allocation",
  sourceId: "admin123", // Admin user ID
  sourceModel: "User",
  entries: [
    // DEBIT: Petty Cash (Asset) - Money goes INTO petty cash
    {
      accountCode: "1003", // Petty Cash account
      accountName: "Petty Cash",
      accountType: "Asset",
      debit: 1000, // Money increases petty cash
      credit: 0,
      description: "Petty cash allocated to user"
    },
    
    // CREDIT: Bank Account (Asset) - Money comes FROM bank
    {
      accountCode: "1002", // Bank account
      accountName: "Bank Account",
      accountType: "Asset",
      debit: 0,
      credit: 1000, // Money decreases bank balance
      description: "Cash withdrawn for petty cash"
    }
  ],
  totalDebit: 1000,
  totalCredit: 1000,
  createdBy: "finance@alamait.com",
  status: "posted",
  metadata: {
    pettyCashUserId: "admin123",
    allocationType: "initial"
  }
}
```

---

## 📊 Financial Impact

### Balance Sheet Effect
- **Bank Account**: Decreases by $1,000 (Credit)
- **Petty Cash Account**: Increases by $1,000 (Debit)
- **Total Assets**: No change (just reallocation)

### Cash Flow Statement Effect
- **Operating Activities**: No impact (internal transfer)
- **Investing Activities**: No impact
- **Financing Activities**: No impact

### Income Statement Effect
- **No impact** - This is an asset transfer, not income or expense

---

## 🔧 Frontend Implementation

### Petty Cash Allocation Form
```javascript
const PettyCashAllocationForm = () => {
  const [allocationData, setAllocationData] = useState({
    userId: '',
    amount: 0,
    description: '',
    allocationDate: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/finance/petty-cash/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...allocationData,
          allocatedBy: currentUser.email
        })
      });
      
      const result = await response.json();
      if (result.success) {
        alert('Petty cash allocated successfully!');
        // Refresh petty cash balances
        refreshPettyCashBalances();
      } else {
        alert(result.message);
      }
    } catch (error) {
      alert('Error allocating petty cash');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Admin user selection */}
      <select
        value={allocationData.userId}
        onChange={(e) => setAllocationData({
          ...allocationData,
          userId: e.target.value
        })}
        required
      >
        <option value="">Select Admin User</option>
        {adminUsers.map(user => (
          <option key={user._id} value={user._id}>
            {user.firstName} {user.lastName}
          </option>
        ))}
      </select>

      {/* Amount input */}
      <input
        type="number"
        value={allocationData.amount}
        onChange={(e) => setAllocationData({
          ...allocationData,
          amount: parseFloat(e.target.value)
        })}
        placeholder="Amount"
        min="0"
        step="0.01"
        required
      />

      {/* Description */}
      <textarea
        value={allocationData.description}
        onChange={(e) => setAllocationData({
          ...allocationData,
          description: e.target.value
        })}
        placeholder="Description (e.g., Monthly petty cash for office supplies)"
        required
      />

      {/* Allocation date */}
      <input
        type="date"
        value={allocationData.allocationDate}
        onChange={(e) => setAllocationData({
          ...allocationData,
          allocationDate: e.target.value
        })}
        required
      />

      <button type="submit">Allocate Petty Cash</button>
    </form>
  );
};
```

### Petty Cash Balance Display
```javascript
const PettyCashBalance = ({ userId }) => {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const response = await fetch(`/api/finance/petty-cash/balance/${userId}`);
        const data = await response.json();
        setBalance(data.balance);
        setTransactions(data.transactions);
      } catch (error) {
        console.error('Error fetching petty cash balance:', error);
      }
    };

    fetchBalance();
  }, [userId]);

  return (
    <div>
      <h3>Petty Cash Balance: ${balance.toFixed(2)}</h3>
      
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map(transaction => (
            <tr key={transaction._id}>
              <td>{new Date(transaction.date).toLocaleDateString()}</td>
              <td>{transaction.type}</td>
              <td>{transaction.description}</td>
              <td>${transaction.amount}</td>
              <td>${transaction.runningBalance}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

---

## 🔄 Related Processes

### 1. Petty Cash Replenishment
When petty cash runs low and needs to be topped up:

```javascript
// Replenish petty cash
const replenishmentData = {
  userId: "admin123",
  amount: 500, // Amount to add
  description: "Top up petty cash for emergency expenses",
  replenishedBy: "finance@alamait.com"
};

// Creates similar double-entry:
// DEBIT: Petty Cash (Asset) - Increases petty cash
// CREDIT: Bank Account (Asset) - Decreases bank balance
```

### 2. Petty Cash Expense Recording
When admin uses petty cash for expenses:

```javascript
// Record petty cash expense
const expenseData = {
  userId: "admin123",
  amount: 50,
  description: "Office supplies purchase",
  expenseCategory: "Office Supplies",
  approvedBy: "finance@alamait.com"
};

// Creates double-entry:
// DEBIT: Office Supplies Expense (Expense) - Records the expense
// CREDIT: Petty Cash (Asset) - Decreases petty cash balance
```

---

## 📋 API Endpoints

### Petty Cash Management
```javascript
// Allocate petty cash
POST /api/finance/petty-cash/allocate
{
  userId: "admin123",
  amount: 1000,
  description: "Monthly petty cash",
  allocatedBy: "finance@alamait.com"
}

// Get petty cash balance
GET /api/finance/petty-cash/balance/:userId

// Replenish petty cash
POST /api/finance/petty-cash/replenish
{
  userId: "admin123",
  amount: 500,
  description: "Top up petty cash",
  replenishedBy: "finance@alamait.com"
}

// Record petty cash expense
POST /api/finance/petty-cash/expense
{
  userId: "admin123",
  amount: 50,
  description: "Office supplies",
  expenseCategory: "Office Supplies",
  approvedBy: "finance@alamait.com"
}
```

---

## ⚠️ Important Notes

### 1. Date Handling
- **ALWAYS** use actual allocation date, not current system date
- Petty cash allocation date affects financial reports for that period

### 2. Required Fields
- `userId` - Admin user receiving petty cash
- `amount` - Amount to allocate
- `description` - Purpose of allocation
- `allocatedBy` - Finance user making allocation
- `allocationDate` - Actual date of allocation

### 3. Validation
- Ensure admin user exists and is authorized
- Validate amount is positive
- Check if allocation exceeds budget limits
- Prevent duplicate allocations

### 4. Financial Reporting
- Petty cash allocations appear in balance sheet under Assets
- No impact on income statement (asset transfer)
- Cash flow statement shows as internal transfer

### 5. Audit Trail
- All petty cash transactions are logged with:
  - Who allocated the funds
  - When it was allocated
  - Purpose of allocation
  - Amount allocated
  - Running balance tracking

This ensures complete transparency and accountability for all petty cash movements in the system. 