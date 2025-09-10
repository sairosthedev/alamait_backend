# Negotiated Payment Frontend Implementation Guide

## Overview
This guide provides the frontend code changes needed to implement negotiated payment functionality in your TransactionTracker component. The backend endpoint is already implemented and ready to use.

## Backend Endpoint
- **URL**: `POST /api/finance/transactions/create-negotiated-payment`
- **Purpose**: Handles scenarios where students negotiate to pay less than the full amount
- **Example**: Student supposed to pay $150 (from accrual) but negotiates to pay $140

## How It Works with Accrual System

The negotiated payment system works with the existing accrual system:

1. **Monthly Accrual**: The accrual service creates monthly rent accruals (e.g., $150)
   - Debit: Accounts Receivable - Student ($150)
   - Credit: Rental Income ($150)

2. **Negotiated Payment**: When student negotiates to pay less (e.g., $140)
   - Credit: Accounts Receivable - Student ($10) - reduces A/R
   - Debit: Other Income - Negotiated Discounts ($10) - records discount

3. **Final Result**: 
   - Student's A/R balance: $140 (what they actually owe)
   - Rental Income: $150 (original accrual)
   - Other Income - Negotiated Discounts: $10 (discount recorded)

## Frontend Changes Required

### 1. Update Transaction Type Options

In your TransactionTracker component, add the negotiated payment option to the transaction type select:

```javascript
// In the Create Transaction Modal, update the SelectContent:
<SelectContent>
  <SelectItem value="rental_income">📋 Rental Income (Debit: A/R, Credit: Income)</SelectItem>
  <SelectItem value="rental_payment">💰 Rental Payment (Debit: Bank, Credit: A/R)</SelectItem>
  <SelectItem value="other_income">💵 Other Income (Debit: Bank, Credit: Other Income)</SelectItem>
  <SelectItem value="expense">💸 Expense (Debit: Expense, Credit: Bank)</SelectItem>
  <SelectItem value="refund">🔄 Refund (Debit: Income, Credit: Bank)</SelectItem>
  <SelectItem value="negotiated_payment">🤝 Negotiated Payment (Debit: A/R, Credit: Rental Income + Other Income)</SelectItem>
  <SelectItem value="custom">⚙️ Custom (Select your own accounts)</SelectItem>
</SelectContent>
```

### 2. Update Form State

Add new fields to your `createFormData` state:

```javascript
const [createFormData, setCreateFormData] = useState({
  description: '',
  reference: '',
  residence: '',
  date: '',
  transactionType: 'rental_income',
  amount: '',
  originalAmount: '', // NEW: For negotiated payments
  negotiatedAmount: '', // NEW: For negotiated payments
  negotiationReason: '', // NEW: For negotiated payments
  accrualMonth: '', // NEW: Month of the original accrual
  accrualYear: '', // NEW: Year of the original accrual
  account: '',
  studentName: '',
  studentId: '',
  customDebitAccount: '',
  customCreditAccount: ''
});
```

### 3. Add Negotiated Payment UI Fields

Add these fields to your Create Transaction Modal, right after the transaction type selection:

