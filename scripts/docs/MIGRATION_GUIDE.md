# 🚀 Monthly Request Status Migration Guide

## 📋 Overview

This guide explains how to update your existing monthly request records in the database to follow the new intelligent status logic:

- **Templates**: Set to `draft` status
- **Past/Current Months**: Set to `approved` status (auto-approved)
- **Future Months**: Set to `pending` status (requires finance approval)

## ⚠️ Important Notes

### **Before Running Migration:**
1. **Backup your database** - This is critical!
2. **Test in development environment first**
3. **Review the preview** before running actual migration
4. **Ensure no active users** are modifying monthly requests during migration

### **What the Migration Does:**
- Updates existing monthly request statuses based on month/year
- Adds migration history to request history
- Preserves all other data (items, costs, etc.)
- Maintains audit trail

## 🛠️ Running the Migration

### **Step 1: Preview Changes (Recommended)**

First, preview what changes would be made without actually modifying the database:

```bash
# Preview mode - shows what would change without making changes
node run-migration.js --preview
```

This will show you:
- Total number of requests found
- Which requests would be updated
- What status changes would be made
- Summary statistics

### **Step 2: Run the Actual Migration**

After reviewing the preview, run the actual migration:

```bash
# Run actual migration
node run-migration.js
```

The script will:
1. Ask for confirmation before proceeding
2. Connect to your database
3. Process all monthly requests
4. Update statuses according to the new logic
5. Add migration history to each updated request
6. Show detailed summary of changes

## 📊 Migration Logic

### **Status Update Rules:**

| Request Type | Month/Year | Current Status | New Status | Reason |
|--------------|------------|----------------|------------|---------|
| Template | Any | Any | `draft` | Templates always draft |
| Regular | Past/Current | Any | `approved` | Auto-approve historical |
| Regular | Future | Any | `pending` | Require finance approval |
| Regular | No month/year | Any | Unchanged | Preserve existing status |

### **Examples:**

```javascript
// Template request (any status → draft)
{
    title: "Monthly Services Template",
    isTemplate: true,
    status: "approved" // Will become "draft"
}

// Past month request (any status → approved)
{
    title: "January 2024 Services",
    month: 1,
    year: 2024,
    status: "pending" // Will become "approved"
}

// Future month request (any status → pending)
{
    title: "March 2025 Services",
    month: 3,
    year: 2025,
    status: "draft" // Will become "pending"
}
```

## 🔧 Migration Scripts

### **Main Migration Script: `migrate-monthly-request-status.js`**

This script contains the core migration logic:

- `previewMigration()` - Preview changes without making them
- `migrateMonthlyRequestStatus()` - Run the actual migration
- Helper functions for status logic

### **Runner Script: `run-migration.js`**

This script provides a user-friendly interface:

- Command-line argument parsing
- Preview mode support
- Confirmation prompts
- Error handling

## 📈 Expected Results

### **After Migration:**

1. **Templates**: All templates will have `draft` status
2. **Past/Current Months**: All requests for past/current months will be `approved`
3. **Future Months**: All requests for future months will be `pending`
4. **Audit Trail**: Each updated request will have migration history

### **Sample Output:**

```
🔄 Starting Monthly Request Status Migration...

📅 Current Date: 1/31/2025
📅 Current Month: 1, Current Year: 2025

📊 Total Monthly Requests Found: 25

🔄 Processing Monthly Requests...

Processing 1/25: Monthly Services Template (ID: 507f1f77bcf86cd799439011)
  Current Status: approved
  Is Template: true
  Template - Keeping as draft
  ✅ Updated: approved → draft

Processing 2/25: January 2024 Services (ID: 507f1f77bcf86cd799439012)
  Current Status: pending
  Month/Year: 1/2024
  Calculated Status: approved
  ✅ Updated: pending → approved

Processing 3/25: March 2025 Services (ID: 507f1f77bcf86cd799439013)
  Current Status: draft
  Month/Year: 3/2025
  Calculated Status: pending
  ✅ Updated: draft → pending

📊 Migration Summary:
====================
Total Requests: 25
Templates: 5
Past/Current Month Requests: 15
Future Month Requests: 5
Updated: 20
Unchanged: 5
Errors: 0

🔄 Status Change Details:
========================
From approved:
  → draft: 5 requests
From pending:
  → approved: 10 requests
  → pending: 5 requests
From draft:
  → pending: 5 requests

🎉 Migration completed successfully!
```

## 🚨 Troubleshooting

### **Common Issues:**

1. **Database Connection Error**
   ```
   ❌ Migration failed: connect ECONNREFUSED
   ```
   **Solution**: Check your `MONGODB_URI` environment variable

2. **Permission Error**
   ```
   ❌ Migration failed: user is not allowed to do action [update] on [collection]
   ```
   **Solution**: Check database user permissions

3. **Validation Error**
   ```
   ❌ Error processing request: Validation failed
   ```
   **Solution**: Check if request data is valid before migration

### **Rollback Plan:**

If something goes wrong, you can:

1. **Restore from backup** (recommended)
2. **Manual rollback** using database queries
3. **Contact support** with error logs

## 📋 Pre-Migration Checklist

- [ ] Database backup completed
- [ ] Development environment tested
- [ ] Preview run and reviewed
- [ ] No active users modifying monthly requests
- [ ] Environment variables configured
- [ ] Database connection tested
- [ ] Rollback plan prepared

## 📋 Post-Migration Checklist

- [ ] Migration completed successfully
- [ ] All requests have correct statuses
- [ ] Migration history added to requests
- [ ] Application tested with new statuses
- [ ] Finance users can see pending requests
- [ ] Admin users can see approved requests
- [ ] Templates are in draft status

## 🎯 Next Steps

After successful migration:

1. **Test the application** with the new status logic
2. **Verify finance workflow** for pending requests
3. **Check admin workflow** for approved requests
4. **Monitor for any issues** in production
5. **Update documentation** if needed

## 📞 Support

If you encounter any issues during migration:

1. Check the error logs
2. Review the troubleshooting section
3. Restore from backup if needed
4. Contact the development team with error details

---

**Remember**: Always backup your database before running any migration! 