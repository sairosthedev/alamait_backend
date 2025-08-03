import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  User, 
  FileText,
  Eye,
  Filter,
  Download
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '@/lib/api';
import FinanceSidebar from '@/components/FinanceSidebar';

const TransactionTracker = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    type: 'all',
    account: 'all',
    status: ''
  });
  const [summary, setSummary] = useState({
    totalDebits: 0,
    totalCredits: 0,
    netAmount: 0,
    transactionCount: 0
  });
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);

  useEffect(() => {
    fetchTransactions();
    fetchSummary();
  }, [filters]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      
      // Build query parameters
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.type !== 'all') params.append('type', filters.type);
      if (filters.account !== 'all') params.append('account', filters.account);
      if (filters.status) params.append('status', filters.status);
      
      const response = await api.get(`/transactions/entries?${params.toString()}`);
      
      if (response.data.success) {
        setTransactions(response.data.data || []);
      } else {
        setTransactions([]);
        toast.error('Failed to fetch transactions');
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setTransactions([]);
      toast.error('Error fetching transactions');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.type !== 'all') params.append('type', filters.type);
      if (filters.account !== 'all') params.append('account', filters.account);
      if (filters.status) params.append('status', filters.status);
      
      const response = await api.get(`/transactions/summary?${params.toString()}`);
      
      if (response.data.success) {
        setSummary(response.data.data || {
          totalDebits: 0,
          totalCredits: 0,
          netAmount: 0,
          transactionCount: 0
        });
      } else {
        setSummary({
          totalDebits: 0,
          totalCredits: 0,
          netAmount: 0,
          transactionCount: 0
        });
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
      setSummary({
        totalDebits: 0,
        totalCredits: 0,
        netAmount: 0,
        transactionCount: 0
      });
    }
  };

  const handleViewTransaction = (transaction) => {
    setSelectedTransaction(transaction);
    setShowTransactionDetails(true);
  };

  const getTransactionTypeIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'debit':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      case 'credit':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      default:
        return <DollarSign className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTransactionTypeBadge = (type) => {
    switch (type?.toLowerCase()) {
      case 'debit':
        return <Badge variant="destructive">Debit</Badge>;
      case 'credit':
        return <Badge variant="default">Credit</Badge>;
      default:
        return <Badge variant="secondary">{type || 'Unknown'}</Badge>;
    }
  };

  const getAccountTypeBadge = (accountType) => {
    switch (accountType?.toLowerCase()) {
      case 'asset':
        return <Badge variant="outline" className="text-blue-600">Asset</Badge>;
      case 'liability':
        return <Badge variant="outline" className="text-red-600">Liability</Badge>;
      case 'equity':
        return <Badge variant="outline" className="text-green-600">Equity</Badge>;
      case 'revenue':
        return <Badge variant="outline" className="text-purple-600">Revenue</Badge>;
      case 'expense':
        return <Badge variant="outline" className="text-orange-600">Expense</Badge>;
      default:
        return <Badge variant="outline">{accountType || 'Unknown'}</Badge>;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      type: 'all',
      account: 'all',
      status: ''
    });
  };

  const exportTransactions = () => {
    toast.info('Export functionality coming soon');
  };

  return (
    <div className="flex">
      <FinanceSidebar />
      <div className="flex-1 p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transaction Tracker</h1>
            <p className="text-gray-600 dark:text-gray-400">Double-entry bookkeeping system</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportTransactions}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Debits</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalDebits)}</p>
                </div>
                <TrendingDown className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Credits</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalCredits)}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Net Amount</p>
                  <p className={`text-2xl font-bold ${summary.netAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(summary.netAmount)}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Transactions</p>
                  <p className="text-2xl font-bold text-gray-900">{summary.transactionCount}</p>
                </div>
                <FileText className="w-8 h-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="type">Transaction Type</Label>
                <Select value={filters.type} onValueChange={(value) => setFilters(prev => ({ ...prev, type: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="debit">Debit</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="account">Account</Label>
                <Select value={filters.account} onValueChange={(value) => setFilters(prev => ({ ...prev, account: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="All accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All accounts</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="accounts_payable">Accounts Payable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={clearFilters} className="w-full">
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction Entries</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading transactions...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => (
                      <TableRow key={transaction._id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            {formatDate(transaction.timestamp || transaction.date || transaction.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getTransactionTypeIcon(transaction.type)}
                            {getTransactionTypeBadge(transaction.type)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{transaction.accountName || transaction.account?.name || 'N/A'}</span>
                            {getAccountTypeBadge(transaction.accountType || transaction.account?.type)}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {transaction.description || 'No description'}
                        </TableCell>
                        <TableCell>
                          <span className={`font-bold ${transaction.type === 'debit' ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(transaction.amount)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 text-sm">
                            <span className="font-medium">{transaction.referenceType || 'N/A'}</span>
                            <span className="text-gray-500">{transaction.referenceId || 'N/A'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewTransaction(transaction)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {transactions.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No transactions found
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transaction Details Modal */}
        <Dialog open={showTransactionDetails} onOpenChange={setShowTransactionDetails}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Transaction Details</DialogTitle>
            </DialogHeader>
            {selectedTransaction && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Transaction ID</Label>
                    <p className="text-sm">{selectedTransaction._id}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Date</Label>
                    <p className="text-sm">{formatDate(selectedTransaction.timestamp || selectedTransaction.date || selectedTransaction.createdAt)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Type</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {getTransactionTypeIcon(selectedTransaction.type)}
                      {getTransactionTypeBadge(selectedTransaction.type)}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Amount</Label>
                    <p className={`text-lg font-bold ${selectedTransaction.type === 'debit' ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(selectedTransaction.amount)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Account</Label>
                    <p className="text-sm">{selectedTransaction.accountName || selectedTransaction.account?.name || 'N/A'}</p>
                    {getAccountTypeBadge(selectedTransaction.accountType || selectedTransaction.account?.type)}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Account Type</Label>
                    <p className="text-sm">{selectedTransaction.accountType || selectedTransaction.account?.type || 'N/A'}</p>
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-600">Description</Label>
                  <p className="text-sm mt-1">{selectedTransaction.description || 'No description'}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Reference Type</Label>
                    <p className="text-sm">{selectedTransaction.referenceType || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Reference ID</Label>
                    <p className="text-sm">{selectedTransaction.referenceId || 'N/A'}</p>
                  </div>
                </div>
                
                {selectedTransaction.metadata && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Additional Details</Label>
                    <pre className="text-sm bg-gray-50 p-2 rounded mt-1 overflow-auto">
                      {JSON.stringify(selectedTransaction.metadata, null, 2)}
                    </pre>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Created By</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <User className="w-4 h-4 text-gray-500" />
                      <p className="text-sm">{selectedTransaction.createdByEmail || selectedTransaction.createdBy?.email || 'System'}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Created At</Label>
                    <p className="text-sm">{formatDate(selectedTransaction.createdAt)}</p>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default TransactionTracker; 