/**
 * Wrapper script to create finance users
 * 
 * This script runs the createFinanceUser.js script in the src/scripts directory
 * It's placed in the root directory for convenience
 * 
 * Usage:
 * node create-finance-user.js [email] [role] [password]
 * 
 * Example:
 * node create-finance-user.js finance@alamait.com finance_admin Password123
 */

require('./src/scripts/createFinanceUser');
