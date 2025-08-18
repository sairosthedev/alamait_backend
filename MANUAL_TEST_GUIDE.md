# 🔧 Manual Test Guide: Complete Maintenance Request Workflow

## 🎯 **Test Objective**
Verify the complete workflow from student creating a maintenance request to finance approval with expense creation.

## 📋 **Prerequisites**
- Backend server running on `localhost:5000`
- Frontend running on `localhost:5173` (or your frontend URL)
- Test users available in the system

## 🚀 **Step-by-Step Test Process**

### **Step 1: Student Creates Maintenance Request**

1. **Open browser** and navigate to your frontend URL
2. **Login as a student** user
3. **Navigate to** Student Dashboard → Maintenance
4. **Click "Create New Request"**
5. **Fill in the form:**
   - Issue: `Test Door Replacement`
   - Description: `Test maintenance request for workflow testing`
   - Room: `Test Room 101`
   - Category: `exterior`
   - Priority: `medium`
6. **Click "Submit Request"**
7. **Verify:** Request appears in the student's maintenance list with status "pending"

**Expected Result:** ✅ Maintenance request created successfully

---

### **Step 2: Admin Assigns Maintenance Request**

1. **Login as admin** user
2. **Navigate to** Admin Dashboard → Maintenance
3. **Find the test request** created by the student
4. **Click "Assign"** or "Update Status"
5. **Fill in assignment details:**
   - Admin Response: `Test admin assignment`
   - Status: `in-progress`
   - Assigned To: Select a vendor/staff member
6. **Click "Update"**
7. **Verify:** Request status changes to "in-progress"

**Expected Result:** ✅ Maintenance request assigned by admin

---

### **Step 3: Finance Approves Maintenance Request**

1. **Login as finance** user
2. **Navigate to** Finance → Requests
3. **Switch to "Student Maintenance" tab**
4. **Find the test request** (should show status "in-progress")
5. **Click the "Approve" button** (green checkmark icon)
6. **Fill in approval modal:**
   - Approval Amount: `150.00`
   - Maintenance Account: `5099` (should auto-select)
   - Accounts Payable Account: `2000` (should auto-select)
   - Approval Notes: `Test finance approval`
7. **Click "Approve Maintenance Request"**
8. **Verify success message** shows expense and transaction creation

**Expected Result:** ✅ Finance approval successful with expense creation

---

### **Step 4: Verify Expense Creation**

1. **Stay logged in as finance** user
2. **Navigate to** Finance → Expenses
3. **Look for the new expense** with:
   - Description: `Maintenance: Test Door Replacement - Test maintenance request for workflow testing`
   - Category: `Maintenance`
   - Amount: `$150.00`
   - Status: `Pending`
4. **Click on the expense** to view details
5. **Verify** it shows:
   - Expense ID (format: EXP-YYYY-XXX)
   - Linked maintenance request
   - Transaction reference

**Expected Result:** ✅ Expense record created and visible

---

### **Step 5: Verify Transaction Creation**

1. **Navigate to** Finance → Transactions
2. **Look for the new transaction** with:
   - Description: `Maintenance approval: Test Door Replacement`
   - Reference: `MAINT-[maintenance_request_id]`
   - Type: `approval`
   - Amount: `$150.00`
3. **Click on the transaction** to view details
4. **Verify double-entry entries:**
   - **Debit:** Maintenance Expense (5099) - $150.00
   - **Credit:** Accounts Payable (2000) - $150.00

**Expected Result:** ✅ Transaction with double-entry accounting created

---

### **Step 6: Verify Maintenance Request Status**

1. **Navigate back to** Finance → Requests → Student Maintenance
2. **Find the test request**
3. **Verify status changes:**
   - Status: `in-progress` (or as set by admin)
   - Finance Status: `approved`
   - Approve button: Should be hidden (already approved)

**Expected Result:** ✅ Maintenance request shows as finance approved

---

### **Step 7: CEO Can View Approved Request**

1. **Login as CEO** user
2. **Navigate to** CEO Dashboard → Maintenance (or relevant section)
3. **Look for the approved maintenance request**
4. **Verify** it shows:
   - Approved status
   - Finance approval details
   - Linked expense information

**Expected Result:** ✅ CEO can see approved maintenance request

---

## 🔍 **Troubleshooting Guide**

### **Issue: Approve Button Not Visible**
**Possible Causes:**
- Request already approved
- Request status is "rejected" or "completed"
- User doesn't have finance permissions

**Solutions:**
1. Check request status in the table
2. Verify user has finance role
3. Create a new test request

### **Issue: Approval Modal Not Opening**
**Possible Causes:**
- JavaScript errors in browser console
- API endpoint issues

**Solutions:**
1. Check browser console for errors
2. Verify backend is running
3. Check network tab for API calls

### **Issue: Expense Not Created**
**Possible Causes:**
- Backend approval endpoint error
- Database connection issues
- Missing required fields

**Solutions:**
1. Check backend console for errors
2. Verify all required fields in approval modal
3. Check database connection

### **Issue: Transaction Not Created**
**Possible Causes:**
- Account codes not found
- Transaction creation error

**Solutions:**
1. Verify account codes exist in system
2. Check backend logs for transaction errors
3. Ensure proper account mapping

---

## 📊 **Success Criteria Checklist**

- [ ] Student can create maintenance request
- [ ] Admin can assign maintenance request
- [ ] Finance can see pending requests
- [ ] Finance can approve requests with amount
- [ ] Approval creates expense record
- [ ] Approval creates transaction with double-entry
- [ ] Expense appears in finance expenses list
- [ ] Transaction appears in finance transactions list
- [ ] Maintenance request shows as approved
- [ ] CEO can view approved requests

---

## 🎯 **Test Data Summary**

**Test Request Details:**
- Issue: `Test Door Replacement`
- Description: `Test maintenance request for workflow testing`
- Room: `Test Room 101`
- Category: `exterior`
- Priority: `medium`
- Approval Amount: `$150.00`

**Expected Records Created:**
- 1 Maintenance Request (approved)
- 1 Expense Record (EXP-YYYY-XXX)
- 1 Transaction Record (TXN-YYYY-XXX)
- 2 Transaction Entries (debit/credit)

---

## 📝 **Notes**

- Keep this test data consistent for repeatable testing
- Document any issues found during testing
- Verify all financial records are properly linked
- Test with different amounts and categories
- Ensure audit trail is maintained throughout the process 