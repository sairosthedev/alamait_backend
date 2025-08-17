# MongoDB Scripts to Update Transactions with Residence Information

## 🎯 **Overview**

These MongoDB scripts will update your transactions and transaction entries to have residence information by linking them to their associated expenses.

## 📋 **Script 1: Update Transactions with Residence from Expenses**

Run this in MongoDB Compass or MongoDB shell:

```javascript
// Step 1: Update transactions that have expenseId
db.transactions.updateMany(
  {
    $and: [
      {
        $or: [
          { residence: { $exists: false } },
          { residence: null },
          { residence: "" }
        ]
      },
      { expenseId: { $exists: true, $ne: null } }
    ]
  },
  [
    {
      $lookup: {
        from: "expenses",
        localField: "expenseId",
        foreignField: "_id",
        as: "expense"
      }
    },
    {
      $set: {
        residence: { $arrayElemAt: ["$expense.residence", 0] },
        residenceName: { $arrayElemAt: ["$expense.residence.name", 0] }
      }
    },
    {
      $unset: "expense"
    }
  ]
);
```

## 📋 **Script 2: Update Transaction Entries with Residence from Transactions**

```javascript
// Step 2: Update transaction entries that have transaction reference
db.transactionentries.updateMany(
  {
    $or: [
      { residence: { $exists: false } },
      { residence: null },
      { residence: "" }
    ]
  },
  [
    {
      $lookup: {
        from: "transactions",
        localField: "transaction",
        foreignField: "_id",
        as: "transaction"
      }
    },
    {
      $set: {
        residence: { $arrayElemAt: ["$transaction.residence", 0] },
        "metadata.residenceId": { $arrayElemAt: ["$transaction.residence", 0] },
        "metadata.residenceName": { $arrayElemAt: ["$transaction.residenceName", 0] },
        "metadata.updatedAt": new Date()
      }
    },
    {
      $unset: "transaction"
    }
  ]
);
```

## 📋 **Script 3: Update Transaction Entries with Residence from Expenses (via reference)**

```javascript
// Step 3: Update transaction entries that reference expenses directly
db.transactionentries.updateMany(
  {
    $and: [
      {
        $or: [
          { residence: { $exists: false } },
          { residence: null },
          { residence: "" }
        ]
      },
      {
        $or: [
          { reference: { $regex: "^EXP" } },
          { reference: { $regex: "^[a-f0-9]{24}$" } }
        ]
      }
    ]
  },
  [
    {
      $lookup: {
        from: "expenses",
        localField: "reference",
        foreignField: "expenseId",
        as: "expense"
      }
    },
    {
      $set: {
        residence: { $arrayElemAt: ["$expense.residence", 0] },
        "metadata.residenceId": { $arrayElemAt: ["$expense.residence", 0] },
        "metadata.residenceName": { $arrayElemAt: ["$expense.residence.name", 0] },
        "metadata.updatedAt": new Date()
      }
    },
    {
      $unset: "expense"
    }
  ]
);
```

## 📋 **Script 4: Update Transaction Entries with Residence from Expenses (via transaction)**

```javascript
// Step 4: Update remaining entries by looking up expense through transaction
db.transactionentries.updateMany(
  {
    $or: [
      { residence: { $exists: false } },
      { residence: null },
      { residence: "" }
    ]
  },
  [
    {
      $lookup: {
        from: "transactions",
        localField: "transaction",
        foreignField: "_id",
        as: "transaction"
      }
    },
    {
      $lookup: {
        from: "expenses",
        localField: "transaction.expenseId",
        foreignField: "_id",
        as: "expense"
      }
    },
    {
      $set: {
        residence: { $arrayElemAt: ["$expense.residence", 0] },
        "metadata.residenceId": { $arrayElemAt: ["$expense.residence", 0] },
        "metadata.residenceName": { $arrayElemAt: ["$expense.residence.name", 0] },
        "metadata.updatedAt": new Date()
      }
    },
    {
      $unset: ["transaction", "expense"]
    }
  ]
);
```

## 🔍 **Verification Scripts**

### **Check Current Status:**
```javascript
// Count transactions without residence
db.transactions.countDocuments({
  $or: [
    { residence: { $exists: false } },
    { residence: null },
    { residence: "" }
  ]
});

// Count transaction entries without residence
db.transactionentries.countDocuments({
  $or: [
    { residence: { $exists: false } },
    { residence: null },
    { residence: "" }
  ]
});
```

### **Check Residence Distribution:**
```javascript
// Residence distribution in transactions
db.transactions.aggregate([
  { $match: { residence: { $exists: true, $ne: null, $ne: "" } } },
  { $group: { 
    _id: '$residence', 
    count: { $sum: 1 },
    residenceName: { $first: '$residenceName' }
  }},
  { $sort: { count: -1 } }
]);
```

## 🚀 **How to Run**

### **Option 1: MongoDB Compass**
1. Open MongoDB Compass
2. Connect to your cluster: `cluster0.ulvve.mongodb.net`
3. Select the `test` database
4. Go to the "Aggregations" tab
5. Copy and paste each script
6. Click "Run"

### **Option 2: MongoDB Shell**
1. Connect to your MongoDB Atlas cluster
2. Switch to the `test` database: `use test`
3. Copy and paste each script
4. Press Enter to execute

### **Option 3: Node.js Script**
1. Save the `update-transactions-with-residence.js` file
2. Run: `node update-transactions-with-residence.js`

## 📊 **Expected Results**

After running these scripts, you should see:
- **Transactions without residence**: 0 (was 1)
- **Transaction entries without residence**: 0 (was 38)
- All transactions and entries properly linked to residences

## ⚠️ **Important Notes**

1. **Backup First**: Consider backing up your database before running these updates
2. **Test Environment**: Test on a copy of your data first if possible
3. **Run in Order**: Execute the scripts in the order shown above
4. **Verify Results**: Use the verification scripts to confirm the updates worked

## 🔧 **Troubleshooting**

If some records still don't have residence information:

1. **Check the data**: Some transactions/entries might not have clear expense relationships
2. **Manual review**: Review the remaining records manually
3. **Data quality**: Ensure your expenses have proper residence information

## 📝 **Example Output**

```
✅ Script 1: Updated 1 transaction with residence
✅ Script 2: Updated 25 transaction entries with residence
✅ Script 3: Updated 8 transaction entries with residence  
✅ Script 4: Updated 5 transaction entries with residence

🎉 SUCCESS: All transactions and entries now have residence information!
```
