# Debtor Mapping Frontend Implementation Guide

## Overview

This guide shows how to implement frontend components that leverage the enhanced debtor mapping system. The new mapping ensures that **Debtors** are always linked with **Residence**, **Payments**, **Applications**, and other related collections for optimal frontend performance.

## 🚀 Quick Start

### 1. Run the Mapping Update Script

First, update your existing debtors with proper mapping:

```bash
node update-debtor-mappings.js
```

### 2. API Endpoints Available

#### Get All Debtors (with optional filtering)
```javascript
GET /api/finance/debtors?includePayments=true&includeInvoices=true&includeTransactions=true
```

#### Get Individual Debtor
```javascript
GET /api/finance/debtors/:id?includePayments=true&includeInvoices=true&includeTransactions=true&includeApplication=true
```

#### Get Comprehensive Debtor Data (Recommended)
```javascript
GET /api/finance/debtors/:id/comprehensive
```

## 📊 Frontend React Components

### 1. Debtor List Component

```jsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Badge
} from '@mui/material';
import { Visibility, Payment, Receipt, AccountBalance } from '@mui/icons-material';
import axios from 'axios';

const DebtorList = () => {
  const [debtors, setDebtors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({});

  useEffect(() => {
    fetchDebtors();
  }, []);

  const fetchDebtors = async () => {
    try {
      const response = await axios.get('/api/finance/debtors', {
        params: {
          includePayments: 'true',
          includeInvoices: 'true',
          includeTransactions: 'true'
        },
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      setDebtors(response.data.debtors);
      setSummary(response.data.summary);
    } catch (error) {
      console.error('Error fetching debtors:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'overdue': return 'error';
      case 'inactive': return 'default';
      default: return 'default';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (loading) {
    return <Box>Loading debtors...</Box>;
  }

  return (
    <Box>
      {/* Summary Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Card sx={{ minWidth: 200 }}>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Total Debtors
            </Typography>
            <Typography variant="h4">{summary.totalDebtors}</Typography>
          </CardContent>
        </Card>
        
        <Card sx={{ minWidth: 200 }}>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Total Owed
            </Typography>
            <Typography variant="h4" color="error">
              {formatCurrency(summary.totalOwed)}
            </Typography>
          </CardContent>
        </Card>
        
        <Card sx={{ minWidth: 200 }}>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Total Paid
            </Typography>
            <Typography variant="h4" color="success.main">
              {formatCurrency(summary.totalPaid)}
            </Typography>
          </CardContent>
        </Card>
        
        <Card sx={{ minWidth: 200 }}>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Overdue
            </Typography>
            <Typography variant="h4" color="warning.main">
              {summary.overdueCount}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Debtors Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Debtors List
          </Typography>
          
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Debtor Code</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Residence</TableCell>
                <TableCell>Current Balance</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Payments</TableCell>
                <TableCell>Invoices</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {debtors.map((debtor) => (
                <TableRow key={debtor._id}>
                  <TableCell>{debtor.debtorCode}</TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body1">
                        {debtor.user?.firstName} {debtor.user?.lastName}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {debtor.user?.email}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {debtor.residence?.name}
                    {debtor.roomNumber && ` - Room ${debtor.roomNumber}`}
                  </TableCell>
                  <TableCell>
                    <Typography 
                      variant="body2" 
                      color={debtor.currentBalance > 0 ? 'error' : 'success.main'}
                    >
                      {formatCurrency(debtor.currentBalance)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={debtor.status} 
                      color={getStatusColor(debtor.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Badge badgeContent={debtor.payments?.length || 0} color="primary">
                      <Payment />
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge badgeContent={debtor.invoices?.length || 0} color="secondary">
                      <Receipt />
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="View Details">
                      <IconButton 
                        size="small"
                        onClick={() => window.open(`/debtors/${debtor._id}`, '_blank')}
                      >
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  );
};

export default DebtorList;
```

### 2. Comprehensive Debtor Details Component

```jsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Divider,
  CircularProgress
} from '@mui/material';
import {
  Person,
  Home,
  Payment,
  Receipt,
  AccountBalance,
  TrendingUp,
  Warning
} from '@mui/icons-material';
import axios from 'axios';

const DebtorDetails = () => {
  const { id } = useParams();
  const [debtor, setDebtor] = useState(null);
  const [statistics, setStatistics] = useState({});
  const [recentActivity, setRecentActivity] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    fetchDebtorDetails();
  }, [id]);

  const fetchDebtorDetails = async () => {
    try {
      const response = await axios.get(`/api/finance/debtors/${id}/comprehensive`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      setDebtor(response.data.debtor);
      setStatistics(response.data.statistics);
      setRecentActivity(response.data.recentActivity);
    } catch (error) {
      console.error('Error fetching debtor details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!debtor) {
    return <Box>Debtor not found</Box>;
  }

  return (
    <Box>
      {/* Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h5" gutterBottom>
                {debtor.user?.firstName} {debtor.user?.lastName}
              </Typography>
              <Typography color="textSecondary">
                {debtor.debtorCode} • {debtor.user?.email}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                {debtor.residence?.name} - Room {debtor.roomNumber}
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box display="flex" justifyContent="space-between">
                <Box>
                  <Typography variant="h6" color="error">
                    {formatCurrency(debtor.currentBalance)}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Current Balance
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="h6" color="success.main">
                    {formatCurrency(debtor.totalPaid)}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Total Paid
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="h6">
                    {formatCurrency(debtor.totalOwed)}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Total Owed
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Payment color="primary" sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="h6">{statistics.payment?.totalPayments || 0}</Typography>
                  <Typography variant="caption">Total Payments</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Receipt color="secondary" sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="h6">{statistics.invoice?.totalInvoices || 0}</Typography>
                  <Typography variant="caption">Total Invoices</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <AccountBalance color="info" sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="h6">{statistics.transaction?.totalTransactions || 0}</Typography>
                  <Typography variant="caption">Transactions</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <TrendingUp color="success" sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="h6">
                    {statistics.balance?.paymentPercentage?.toFixed(1) || 0}%
                  </Typography>
                  <Typography variant="caption">Payment Rate</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs for Different Sections */}
      <Card>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Recent Activity" />
          <Tab label="Payments" />
          <Tab label="Invoices" />
          <Tab label="Transactions" />
          <Tab label="Details" />
        </Tabs>
        
        <Divider />
        
        <CardContent>
          {/* Recent Activity Tab */}
          {activeTab === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Recent Activity (Last 30 Days)
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="primary">
                    Recent Payments ({recentActivity.payments?.length || 0})
                  </Typography>
                  {recentActivity.payments?.slice(0, 5).map((payment, index) => (
                    <Box key={index} sx={{ py: 1 }}>
                      <Typography variant="body2">
                        {formatCurrency(payment.amount)} - {formatDate(payment.paymentDate)}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {payment.paymentMethod}
                      </Typography>
                    </Box>
                  ))}
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="secondary">
                    Recent Invoices ({recentActivity.invoices?.length || 0})
                  </Typography>
                  {recentActivity.invoices?.slice(0, 5).map((invoice, index) => (
                    <Box key={index} sx={{ py: 1 }}>
                      <Typography variant="body2">
                        {formatCurrency(invoice.amount)} - {formatDate(invoice.dueDate)}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {invoice.status}
                      </Typography>
                    </Box>
                  ))}
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="info">
                    Recent Transactions ({recentActivity.transactions?.length || 0})
                  </Typography>
                  {recentActivity.transactions?.slice(0, 5).map((transaction, index) => (
                    <Box key={index} sx={{ py: 1 }}>
                      <Typography variant="body2">
                        {formatCurrency(transaction.amount)} - {formatDate(transaction.date)}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {transaction.description}
                      </Typography>
                    </Box>
                  ))}
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Payments Tab */}
          {activeTab === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Payment History
              </Typography>
              
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Method</TableCell>
                    <TableCell>Reference</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {debtor.payments?.map((payment) => (
                    <TableRow key={payment._id}>
                      <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                      <TableCell>{formatCurrency(payment.amount)}</TableCell>
                      <TableCell>{payment.paymentMethod}</TableCell>
                      <TableCell>{payment.reference}</TableCell>
                      <TableCell>
                        <Chip 
                          label={payment.status} 
                          color={payment.status === 'confirmed' ? 'success' : 'warning'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}

          {/* Invoices Tab */}
          {activeTab === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Invoice History
              </Typography>
              
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Invoice #</TableCell>
                    <TableCell>Due Date</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Description</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {debtor.invoices?.map((invoice) => (
                    <TableRow key={invoice._id}>
                      <TableCell>{invoice.invoiceNumber}</TableCell>
                      <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                      <TableCell>{formatCurrency(invoice.amount)}</TableCell>
                      <TableCell>
                        <Chip 
                          label={invoice.status} 
                          color={invoice.status === 'paid' ? 'success' : 
                                 invoice.status === 'overdue' ? 'error' : 'warning'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{invoice.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}

          {/* Transactions Tab */}
          {activeTab === 3 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Transaction History
              </Typography>
              
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Reference</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {debtor.transactions?.map((transaction) => (
                    <TableRow key={transaction._id}>
                      <TableCell>{formatDate(transaction.date)}</TableCell>
                      <TableCell>{transaction.description}</TableCell>
                      <TableCell>{formatCurrency(transaction.amount)}</TableCell>
                      <TableCell>{transaction.reference}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}

          {/* Details Tab */}
          {activeTab === 4 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Debtor Details
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom>
                    Personal Information
                  </Typography>
                  <Box sx={{ pl: 2 }}>
                    <Typography variant="body2">
                      <strong>Name:</strong> {debtor.user?.firstName} {debtor.user?.lastName}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Email:</strong> {debtor.user?.email}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Phone:</strong> {debtor.user?.phone}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Role:</strong> {debtor.user?.role}
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom>
                    Residence Information
                  </Typography>
                  <Box sx={{ pl: 2 }}>
                    <Typography variant="body2">
                      <strong>Residence:</strong> {debtor.residence?.name}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Address:</strong> {debtor.residence?.address}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Room:</strong> {debtor.roomNumber}
                    </Typography>
                    <Typography variant="body2">
                      <strong>City:</strong> {debtor.residence?.city}
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom>
                    Financial Information
                  </Typography>
                  <Box sx={{ pl: 2 }}>
                    <Typography variant="body2">
                      <strong>Account Code:</strong> {debtor.accountCode}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Credit Limit:</strong> {formatCurrency(debtor.creditLimit)}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Payment Terms:</strong> {debtor.paymentTerms}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Days Overdue:</strong> {debtor.daysOverdue}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Last Payment:</strong> {debtor.lastPaymentDate ? formatDate(debtor.lastPaymentDate) : 'None'}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default DebtorDetails;
```

