/**
 * Simple Logger Utility
 * Provides consistent logging across the application
 */

class Logger {
    static info(message, data = null) {
        const timestamp = new Date().toISOString();
        console.log(`[INFO] ${timestamp}: ${message}`);
        if (data) {
            console.log('   Data:', data);
        }
    }
    
    static warn(message, data = null) {
        const timestamp = new Date().toISOString();
        console.warn(`[WARN] ${timestamp}: ${message}`);
        if (data) {
            console.warn('   Data:', data);
        }
    }
    
    static error(message, error = null) {
        const timestamp = new Date().toISOString();
        console.error(`[ERROR] ${timestamp}: ${message}`);
        if (error) {
            console.error('   Error:', error.message || error);
            if (error.stack) {
                console.error('   Stack:', error.stack);
            }
        }
    }
    
    static success(message, data = null) {
        const timestamp = new Date().toISOString();
        console.log(`[SUCCESS] ${timestamp}: ${message}`);
        if (data) {
            console.log('   Data:', data);
        }
    }
}

module.exports = Logger;
