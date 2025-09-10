# Fix for "Unknown Student" Issue

## Problem
The frontend TransactionTracker is showing "Unknown Student" because the field mapping in the `fetchStudentAccounts` function doesn't match the actual field names returned by the debtors endpoint.

## Root Cause
The backend returns student names as separate fields:
- `debtor.user.firstName`
- `debtor.user.lastName`

But the frontend is trying to access:
- `debtor.user?.name` (which doesn't exist)

## Solution
Update the frontend `fetchStudentAccounts` function to properly map the student names.

### Current Frontend Code (Incorrect):
```javascript
const studentAccounts = debtors.map(debtor => ({
  _id: debtor._id,
  id: debtor._id,
  studentId: debtor.user?._id || debtor.user?.id,
  studentName: debtor.user?.name || debtor.user?.fullName || debtor.studentName || 'Unknown Student',
  residence: debtor.residence?.name || debtor.residenceName,
  residenceId: debtor.residence?._id || debtor.residenceId,
  currentBalance: debtor.currentBalance || 0,
  accountCode: debtor.accountCode || '1100',
  accountName: debtor.accountName || `Accounts Receivable - ${debtor.user?.name || debtor.studentName}`
}));
```

### Fixed Frontend Code:
```javascript
const studentAccounts = debtors.map(debtor => {
  // Properly construct student name from firstName and lastName
  const studentName = debtor.user?.firstName && debtor.user?.lastName 
    ? `${debtor.user.firstName} ${debtor.user.lastName}`
    : debtor.user?.firstName || debtor.user?.lastName || 'Unknown Student';
  
  return {
    _id: debtor._id,
    id: debtor._id,
    studentId: debtor.user?._id || debtor.user?.id,
    studentName: studentName,
    residence: debtor.residence?.name || debtor.residenceName,
    residenceId: debtor.residence?._id || debtor.residenceId,
    currentBalance: debtor.currentBalance || 0,
    accountCode: debtor.accountCode || '1100',
    accountName: debtor.accountName || `Accounts Receivable - ${studentName}`
  };
});
```

### Alternative: Enhanced Field Mapping with Debugging
```javascript
const studentAccounts = debtors.map(debtor => {
  // Enhanced field mapping with multiple fallbacks
  const studentName = 
    (debtor.user?.firstName && debtor.user?.lastName) 
      ? `${debtor.user.firstName} ${debtor.user.lastName}`
      : debtor.user?.firstName || 
        debtor.user?.lastName || 
        debtor.user?.name || 
        debtor.user?.fullName || 
        debtor.studentName || 
        debtor.contactInfo?.name ||
        'Unknown Student';
      
  const residenceName = 
    debtor.residence?.name || 
    debtor.residenceName || 
    debtor.residence?.residenceName || 
    debtor.residence?.title || 
    'Unknown Residence';
    
  const studentId = 
    debtor.user?._id || 
    debtor.user?.id || 
    debtor.studentId || 
    debtor.student?._id || 
    debtor.student?.id;
    
  const residenceId = 
    debtor.residence?._id || 
    debtor.residence?.id || 
    debtor.residenceId;
  
  // Debug: Log the mapping process
  console.log('📋 Mapped student:', {
    originalFirstName: debtor.user?.firstName,
    originalLastName: debtor.user?.lastName,
    mappedName: studentName,
    originalResidence: debtor.residence?.name,
    mappedResidence: residenceName
  });
  
  return {
    _id: debtor._id,
    id: debtor._id,
    studentId: studentId,
    studentName: studentName,
    residence: residenceName,
    residenceId: residenceId,
    currentBalance: debtor.currentBalance || 0,
    accountCode: debtor.accountCode || '1100',
    accountName: debtor.accountName || `Accounts Receivable - ${studentName}`
  };
});
```

## How to Apply the Fix

1. **Open your frontend TransactionTracker component**
2. **Find the `fetchStudentAccounts` function**
3. **Replace the student name mapping logic** with the fixed version above
4. **Save the file**
5. **Refresh the Transaction Tracker page**
6. **Click the "Refresh" button** next to "Student (Accounts Receivable)"

## Expected Result
After applying this fix, you should see:
- ✅ Actual student names instead of "Unknown Student"
- ✅ Proper residence names
- ✅ Console logs showing the mapping process (if using the enhanced version)

## Debugging
If you're still seeing "Unknown Student" after the fix:
1. **Check the browser console** for the mapping logs
2. **Look for the "📋 Mapped student:" logs** to see what data is being received
3. **Share the console output** so we can identify any remaining field mapping issues

The enhanced version includes comprehensive debugging that will show exactly what field names the API is using, making it easy to fix any remaining mapping issues.
