# Role Permission Fix Guide

## Problem
You're getting a 403 Forbidden error when trying to access admin expenses:
```
Access denied. Required role: admin,finance,finance_admin,finance_user
```

## Root Cause
The system was inconsistently checking for a `finance` role that doesn't exist in the User model. The User model only supports:
- `admin`
- `student` 
- `finance_admin`
- `finance_user`

## Solution Applied

### 1. Updated User Model
- Added `finance` role to the User model enum (for backward compatibility)
- Updated all role checks to be consistent

### 2. Fixed Route Permissions
- Updated admin routes to use consistent role checking
- Removed references to the non-existent `finance` role
- Updated finance routes to use proper role combinations

### 3. Updated Middleware
- Fixed `checkAdminOrFinance` middleware to use correct roles
- Updated error messages to reflect actual required roles

## How to Fix Your Current Issue

### Option 1: Create an Admin User (Recommended)
```bash
# Create a new admin user
node src/scripts/createFinanceUser.js admin@alamait.com admin your_password

# Or create a finance admin user
node src/scripts/createFinanceUser.js finance@alamait.com finance_admin your_password
```

### Option 2: Update Existing User Role
```bash
# Run the fix script
node fix-user-role.js
```

### Option 3: Manual Database Update
If you know your user's email, you can manually update their role in the database:
```javascript
// In MongoDB shell or through your database tool
db.users.updateOne(
  { email: "your-email@example.com" },
  { $set: { role: "admin" } }
)
```

## Valid Roles and Permissions

| Role | Permissions |
|------|-------------|
| `admin` | Full system access, can access all admin and finance features |
| `finance_admin` | Finance management access, can manage expenses, payments, etc. |
| `finance_user` | Basic finance access, can view and update finance data |
| `student` | Student access only (default role) |

## Required Roles for Admin Expenses

The admin expenses endpoint (`/api/admin/expenses`) requires one of these roles:
- `admin`
- `finance_admin` 
- `finance_user`

## Testing the Fix

1. **Check your current user role:**
   ```bash
   node debug-user-permissions.js
   ```

2. **Create a test admin user:**
   ```bash
   node src/scripts/createFinanceUser.js test@alamait.com admin test123
   ```

3. **Login with the new admin user and test the expenses endpoint**

## Frontend Changes

The frontend should now work correctly once you have a user with the proper role. The error handling in the frontend will show the correct required roles.

## Troubleshooting

If you're still getting permission errors:

1. **Check your JWT token:**
   - Make sure you're logged in with a user that has the correct role
   - Check that the token hasn't expired

2. **Verify user role in database:**
   ```bash
   node debug-user-permissions.js
   ```

3. **Check server logs:**
   - Look for role check middleware logs
   - Verify the user's role is being read correctly

4. **Clear browser cache:**
   - Clear localStorage/sessionStorage
   - Log out and log back in

## API Endpoints and Required Roles

| Endpoint | Required Roles |
|----------|----------------|
| `/api/admin/expenses` | `admin`, `finance_admin`, `finance_user` |
| `/api/finance/expenses` | `admin`, `finance_admin` |
| `/api/admin/*` | `admin`, `finance_admin`, `finance_user` |
| `/api/finance/*` | `admin`, `finance_admin`, `finance_user` |

## Next Steps

1. Create an admin user using one of the methods above
2. Login with the admin user
3. Test the expenses functionality
4. If you need different permission levels, create users with `finance_admin` or `finance_user` roles

## Support

If you continue to have issues:
1. Check the server logs for detailed error messages
2. Verify your database connection and user data
3. Ensure your JWT_SECRET environment variable is set correctly 