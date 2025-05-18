/**
 * Utility for generating unique IDs
 */

/**
 * Generates a unique ID with a specified prefix
 * @param {string} prefix - The prefix for the ID (e.g., 'EXP' for expenses)
 * @returns {string} A unique ID
 */
exports.generateUniqueId = async (prefix = '') => {
    const timestamp = Date.now();
    const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}-${timestamp}-${randomPart}`;
}; 