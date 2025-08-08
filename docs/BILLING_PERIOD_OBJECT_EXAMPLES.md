# Billing Period Object Structure - Complete Guide

## 🎯 **Overview**

The billing period for debtors has been enhanced from a simple string to a comprehensive object structure that provides much more flexibility and functionality for billing management.

## 📊 **New Billing Period Object Structure**

### **Complete Object Schema**
```javascript
billingPeriod: {
  // Period Information
  type: {
    type: String,
    enum: ['monthly', 'quarterly', 'semester', 'annual', 'custom'],
    default: 'monthly'
  },
  
  // Duration
  duration: {
    value: Number,        // Required, min: 1
    unit: String          // 'days', 'weeks', 'months', 'quarters', 'years'
  },
  
  // Date Range
  startDate: Date,        // Required
  endDate: Date,          // Required
  
  // Billing Cycle
  billingCycle: {
    frequency: String,     // 'weekly', 'bi-weekly', 'monthly', 'quarterly', 'annual'
    dayOfMonth: Number,    // 1-31, default: 1
    gracePeriod: Number    // days, default: 5
  },
  
  // Amount Information
  amount: {
    monthly: Number,       // Required, min: 0
    total: Number,         // Required, min: 0
    currency: String       // default: 'USD'
  },
  
  // Status
  status: String,          // 'active', 'completed', 'cancelled', 'suspended'
  
  // Additional Information
  description: String,
  notes: String,
  
  // Auto-renewal settings
  autoRenewal: {
    enabled: Boolean,      // default: false
    renewalType: String,   // 'same_period', 'custom_period'
    customRenewalPeriod: {
      value: Number,
      unit: String
    }
  }
}
```

## 🚀 **Usage Examples**

### **1. Creating a Monthly Billing Period**

```javascript
const billingPeriodService = require('./src/services/billingPeriodService');

// Create a 6-month billing period
const monthlyBillingPeriod = billingPeriodService.createBillingPeriod({
  type: 'monthly',
  duration: { value: 6, unit: 'months' },
  startDate: new Date('2024-01-01'),
  monthlyAmount: 500,
  description: 'Student accommodation billing period',
  notes: 'Standard 6-month lease'
});

console.log(monthlyBillingPeriod);
// Output:
// {
//   type: 'monthly',
//   duration: { value: 6, unit: 'months' },
//   startDate: 2024-01-01T00:00:00.000Z,
//   endDate: 2024-07-01T00:00:00.000Z,
//   billingCycle: {
//     frequency: 'monthly',
//     dayOfMonth: 1,
//     gracePeriod: 5
//   },
//   amount: {
//     monthly: 500,
//     total: 3000,
//     currency: 'USD'
//   },
//   status: 'active',
//   description: 'Student accommodation billing period',
//   notes: 'Standard 6-month lease',
//   autoRenewal: {
//     enabled: false,
//     renewalType: 'same_period',
//     customRenewalPeriod: null
//   }
// }
```

### **2. Creating a Quarterly Billing Period**

```javascript
const quarterlyBillingPeriod = billingPeriodService.createBillingPeriod({
  type: 'quarterly',
  duration: { value: 3, unit: 'months' },
  startDate: new Date('2024-01-01'),
  monthlyAmount: 600,
  billingCycle: {
    frequency: 'quarterly',
    dayOfMonth: 1,
    gracePeriod: 7
  },
  description: 'Quarterly student billing',
  autoRenewal: {
    enabled: true,
    renewalType: 'same_period'
  }
});
```

### **3. Creating a Custom Billing Period**

```javascript
const customBillingPeriod = billingPeriodService.createBillingPeriod({
  type: 'custom',
  duration: { value: 45, unit: 'days' },
  startDate: new Date('2024-01-15'),
  monthlyAmount: 400,
  billingCycle: {
    frequency: 'weekly',
    dayOfMonth: 1,
    gracePeriod: 3
  },
  description: 'Short-term accommodation',
  notes: 'Special 45-day period for summer students'
});
```

### **4. Creating a Debtor with New Billing Period**

```javascript
const Debtor = require('./src/models/Debtor');
const billingPeriodService = require('./src/services/billingPeriodService');

// Create billing period object
const billingPeriod = billingPeriodService.createBillingPeriod({
  type: 'semester',
  duration: { value: 6, unit: 'months' },
  startDate: new Date('2024-01-01'),
  monthlyAmount: 550,
  description: 'Spring semester accommodation',
  autoRenewal: {
    enabled: true,
    renewalType: 'same_period'
  }
});

// Create debtor with billing period
const debtor = new Debtor({
  debtorCode: 'DR0001',
  user: userId,
  accountCode: '110001',
  status: 'active',
  currentBalance: 0,
  totalOwed: billingPeriod.amount.total,
  totalPaid: 0,
  residence: residenceId,
  roomNumber: 'A101',
  billingPeriod: billingPeriod,
  billingPeriodLegacy: '6 months', // For backward compatibility
  roomPrice: billingPeriod.amount.monthly,
  createdBy: adminUserId
});

await debtor.save();
```

## 🔧 **Service Functions**

### **1. Calculate Duration**

```javascript
// Calculate duration in different units
const durationInDays = billingPeriodService.calculateDurationInDays(billingPeriod);
const durationInMonths = billingPeriodService.calculateDurationInMonths(billingPeriod);

console.log(`Duration: ${durationInDays} days, ${durationInMonths} months`);
```

### **2. Check Overdue Status**

```javascript
const isOverdue = billingPeriodService.isOverdue(billingPeriod);
console.log(`Is overdue: ${isOverdue}`);
```

### **3. Get Next Billing Date**

```javascript
const nextBillingDate = billingPeriodService.getNextBillingDate(billingPeriod);
console.log(`Next billing date: ${nextBillingDate}`);
```

