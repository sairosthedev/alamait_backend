const crypto = require('crypto');

/**
 * Hashes a plain text password using SHA-256.
 * @param {string} password - The plain text password.
 * @returns {string} The SHA-256 hash of the password.
 */
function hashPasswordSha256(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Checks if a string is a valid SHA-256 hash.
 * @param {string} str - The string to check.
 * @returns {boolean} True if it's a SHA-256 hash, false otherwise.
 */
function isSha256Hash(str) {
    return typeof str === 'string' && str.length === 64 && /^[0-9a-fA-F]{64}$/.test(str);
}

/**
 * Normalizes a password: if it's a plain text password, it hashes it with SHA-256.
 * If it's already a SHA-256 hash, it returns it as is.
 * This is used when the client might send either a plain text or a pre-hashed password.
 * @param {string} password - The password string (plain text or SHA-256 hash).
 * @returns {string} The SHA-256 hash of the password.
 */
function normalizePassword(password) {
    if (isSha256Hash(password)) {
        return password; // Already a SHA-256 hash
    }
    return hashPasswordSha256(password); // Hash plain text password
}

module.exports = {
    hashPasswordSha256,
    isSha256Hash,
    normalizePassword
};

