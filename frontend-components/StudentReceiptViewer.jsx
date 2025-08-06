import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
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
  Button,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Receipt as ReceiptIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  Email as EmailIcon
} from '@mui/icons-material';

const StudentReceiptViewer = () => {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  // Fetch student's receipts
  const fetchMyReceipts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get current user's student ID from context or localStorage
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const studentId = user._id;
      
      if (!studentId) {
        setError('User information not found');
        return;
      }

      const response = await axios.get(`/api/receipts/student/${studentId}`);
      setReceipts(response.data.data);
    } catch (err) {
      setError('Failed to fetch receipts: ' + (err.response?.data?.message || err.message));
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
    fetchMyReceipts();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <ReceiptIcon sx={{ mr: 2, fontSize: 32 }} />
        <Typography variant="h4" component="h1">
          My Receipts
        </Typography>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Receipts Table */}
      <Card>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : receipts.length === 0 ? (
            <Box sx={{ textAlign: 'center', p: 3 }}>
              <ReceiptIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No receipts found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                You don't have any receipts yet. Receipts will appear here after payments are processed.
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Receipt Number</TableCell>
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

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
                
                <Grid item xs={12} md={6}>
                  <Typography variant="h6">Payment Information</Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText
                        primary="Payment Method"
                        secondary={selectedReceipt.paymentMethod?.replace('_', ' ').toUpperCase()}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Payment Reference"
                        secondary={selectedReceipt.paymentReference}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Residence"
                        secondary={selectedReceipt.residence?.name}
                      />
                    </ListItem>
                    {selectedReceipt.room && (
                      <ListItem>
                        <ListItemText
                          primary="Room"
                          secondary={selectedReceipt.room?.roomNumber}
                        />
                      </ListItem>
                    )}
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
            <Button
              onClick={() => downloadReceipt(selectedReceipt._id)}
              startIcon={<DownloadIcon />}
              variant="contained"
            >
              Download PDF
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StudentReceiptViewer; 