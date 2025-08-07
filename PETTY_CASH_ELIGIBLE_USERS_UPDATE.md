# Petty Cash Eligible Users - Complete Update

## ✅ **UPDATED ELIGIBLE ROLES**

The petty cash system now supports the following eligible roles for petty cash allocation:

### **🎯 Complete List of Eligible Roles:**

1. **`admin`** - Admin users
2. **`admin_assistant`** - Admin assistants  
3. **`ceo_assistant`** - CEO assistants
4. **`finance_assistant`** - Finance assistants
5. **`finance_admin`** - Finance administrators
6. **`finance_user`** - Finance users
7. **`property_manager`** - Property managers
8. **`maintenance`** - Maintenance staff
9. **`manager`** - General managers
10. **`staff`** - General staff

---

## 💰 **Role-Based Petty Cash Account Mapping**

### **Account 1011 - Admin Petty Cash**
**Eligible Roles:**
- `admin`
- `admin_assistant` 
- `ceo_assistant`

**Purpose:** All administrative and executive assistant expenses

### **Account 1012 - Finance Petty Cash**
**Eligible Roles:**
- `finance_admin`
- `finance_user`
- `finance_assistant`

**Purpose:** All finance-related expenses

### **Account 1013 - Property Manager Petty Cash**
**Eligible Roles:**
- `property_manager`

**Purpose:** Property management expenses

### **Account 1014 - Maintenance Petty Cash**
**Eligible Roles:**
- `maintenance`

**Purpose:** Maintenance and repair expenses

### **Account 1010 - General Petty Cash**
**Eligible Roles:**
- `manager`
- `staff`
- Any other role not specifically mapped

**Purpose:** General operational expenses

---

## 🔧 **Implementation Details**

### **Updated Files:**

#### **1. Eligible Users Endpoint** (`src/routes/finance/index.js`)
```javascript
// Get users who are eligible for petty cash (not students/tenants)
const eligibleUsers = await User.find({
    role: { 
        $in: [
            'admin', 
            'admin_assistant', 
            'ceo_assistant', 
            'finance_assistant',
            'finance_admin', 
            'finance_user', 
            'property_manager', 
            'maintenance', 
            'manager', 
            'staff'
        ] 
    },
    status: 'active'
})
```

#### **2. Petty Cash Account Mapping** (`src/utils/pettyCashUtils.js`)
```javascript
const getPettyCashAccountByRole = async (userRole) => {
    let accountCode = '1010'; // Default to General Petty Cash
    
    switch (userRole) {
        case 'admin':
        case 'admin_assistant':
        case 'ceo_assistant':
            accountCode = '1011'; // Admin Petty Cash
            break;
        case 'finance_admin':
        case 'finance_user':
        case 'finance_assistant':
            accountCode = '1012'; // Finance Petty Cash
            break;
        case 'property_manager':
            accountCode = '1013'; // Property Manager Petty Cash
            break;
        case 'maintenance':
            accountCode = '1014'; // Maintenance Petty Cash
            break;
        default:
            accountCode = '1010'; // General Petty Cash
    }
    
    const account = await Account.findOne({ code: accountCode });
    return account;
};
```

---

## 📊 **API Endpoints**

### **Get Eligible Users**
```http
GET /api/finance/eligible-users-for-petty-cash
```

**Response:**
```json
{
  "success": true,
  "eligibleUsers": [
    {
      "_id": "user_id",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@alamait.com",
      "role": "admin",
      "status": "active"
    }
  ],
  "total": 25
}
```

### **Allocate Petty Cash**
```http
POST /api/finance/allocate-petty-cash
{
  "userId": "user_id",
  "amount": 500,
  "description": "Monthly petty cash allocation"
}
```

---

## 🎯 **Benefits of This Update**

### **1. Comprehensive Coverage**
- All administrative roles are now eligible
- Executive assistants can receive petty cash
- Finance assistants are properly supported
- General staff and managers are included

### **2. Proper Account Mapping**
- Each role type uses the appropriate petty cash account
- Better financial tracking and reporting
- Clear separation of expenses by department/role

### **3. Double-Entry Transactions**
- All petty cash allocations create proper double-entry transactions
- Transactions are visible in the user's account
- Full audit trail maintained

---

## 🔍 **Testing the Updates**

### **Test Eligible Users Endpoint**
```bash
curl -X GET http://localhost:3000/api/finance/eligible-users-for-petty-cash \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### **Test Petty Cash Allocation**
```bash
curl -X POST http://localhost:3000/api/finance/allocate-petty-cash \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_id",
    "amount": 300,
    "description": "Test allocation for admin assistant"
  }'
```

---

## ✅ **Summary**

**All requested roles are now eligible for petty cash:**

✅ **`admin`** - Already included  
✅ **`admin_assistant`** - Added  
✅ **`ceo_assistant`** - Added  
✅ **`finance_assistant`** - Added  

**Plus existing roles:**
✅ `finance_admin`, `finance_user`  
✅ `property_manager`, `maintenance`  
✅ `manager`, `staff`  

**All petty cash allocations now create proper double-entry transactions that are visible in the user's account!** 🎉
