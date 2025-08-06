import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Grid,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  Receipt as ReceiptIcon,
  Download as DownloadIcon,
  Email as EmailIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Visibility as ViewIcon,
  Print as PrintIcon
} from '@mui/icons-material';

const ReceiptManagement = () => {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  
  // Filter states
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    student: '',
    status: '',
    startDate: '',
    endDate: '',
    search: '',
    sortBy: 'receiptDate',
    sortOrder: 'desc'
  });
  
  // Create receipt form
  const [createForm, setCreateForm] = useState({
    paymentId: '',
    items: [{ description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }],
    notes: '',
    template: 'default'
  });
  
  const [payments, setPayments] = useState([]);
  const [students, setStudents] = useState([]);

  // Fetch receipts
  const fetchReceipts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const queryParams = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key]) {
          queryParams.append(key, filters[key]);
        }
      });

      const response = await axios.get(`/api/receipts?${queryParams}`);
      setReceipts(response.data.data);
    } catch (err) {
      setError('Failed to fetch receipts: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Fetch payments for receipt creation
  const fetchPayments = async () => {
    try {
      const response = await axios.get('/api/payments?status=completed');
      setPayments(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    }
  };

  // Fetch students for receipt creation
  const fetchStudents = async () => {
    try {
      const response = await axios.get('/api/finance/users?role=student');
      setStudents(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch students:', err);
    }
  };

  // Create receipt
  const createReceipt = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post('/api/receipts', createForm);
      setSuccess('Receipt created and sent successfully!');
      setCreateDialogOpen(false);
      resetCreateForm();
      fetchReceipts();
    } catch (err) {
      setError('Failed to create receipt: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Download receipt
  const downloadReceipt = async (receiptId) => {
    try {
      const response = await axios.get(`/api/receipts/${receiptId}/download`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `receipt-${receiptId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Failed to download receipt: ' + (err.response?.data?.message || err.message));
    }
  };

  // Resend receipt email
  const resendReceiptEmail = async (receiptId) => {
    try {
      await axios.post(`/api/receipts/${receiptId}/resend-email`);
      setSuccess('Receipt email sent successfully!');
      fetchReceipts();
    } catch (err) {
      setError('Failed to resend email: ' + (err.response?.data?.message || err.message));
    }
  };

  // Delete receipt
  const deleteReceipt = async (receiptId) => {
    if (!window.confirm('Are you sure you want to delete this receipt?')) {
      return;
    }
    
    try {
      await axios.delete(`/api/receipts/${receiptId}`);
      setSuccess('Receipt deleted successfully!');
      fetchReceipts();
    } catch (err) {
      setError('Failed to delete receipt: ' + (err.response?.data?.message || err.message));
    }
  };

  // View receipt details
  const viewReceipt = async (receiptId) => {
    try {
      const response = await axios.get(`/api/receipts/${receiptId}`);
      setSelectedReceipt(response.data.data);
      setViewDialogOpen(true);
    } catch (err) {
      setError('Failed to fetch receipt details: ' + (err.response?.data?.message || err.message));
    }
  };

  // Reset create form
  const resetCreateForm = () => {
    setCreateForm({
      paymentId: '',
      items: [{ description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }],
      notes: '',
      template: 'default'
    });
  };

  // Add item to receipt
  const addItem = () => {
    setCreateForm(prev => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }]
    }));
  };

  // Remove item from receipt
  const removeItem = (index) => {
    setCreateForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Update item in receipt
  const updateItem = (index, field, value) => {
    setCreateForm(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      
      // Calculate total price
      if (field === 'quantity' || field === 'unitPrice') {
        const quantity = field === 'quantity' ? value : newItems[index].quantity;
        const unitPrice = field === 'unitPrice' ? value : newItems[index].unitPrice;
        newItems[index].totalPrice = quantity * unitPrice;
      }
      
      return { ...prev, items: newItems };
    });
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'sent': return 'success';
      case 'pending': return 'warning';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Format date
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString();
  };

  useEffect(() => {
    fetchReceipts();
    fetchPayments();
    fetchStudents();
  }, [filters]);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Receipt Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create Receipt
        </Button>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            <FilterIcon sx={{ mr: 1 }} />
            Filters
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Search"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                placeholder="Receipt number, reference..."
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="sent">Sent</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="failed">Failed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                type="date"
                label="Start Date"
                value={filters.startDate}
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                type="date"
                label="End Date"
                value={filters.endDate}
                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Receipts Table */}
      <Card>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Receipt Number</TableCell>
                    <TableCell>Student</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {receipts.map((receipt) => (
                    <TableRow key={receipt._id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {receipt.receiptNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {receipt.student ? `${receipt.student.firstName} ${receipt.student.lastName}` : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {formatCurrency(receipt.totalAmount)}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatDate(receipt.receiptDate)}</TableCell>
                      <TableCell>
                        <Chip
                          label={receipt.status}
                          color={getStatusColor(receipt.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Tooltip title="View Details">
                          <IconButton onClick={() => viewReceipt(receipt._id)}>
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Download PDF">
                          <IconButton onClick={() => downloadReceipt(receipt._id)}>
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Resend Email">
                          <IconButton onClick={() => resendReceiptEmail(receipt._id)}>
                            <EmailIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton onClick={() => deleteReceipt(receipt._id)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Create Receipt Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Receipt</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Payment</InputLabel>
                <Select
                  value={createForm.paymentId}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, paymentId: e.target.value }))}
                >
                  {payments.map((payment) => (
                    <MenuItem key={payment._id} value={payment._id}>
                      {payment.reference} - {formatCurrency(payment.amount)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Items
              </Typography>
              {createForm.items.map((item, index) => (
                <Box key={index} sx={{ mb: 2, p: 2, border: '1px solid #ddd', borderRadius: 1 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Description"
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={2}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Quantity"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value))}
                      />
                    </Grid>
                    <Grid item xs={12} sm={2}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Unit Price"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value))}
                      />
                    </Grid>
                    <Grid item xs={12} sm={1}>
                      <TextField
                        fullWidth
                        label="Total"
                        value={formatCurrency(item.totalPrice)}
                        InputProps={{ readOnly: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={1}>
                      <IconButton onClick={() => removeItem(index)} color="error">
                        <DeleteIcon />
                      </IconButton>
                    </Grid>
                  </Grid>
                </Box>
              ))}
              <Button onClick={addItem} startIcon={<AddIcon />}>
                Add Item
              </Button>
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notes"
                value={createForm.notes}
                onChange={(e) => setCreateForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={createReceipt} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={20} /> : 'Create Receipt'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Receipt Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Receipt Details - {selectedReceipt?.receiptNumber}
        </DialogTitle>
        <DialogContent>
          {selectedReceipt && (
            <Box>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6">Student Information</Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText
                        primary="Name"
                        secondary={`${selectedReceipt.student?.firstName} ${selectedReceipt.student?.lastName}`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Email"
                        secondary={selectedReceipt.student?.email}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Phone"
                        secondary={selectedReceipt.student?.phone}
                      />
                    </ListItem>
                  </List>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="h6">Receipt Information</Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText
                        primary="Receipt Number"
                        secondary={selectedReceipt.receiptNumber}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Date"
                        secondary={formatDate(selectedReceipt.receiptDate)}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Status"
                        secondary={
                          <Chip
                            label={selectedReceipt.status}
                            color={getStatusColor(selectedReceipt.status)}
                            size="small"
                          />
                        }
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Total Amount"
                        secondary={formatCurrency(selectedReceipt.totalAmount)}
                      />
                    </ListItem>
                  </List>
                </Grid>
                
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6">Items</Typography>
                  <TableContainer component={Paper}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Description</TableCell>
                          <TableCell>Quantity</TableCell>
                          <TableCell>Unit Price</TableCell>
                          <TableCell>Total</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedReceipt.items?.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.description}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                            <TableCell>{formatCurrency(item.totalPrice)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
                
                {selectedReceipt.notes && (
                  <Grid item xs={12}>
                    <Typography variant="h6">Notes</Typography>
                    <Typography variant="body2">{selectedReceipt.notes}</Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          {selectedReceipt && (
            <>
              <Button
                onClick={() => downloadReceipt(selectedReceipt._id)}
                startIcon={<DownloadIcon />}
              >
                Download
              </Button>
              <Button
                onClick={() => resendReceiptEmail(selectedReceipt._id)}
                startIcon={<EmailIcon />}
              >
                Resend Email
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ReceiptManagement; 