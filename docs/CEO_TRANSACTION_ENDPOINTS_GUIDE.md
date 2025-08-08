# 🏢 CEO Transaction Endpoints Guide

## Overview
The CEO role now has full access to all transaction endpoints, providing comprehensive visibility into the financial transaction system. These endpoints use the same controllers as the finance routes to ensure data consistency and functionality.

## 🔐 Authentication & Authorization
- **Required**: JWT Token with CEO role
- **Headers**: `Authorization: Bearer <JWT_TOKEN>`
- **Access**: CEO role only

## 📊 Available Transaction Endpoints

### 1. **Get All Transactions**
```http
GET /api/ceo/financial/transactions
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Number of results per page (default: 50)
- `type` (optional): Filter by transaction type (approval, payment, adjustment)
- `startDate` (optional): Filter from date (YYYY-MM-DD)
- `endDate` (optional): Filter to date (YYYY-MM-DD)
- `residence` (optional): Filter by residence ID

**Response:**
```json
{
  "success": true,
  "transactions": [
    {
      "_id": "transaction_id",
      "transactionId": "TXN-2025-001",
      "date": "2025-01-15T10:30:00.000Z",
      "description": "Student rent payment",
      "type": "payment",
      "amount": 500,
      "residence": "residence_id",
      "expenseId": "expense_id",
      "createdBy": {
        "_id": "user_id",
        "firstName": "John",
        "lastName": "Doe",
        "email": "finance@alamait.com"
      },
      "entries": []
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 50,
    "pages": 2
  }
}
```

### 2. **Get Transaction Summary**
```http
GET /api/ceo/financial/transactions/summary
```

**Query Parameters:**
- `startDate` (optional): Filter from date
- `endDate` (optional): Filter to date
- `type` (optional): Filter by transaction type
- `account` (optional): Filter by account
- `status` (optional): Filter by status

**Response:**
```json
{
  "success": true,
  "summary": {
    "totalTransactions": 150,
    "totalAmount": 75000,
    "averageAmount": 500,
    "transactionTypes": {
      "payment": 100,
      "approval": 30,
      "adjustment": 20
    },
    "dateRange": {
      "startDate": "2025-01-01",
      "endDate": "2025-01-31"
    }
  }
}
```

### 3. **Get Transaction Entries**
```http
GET /api/ceo/financial/transactions/entries
```

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Number of results per page
- `account` (optional): Filter by account code
- `startDate` (optional): Filter from date
- `endDate` (optional): Filter to date
- `type` (optional): Filter by entry type

**Response:**
```json
{
  "success": true,
  "entries": [
    {
      "_id": "entry_id",
      "transactionId": "TXN-2025-001",
      "accountCode": "1001",
      "accountName": "Cash",
      "accountType": "Asset",
      "debit": 500,
      "credit": 0,
      "description": "Student rent payment",
      "date": "2025-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 300,
    "page": 1,
    "limit": 50,
    "pages": 6
  }
}
```

### 4. **Get Transaction by ID**
```http
GET /api/ceo/financial/transactions/:id
```

**Response:**
```json
{
  "success": true,
  "transaction": {
    "_id": "transaction_id",
    "transactionId": "TXN-2025-001",
    "date": "2025-01-15T10:30:00.000Z",
    "description": "Student rent payment",
    "type": "payment",
    "amount": 500,
    "residence": {
      "_id": "residence_id",
      "name": "St. Kilda Residence"
    },
    "expenseId": "expense_id",
    "createdBy": {
      "_id": "user_id",
      "firstName": "John",
      "lastName": "Doe",
      "email": "finance@alamait.com"
    },
    "entries": [
      {
        "accountCode": "1001",
        "accountName": "Cash",
        "accountType": "Asset",
        "debit": 500,
        "credit": 0
      },
      {
        "accountCode": "4001",
        "accountName": "Rental Income",
        "accountType": "Income",
        "debit": 0,
        "credit": 500
      }
    ]
  }
}
```

### 5. **Get Transaction Entries by Transaction ID**
```http
GET /api/ceo/financial/transactions/:id/entries
```

**Response:**
```json
{
  "success": true,
  "entries": [
    {
      "_id": "entry_id",
      "transactionId": "TXN-2025-001",
      "accountCode": "1001",
      "accountName": "Cash",
      "accountType": "Asset",
      "debit": 500,
      "credit": 0,
      "description": "Student rent payment",
      "date": "2025-01-15T10:30:00.000Z"
    },
    {
      "_id": "entry_id_2",
      "transactionId": "TXN-2025-001",
      "accountCode": "4001",
      "accountName": "Rental Income",
      "accountType": "Income",
      "debit": 0,
      "credit": 500,
      "description": "Student rent payment",
      "date": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

### 6. **Get Transaction History for Specific Source**
```http
GET /api/ceo/financial/transactions/transaction-history/:sourceType/:sourceId
```

**Path Parameters:**
- `sourceType`: Type of source (payment, expense, invoice)
- `sourceId`: ID of the source

**Response:**
```json
{
  "success": true,
  "transactionHistory": [
    {
      "_id": "transaction_id",
      "transactionId": "TXN-2025-001",
      "date": "2025-01-15T10:30:00.000Z",
      "description": "Payment transaction",
      "type": "payment",
      "amount": 500,
      "entries": []
    }
  ]
}
```

## 🔍 Filtering and Search Options

### **Date Range Filtering**
```http
GET /api/ceo/financial/transactions?startDate=2025-01-01&endDate=2025-01-31
```

### **Transaction Type Filtering**
```http
GET /api/ceo/financial/transactions?type=payment
```

### **Residence Filtering**
```http
GET /api/ceo/financial/transactions?residence=residence_id
```

### **Pagination**
```http
GET /api/ceo/financial/transactions?page=2&limit=25
```

### **Combined Filters**
```http
GET /api/ceo/financial/transactions?startDate=2025-01-01&endDate=2025-01-31&type=payment&residence=residence_id&page=1&limit=50
```

## 📈 Transaction Types

### **Available Transaction Types:**
- `payment`: Student payments, rent payments
- `approval`: Request approvals, expense approvals
- `adjustment`: Account adjustments, corrections
- `expense_payment`: Expense payments to vendors
- `refund`: Payment refunds
- `invoice_payment`: Invoice payments

## 🏗️ Implementation Details

### **Route Registration**
- **File**: `src/routes/ceo/index.js`
- **Base Path**: `/api/ceo/financial/transactions`
- **Controller**: Uses `TransactionController` from finance module
- **Middleware**: Authentication and CEO role validation

### **Data Consistency**
- Uses the same controllers as finance routes
- Ensures consistent data structure and validation
- Same filtering, sorting, and pagination capabilities
- Same error handling and response formats

### **Security Features**
- **Role-based access control**: CEO role only
- **Authentication required**: JWT token validation
- **Query parameter validation**: Safe filtering implementation
- **Rate limiting**: Inherits from existing middleware

## 🧪 Testing the Endpoints

### **Test Script Example**
```javascript
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const CEO_TOKEN = 'your_ceo_jwt_token';

// Test getting all transactions
async function testGetAllTransactions() {
    try {
        const response = await axios.get(`${BASE_URL}/api/ceo/financial/transactions`, {
            headers: {
                'Authorization': `Bearer ${CEO_TOKEN}`
            },
            params: {
                page: 1,
                limit: 10,
                startDate: '2025-01-01',
                endDate: '2025-01-31'
            }
        });
        
        console.log('✅ Transactions fetched successfully:', response.data);
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

// Test getting transaction summary
async function testGetTransactionSummary() {
    try {
        const response = await axios.get(`${BASE_URL}/api/ceo/financial/transactions/summary`, {
            headers: {
                'Authorization': `Bearer ${CEO_TOKEN}`
            },
            params: {
                startDate: '2025-01-01',
                endDate: '2025-01-31'
            }
        });
        
        console.log('✅ Transaction summary fetched successfully:', response.data);
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}
```

## ✅ Benefits for CEO Role

### **1. Complete Financial Visibility**
- View all transactions across the system
- Access detailed transaction entries
- Monitor financial activities in real-time

### **2. Advanced Filtering**
- Filter by date ranges, transaction types, residences
- Search and paginate through large datasets
- Get transaction summaries for reporting

### **3. Audit Trail Access**
- Track all financial activities
- View transaction history for specific sources
- Monitor approval workflows

### **4. Data Consistency**
- Same data structure as finance routes
- Consistent API responses
- Reliable filtering and sorting

## 🚀 Usage Examples

### **Frontend Integration**
```javascript
// React component example
const [transactions, setTransactions] = useState([]);
const [loading, setLoading] = useState(false);

const fetchTransactions = async () => {
    setLoading(true);
    try {
        const response = await fetch('/api/ceo/financial/transactions?page=1&limit=50', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();
        setTransactions(data.transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
    } finally {
        setLoading(false);
    }
};
```

### **Dashboard Integration**
```javascript
// Dashboard widget example
const TransactionWidget = () => {
    const [summary, setSummary] = useState(null);
    
    useEffect(() => {
        fetch('/api/ceo/financial/transactions/summary')
            .then(res => res.json())
            .then(data => setSummary(data.summary));
    }, []);
    
    return (
        <div className="transaction-summary">
            <h3>Transaction Summary</h3>
            <p>Total Transactions: {summary?.totalTransactions}</p>
            <p>Total Amount: ${summary?.totalAmount}</p>
        </div>
    );
};
```

## 🎯 Summary

The CEO now has comprehensive access to all transaction endpoints with:

✅ **6 Transaction Endpoints** available  
✅ **Advanced Filtering** capabilities  
✅ **Pagination** support  
✅ **Consistent Data Structure** with finance routes  
✅ **Full Audit Trail** access  
✅ **Real-time Financial Monitoring**  

**All endpoints are now ready for CEO use!** 🎉
