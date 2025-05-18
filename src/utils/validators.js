/**
 * Utility for validating data
 */

/**
 * Validates a MongoDB object ID
 * @param {string} id - The ID to validate
 * @returns {boolean} Whether the ID is valid
 */
exports.validateMongoId = (id) => {
    if (!id) return false;
    // MongoDB ObjectID is a 24-character hex string
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    return objectIdRegex.test(id);
}; 