### **4. Get Billing Period Summary**

```javascript
const summary = billingPeriodService.getBillingPeriodSummary(billingPeriod);
console.log(summary);
// Output:
// {
//   type: 'monthly',
//   duration: {
//     value: 6,
//     unit: 'months',
//     inDays: 182.64,
//     inMonths: 6
//   },
//   amount: {
//     monthly: 500,
//     total: 3000,
//     currency: 'USD'
//   },
//   status: 'active',
//   isOverdue: false,
//   nextBillingDate: 2024-02-01T00:00:00.000Z,
//   progress: {
//     percentage: 16.67,
//     daysRemaining: 152,
//     daysElapsed: 30
//   }
// }
```

### **5. Validate Billing Period**

```javascript
const validation = billingPeriodService.validateBillingPeriod(billingPeriod);
if (!validation.isValid) {
  console.error('Validation errors:', validation.errors);
}
```

### **6. Auto-Renewal**

```javascript
// Check if auto-renewal is possible
if (billingPeriod.autoRenewal.enabled) {
  const newBillingPeriod = billingPeriodService.renewBillingPeriod(billingPeriod);
  console.log('New billing period created:', newBillingPeriod);
}
```

## 📈 **API Integration Examples**

### **1. Create Debtor with Billing Period**

```javascript
// POST /api/finance/debtors
const createDebtor = async (req, res) => {
  try {
    const {
      userId,
      residenceId,
      roomNumber,
      billingPeriodData
    } = req.body;

    // Create billing period object
    const billingPeriod = billingPeriodService.createBillingPeriod(billingPeriodData);

    // Validate billing period
    const validation = billingPeriodService.validateBillingPeriod(billingPeriod);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid billing period data',
        errors: validation.errors
      });
    }

    // Create debtor
    const debtor = new Debtor({
      debtorCode: await Debtor.generateDebtorCode(),
      user: userId,
      accountCode: await Debtor.generateAccountCode(),
      residence: residenceId,
      roomNumber,
      billingPeriod,
      billingPeriodLegacy: `${billingPeriod.duration.value} ${billingPeriod.duration.unit}`,
      roomPrice: billingPeriod.amount.monthly,
      totalOwed: billingPeriod.amount.total,
      createdBy: req.user._id
    });

    await debtor.save();

    res.status(201).json({
      success: true,
      message: 'Debtor created successfully',
      data: debtor
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating debtor',
      error: error.message
    });
  }
};
```

### **2. Get Debtor with Billing Period Summary**

```javascript
// GET /api/finance/debtors/:id
const getDebtor = async (req, res) => {
  try {
    const debtor = await Debtor.findById(req.params.id);
    
    if (!debtor) {
      return res.status(404).json({
        success: false,
        message: 'Debtor not found'
      });
    }

    // Get billing period summary
    const billingSummary = billingPeriodService.getBillingPeriodSummary(debtor.billingPeriod);

    res.status(200).json({
      success: true,
      data: {
        ...debtor.toObject(),
        billingSummary
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching debtor',
      error: error.message
    });
  }
};
```

### **3. Update Billing Period**

```javascript
// PUT /api/finance/debtors/:id/billing-period
const updateBillingPeriod = async (req, res) => {
  try {
    const { billingPeriodData } = req.body;
    
    // Create new billing period
    const newBillingPeriod = billingPeriodService.createBillingPeriod(billingPeriodData);
    
    // Validate
    const validation = billingPeriodService.validateBillingPeriod(newBillingPeriod);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid billing period data',
        errors: validation.errors
      });
    }

    // Update debtor
    const debtor = await Debtor.findByIdAndUpdate(
      req.params.id,
      {
        billingPeriod: newBillingPeriod,
        billingPeriodLegacy: `${newBillingPeriod.duration.value} ${newBillingPeriod.duration.unit}`,
        totalOwed: newBillingPeriod.amount.total,
        roomPrice: newBillingPeriod.amount.monthly
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Billing period updated successfully',
      data: debtor
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating billing period',
      error: error.message
    });
  }
};
```

## 🎯 **Benefits of New Structure**

### **1. Flexibility**
- Support for various billing cycles (weekly, monthly, quarterly, annual)
- Custom duration units (days, weeks, months, years)
- Configurable grace periods

### **2. Better Tracking**
- Detailed amount breakdown (monthly vs total)
- Progress tracking with percentage completion
- Overdue status calculation

### **3. Auto-Renewal Support**
- Automatic renewal of billing periods
- Custom renewal periods
- Renewal history tracking

### **4. Enhanced Reporting**
- Billing period summaries
- Progress analytics
- Financial forecasting

### **5. Backward Compatibility**
- Legacy `billingPeriodLegacy` field preserved
- Gradual migration support
- No breaking changes to existing code

## 🔄 **Migration from Legacy Format**

The migration script automatically converts existing debtors:

```bash
# Run migration
node migrate-debtor-billing-period.js
```

This converts:
- `"6 months"` → Comprehensive object with all details
- `"1 year"` → Annual billing period object
- `"3 months"` → Quarterly billing period object

## 📊 **Database Queries**

### **Find Debtors by Billing Period Type**
```javascript
const monthlyDebtors = await Debtor.find({
  'billingPeriod.type': 'monthly'
});
```

### **Find Overdue Billing Periods**
```javascript
const overdueDebtors = await Debtor.find({
  'billingPeriod.endDate': { $lt: new Date() },
  'billingPeriod.status': 'active'
});
```

### **Find Debtors by Amount Range**
```javascript
const highValueDebtors = await Debtor.find({
  'billingPeriod.amount.monthly': { $gte: 1000 }
});
```

This new structure provides much more flexibility and functionality for managing debtor billing periods!
