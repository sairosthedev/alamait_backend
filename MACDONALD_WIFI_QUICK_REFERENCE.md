# 🔧 **MacDonald WiFi Request - Quick Reference**

## 📋 **Request Details**
- **Requestor**: MacDonald
- **Service**: WiFi fixing
- **Amount**: R2,500
- **Status**: ✅ Approved & Paid
- **Payment Method**: Bank Transfer

---

## 🏦 **Accounts Involved**

| Account | Code | Type | Purpose | Impact |
|---------|------|------|---------|---------|
| **Maintenance Expenses** | `5000` | Expense | Record WiFi cost | +R2,500 |
| **Accounts Payable - MacDonald** | `200001` | Liability | Money owed to vendor | +R2,500 → R0 |
| **Bank Account** | `1001` | Asset | Payment source | -R2,500 |

---

## 💰 **Accounting Entries**

### **When Approved:**
```
Dr. Maintenance Expenses (5000)        R2,500.00
Cr. Accounts Payable - MacDonald (200001)  R2,500.00
```

### **When Paid:**
```
Dr. Accounts Payable - MacDonald (200001)  R2,500.00
Cr. Bank Account (1001)               R2,500.00
```

---

## 📊 **Financial Impact**

### **Income Statement:**
- Maintenance Expenses: +R2,500
- Net Income: -R2,500

### **Balance Sheet:**
- Bank Account: -R2,500
- Accounts Payable: No change (paid off)

### **Cash Flow:**
- Operating Activities: -R2,500 (payment)

---

## 🔍 **System Queries**

```javascript
// Check vendor balance
const vendor = await Vendor.findOne({ 
  'contactPerson.email': 'macdonald.wifi@example.com' 
});

// Check account balances
const vendorAccount = await Account.findOne({ code: '200001' });
const expenseAccount = await Account.findOne({ code: '5000' });
const bankAccount = await Account.findOne({ code: '1001' });
```

---

## ✅ **Verification Points**

- [ ] Vendor balance: R0 (paid off)
- [ ] Maintenance expenses: R2,500 (permanent)
- [ ] Bank account: Reduced by R2,500
- [ ] Two transactions created (approval + payment)
- [ ] All entries balanced

---

## 🚀 **Run Demo**
```bash
node handle-macdonald-wifi-request.js
``` 