## 🔧 API Usage Examples

### 1. Basic Debtor List
```javascript
const fetchDebtors = async () => {
  const response = await axios.get('/api/finance/debtors', {
    params: {
      includePayments: 'true',
      includeInvoices: 'true',
      includeTransactions: 'true'
    }
  });
  
  return response.data;
};
```

### 2. Comprehensive Debtor Details
```javascript
const fetchDebtorComprehensive = async (debtorId) => {
  const response = await axios.get(`/api/finance/debtors/${debtorId}/comprehensive`);
  
  return {
    debtor: response.data.debtor,
    statistics: response.data.statistics,
    recentActivity: response.data.recentActivity,
    summary: response.data.summary
  };
};
```

### 3. Filtered Debtor List
```javascript
const fetchFilteredDebtors = async (filters) => {
  const response = await axios.get('/api/finance/debtors', {
    params: {
      ...filters,
      includePayments: 'true',
      includeInvoices: 'true',
      includeTransactions: 'true'
    }
  });
  
  return response.data;
};
```

## 📊 Data Structure

### Comprehensive Debtor Response
```javascript
{
  success: true,
  debtor: {
    _id: "...",
    debtorCode: "DR0001",
    user: {
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phone: "+1234567890",
      role: "student"
    },
    residence: {
      name: "Student Residence A",
      address: "123 Main St",
      city: "New York",
      state: "NY"
    },
    application: {
      status: "approved",
      submittedAt: "2024-01-15T00:00:00.000Z",
      roomNumber: "101"
    },
    payments: [
      {
        _id: "...",
        amount: 500,
        paymentDate: "2024-01-20T00:00:00.000Z",
        paymentMethod: "Bank Transfer",
        status: "confirmed"
      }
    ],
    invoices: [...],
    transactions: [...],
    currentBalance: 1000,
    totalOwed: 1500,
    totalPaid: 500,
    status: "active"
  },
  statistics: {
    payment: { totalPayments: 5, totalPaid: 2500, ... },
    invoice: { totalInvoices: 3, totalInvoiced: 3000, ... },
    transaction: { totalTransactions: 8, totalTransactionAmount: 3000, ... },
    balance: { currentBalance: 1000, paymentPercentage: 83.3, ... }
  },
  recentActivity: {
    payments: [...],
    invoices: [...],
    transactions: [...]
  },
  summary: {
    totalRecentPayments: 2,
    totalRecentInvoices: 1,
    totalRecentTransactions: 3,
    lastActivity: "2024-01-20T00:00:00.000Z"
  }
}
```

## 🎯 Benefits

1. **Single API Call**: Get all related data in one request
2. **Optimized Performance**: No need for multiple API calls
3. **Rich Data**: Complete debtor profile with statistics
4. **Flexible Filtering**: Include/exclude related data as needed
5. **Real-time Statistics**: Calculated payment rates, overdue amounts, etc.

## 🔄 Automatic Updates

The mapping system automatically updates when:
- New payments are made
- New invoices are created
- New transactions are recorded
- Applications are approved

This ensures your frontend always has the most up-to-date information without manual synchronization.

---

**Ready to implement?** Start with the mapping update script and then use the comprehensive API endpoints for optimal frontend performance! 