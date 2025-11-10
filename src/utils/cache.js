/**
 * Simple In-Memory Cache Utility
 * Provides fast caching for frequently accessed data
 */

class Cache {
    constructor(defaultTTL = 300000) { // 5 minutes default
        this.cache = new Map();
        this.defaultTTL = defaultTTL;
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Cleanup every minute
    }

    /**
     * Get value from cache
     * @param {string} key - Cache key
     * @returns {any|null} - Cached value or null if not found/expired
     */
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        // Check if expired
        if (Date.now() > item.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return item.value;
    }

    /**
     * Set value in cache
     * @param {string} key - Cache key
     * @param {any} value - Value to cache
     * @param {number} ttl - Time to live in milliseconds (optional)
     */
    set(key, value, ttl = null) {
        const expiresAt = Date.now() + (ttl || this.defaultTTL);
        this.cache.set(key, { value, expiresAt });
    }

    /**
     * Delete value from cache
     * @param {string} key - Cache key
     */
    delete(key) {
        this.cache.delete(key);
    }

    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Clear cache by pattern
     * @param {string} pattern - Pattern to match keys (regex string)
     */
    clearPattern(pattern) {
        const regex = new RegExp(pattern);
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Cleanup expired entries
     */
    cleanup() {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (now > item.expiresAt) {
                this.cache.delete(key);
            }
        }
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
}

// Create singleton instance
const cache = new Cache();

/**
 * Cache middleware for Express routes
 * @param {number} ttl - Time to live in milliseconds
 * @param {function} keyGenerator - Function to generate cache key from request
 */
const cacheMiddleware = (ttl = 300000, keyGenerator = null) => {
    return (req, res, next) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        // Generate cache key
        const key = keyGenerator 
            ? keyGenerator(req)
            : `cache:${req.method}:${req.originalUrl}:${JSON.stringify(req.query)}`;

        // Try to get from cache
        const cached = cache.get(key);
        if (cached) {
            return res.json(cached);
        }

        // Override res.json to cache response
        const originalJson = res.json.bind(res);
        res.json = function(data) {
            // Only cache successful responses
            if (res.statusCode === 200) {
                cache.set(key, data, ttl);
            }
            return originalJson(data);
        };

        next();
    };
};

/**
 * Invalidate cache by pattern
 * @param {string} pattern - Pattern to match keys
 */
const invalidateCache = (pattern) => {
    cache.clearPattern(pattern);
};

module.exports = {
    cache,
    cacheMiddleware,
    invalidateCache
};


