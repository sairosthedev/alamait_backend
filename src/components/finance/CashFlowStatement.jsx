import React, { useState, useEffect } from 'react';
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
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Grid,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    CircularProgress,
    Alert,
    useTheme,
    IconButton,
    Tooltip
} from '@mui/material';
import {
    TrendingUp as TrendingUpIcon,
    TrendingDown as TrendingDownIcon,
    Visibility as VisibilityIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import financeService from '../../services/financeService';

const CashFlowStatement = () => {
    const theme = useTheme();
    const [cashFlowData, setCashFlowData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [period, setPeriod] = useState(new Date().getFullYear().toString());
    const [basis, setBasis] = useState('cash');
    const [residenceId, setResidenceId] = useState('');
    const [residences, setResidences] = useState([]);
    
    // Drill-down modal state
    const [drillDownOpen, setDrillDownOpen] = useState(false);
    const [drillDownData, setDrillDownData] = useState(null);
    const [drillDownLoading, setDrillDownLoading] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(null);

    useEffect(() => {
        fetchResidences();
        fetchCashFlowData();
    }, [period, basis, residenceId]);

    const fetchResidences = async () => {
        try {
            const data = await financeService.getResidences();
            setResidences(data.residences || []);
        } catch (error) {
            console.error('Error fetching residences:', error);
        }
    };

    const fetchCashFlowData = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await financeService.getCashFlowWithDrillDown(period, basis, residenceId);
            setCashFlowData(data.data);
        } catch (error) {
            setError('Failed to fetch cash flow data');
            console.error('Error fetching cash flow data:', error);
            toast.error('Failed to fetch cash flow data');
        } finally {
            setLoading(false);
        }
    };

    const handleDrillDown = async (accountCode, month, accountName) => {
        setDrillDownLoading(true);
        setSelectedAccount({ code: accountCode, name: accountName });
        setSelectedMonth(month);
        
        try {
            const data = await financeService.getAccountTransactionDetails(period, month, accountCode, residenceId);
            setDrillDownData(data.data);
            setDrillDownOpen(true);
        } catch (error) {
            console.error('Error fetching drill-down data:', error);
            toast.error('Failed to fetch transaction details');
        } finally {
            setDrillDownLoading(false);
        }
    };

    const handleCloseDrillDown = () => {
        setDrillDownOpen(false);
        setDrillDownData(null);
        setSelectedAccount(null);
        setSelectedMonth(null);
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    const getAccountColor = (accountCode) => {
        // Color coding based on account type
        if (accountCode.startsWith('1')) return theme.palette.primary.main; // Assets
        if (accountCode.startsWith('2')) return theme.palette.warning.main; // Liabilities
        if (accountCode.startsWith('4')) return theme.palette.success.main; // Income
        if (accountCode.startsWith('5')) return theme.palette.error.main; // Expenses
        return theme.palette.grey[600];
    };

    const renderAccountBreakdown = (breakdown, month, sectionTitle) => {
        if (!breakdown || Object.keys(breakdown).length === 0) {
            return (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    No {sectionTitle.toLowerCase()} for this month
                </Typography>
            );
        }

        return (
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Account</TableCell>
                            <TableCell align="right">Inflows</TableCell>
                            <TableCell align="right">Outflows</TableCell>
                            <TableCell align="right">Net</TableCell>
                            <TableCell align="center">Details</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {Object.entries(breakdown).map(([accountCode, data]) => {
                            const hasActivity = data.inflows > 0 || data.outflows > 0;
                            const netAmount = data.inflows - data.outflows;
                            
                            return (
                                <TableRow key={accountCode} hover={hasActivity}>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Chip
                                                label={accountCode}
                                                size="small"
                                                sx={{
                                                    backgroundColor: getAccountColor(accountCode),
                                                    color: 'white',
                                                    fontSize: '0.75rem'
                                                }}
                                            />
                                            <Typography variant="body2">
                                                {data.accountName || `Account ${accountCode}`}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell align="right">
                                        {data.inflows > 0 && (
                                            <Typography variant="body2" color="success.main">
                                                {formatCurrency(data.inflows)}
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell align="right">
                                        {data.outflows > 0 && (
                                            <Typography variant="body2" color="error.main">
                                                {formatCurrency(data.outflows)}
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell align="right">
                                        <Typography
                                            variant="body2"
                                            color={netAmount >= 0 ? 'success.main' : 'error.main'}
                                            sx={{ fontWeight: 'bold' }}
                                        >
                                            {formatCurrency(netAmount)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        {hasActivity && data.drillDownUrl && (
                                            <Tooltip title="View transaction details">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleDrillDown(accountCode, month, data.accountName)}
                                                    color="primary"
                                                >
                                                    <VisibilityIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        );
    };

    const renderMonthlySection = (monthData, monthName) => {
        const { operating_activities, investing_activities, financing_activities } = monthData;
        
        return (
            <Card key={monthName} sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ textTransform: 'capitalize' }}>
                        {monthName} {period}
                    </Typography>
                    
                    <Grid container spacing={3}>
                        <Grid item xs={12} md={4}>
                            <Typography variant="subtitle1" gutterBottom color="primary">
                                Operating Activities
                            </Typography>
                            {renderAccountBreakdown(operating_activities.breakdown, monthName, 'Operating Activities')}
                            <Typography variant="body2" align="right" sx={{ fontWeight: 'bold' }}>
                                Net Operating: {formatCurrency(operating_activities.net)}
                            </Typography>
                        </Grid>
                        
                        <Grid item xs={12} md={4}>
                            <Typography variant="subtitle1" gutterBottom color="secondary">
                                Investing Activities
                            </Typography>
                            {renderAccountBreakdown(investing_activities.breakdown, monthName, 'Investing Activities')}
                            <Typography variant="body2" align="right" sx={{ fontWeight: 'bold' }}>
                                Net Investing: {formatCurrency(investing_activities.net)}
                            </Typography>
                        </Grid>
                        
                        <Grid item xs={12} md={4}>
                            <Typography variant="subtitle1" gutterBottom color="info">
                                Financing Activities
                            </Typography>
                            {renderAccountBreakdown(financing_activities.breakdown, monthName, 'Financing Activities')}
                            <Typography variant="body2" align="right" sx={{ fontWeight: 'bold' }}>
                                Net Financing: {formatCurrency(financing_activities.net)}
                            </Typography>
                        </Grid>
                    </Grid>
                    
                    <Box sx={{ mt: 2, p: 2, backgroundColor: theme.palette.grey[50], borderRadius: 1 }}>
                        <Typography variant="h6" align="right">
                            Net Cash Flow: {formatCurrency(monthData.net_cash_flow)}
                        </Typography>
                    </Box>
                </CardContent>
            </Card>
        );
    };

    const renderDrillDownModal = () => {
        if (!drillDownData) return null;

        const { summary, transactions } = drillDownData;

        return (
            <Dialog
                open={drillDownOpen}
                onClose={handleCloseDrillDown}
                maxWidth="lg"
                fullWidth
            >
                <DialogTitle>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                            <Typography variant="h6">
                                {selectedAccount?.name} - {selectedMonth} {period}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Account Code: {selectedAccount?.code}
                            </Typography>
                        </Box>
                        <IconButton onClick={handleCloseDrillDown}>
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </DialogTitle>
                
                <DialogContent>
                    {drillDownLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <Box>
                            {/* Summary */}
                            <Card sx={{ mb: 3 }}>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Summary
                                    </Typography>
                                    <Grid container spacing={2}>
                                        <Grid item xs={6} md={3}>
                                            <Typography variant="body2" color="text.secondary">
                                                Total Transactions
                                            </Typography>
                                            <Typography variant="h6">
                                                {summary.totalTransactions}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={6} md={3}>
                                            <Typography variant="body2" color="text.secondary">
                                                Total Amount
                                            </Typography>
                                            <Typography variant="h6" color="primary">
                                                {formatCurrency(summary.totalAmount)}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={6} md={3}>
                                            <Typography variant="body2" color="text.secondary">
                                                Total Credits
                                            </Typography>
                                            <Typography variant="h6" color="success.main">
                                                {formatCurrency(summary.totalCredits)}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={6} md={3}>
                                            <Typography variant="body2" color="text.secondary">
                                                Total Debits
                                            </Typography>
                                            <Typography variant="h6" color="error.main">
                                                {formatCurrency(summary.totalDebits)}
                                            </Typography>
                                        </Grid>
                                    </Grid>
                                </CardContent>
                            </Card>

                            {/* Transactions */}
                            <TableContainer component={Paper}>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Date</TableCell>
                                            <TableCell>Description</TableCell>
                                            <TableCell>Student</TableCell>
                                            <TableCell>Type</TableCell>
                                            <TableCell align="right">Amount</TableCell>
                                            <TableCell>Reference</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {transactions.map((tx, index) => (
                                            <TableRow key={index}>
                                                <TableCell>
                                                    {new Date(tx.date).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell>{tx.description}</TableCell>
                                                <TableCell>{tx.studentName}</TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={tx.type}
                                                        size="small"
                                                        color={tx.type === 'credit' ? 'success' : 'error'}
                                                    />
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Typography
                                                        color={tx.type === 'credit' ? 'success.main' : 'error.main'}
                                                    >
                                                        {formatCurrency(tx.amount)}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>{tx.reference || 'N/A'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    )}
                </DialogContent>
                
                <DialogActions>
                    <Button onClick={handleCloseDrillDown}>Close</Button>
                </DialogActions>
            </Dialog>
        );
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">{error}</Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" component="h1">
                    Cash Flow Statement
                </Typography>
                <Button
                    variant="contained"
                    onClick={fetchCashFlowData}
                    disabled={loading}
                >
                    Refresh
                </Button>
            </Box>

            {/* Filters */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={3}>
                            <FormControl fullWidth>
                                <InputLabel>Period</InputLabel>
                                <Select
                                    value={period}
                                    onChange={(e) => setPeriod(e.target.value)}
                                    label="Period"
                                >
                                    {Array.from({ length: 5 }, (_, i) => {
                                        const year = new Date().getFullYear() - i;
                                        return (
                                            <MenuItem key={year} value={year.toString()}>
                                                {year}
                                            </MenuItem>
                                        );
                                    })}
                                </Select>
                            </FormControl>
                        </Grid>
                        
                        <Grid item xs={12} sm={3}>
                            <FormControl fullWidth>
                                <InputLabel>Basis</InputLabel>
                                <Select
                                    value={basis}
                                    onChange={(e) => setBasis(e.target.value)}
                                    label="Basis"
                                >
                                    <MenuItem value="cash">Cash Basis</MenuItem>
                                    <MenuItem value="accrual">Accrual Basis</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        
                        <Grid item xs={12} sm={4}>
                            <FormControl fullWidth>
                                <InputLabel>Residence</InputLabel>
                                <Select
                                    value={residenceId}
                                    onChange={(e) => setResidenceId(e.target.value)}
                                    label="Residence"
                                >
                                    <MenuItem value="">All Residences</MenuItem>
                                    {residences.map((residence) => (
                                        <MenuItem key={residence._id} value={residence._id}>
                                            {residence.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Cash Flow Data */}
            {cashFlowData && (
                <Box>
                    {/* Yearly Summary */}
                    <Card sx={{ mb: 3 }}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Yearly Summary ({period})
                            </Typography>
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={4}>
                                    <Typography variant="subtitle1" gutterBottom color="primary">
                                        Operating Activities
                                    </Typography>
                                    {renderAccountBreakdown(cashFlowData.yearly_totals.operating_activities.breakdown, 'yearly', 'Operating Activities')}
                                    <Typography variant="body2" align="right" sx={{ fontWeight: 'bold' }}>
                                        Net Operating: {formatCurrency(cashFlowData.yearly_totals.operating_activities.net)}
                                    </Typography>
                                </Grid>
                                
                                <Grid item xs={12} md={4}>
                                    <Typography variant="subtitle1" gutterBottom color="secondary">
                                        Investing Activities
                                    </Typography>
                                    {renderAccountBreakdown(cashFlowData.yearly_totals.investing_activities.breakdown, 'yearly', 'Investing Activities')}
                                    <Typography variant="body2" align="right" sx={{ fontWeight: 'bold' }}>
                                        Net Investing: {formatCurrency(cashFlowData.yearly_totals.investing_activities.net)}
                                    </Typography>
                                </Grid>
                                
                                <Grid item xs={12} md={4}>
                                    <Typography variant="subtitle1" gutterBottom color="info">
                                        Financing Activities
                                    </Typography>
                                    {renderAccountBreakdown(cashFlowData.yearly_totals.financing_activities.breakdown, 'yearly', 'Financing Activities')}
                                    <Typography variant="body2" align="right" sx={{ fontWeight: 'bold' }}>
                                        Net Financing: {formatCurrency(cashFlowData.yearly_totals.financing_activities.net)}
                                    </Typography>
                                </Grid>
                            </Grid>
                            
                            <Box sx={{ mt: 2, p: 2, backgroundColor: theme.palette.primary.light, borderRadius: 1 }}>
                                <Typography variant="h5" align="right" color="primary.contrastText">
                                    Total Net Cash Flow: {formatCurrency(cashFlowData.yearly_totals.net_cash_flow)}
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>

                    {/* Monthly Breakdowns */}
                    <Typography variant="h5" gutterBottom>
                        Monthly Breakdown
                    </Typography>
                    {Object.entries(cashFlowData.monthly_breakdown).map(([monthName, monthData]) =>
                        renderMonthlySection(monthData, monthName)
                    )}
                </Box>
            )}

            {/* Drill-down Modal */}
            {renderDrillDownModal()}
        </Box>
    );
};

export default CashFlowStatement;