```javascript
{/* Negotiated Payment Fields - Show only when transactionType is 'negotiated_payment' */}
{createFormData.transactionType === 'negotiated_payment' && (
  <div className="space-y-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
    <div className="flex items-center gap-2">
      <span className="text-orange-600">🤝</span>
      <h3 className="text-sm font-medium text-orange-800">Negotiated Payment Details</h3>
    </div>
    
    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label htmlFor="originalAmount">Original Amount *</Label>
        <Input
          id="originalAmount"
          type="number"
          step="0.01"
          min="0"
          value={createFormData.originalAmount}
          onChange={(e) => setCreateFormData(prev => ({ ...prev, originalAmount: e.target.value }))}
          placeholder="e.g., 150.00"
        />
      </div>
      <div>
        <Label htmlFor="negotiatedAmount">Negotiated Amount *</Label>
        <Input
          id="negotiatedAmount"
          type="number"
          step="0.01"
          min="0"
          value={createFormData.negotiatedAmount}
          onChange={(e) => setCreateFormData(prev => ({ ...prev, negotiatedAmount: e.target.value }))}
          placeholder="e.g., 140.00"
        />
      </div>
    </div>
    
    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label htmlFor="accrualMonth">Accrual Month *</Label>
        <Select 
          value={createFormData.accrualMonth} 
          onValueChange={(value) => setCreateFormData(prev => ({ ...prev, accrualMonth: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">January</SelectItem>
            <SelectItem value="2">February</SelectItem>
            <SelectItem value="3">March</SelectItem>
            <SelectItem value="4">April</SelectItem>
            <SelectItem value="5">May</SelectItem>
            <SelectItem value="6">June</SelectItem>
            <SelectItem value="7">July</SelectItem>
            <SelectItem value="8">August</SelectItem>
            <SelectItem value="9">September</SelectItem>
            <SelectItem value="10">October</SelectItem>
            <SelectItem value="11">November</SelectItem>
            <SelectItem value="12">December</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="accrualYear">Accrual Year *</Label>
        <Input
          id="accrualYear"
          type="number"
          min="2020"
          max="2030"
          value={createFormData.accrualYear}
          onChange={(e) => setCreateFormData(prev => ({ ...prev, accrualYear: e.target.value }))}
          placeholder="e.g., 2024"
        />
      </div>
    </div>
    
    <div>
      <Label htmlFor="negotiationReason">Negotiation Reason</Label>
      <Input
        id="negotiationReason"
        value={createFormData.negotiationReason}
        onChange={(e) => setCreateFormData(prev => ({ ...prev, negotiationReason: e.target.value }))}
        placeholder="e.g., Student financial hardship, Early payment discount"
      />
    </div>
    
    {/* Show discount calculation */}
    {createFormData.originalAmount && createFormData.negotiatedAmount && (
      <div className="p-3 bg-white border border-orange-300 rounded">
        <div className="text-sm">
          <div className="flex justify-between">
            <span>Original Amount:</span>
            <span className="font-medium">${parseFloat(createFormData.originalAmount || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Negotiated Amount:</span>
            <span className="font-medium">${parseFloat(createFormData.negotiatedAmount || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t pt-1 mt-1">
            <span>Discount Amount:</span>
            <span className="font-bold text-orange-600">
              ${(parseFloat(createFormData.originalAmount || 0) - parseFloat(createFormData.negotiatedAmount || 0)).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Discount %:</span>
            <span className="font-bold text-orange-600">
              {createFormData.originalAmount && createFormData.negotiatedAmount ? 
                (((parseFloat(createFormData.originalAmount) - parseFloat(createFormData.negotiatedAmount)) / parseFloat(createFormData.originalAmount)) * 100).toFixed(1) + '%' : 
                '0.0%'
              }
            </span>
          </div>
        </div>
      </div>
    )}
    
    <div className="text-xs text-orange-700 bg-orange-100 p-2 rounded">
      <strong>How this works with accrual system:</strong>
      <br />• Finds the original monthly accrual for the specified month/year
      <br />• Credit: Student's A/R Account (reduces A/R by discount amount)
      <br />• Debit: Other Income - Negotiated Discounts (records discount as income)
      <br />• <strong>Result:</strong> Student owes negotiated amount, discount is tracked separately
    </div>
  </div>
)}
```

### 4. Update Transaction Creation Logic

Update your `handleCreateTransaction` function to handle negotiated payments:

