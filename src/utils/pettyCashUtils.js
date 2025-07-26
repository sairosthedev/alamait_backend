const Account = require('../models/Account');

/**
 * Get the appropriate petty cash account based on user role
 * @param {string} userRole - The role of the user
 * @returns {Promise<Object>} The petty cash account object
 */
const getPettyCashAccountByRole = async (userRole) => {
    let accountCode = '1010'; // Default to General Petty Cash
    
    switch (userRole) {
        case 'admin':
            accountCode = '1011'; // Admin Petty Cash
            break;
        case 'finance_admin':
        case 'finance_user':
            accountCode = '1012'; // Finance Petty Cash
            break;
        case 'property_manager':
            accountCode = '1013'; // Property Manager Petty Cash
            break;
        case 'maintenance':
            accountCode = '1014'; // Maintenance Petty Cash
            break;
        default:
            accountCode = '1010'; // General Petty Cash
    }
    
    const account = await Account.findOne({ code: accountCode });
    return account;
};

/**
 * Get all petty cash accounts
 * @returns {Promise<Array>} Array of all petty cash accounts
 */
const getAllPettyCashAccounts = async () => {
    const accounts = await Account.find({
        code: { $in: ['1010', '1011', '1012', '1013', '1014'] }
    }).sort({ code: 1 });
    
    return accounts;
};

module.exports = {
    getPettyCashAccountByRole,
    getAllPettyCashAccounts
}; 