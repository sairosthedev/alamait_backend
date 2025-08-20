# Application Code Mapping System

## Overview

The Application Code Mapping System ensures that when students register with an application code, they are automatically linked to their corresponding applications, and debtors are created when students register with approved applications.

## 🔄 **Correct Flow**

### **1. Application Creation (Admin/Public)**
```
Admin creates application → Application status: "pending" (NO applicationCode yet)
```

### **2. Admin Approval**
```
Admin approves application → Application gets applicationCode + status: "approved" (NO debtor yet)
```

### **3. Student Registration**
```
Student registers with applicationCode → System links user ID to application → Creates debtor
```

### **4. Debtor Creation**
```
Debtor created automatically when student registers with approved application
```

## 🏗️ **How It Works**

### **A. Application Approval (Admin)**

When an admin approves an application:

```javascript
// In src/controllers/admin/applicationController.js
case 'approve':
    application.status = 'approved';
    // Generate application code and approve
    // NO debtor created yet - only when student registers
```

### **B. Student Registration with Application Code**

When a student registers with an `applicationCode`:

```javascript
// In src/controllers/auth/authController.js
const { email, password, firstName, lastName, phone, applicationCode } = req.body;

// Create new user with application code
user = new User({
    email,
    firstName,
    lastName,
    phone,
    password,
    applicationCode,  // ← Application code from registration
    role: 'student',
    isVerified: true
});
```

### **C. Auto-Linking Middleware (User Model)**

The User model automatically links to existing applications AND creates debtors:

```javascript
// In src/models/User.js - post-save middleware
userSchema.post('save', async function(doc) {
    if (this.isNew) {
        // Find applications with matching email OR application code
        const applicationsToLink = await Application.find({
            $and: [
                {
                    $or: [
                        { email: this.email },           // ← Match by email
                        { applicationCode: this.applicationCode }  // ← Match by application code
                    ]
                },
                {
                    $or: [
                        { student: { $exists: false } },
                        { student: null },
                        { student: undefined }
                    ]
                }
            ]
        });
        
        // Link applications to user
        for (const application of applicationsToLink) {
            application.student = this._id;
            await application.save();
            
            // If approved, create debtor NOW (when student registers)
            if (application.status === 'approved') {
                // Create debtor with complete application data
                const debtor = await createDebtorForStudent(this, {
                    createdBy: this._id,
                    residenceId: application.residence,
                    roomNumber: application.allocatedRoom,
                    startDate: application.startDate,
                    endDate: application.endDate,
                    application: application._id,
                    applicationCode: application.applicationCode
                });
                
                // Link debtor back to application
                application.debtor = debtor._id;
                await application.save();
            }
        }
    }
});
```

### **D. Debtor Creation with Application Data**

The debtor service creates debtors with complete application information:

```javascript
// In src/services/debtorService.js
const debtorData = {
    debtorCode,
    user: user._id,
    accountCode,
    // ... other fields ...
    
    // Application linking
    application: options.application,           // ← Application ID
    applicationCode: options.applicationCode,  // ← Application code
    
    // Financial data from application
    startDate: options.startDate,
    endDate: options.endDate,
    roomPrice: options.roomPrice,
    residence: options.residenceId,
    roomNumber: options.roomNumber
};
```

## 🛠️ **Scripts Available**

### **1. Map All Application Codes**
```bash
npm run map-application-codes
```
- Maps ALL users with application codes to their applications
- Creates debtors for approved applications
- Updates existing debtors with application links

### **2. Fix Specific User (Macdonald)**
```bash
npm run fix-macdonald-mapping
```
- Specifically fixes Macdonald Sairos' application mapping
- Creates debtor if application is approved
- Links everything properly

### **3. Debug Application-Debtor Relationship**
```bash
npm run debug-application-debtor <applicationId>
```
- Debug why a specific application doesn't have a debtor
- Shows all the linking information

## 🔍 **Verification Points**

### **Check Application Has Student Field**
```javascript
// Application should have:
{
    _id: "application_id",
    student: "user_id",           // ← Should be set when student registers
    applicationCode: "APP123...", // ← Should be set when admin approves
    status: "approved"
}
```

### **Check Debtor Has Application Link**
```javascript
// Debtor should have:
{
    _id: "debtor_id",
    user: "user_id",
    application: "application_id",     // ← Should be set
    applicationCode: "APP123...",      // ← Should be set
    debtorCode: "DR0001"
}
```

### **Check User Has Application Code**
```javascript
// User should have:
{
    _id: "user_id",
    email: "student@email.com",
    applicationCode: "APP123...",      // ← Should be set
    role: "student"
}
```

## 🚨 **Common Issues & Solutions**

### **Issue 1: Application Missing Student Field**
**Cause**: Student hasn't registered yet with the application code
**Solution**: Student needs to register with the application code

### **Issue 2: Debtor Missing Application Link**
**Cause**: Debtor created before application approval
**Solution**: Run `npm run map-application-codes` to update existing debtors

### **Issue 3: No Debtor Created**
**Cause**: Student hasn't registered or application not approved
**Solution**: Ensure student registers with correct application code

## ✅ **Benefits of This System**

1. **Proper Flow**: Debtors only created when students actually register
2. **Complete Data**: Debtors have all application information
3. **Audit Trail**: Full traceability from application to debtor
4. **Error Prevention**: Prevents orphaned applications or debtors
5. **Student-Driven**: Debtors created when students are ready

## 🔧 **Maintenance**

- Run `npm run map-application-codes` periodically to catch any missed mappings
- Use debug scripts to troubleshoot specific issues
- Monitor logs for auto-linking success/failures
