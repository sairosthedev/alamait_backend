# Database Connection Fix for Test Scripts

## Problem

The test scripts were failing with the error:
```
MongooseError: Operation `users.deleteMany()` buffering timed out after 10000ms
```

This happened because the scripts were trying to perform database operations without establishing a database connection first.

## Solution

### 1. Added Database Connection Setup

All test scripts now include:

```javascript
const mongoose = require('mongoose');
require('dotenv').config();

// Database connection
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        process.exit(1);
    }
};
```

### 2. Updated Test Scripts

**Files Fixed:**
- ✅ `test-manual-add-student-with-application.js`
- ✅ `scripts/check-students-without-application-codes.js`
- ✅ `scripts/create-application-codes-for-existing-students.js`

**Changes Made:**
1. **Added dotenv configuration** to load environment variables
2. **Added database connection function** with proper error handling
3. **Connect to database** before running any database operations
4. **Close database connection** in finally block
5. **Added proper error handling** for cleanup operations

### 3. Created Simple Test Script

**New File:** `test-simple-application-code-generation.js`

This script tests the basic application code generation functionality without requiring:
- Real residence IDs
- Debtor creation (which might fail due to missing residence data)
- Complex entity relationships

## How to Test

### 1. Test Basic Functionality
```bash
cd alamait_backend
node test-simple-application-code-generation.js
```

This will test:
- ✅ Database connection
- ✅ Student creation
- ✅ Application code generation
- ✅ Application record creation
- ✅ Student-application linking
- ✅ Verification of relationships

### 2. Test Complete Flow (if you have residence data)
```bash
cd alamait_backend
node test-manual-add-student-with-application.js
```

**Note:** This requires a valid residence ID. Update the `TEST_RESIDENCE_ID` variable in the script with a real residence ID from your database.

### 3. Check Existing Students
```bash
cd alamait_backend
node scripts/check-students-without-application-codes.js
```

### 4. Migrate Existing Students (if needed)
```bash
cd alamait_backend
node scripts/create-application-codes-for-existing-students.js
```

## Environment Setup

Make sure you have a `.env` file in the `alamait_backend` directory with:

```env
MONGODB_URI=mongodb://your-mongodb-connection-string
```

If no `.env` file exists, the scripts will fall back to:
```
mongodb://localhost:27017/alamait
```

## Expected Output

### Successful Test Run
```
✅ MongoDB Connected: your-mongodb-host
🧪 Testing Simple Application Code Generation
==================================================

1️⃣ Cleaning up existing test data...
✅ Cleanup completed

2️⃣ Creating test student...
✅ Created test student: Test Student
   Email: test.simple.1234567890@example.com
   ID: 507f1f77bcf86cd799439011

3️⃣ Generating application code...
✅ Generated application code: APP1234567890ABC123

4️⃣ Creating application record...
✅ Created application: APP1234567890ABC123
   Student ID: 507f1f77bcf86cd799439011
   Status: approved

5️⃣ Updating student with application code...
✅ Updated student with application code: APP1234567890ABC123

6️⃣ Verifying the link...
   Student application code: APP1234567890ABC123
   Application student link: 507f1f77bcf86cd799439011
   Student found by app code: YES
   Application found by student: YES

✅ All tests completed successfully!

📋 Summary:
   Student: test.simple.1234567890@example.com (507f1f77bcf86cd799439011)
   Application: APP1234567890ABC123 (507f1f77bcf86cd799439012)
   Application Code: APP1234567890ABC123
   Student-Application Link: ✅

🧹 Cleaning up test data...
✅ Cleanup completed
✅ Database connection closed
```

### Database Connection Error
```
❌ Database connection failed: connect ECONNREFUSED 127.0.0.1:27017
```

**Solution:** Make sure MongoDB is running and the connection string is correct.

## Troubleshooting

### 1. Database Connection Issues
- **Check MongoDB is running**
- **Verify connection string** in `.env` file
- **Check network connectivity** to MongoDB server

### 2. Environment Variables
- **Ensure `.env` file exists** in `alamait_backend` directory
- **Check `MONGODB_URI`** is set correctly
- **Restart terminal** after creating `.env` file

### 3. Permission Issues
- **Check database permissions** for the user
- **Verify database exists** and is accessible
- **Check firewall settings** if connecting to remote MongoDB

### 4. Model Import Issues
- **Verify model paths** are correct
- **Check model files** exist and are properly exported
- **Ensure all dependencies** are installed

## Next Steps

1. **Run the simple test** to verify basic functionality
2. **Update residence ID** in the full test if needed
3. **Run the complete test** to verify debtor creation
4. **Check existing students** for missing application codes
5. **Migrate existing students** if needed

## Files Modified

- ✅ `test-manual-add-student-with-application.js` - Added database connection
- ✅ `scripts/check-students-without-application-codes.js` - Added database connection
- ✅ `scripts/create-application-codes-for-existing-students.js` - Added database connection
- ✅ `test-simple-application-code-generation.js` - New simple test script

All scripts now properly connect to the database and handle connection cleanup. 