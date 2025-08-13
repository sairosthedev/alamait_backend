# 🎓 Automatic Account Creation System

## 📋 Overview

This system automatically creates individual financial accounts for students and tenants when they are registered as users in the system. This ensures that every student and tenant has their own account for financial tracking and management.

## 🚀 Features

### ✅ **Automatic Account Creation**
- **Student Accounts**: Created automatically when `role === 'student'`
- **Tenant Accounts**: Created automatically when `role === 'tenant'`
- **Unique Account Codes**: Auto-generated codes (STU000001, TEN000001)
- **Chart of Accounts Integration**: Automatically added to chart of accounts

### ✅ **Backward Compatibility**
- **Existing Users**: Not affected by the new system
- **Manual Creation**: Still possible through API endpoints
- **Error Handling**: Account creation failures don't prevent user registration

### ✅ **Flexible Implementation**
- **Admin Creation**: Works when admins manually create users
- **Student Registration**: Works when students apply and get approved
- **Tenant Registration**: Works when tenants are added to the system

## 📊 Account Types

### **Student Accounts**
```javascript
{
  student: ObjectId,           // Reference to User
  accountCode: "STU000001",    // Auto-generated
  accountName: "Student Account - STU000001",
  balance: 0,                  // Current balance
  status: "active",            // active/inactive/suspended
  createdBy: ObjectId,         // Who created the account
  createdAt: Date,
  updatedAt: Date
}
```

### **Tenant Accounts**
```javascript
{
  tenant: ObjectId,            // Reference to User
  accountCode: "TEN000001",    // Auto-generated
  accountName: "Tenant Account - TEN000001",
  balance: 0,                  // Current balance
  status: "active",            // active/inactive/suspended
  createdBy: ObjectId,         // Who created the account
  createdAt: Date,
  updatedAt: Date
}
```

## 🔧 Implementation Details

### **User Model Integration**
The `User` model now includes:

1. **Pre-save Middleware**: Automatically triggers account creation
2. **createStudentAccount() Method**: Creates student accounts
3. **createTenantAccount() Method**: Creates tenant accounts

### **Automatic Triggers**
```javascript
// When a new user is created with role 'student'
if (this.role === 'student') {
    await this.createStudentAccount();
}

// When a new user is created with role 'tenant'
if (this.role === 'tenant') {
    await this.createTenantAccount();
}
```

## 📡 Usage Scenarios

### **Scenario 1: Student Application Approval**
```javascript
// When admin approves a student application
const newStudent = new User({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    role: 'student',
    // ... other fields
});

await newStudent.save();
// ✅ Student account automatically created!
```

### **Scenario 2: Admin Creates Tenant**
```javascript
// When admin manually creates a tenant
const newTenant = new User({
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@example.com',
    role: 'tenant',
    // ... other fields
});

await newTenant.save();
// ✅ Tenant account automatically created!
```

### **Scenario 3: Student Self-Registration**
```javascript
// When student applies through the application system
const studentApplication = {
    firstName: 'Mike',
    lastName: 'Johnson',
    email: 'mike.johnson@example.com',
    // ... other application fields
};

// After approval, user is created
const approvedStudent = new User({
    ...studentApplication,
    role: 'student'
});

await approvedStudent.save();
// ✅ Student account automatically created!
```

## 🔐 Error Handling

### **Graceful Failure**
- **Account Creation Fails**: User creation still succeeds
- **Duplicate Accounts**: System checks and skips creation
- **Model Not Found**: System logs warning and continues

### **Error Logging**
```javascript
// Example error handling
try {
    await this.createStudentAccount();
} catch (error) {
    console.error(`❌ Error creating student account for ${this.firstName} ${this.lastName}:`, error);
    // Don't throw error to prevent user creation from failing
    return null;
}
```

## 📈 Benefits

### **For Finance Team**
- **Automatic Setup**: No manual account creation needed
- **Consistent Structure**: All accounts follow same format
- **Immediate Availability**: Accounts ready for transactions
- **Reduced Errors**: No missing accounts for new users

### **For System Administrators**
- **Streamlined Process**: One-step user and account creation
- **Audit Trail**: Complete tracking of account creation
- **Flexibility**: Works with existing user creation workflows
- **Scalability**: Handles growing user base automatically

### **For Users**
- **Immediate Access**: Accounts available as soon as they're created
- **Transparency**: Clear account codes and balances
- **Consistency**: Same account structure for all users

## 🛠️ Technical Implementation

### **Files Modified**
1. **`src/models/User.js`**: Added pre-save middleware and account creation methods
2. **`src/models/TenantAccount.js`**: New model for tenant accounts
3. **`src/models/StudentAccount.js`**: Existing model (no changes needed)

### **Database Changes**
- **New Collection**: `tenantaccounts` for tenant accounts
- **Indexes**: Added for efficient queries
- **References**: Proper ObjectId references to users

### **API Compatibility**
- **Existing Endpoints**: Continue to work unchanged
- **New Endpoints**: Available for tenant account management
- **Frontend Integration**: No changes required

## 🔄 Migration Strategy

### **Phase 1: Implementation (Complete)**
- ✅ Added automatic account creation to User model
- ✅ Created TenantAccount model
- ✅ Added error handling and logging
- ✅ Maintained backward compatibility

### **Phase 2: Testing**
1. **Test Student Creation**: Verify student accounts are created
2. **Test Tenant Creation**: Verify tenant accounts are created
3. **Test Error Scenarios**: Verify graceful failure handling
4. **Test Existing Users**: Verify no impact on existing data

### **Phase 3: Monitoring**
1. **Log Analysis**: Monitor account creation logs
2. **Error Tracking**: Track any creation failures
3. **Performance**: Monitor impact on user creation speed
4. **User Feedback**: Gather feedback on the new system

## ⚠️ Important Notes

### **Account Code Generation**
- **Student Codes**: `STU` + 6 digits (e.g., STU000001)
- **Tenant Codes**: `TEN` + 6 digits (e.g., TEN000001)
- **Uniqueness**: Guaranteed through database constraints
- **Sequential**: Codes are generated sequentially

### **Chart of Accounts Integration**
- **Automatic Creation**: Chart of accounts entries created automatically
- **Asset Classification**: All user accounts classified as assets
- **Naming Convention**: "Student/Tenant Account - [Name]"
- **Code Matching**: Chart code matches account code

### **Error Recovery**
- **Manual Creation**: Can still create accounts manually if needed
- **Duplicate Prevention**: System prevents duplicate accounts
- **Logging**: All actions logged for debugging
- **Graceful Degradation**: System continues working even if account creation fails

## 📞 Support

### **Troubleshooting**
1. **Check Logs**: Look for account creation messages
2. **Verify Models**: Ensure all models are properly imported
3. **Database Connection**: Verify database connectivity
4. **Permissions**: Check user permissions for account creation

### **Common Issues**
- **Account Not Created**: Check if user role is correct
- **Duplicate Error**: Account already exists (normal behavior)
- **Model Not Found**: Check if TenantAccount model is imported
- **Database Error**: Check database connection and permissions

---

**The automatic account creation system is now active and will create accounts for all new students and tenants! 🎉** 