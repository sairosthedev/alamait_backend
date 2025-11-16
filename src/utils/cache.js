/**
 * Simple In-Memory Cache Utility
 * For production, consider using Redis
 */

class SimpleCache {
    constructor() {
        this.cache = new Map();
        this.timers = new Map();
    }

    /**
     * Get value from cache
     */
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        // Check if expired
        if (item.expiresAt && Date.now() > item.expiresAt) {
            this.delete(key);
            return null;
        }
        
        return item.value;
    }

    /**
     * Set value in cache with optional TTL (time to live) in milliseconds
     */
    set(key, value, ttl = 300000) { // Default 5 minutes
        // Clear existing timer if any
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
        }
        
        const expiresAt = ttl > 0 ? Date.now() + ttl : null;
        this.cache.set(key, { value, expiresAt });
        
        // Set timer to auto-delete
        if (ttl > 0) {
            const timer = setTimeout(() => {
                this.delete(key);
            }, ttl);
            this.timers.set(key, timer);
        }
        
        return true;
    }

    /**
     * Delete value from cache
     */
    delete(key) {
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
            this.timers.delete(key);
        }
        return this.cache.delete(key);
    }

    /**
     * Clear all cache
     */
    clear() {
        this.timers.forEach(timer => clearTimeout(timer));
        this.timers.clear();
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }

    /**
     * Generate cache key from parameters
     */
    static generateKey(prefix, ...params) {
        const paramString = params
            .map(p => {
                if (typeof p === 'object' && p !== null) {
                    return JSON.stringify(p);
                }
                return String(p || '');
            })
            .join(':');
        return `${prefix}:${paramString}`;
    }
}

// Export singleton instance
const cache = new SimpleCache();

// Clear cache on server restart (optional - comment out if you want cache to persist)
// process.on('SIGTERM', () => cache.clear());
// process.on('SIGINT', () => cache.clear());

module.exports = { cache, SimpleCache };
