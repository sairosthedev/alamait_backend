/**
 * Account Name Normalizer
 * 
 * Ensures consistent account names across the system.
 * This is especially important for account code 10003 which should always be "Cbz Vault".
 */

/**
 * Normalize account name based on account code
 * @param {string} accountCode - The account code
 * @param {string} accountName - The account name (from database or user input)
 * @returns {string} - Normalized account name
 */
function normalizeAccountName(accountCode, accountName) {
    // Always use "Cbz Vault" for account code 10003
    if (accountCode === '10003') {
        return 'Cbz Vault';
    }
    
    // Return the original name for all other accounts
    return accountName;
}

/**
 * Normalize account name in a transaction entry
 * @param {Object} entry - Transaction entry object
 * @returns {Object} - Entry with normalized account name
 */
function normalizeEntryAccountName(entry) {
    if (entry.accountCode) {
        entry.accountName = normalizeAccountName(entry.accountCode, entry.accountName);
    }
    return entry;
}

/**
 * Normalize account names in an array of entries
 * @param {Array} entries - Array of transaction entries
 * @returns {Array} - Array of entries with normalized account names
 */
function normalizeEntriesAccountNames(entries) {
    return entries.map(entry => normalizeEntryAccountName(entry));
}

module.exports = {
    normalizeAccountName,
    normalizeEntryAccountName,
    normalizeEntriesAccountNames
};


