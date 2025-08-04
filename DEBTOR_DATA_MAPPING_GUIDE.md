# Debtor Data Mapping Guide

## Overview
This guide explains how to map debtors (students) to fetch comprehensive data from multiple collections including Residence, Payments, Transactions, Applications, and Bookings.

## Data Mapping Strategy

### 1. **Debtor Model Structure**
```javascript
// Debtor Model (src/models/Debtor.js)
{
  user: ObjectId,           // Links to User collection (student)
  residence: ObjectId,      // Links to Residence collection
  accountCode: String,      // Links to Account collection
  roomNumber: String,       // Links to specific room in residence
  // ... other fields
}
```

### 2. **Collection Relationships**
```
Debtor (Student) → User (student details)
Debtor (Student) → Residence (residence details)
Debtor (Student) → Payment (payment history)
Debtor (Student) → Transaction (financial transactions)
Debtor (Student) → Application (application history)
Debtor (Student) → Booking (booking history)
```

## API Endpoints for Comprehensive Data Fetching

### 1. **Get Comprehensive Debtor Data**
**Endpoint:** `GET /api/finance/debtors/:id/comprehensive`

**Description:** Fetches all related data for a specific debtor from all collections

**Query Parameters:**
- `includeHistory` (boolean): Include full history or just summary
- `months` (number): Number of months for statistics calculation

**Example Usage:**
```javascript
const getComprehensiveData = async (debtorId) => {
  const response = await api.get(`/finance/debtors/${debtorId}/comprehensive`, {
    params: {
      includeHistory: true,
      months: 12
    }
  });
  return response.data;
};
```

**Response Structure:**
```javascript
{
  success: true,
  debtor: {
    // Debtor details with room information
    _id: "debtorId",
    debtorCode: "DR0001",
    user: { firstName: "John", lastName: "Doe", email: "john@example.com" },
    residence: { name: "Student Residence", address: "123 Main St" },
    roomDetails: { roomNumber: "A101", price: 500, type: "Single" }
  },
  residence: {
    // Complete residence details with rooms
    name: "Student Residence",
    address: "123 Main St",
    rooms: [...]
  },
  payments: {
    data: [...], // All payment records
    statistics: {
      totalPayments: 15,
      totalAmount: 7500,
      confirmedAmount: 7000,
      pendingAmount: 500,
      methodBreakdown: { "Bank Transfer": 4000, "Cash": 3500 },
      averagePayment: 500
    }
  },
  transactions: {
    data: [...], // All transaction records
    statistics: {
      totalTransactions: 20,
      totalDebit: 8000,
      totalCredit: 7500,
      netAmount: 500,
      typeBreakdown: { "payment": 15, "invoice": 5 }
    }
  },
  applications: [...], // Application history
  bookings: [...],     // Booking history
  summary: {
    totalPayments: 15,
    totalTransactions: 20,
    totalApplications: 3,
    totalBookings: 2,
    currentBalance: 500,
    totalOwed: 8000,
    totalPaid: 7500
  }
}
```

### 2. **Get All Debtors with Comprehensive Mapping**
**Endpoint:** `GET /api/finance/debtors/comprehensive/all`

**Description:** Fetches all debtors with optional detailed data for each

**Query Parameters:**
- `page` (number): Page number for pagination
- `limit` (number): Items per page
- `status` (string): Filter by debtor status
- `residence` (string): Filter by residence ID
- `search` (string): Search by name, email, or codes
- `overdue` (boolean): Filter overdue debtors only
- `includeDetails` (boolean): Include detailed data for each debtor

**Example Usage:**
```javascript
const getAllDebtorsComprehensive = async (filters = {}) => {
  const response = await api.get('/finance/debtors/comprehensive/all', {
    params: {
      page: 1,
      limit: 10,
      status: 'active',
      includeDetails: true,
      ...filters
    }
  });
  return response.data;
};
```

### 3. **Get Debtor Payment History**
**Endpoint:** `GET /api/finance/debtors/:id/payment-history`

**Description:** Fetches detailed payment history with statistics

**Query Parameters:**
- `startDate` (string): Start date filter (YYYY-MM-DD)
- `endDate` (string): End date filter (YYYY-MM-DD)
- `status` (string): Payment status filter
- `method` (string): Payment method filter

**Example Usage:**
```javascript
const getPaymentHistory = async (debtorId, filters = {}) => {
  const response = await api.get(`/finance/debtors/${debtorId}/payment-history`, {
    params: {
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      status: 'Confirmed',
      ...filters
    }
  });
  return response.data;
};
```

## Data Mapping Examples

### 1. **Mapping Debtor to Residence Data**
```javascript
// Get debtor with residence details
const debtor = await Debtor.findById(debtorId)
  .populate('residence', 'name address city state zipCode');

// Get specific room details
const residence = await Residence.findById(debtor.residence)
  .populate('rooms');

const roomDetails = residence.rooms.find(room => 
  room.roomNumber === debtor.roomNumber
);
```

### 2. **Mapping Debtor to Payment Data**
```javascript
// Get all payments for a debtor (student)
const payments = await Payment.find({
  student: debtor.user._id
})
.populate('residence', 'name address')
.populate('student', 'firstName lastName email')
.sort({ date: -1 });
```

### 3. **Mapping Debtor to Transaction Data**
```javascript
// Get all transactions related to a debtor
const transactions = await Transaction.find({
  $or: [
    { 'entries.account': debtor.accountCode },
    { 'entries.debtorId': debtor._id },
    { reference: { $regex: debtor.debtorCode, $options: 'i' } }
  ]
})
.populate('entries')
.populate('residence', 'name address')
.sort({ date: -1 });
```

