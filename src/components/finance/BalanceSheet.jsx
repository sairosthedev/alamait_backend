import React, { useState, useEffect } from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Typography,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Grid,
    useTheme
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { toast } from 'react-toastify';
import financeService from '../../services/financeService';

const BalanceSheet = () => {
    const theme = useTheme();
    const [balanceSheet, setBalanceSheet] = useState({
        assets: [],
        liabilities: [],
        equity: [],
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0,
        netWorth: 0
    });
    const [openDialog, setOpenDialog] = useState(false);
    const [editingEntry, setEditingEntry] = useState(null);
    const [formData, setFormData] = useState({
        type: 'asset',
        category: '',
        name: '',
        value: '',
        description: ''
    });

    useEffect(() => {
        fetchBalanceSheetData();
    }, []);

    const fetchBalanceSheetData = async () => {
        try {
            const data = await financeService.getBalanceSheetEntries();
            
            // Calculate totals
            const totalAssets = data.assets.reduce((sum, asset) => sum + (parseFloat(asset.value) || 0), 0);
            const totalLiabilities = data.liabilities.reduce((sum, liability) => sum + (parseFloat(liability.value) || 0), 0);
            const totalEquity = data.equity.reduce((sum, equity) => sum + (parseFloat(equity.value) || 0), 0);
            
            setBalanceSheet({
                ...data,
                totalAssets,
                totalLiabilities,
                totalEquity,
                netWorth: totalAssets - totalLiabilities
            });
        } catch (error) {
            toast.error('Failed to fetch balance sheet data');
            console.error('Error fetching balance sheet data:', error);
        }
    };

    const handleOpenDialog = (entry = null) => {
        if (entry) {
            setEditingEntry(entry);
            setFormData({
                type: entry.type,
                category: entry.category,
                name: entry.name,
                value: entry.value,
                description: entry.description || ''
            });
        } else {
            setEditingEntry(null);
            setFormData({
                type: 'asset',
                category: '',
                name: '',
                value: '',
                description: ''
            });
        }
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setEditingEntry(null);
        setFormData({
            type: 'asset',
            category: '',
            name: '',
            value: '',
            description: ''
        });
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleAddEntry = async (entryData) => {
        try {
            console.log('Sending entry data:', entryData);
            
            // Map the type to the correct endpoint type
            const typeMap = {
                'Current': 'liability',
                'Non-Current': 'liability',
                'Fixed': 'asset',
                'Current Asset': 'asset',
                'Equity': 'equity'
            };

            const mappedType = typeMap[entryData.type] || entryData.type;
            const dataToSend = {
                ...entryData,
                type: mappedType
            };

            if (entryData._id) {
                await financeService.updateBalanceSheetEntry(entryData._id, dataToSend);
            } else {
                await financeService.addBalanceSheetEntry(dataToSend);
            }
            
            toast.success('Entry saved successfully');
            fetchBalanceSheetData();
        } catch (error) {
            console.error('Error saving entry:', error);
            toast.error(error.message || 'Failed to save entry');
        }
    };

    const handleDelete = async (entryId, type) => {
        if (window.confirm('Are you sure you want to delete this entry?')) {
            try {
                await financeService.deleteBalanceSheetEntry(entryId, type);
                toast.success('Entry deleted successfully');
                fetchBalanceSheetData();
            } catch (error) {
                toast.error(error.message || 'Failed to delete entry');
                console.error('Error deleting entry:', error);
            }
        }
    };

    const renderEntryTable = (entries, type) => (
        <TableContainer component={Paper} sx={{ mb: 3 }}>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell>Category</TableCell>
                        <TableCell>Name</TableCell>
                        <TableCell align="right">Value</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell align="center">Actions</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {entries.map((entry) => (
                        <TableRow key={entry._id}>
                            <TableCell>{entry.category}</TableCell>
                            <TableCell>{entry.name}</TableCell>
                            <TableCell align="right">${entry.value.toLocaleString()}</TableCell>
                            <TableCell>{entry.description}</TableCell>
                            <TableCell align="center">
                                <IconButton
                                    size="small"
                                    onClick={() => handleOpenDialog({ ...entry, type })}
                                    sx={{ mr: 1 }}
                                >
                                    <EditIcon />
                                </IconButton>
                                <IconButton
                                    size="small"
                                    onClick={() => handleDelete(entry._id, type)}
                                    color="error"
                                >
                                    <DeleteIcon />
                                </IconButton>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h4" component="h1">
                    Balance Sheet
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenDialog()}
                >
                    Add Entry
                </Button>
            </Box>

            <Grid container spacing={3}>
                <Grid item xs={12}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Assets
                            </Typography>
                            {renderEntryTable(balanceSheet.assets, 'asset')}
                            <Typography variant="subtitle1" align="right">
                                Total Assets: ${balanceSheet.totalAssets.toLocaleString()}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Liabilities
                            </Typography>
                            {renderEntryTable(balanceSheet.liabilities, 'liability')}
                            <Typography variant="subtitle1" align="right">
                                Total Liabilities: ${balanceSheet.totalLiabilities.toLocaleString()}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Equity
                            </Typography>
                            {renderEntryTable(balanceSheet.equity, 'equity')}
                            <Typography variant="subtitle1" align="right">
                                Total Equity: ${balanceSheet.totalEquity.toLocaleString()}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Net Worth
                            </Typography>
                            <Typography variant="h4" align="right" color="primary">
                                ${balanceSheet.netWorth.toLocaleString()}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {editingEntry ? 'Edit Entry' : 'Add New Entry'}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 2 }}>
                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Type</InputLabel>
                            <Select
                                name="type"
                                value={formData.type}
                                onChange={handleInputChange}
                                label="Type"
                            >
                                <MenuItem value="asset">Asset</MenuItem>
                                <MenuItem value="liability">Liability</MenuItem>
                                <MenuItem value="equity">Equity</MenuItem>
                            </Select>
                        </FormControl>

                        <TextField
                            fullWidth
                            label="Category"
                            name="category"
                            value={formData.category}
                            onChange={handleInputChange}
                            sx={{ mb: 2 }}
                        />

                        <TextField
                            fullWidth
                            label="Name"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            sx={{ mb: 2 }}
                        />

                        <TextField
                            fullWidth
                            label="Value"
                            name="value"
                            type="number"
                            value={formData.value}
                            onChange={handleInputChange}
                            sx={{ mb: 2 }}
                        />

                        <TextField
                            fullWidth
                            label="Description"
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            multiline
                            rows={3}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Cancel</Button>
                    <Button onClick={() => handleAddEntry(formData)} variant="contained">
                        {editingEntry ? 'Update' : 'Add'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default BalanceSheet; 