# 🎓 Individual Student Accounts System

## 📋 Overview

This system allows you to create individual financial accounts for each student while maintaining compatibility with your existing payment system. Each student gets their own account with a unique code and balance tracking.

## 🚀 Features

### ✅ **Individual Account Tracking**
- **Unique Account Codes**: Each student gets a unique code (e.g., `STU000001`)
- **Balance Tracking**: Real-time balance updates
- **Transaction History**: Complete audit trail
- **Account Status**: Active, inactive, or suspended

### ✅ **Chart of Accounts Integration**
- **Automatic Creation**: Student accounts are automatically added to your chart of accounts
- **Asset Classification**: All student accounts are classified as assets
- **Double-Entry Ready**: Compatible with your existing transaction system

### ✅ **Backward Compatibility**
- **Existing System Unchanged**: Your current payment system continues to work
- **Gradual Migration**: You can migrate students one by one
- **No Breaking Changes**: All existing functionality remains intact

## 📊 Account Structure

### **Student Account Model**
```javascript
{
  student: ObjectId,           // Reference to User
  accountCode: "STU000001",    // Auto-generated unique code
  accountName: "Student Account - STU000001",
  balance: 0,                  // Current balance
  totalDebits: 0,             // Total debits
  totalCredits: 0,            // Total credits
  status: "active",           // active/inactive/suspended
  notes: "Optional notes",
  createdBy: ObjectId,        // Who created the account
  createdAt: Date,
  updatedAt: Date
}
```

### **Chart of Accounts Entry**
```javascript
{
  code: "STU000001",          // Same as student account code
  name: "Student Account - John Doe",
  type: "Asset"               // Always Asset type
}
```

## 🔧 Implementation Steps

### **Step 1: Run Migration (Optional)**
Create accounts for existing students:
```bash
node scripts/create-student-accounts.js
```

### **Step 2: Create Account for New Student**
```javascript
// API Call
POST /api/finance/student-accounts
{
  "studentId": "student_id_here",
  "initialBalance": 0,
  "notes": "Optional notes"
}
```

### **Step 3: View Student Account**
```javascript
// API Call
GET /api/finance/student-accounts/:studentId
```

## 📡 API Endpoints

### **Create Student Account**
```http
POST /api/finance/student-accounts
Authorization: Bearer <token>
Content-Type: application/json

{
  "studentId": "507f1f77bcf86cd799439011",
  "initialBalance": 0,
  "notes": "Account created for new student"
}
```

### **Get All Student Accounts**
```http
GET /api/finance/student-accounts?status=active&search=john
Authorization: Bearer <token>
```

### **Get Individual Student Account**
```http
GET /api/finance/student-accounts/:studentId
Authorization: Bearer <token>
```

### **Get Student Account Summary**
```http
GET /api/finance/student-accounts/:studentId/summary
Authorization: Bearer <token>
```

### **Update Student Account**
```http
PUT /api/finance/student-accounts/:studentId
Authorization: Bearer <token>
Content-Type: application/json

{
  "balance": 500,
  "status": "active",
  "notes": "Updated balance"
}
```

## 🔐 Security & Permissions

### **Role-Based Access**
- **Finance Roles**: `finance`, `finance_admin`, `finance_user`
- **Admin Role**: `admin`
- **Students**: Cannot access account management

### **Authentication Required**
- All endpoints require valid JWT token
- Role verification on all operations

## 📈 Usage Examples

### **Frontend Integration (React)**
```javascript
// Create student account
const createStudentAccount = async (studentId) => {
  const response = await fetch('/api/finance/student-accounts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      studentId,
      initialBalance: 0,
      notes: 'Account created via frontend'
    })
  });
  return response.json();
};

// Get student account summary
const getStudentAccountSummary = async (studentId) => {
  const response = await fetch(`/api/finance/student-accounts/${studentId}/summary`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};
```

### **Account Management Dashboard**
```javascript
// Get all student accounts with search
const getAllStudentAccounts = async (search = '', status = '') => {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (status) params.append('status', status);
  
  const response = await fetch(`/api/finance/student-accounts?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};
```

## 🔄 Migration Strategy

### **Phase 1: Setup (Complete)**
- ✅ Create StudentAccount model
- ✅ Create management controller
- ✅ Add API routes
- ✅ Create migration script

### **Phase 2: Gradual Migration**
1. **Run migration script** for existing students
2. **Create accounts** for new students automatically
3. **Test with small group** of students
4. **Monitor** account balances and transactions

### **Phase 3: Full Integration (Future)**
1. **Update payment system** to use individual accounts
2. **Modify transaction creation** to use student-specific accounts
3. **Add balance validation** for payments
4. **Implement account statements**

## 🎯 Benefits

### **For Finance Team**
- **Individual Tracking**: See each student's financial status
- **Better Reporting**: Generate student-specific reports
- **Account Management**: Manage student accounts independently
- **Audit Trail**: Complete transaction history per student

### **For Students**
- **Transparency**: Clear view of their account balance
- **Payment History**: Track all payments and charges
- **Account Status**: Know if their account is active/suspended

### **For System**
- **Scalability**: Handle growing number of students
- **Flexibility**: Support different account types
- **Compliance**: Better financial record keeping
- **Integration**: Ready for advanced features

## ⚠️ Important Notes

### **Current System Compatibility**
- **Existing payments continue to work** with general account `1100`
- **New individual accounts are separate** from the general system
- **No automatic migration** of existing payment data
- **Manual balance adjustment** may be needed for existing students

### **Future Considerations**
- **Payment System Update**: Modify payment controller to use individual accounts
- **Balance Validation**: Check student account balance before accepting payments
- **Account Statements**: Generate monthly/quarterly statements
- **Overdue Tracking**: Track overdue balances per student

## 🛠️ Troubleshooting

### **Common Issues**

**Account Already Exists**
```
Error: Student account already exists
```
**Solution**: Check if account exists before creating

**Student Not Found**
```
Error: Student not found
```
**Solution**: Verify student ID and role

**Permission Denied**
```
Error: Access denied
```
**Solution**: Check user role and permissions

### **Database Queries**

**Find Student Account**
```javascript
const account = await StudentAccount.findOne({ student: studentId });
```

**Get All Active Accounts**
```javascript
const accounts = await StudentAccount.find({ status: 'active' });
```

**Search by Student Name**
```javascript
const accounts = await StudentAccount.find()
  .populate('student', 'firstName lastName email')
  .then(accounts => accounts.filter(acc => 
    acc.student.firstName.toLowerCase().includes('john')
  ));
```

## 📞 Support

For questions or issues with the individual student accounts system:
1. Check the API documentation
2. Review the migration logs
3. Contact the development team

---

**The individual student accounts system is now ready for use! 🎉** 