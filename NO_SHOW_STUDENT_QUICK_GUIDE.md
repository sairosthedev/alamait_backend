# 🚫 No-Show Student Quick Guide

## The Problem
Student applies for September lease, pays in July/August, doesn't show up, gets replaced by another student. **No refund issued.**

## The Solution
Two approaches to handle this scenario:

---

## 🎯 **Approach 1: All-in-One API Call (Recommended)**

**When to use:** You have the replacement student details ready

### Step 1: Call the No-Show API with Replacement Details
```bash
POST /api/finance/transactions/handle-no-show-payment
{
  "studentId": "64f1a2b3c4d5e6f7g8h9i0j1",
  "studentName": "John Smith",
  "paymentId": "64f1a2b3c4d5e6f7g8h9i0j2",
  "originalPaymentAmount": 500,
  "reason": "Student no-show for September lease start",
  "replacementStudentId": "64f1a2b3c4d5e6f7g8h9i0j3",
  "replacementStudentName": "Jane Doe",
  "residenceId": "64f1a2b3c4d5e6f7g8h9i0j4"
}
```

### What Happens Automatically:
✅ **Payment forfeited** → Becomes business income  
✅ **Room freed** → Made available for replacement  
✅ **Replacement assigned** → Automatically gets the freed room  
✅ **Accounting updated** → All transactions recorded  

---

## 🎯 **Approach 2: Two-Step Process**

**When to use:** You want to add replacement through your existing "Add Students" functionality

### Step 1: Process No-Show (Free the Room)
```bash
POST /api/finance/transactions/handle-no-show-payment
{
  "studentId": "64f1a2b3c4d5e6f7g8h9i0j1",
  "studentName": "John Smith",
  "paymentId": "64f1a2b3c4d5e6f7g8h9i0j2",
  "originalPaymentAmount": 500,
  "reason": "Student no-show for September lease start",
  "residenceId": "64f1a2b3c4d5e6f7g8h9i0j4"
  // Note: No replacement student details
}
```

### What Happens:
✅ **Payment forfeited** → Becomes business income  
✅ **Room freed** → Made available for new assignment  
❌ **No replacement assigned** → Room is just available  

### Step 2: Add Replacement Through Admin Panel
- Use your existing "Add Students" functionality
- The room is now available for assignment
- Process replacement student normally
- They pay their own rent/deposit

---

## 📊 **Accounting Impact**

**Correct Accounting Treatment (Prevents Double-Counting):**

### If Rental Income Was Already Accrued:
```
Step 1: Dr. Rental Income - School Accommodation    $500
            Cr. Accounts Receivable - Student    $500

Step 2: Dr. Forfeited Deposits Income    $500
            Cr. Accounts Receivable - Student    $500
```

### If No Rental Income Was Accrued Yet:
```
Dr. Forfeited Deposits Income    $500
    Cr. Accounts Receivable - Student    $500
```

**Net Result:**
- ✅ **No double-counting** of income
- ✅ **Accurate reflection** that no rental service was provided
- ✅ **Forfeited payment** becomes legitimate business income
- ✅ **Student's A/R balance** reduced to zero
- ✅ **Room becomes available** for replacement

---

## 🏠 **Room Status After Processing**

| Room Occupancy | Room Status | Available For |
|----------------|-------------|---------------|
| 0 | `available` | New student assignment |
| 1+ (but < capacity) | `reserved` | Additional occupants |
| At capacity | `occupied` | No more occupants |

---

## 🚀 **Quick Start**

### For Approach 1 (All-in-One):
```bash
# Run the example
node examples/no-show-student-example.js 1
```

### For Approach 2 (Two-Step):
```bash
# Run the example
node examples/no-show-student-example.js 2
```

---

## ✅ **Benefits**

- **Proper Accounting**: Maintains double-entry principles
- **No Refund Liability**: Payment becomes income, not liability
- **Room Management**: Automatically frees up rooms
- **Flexible Replacement**: Works with existing admin panel
- **Audit Trail**: Complete transaction history
- **Business Policy Aligned**: No refunds as per your policy

---

## 🔧 **Integration**

This solution works seamlessly with your existing:
- Double-entry accounting system
- Room management system
- Student application system
- Admin panel "Add Students" functionality
- Financial reporting
- Audit logging

**The system handles everything automatically while maintaining data integrity and compliance.**
