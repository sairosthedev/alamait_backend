import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Button, 
    Checkbox, 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableRow,
    Paper,
    Typography,
    Box,
    Alert,
    CircularProgress,
    Chip,
    Select,
    MenuItem,
    FormControl,
    InputLabel
} from '@mui/material';
import { 
    Download as DownloadIcon,
    CloudDownload as CloudDownloadIcon,
    SelectAll as SelectAllIcon,
    Clear as ClearIcon
} from '@mui/icons-material';

const LeaseBulkDownload = () => {
    const [leases, setLeases] = useState([]);
    const [selectedLeases, setSelectedLeases] = useState([]);
    const [loading, setLoading] = useState(false);
    const [downloadLoading, setDownloadLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [residences, setResidences] = useState([]);
    const [selectedResidence, setSelectedResidence] = useState('all');
    const [filteredLeases, setFilteredLeases] = useState([]);

    // Fetch leases on component mount
    useEffect(() => {
        fetchLeases();
        fetchResidences();
    }, []);

    // Filter leases when residence selection changes
    useEffect(() => {
        if (selectedResidence === 'all') {
            setFilteredLeases(leases);
        } else {
            setFilteredLeases(leases.filter(lease => lease.residence === selectedResidence));
        }
    }, [leases, selectedResidence]);

    const fetchLeases = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await axios.get('/api/finance/leases', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setLeases(response.data.leases || []);
        } catch (error) {
            console.error('Error fetching leases:', error);
            setError('Failed to fetch leases');
        } finally {
            setLoading(false);
        }
    };

    const fetchResidences = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('/api/residences', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setResidences(response.data.data || []);
        } catch (error) {
            console.error('Error fetching residences:', error);
        }
    };

    const handleSelectAll = () => {
        if (selectedLeases.length === filteredLeases.length) {
            setSelectedLeases([]);
        } else {
            setSelectedLeases(filteredLeases.map(lease => lease._id));
        }
    };

    const handleSelectLease = (leaseId) => {
        setSelectedLeases(prev => 
            prev.includes(leaseId) 
                ? prev.filter(id => id !== leaseId)
                : [...prev, leaseId]
        );
    };

    const handleBulkDownload = async () => {
        if (selectedLeases.length === 0) {
            setError('Please select at least one lease to download');
            return;
        }

        try {
            setDownloadLoading(true);
            setError(null);
            setSuccess(null);

            const token = localStorage.getItem('token');
            const response = await axios.post(
                '/api/lease-downloads/multiple',
                { leaseIds: selectedLeases },
                {
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: 'blob'
                }
            );

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `leases_${Date.now()}.zip`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            setSuccess(`Successfully downloaded ${selectedLeases.length} lease(s)`);
            setSelectedLeases([]);
        } catch (error) {
            console.error('Download failed:', error);
            setError('Failed to download leases. Please try again.');
        } finally {
            setDownloadLoading(false);
        }
    };

    const handleResidenceDownload = async () => {
        if (selectedResidence === 'all') {
            setError('Please select a specific residence for residence-based download');
            return;
        }

        try {
            setDownloadLoading(true);
            setError(null);
            setSuccess(null);

            const token = localStorage.getItem('token');
            const response = await axios.get(
                `/api/lease-downloads/residence/${selectedResidence}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: 'blob'
                }
            );

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `residence_leases_${Date.now()}.zip`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            const residenceName = residences.find(r => r._id === selectedResidence)?.name || 'Unknown';
            setSuccess(`Successfully downloaded all leases for ${residenceName}`);
        } catch (error) {
            console.error('Residence download failed:', error);
            setError('Failed to download residence leases. Please try again.');
        } finally {
            setDownloadLoading(false);
        }
    };

    const handleDownloadAll = async () => {
        try {
            setDownloadLoading(true);
            setError(null);
            setSuccess(null);

            const token = localStorage.getItem('token');
            const response = await axios.get(
                '/api/lease-downloads/all',
                {
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: 'blob'
                }
            );

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `all_leases_${Date.now()}.zip`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            setSuccess('Successfully downloaded all leases');
        } catch (error) {
            console.error('All leases download failed:', error);
            setError('Failed to download all leases. Please try again.');
        } finally {
            setDownloadLoading(false);
        }
    };

    const clearSelection = () => {
        setSelectedLeases([]);
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Paper sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
                Lease Bulk Download
            </Typography>

            {/* Error/Success Messages */}
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

            {/* Controls */}
            <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Residence Filter */}
                <FormControl sx={{ minWidth: 200 }}>
                    <InputLabel>Filter by Residence</InputLabel>
                    <Select
                        value={selectedResidence}
                        onChange={(e) => setSelectedResidence(e.target.value)}
                        label="Filter by Residence"
                    >
                        <MenuItem value="all">All Residences</MenuItem>
                        {residences.map(residence => (
                            <MenuItem key={residence._id} value={residence._id}>
                                {residence.name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {/* Download Buttons */}
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<CloudDownloadIcon />}
                    onClick={handleBulkDownload}
                    disabled={selectedLeases.length === 0 || downloadLoading}
                >
                    {downloadLoading ? 'Downloading...' : `Download Selected (${selectedLeases.length})`}
                </Button>

                <Button
                    variant="outlined"
                    color="secondary"
                    startIcon={<DownloadIcon />}
                    onClick={handleResidenceDownload}
                    disabled={selectedResidence === 'all' || downloadLoading}
                >
                    Download Residence
                </Button>

                <Button
                    variant="outlined"
                    color="info"
                    startIcon={<DownloadIcon />}
                    onClick={handleDownloadAll}
                    disabled={downloadLoading}
                >
                    Download All
                </Button>

                <Button
                    variant="text"
                    onClick={clearSelection}
                    disabled={selectedLeases.length === 0}
                    startIcon={<ClearIcon />}
                >
                    Clear Selection
                </Button>
            </Box>

            {/* Leases Table */}
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell padding="checkbox">
                            <Checkbox
                                checked={selectedLeases.length === filteredLeases.length && filteredLeases.length > 0}
                                indeterminate={selectedLeases.length > 0 && selectedLeases.length < filteredLeases.length}
                                onChange={handleSelectAll}
                            />
                        </TableCell>
                        <TableCell>Student</TableCell>
                        <TableCell>Residence</TableCell>
                        <TableCell>Filename</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Upload Date</TableCell>
                        <TableCell>Actions</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {filteredLeases.map((lease) => (
                        <TableRow key={lease._id}>
                            <TableCell padding="checkbox">
                                <Checkbox
                                    checked={selectedLeases.includes(lease._id)}
                                    onChange={() => handleSelectLease(lease._id)}
                                />
                            </TableCell>
                            <TableCell>{lease.student?.name || 'N/A'}</TableCell>
                            <TableCell>{lease.residence?.name || 'N/A'}</TableCell>
                            <TableCell>{lease.originalname || lease.filename}</TableCell>
                            <TableCell>
                                <Chip 
                                    label={lease.status} 
                                    color={lease.status === 'active' ? 'success' : 'default'}
                                    size="small"
                                />
                            </TableCell>
                            <TableCell>
                                {new Date(lease.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                                <Button
                                    size="small"
                                    variant="text"
                                    onClick={() => window.open(`/api/lease-downloads/single/${lease._id}`, '_blank')}
                                >
                                    Download
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            {filteredLeases.length === 0 && (
                <Box textAlign="center" py={4}>
                    <Typography color="textSecondary">
                        No leases found
                    </Typography>
                </Box>
            )}
        </Paper>
    );
};

export default LeaseBulkDownload; 