import React from 'react';
import './PettyCashDisplay.css';

const PettyCashDisplay = ({ apiResponse }) => {
    // Handle loading state
    if (!apiResponse) {
        return (
            <div className="petty-cash-display">
                <div className="petty-cash-header">
                    <h2>💰 Petty Cash Balance</h2>
                    <div className="user-info">
                        <span>Loading...</span>
                    </div>
                </div>
            </div>
        );
    }

    // Handle error state
    if (!apiResponse.success) {
        return (
            <div className="petty-cash-error">
                <h3>❌ Error</h3>
                <p>{apiResponse.message || 'Failed to load petty cash data'}</p>
            </div>
        );
    }

    const { user, pettyCashBalance, summary } = apiResponse.data;

    // Calculate status and color
    const getStatus = (balance) => {
        if (balance > 100) return 'Good';
        if (balance > 50) return 'Moderate';
        if (balance > 0) return 'Low';
        return 'Empty';
    };

    const getStatusColor = (balance) => {
        if (balance > 100) return 'green';
        if (balance > 50) return 'orange';
        if (balance > 0) return 'red';
        return 'gray';
    };

    const status = getStatus(pettyCashBalance.currentBalance);
    const statusColor = getStatusColor(pettyCashBalance.currentBalance);
    const lastUpdated = new Date(summary.lastUpdated).toLocaleString();

    return (
        <div className="petty-cash-display">
            <div className="petty-cash-header">
                <h2>💰 Petty Cash Balance</h2>
                <div className="user-info">
                    <strong>{user.firstName} {user.lastName}</strong>
                    <span className="role">({user.role})</span>
                </div>
            </div>
            
            <div className="petty-cash-balance">
                <div className={`balance-amount ${statusColor}`}>
                    <span className="amount">{pettyCashBalance.formattedBalance}</span>
                    <span className="status">{status}</span>
                </div>
            </div>
            
            <div className="petty-cash-details">
                <div className="detail-row">
                    <span className="label">Total Allocated:</span>
                    <span className="value">${pettyCashBalance.totalAllocated.toFixed(2)}</span>
                </div>
                <div className="detail-row">
                    <span className="label">Total Expenses:</span>
                    <span className="value">${pettyCashBalance.totalExpenses.toFixed(2)}</span>
                </div>
                <div className="detail-row">
                    <span className="label">Total Replenished:</span>
                    <span className="value">${pettyCashBalance.totalReplenished.toFixed(2)}</span>
                </div>
                <div className="detail-row">
                    <span className="label">Total Transactions:</span>
                    <span className="value">{summary.totalTransactions}</span>
                </div>
            </div>
            
            <div className="petty-cash-footer">
                <small>Last Updated: {lastUpdated}</small>
            </div>
        </div>
    );
};

// Usage example component
const PettyCashExample = () => {
    const [pettyCashData, setPettyCashData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    // Fetch petty cash data
    const fetchPettyCashBalance = async (userId) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/finance/petty-cash-balance/${userId}`);
            const data = await response.json();
            
            if (data.success) {
                setPettyCashData(data);
            } else {
                setError(data.message || 'Failed to fetch petty cash balance');
            }
        } catch (err) {
            setError('Network error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Load data on component mount
    React.useEffect(() => {
        // Replace with actual user ID
        const userId = '67c023adae5e27657502e887';
        fetchPettyCashBalance(userId);
    }, []);

    if (loading) {
        return <PettyCashDisplay apiResponse={null} />;
    }

    if (error) {
        return (
            <PettyCashDisplay 
                apiResponse={{ 
                    success: false, 
                    message: error 
                }} 
            />
        );
    }

    return <PettyCashDisplay apiResponse={pettyCashData} />;
};

export default PettyCashDisplay;
export { PettyCashExample };