```javascript
const handleCreateTransaction = async () => {
  try {
    // Handle negotiated payment differently
    if (createFormData.transactionType === 'negotiated_payment') {
      await handleNegotiatedPayment();
      return;
    }

    // Existing logic for other transaction types...
    if (!createFormData.description || !createFormData.residence || !createFormData.amount) {
      toast.error('Description, residence, and amount are required');
      return;
    }

    const amount = parseFloat(createFormData.amount);
    if (amount <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }

    // ... rest of existing logic
  } catch (error) {
    console.error('Error creating transaction:', error);
    toast.error('Failed to create transaction');
  }
};

// New function for handling negotiated payments
const handleNegotiatedPayment = async () => {
  try {
    // Validate required fields for negotiated payment
    if (!createFormData.description || !createFormData.studentName || !createFormData.studentId || 
        !createFormData.originalAmount || !createFormData.negotiatedAmount ||
        !createFormData.accrualMonth || !createFormData.accrualYear) {
      toast.error('Description, student, original amount, negotiated amount, accrual month, and accrual year are required');
      return;
    }

    const original = parseFloat(createFormData.originalAmount);
    const negotiated = parseFloat(createFormData.negotiatedAmount);

    if (isNaN(original) || isNaN(negotiated) || original <= 0 || negotiated <= 0) {
      toast.error('Original amount and negotiated amount must be positive numbers');
      return;
    }

    if (negotiated >= original) {
      toast.error('Negotiated amount must be less than original amount');
      return;
    }

    const selectedResidence = residences.find(r => (r._id || r.id) === createFormData.residence);

    // Call the negotiated payment endpoint
    const response = await api.post('/finance/transactions/create-negotiated-payment', {
      description: createFormData.description,
      reference: createFormData.reference,
      residence: selectedResidence,
      date: createFormData.date || new Date().toISOString(),
      studentName: createFormData.studentName,
      studentId: createFormData.studentId,
      originalAmount: original,
      negotiatedAmount: negotiated,
      negotiationReason: createFormData.negotiationReason,
      residenceId: selectedResidence?._id || selectedResidence?.id,
      accrualMonth: parseInt(createFormData.accrualMonth),
      accrualYear: parseInt(createFormData.accrualYear)
    });

    if (response.data.success) {
      const discountAmount = original - negotiated;
      const discountPercentage = ((discountAmount / original) * 100).toFixed(1);
      
      toast.success(
        `Negotiated payment created successfully! ` +
        `Original: $${original.toFixed(2)}, Negotiated: $${negotiated.toFixed(2)}, ` +
        `Discount: $${discountAmount.toFixed(2)} (${discountPercentage}%)`
      );
      
      setShowCreateModal(false);
      resetCreateForm();
      fetchTransactions();
    } else {
      toast.error(response.data.message || 'Failed to create negotiated payment');
    }
  } catch (error) {
    console.error('Error creating negotiated payment:', error);
    if (error.response?.data?.message) {
      toast.error(error.response.data.message);
    } else {
      toast.error('Failed to create negotiated payment');
    }
  }
};
```

### 5. Update Form Reset Function

Update your `resetCreateForm` function to include the new fields:

```javascript
const resetCreateForm = () => {
  setCreateFormData({
    description: '',
    reference: '',
    residence: '',
    date: '',
    transactionType: 'rental_income',
    amount: '',
    originalAmount: '', // NEW
    negotiatedAmount: '', // NEW
    negotiationReason: '', // NEW
    accrualMonth: '', // NEW
    accrualYear: '', // NEW
    account: '',
    studentName: '',
    studentId: '',
    customDebitAccount: '',
    customCreditAccount: ''
  });
};
```

### 6. Update Transaction Type Mapping

Update your `getTransactionAccounts` function to handle negotiated payments:

```javascript
const getTransactionAccounts = async (transactionType, context = {}) => {
  try {
    // Handle negotiated payment
    if (transactionType === 'negotiated_payment') {
      return {
        debitAccount: '1100-{studentId}',
        debitAccountName: 'Accounts Receivable - {studentName}',
        creditAccount: '4001',
        creditAccountName: 'Rental Income',
        additionalCredits: [{
          code: '4002',
          name: 'Other Income - Negotiated Discounts'
        }]
      };
    }

    // ... existing logic for other transaction types
  } catch (error) {
    console.error('Error fetching dynamic accounts, using fallback:', error);
  }

  // ... rest of existing logic
};
```