### 4. **Mapping Debtor to Application Data**
```javascript
// Get application history for a debtor
const applications = await Application.find({
  student: debtor.user._id
})
.populate('residence', 'name address')
.sort({ createdAt: -1 });
```

### 5. **Mapping Debtor to Booking Data**
```javascript
// Get booking history for a debtor
const bookings = await Booking.find({
  student: debtor.user._id
})
.populate('residence', 'name address')
.populate('room')
.sort({ startDate: -1 });
```

## Frontend Integration Examples

### 1. **Debtor Dashboard Component**
```javascript
import React, { useState, useEffect } from 'react';
import api from '../lib/api';

const DebtorDashboard = ({ debtorId }) => {
  const [debtorData, setDebtorData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDebtorData = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/finance/debtors/${debtorId}/comprehensive`);
        
        if (response.data.success) {
          setDebtorData(response.data);
        }
      } catch (error) {
        console.error('Error fetching debtor data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDebtorData();
  }, [debtorId]);

  if (loading) return <div>Loading...</div>;
  if (!debtorData) return <div>No data found</div>;

  return (
    <div>
      <h2>Debtor Dashboard</h2>
      
      {/* Debtor Information */}
      <div>
        <h3>Debtor Details</h3>
        <p>Name: {debtorData.debtor.user.firstName} {debtorData.debtor.user.lastName}</p>
        <p>Email: {debtorData.debtor.user.email}</p>
        <p>Residence: {debtorData.debtor.residence.name}</p>
        <p>Room: {debtorData.debtor.roomNumber}</p>
        <p>Current Balance: ${debtorData.debtor.currentBalance}</p>
      </div>

      {/* Payment Statistics */}
      <div>
        <h3>Payment Statistics</h3>
        <p>Total Payments: {debtorData.payments.statistics.totalPayments}</p>
        <p>Total Amount: ${debtorData.payments.statistics.totalAmount}</p>
        <p>Confirmed Amount: ${debtorData.payments.statistics.confirmedAmount}</p>
      </div>

      {/* Transaction Statistics */}
      <div>
        <h3>Transaction Statistics</h3>
        <p>Total Transactions: {debtorData.transactions.statistics.totalTransactions}</p>
        <p>Net Amount: ${debtorData.transactions.statistics.netAmount}</p>
      </div>

      {/* Recent Payments */}
      <div>
        <h3>Recent Payments</h3>
        {debtorData.payments.data.slice(0, 5).map(payment => (
          <div key={payment._id}>
            <p>Date: {new Date(payment.date).toLocaleDateString()}</p>
            <p>Amount: ${payment.totalAmount}</p>
            <p>Status: {payment.status}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DebtorDashboard;
```

### 2. **Debtors List Component**
```javascript
const DebtorsList = () => {
  const [debtors, setDebtors] = useState([]);
  const [pagination, setPagination] = useState({});
  const [summary, setSummary] = useState({});

  const fetchDebtors = async (page = 1) => {
    try {
      const response = await api.get('/finance/debtors/comprehensive/all', {
        params: {
          page,
          limit: 10,
          includeDetails: true
        }
      });

      if (response.data.success) {
        setDebtors(response.data.debtors);
        setPagination(response.data.pagination);
        setSummary(response.data.summary);
      }
    } catch (error) {
      console.error('Error fetching debtors:', error);
    }
  };

  useEffect(() => {
    fetchDebtors();
  }, []);

  return (
    <div>
      <h2>Debtors List</h2>
      
      {/* Summary Cards */}
      <div>
        <div>Total Debtors: {summary.totalDebtors}</div>
        <div>Total Owed: ${summary.totalOwed}</div>
        <div>Total Paid: ${summary.totalPaid}</div>
        <div>Overdue Count: {summary.overdueCount}</div>
      </div>

      {/* Debtors Table */}
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Residence</th>
            <th>Room</th>
            <th>Balance</th>
            <th>Recent Payments</th>
          </tr>
        </thead>
        <tbody>
          {debtors.map(debtor => (
            <tr key={debtor._id}>
              <td>{debtor.user.firstName} {debtor.user.lastName}</td>
              <td>{debtor.user.email}</td>
              <td>{debtor.residence.name}</td>
              <td>{debtor.roomNumber}</td>
              <td>${debtor.currentBalance}</td>
              <td>{debtor.recentPayments?.length || 0} payments</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

## Performance Optimization Tips

### 1. **Use Pagination**
- Always use pagination for large datasets
- Limit the number of records fetched at once

### 2. **Selective Data Loading**
- Use `includeDetails` parameter to load detailed data only when needed
- Use `includeHistory` parameter to control historical data loading

### 3. **Index Optimization**
- Ensure proper indexes on frequently queried fields
- Use compound indexes for complex queries

### 4. **Caching Strategy**
- Cache frequently accessed debtor data
- Implement client-side caching for better performance

## Error Handling

```javascript
const fetchDebtorData = async (debtorId) => {
  try {
    const response = await api.get(`/finance/debtors/${debtorId}/comprehensive`);
    
    if (response.data.success) {
      return response.data;
    } else {
      throw new Error(response.data.message);
    }
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error('Debtor not found');
    } else if (error.response?.status === 403) {
      throw new Error('Access denied');
    } else {
      throw new Error('Failed to fetch debtor data');
    }
  }
};
```

This comprehensive mapping system allows you to efficiently fetch and display all relevant data for debtors from multiple collections while maintaining good performance and providing rich functionality for your application. 