## Example Usage

### Scenario 1: Student negotiates from $150 to $140 (August 2024)
- **Original Amount**: $150.00 (from August 2024 accrual)
- **Negotiated Amount**: $140.00
- **Discount**: $10.00 (6.7%)

**Original Accrual (August 2024):**
- Debit: Accounts Receivable - John Doe: $150.00
- Credit: Rental Income: $150.00

**Negotiated Payment Adjustment:**
- Credit: Accounts Receivable - John Doe: $10.00 (reduces A/R)
- Debit: Other Income - Negotiated Discounts: $10.00 (records discount)

**Final Result:**
- Student's A/R Balance: $140.00 (what they owe)
- Rental Income: $150.00 (original accrual)
- Other Income - Negotiated Discounts: $10.00 (discount tracked)

### Scenario 2: Student negotiates from $135 to $133 (September 2024)
- **Original Amount**: $135.00 (from September 2024 accrual)
- **Negotiated Amount**: $133.00
- **Discount**: $2.00 (1.5%)

**Original Accrual (September 2024):**
- Debit: Accounts Receivable - Jane Smith: $135.00
- Credit: Rental Income: $135.00

**Negotiated Payment Adjustment:**
- Credit: Accounts Receivable - Jane Smith: $2.00 (reduces A/R)
- Debit: Other Income - Negotiated Discounts: $2.00 (records discount)

**Final Result:**
- Student's A/R Balance: $133.00 (what they owe)
- Rental Income: $135.00 (original accrual)
- Other Income - Negotiated Discounts: $2.00 (discount tracked)

## Benefits

1. **Accrual System Integration**: Works seamlessly with existing monthly accrual system
2. **Proper Double-Entry Accounting**: All transactions are properly balanced
3. **Transparent Reporting**: Discounts are clearly tracked in "Other Income - Negotiated Discounts"
4. **Student-Specific A/R**: Each student has their own accounts receivable account
5. **Audit Trail**: Full metadata including negotiation reasons and links to original accruals
6. **Financial Statements**: Properly reflected in both Income Statement and Balance Sheet
7. **Month Tracking**: Links negotiated payments to specific accrual months for proper reporting

## Testing

After implementing these changes:

1. **Test the UI**: Verify the negotiated payment fields appear when selected
2. **Test Validation**: Ensure negotiated amount must be less than original amount
3. **Test API Call**: Verify the backend endpoint is called correctly
4. **Test Transaction Creation**: Check that the transaction appears in the Transaction Tracker
5. **Test Financial Reports**: Verify the transaction appears correctly in Income Statement and Balance Sheet

## Updated Frontend Code for Lease Start Transactions

Since some students have lease start transactions (prorated rent) instead of full monthly accruals, here's the updated code to handle both cases:

### Updated fetchOriginalARBalance Function

```javascript
// Fetch A/R balance for student for specific month
const fetchOriginalARBalance = async () => {
  if (!negotiatedPaymentData.studentId || !negotiatedPaymentData.accrualMonth || !negotiatedPaymentData.accrualYear) {
    toast.error('Please select student, month, and year first');
    return;
  }

  setLoadingAccrual(true);
  try {
    // Fetch transactions for this student
    const response = await api.get('/finance/transactions', {
      params: {
        studentId: negotiatedPaymentData.studentId,
        limit: 100
      }
    });

    if (response.data && response.data.transactions) {
      // Look for both monthly accruals AND lease start transactions
      const accrualTransaction = response.data.transactions.find(tx => {
        const txDate = new Date(tx.date);
        const txYear = txDate.getFullYear();
        const txMonth = txDate.getMonth() + 1;
        
        // Check if this transaction is for the specified month/year
        const isCorrectMonth = txYear === parseInt(negotiatedPaymentData.accrualYear) && 
                              txMonth === parseInt(negotiatedPaymentData.accrualMonth);
        
        if (!isCorrectMonth) return false;
        
        // Look for either monthly accrual or lease start
        const isMonthlyAccrual = tx.metadata?.type === 'monthly_rent_accrual' ||
                                tx.metadata?.type === 'lease_start' ||
                                tx.source === 'rental_accrual';
        
        // Check if it has the student's A/R account
        const hasStudentAR = tx.entries?.some(entry => 
          entry.accountCode === `1100-${negotiatedPaymentData.studentId}` && 
          entry.debit > 0
        );
        
        return isMonthlyAccrual && hasStudentAR;
      });

      if (accrualTransaction) {
        // Find the debit entry (what the student owes)
        const debitEntry = accrualTransaction.entries.find(entry => 
          entry.accountCode === `1100-${negotiatedPaymentData.studentId}` && 
          entry.debit > 0
        );
        
        if (debitEntry) {
          setNegotiatedPaymentData(prev => ({
            ...prev,
            originalAmount: debitEntry.debit
          }));
          
          const transactionType = accrualTransaction.metadata?.type === 'lease_start' ? 'lease start (prorated)' : 'monthly accrual';
          toast.success(`Found ${transactionType} for ${negotiatedPaymentData.accrualMonth}/${negotiatedPaymentData.accrualYear}: $${debitEntry.debit.toFixed(2)}`);
        } else {
          toast.error('Could not find accrual amount in transaction entries');
        }
      } else {
        toast.error(`No accrual found for ${negotiatedPaymentData.studentName} for ${negotiatedPaymentData.accrualMonth}/${negotiatedPaymentData.accrualYear}`);
        setNegotiatedPaymentData(prev => ({
          ...prev,
          originalAmount: 0
        }));
      }
    } else {
      toast.error(`No transactions found for ${negotiatedPaymentData.studentName}`);
      setNegotiatedPaymentData(prev => ({
        ...prev,
        originalAmount: 0
      }));
    }
  } catch (error) {
    console.error('Error fetching accrual amount:', error);
    toast.error('Failed to fetch accrual amount');
    setNegotiatedPaymentData(prev => ({
      ...prev,
      originalAmount: 0
    }));
  } finally {
    setLoadingAccrual(false);
  }
};
```

### Updated Auto-fetch Logic

```javascript
// Auto-fetch A/R balance when student, month, and year are selected
useEffect(() => {
  if (negotiatedPaymentData.studentId && 
      negotiatedPaymentData.accrualMonth && 
      negotiatedPaymentData.accrualYear && 
      negotiatedPaymentData.originalAmount === 0) {
    fetchOriginalARBalance();
  }
}, [negotiatedPaymentData.studentId, negotiatedPaymentData.accrualMonth, negotiatedPaymentData.accrualYear]);
```

### Updated Button Logic

```javascript
<Button
  type="button"
  variant="outline"
  onClick={fetchOriginalARBalance}
  disabled={!negotiatedPaymentData.studentId || !negotiatedPaymentData.accrualMonth || !negotiatedPaymentData.accrualYear || loadingAccrual}
  className="whitespace-nowrap"
>
  {loadingAccrual ? (
    <>
      <RefreshCw className="w-4 h-4 animate-spin mr-2" />
      Fetching...
    </>
  ) : (
    <>
      <RefreshCw className="w-4 h-4 mr-2" />
      Fetch Amount
    </>
  )}
</Button>
```

## Notes

- The backend automatically creates student-specific A/R accounts if they don't exist
- The backend automatically creates the "Other Income - Negotiated Discounts" account if it doesn't exist
- All transactions include comprehensive metadata for audit purposes
- The system maintains proper double-entry bookkeeping principles
- **Updated**: The system now handles both monthly accruals and lease start transactions for negotiated payments
