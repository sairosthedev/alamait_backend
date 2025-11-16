/**
 * Centralized Caching Service
 * 
 * Currently uses in-memory cache (Map), but designed to be easily
 * extensible to Redis for distributed systems.
 * 
 * Features:
 * - TTL (Time To Live) support
 * - Automatic cache invalidation
 * - Request deduplication
 * - Extensible to Redis
 */

class CacheService {
    constructor() {
        // In-memory cache (can be replaced with Redis)
        this.cache = new Map();
        this.pendingRequests = new Map(); // For request deduplication
    }

    /**
     * Get cached data or fetch and cache it
     * @param {string} key - Cache key
     * @param {number} ttlSeconds - Time to live in seconds
     * @param {Function} fetchFunction - Function to fetch data if not cached
     * @returns {Promise<any>} - Cached or freshly fetched data
     */
    async getOrSet(key, ttlSeconds, fetchFunction) {
        // Check cache first
        const cached = this.get(key);
        if (cached !== null) {
            return cached;
        }

        // Check if request is already in progress (deduplication)
        if (this.pendingRequests.has(key)) {
            // Wait for the pending request to complete
            return this.pendingRequests.get(key);
        }

        // Fetch data
        const promise = fetchFunction()
            .then(data => {
                // Cache the result
                this.set(key, data, ttlSeconds);
                return data;
            })
            .finally(() => {
                // Remove from pending requests
                this.pendingRequests.delete(key);
            });

        // Store pending request for deduplication
        this.pendingRequests.set(key, promise);

        return promise;
    }

    /**
     * Get cached data
     * @param {string} key - Cache key
     * @returns {any|null} - Cached data or null if not found/expired
     */
    get(key) {
        const cached = this.cache.get(key);
        if (!cached) {
            return null;
        }

        // Check if expired
        if (Date.now() > cached.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    /**
     * Set cached data
     * @param {string} key - Cache key
     * @param {any} data - Data to cache
     * @param {number} ttlSeconds - Time to live in seconds
     */
    set(key, data, ttlSeconds = 300) {
        this.cache.set(key, {
            data,
            expiresAt: Date.now() + (ttlSeconds * 1000)
        });
    }

    /**
     * Delete cached data
     * @param {string} key - Cache key
     */
    delete(key) {
        this.cache.delete(key);
    }

    /**
     * Delete all cached data matching a pattern
     * @param {string} pattern - Pattern to match (supports wildcards)
     */
    deletePattern(pattern) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
        this.pendingRequests.clear();
    }

    /**
     * Get cache statistics
     */
    getStats() {
        let expiredCount = 0;
        let validCount = 0;
        const now = Date.now();

        for (const cached of this.cache.values()) {
            if (now > cached.expiresAt) {
                expiredCount++;
            } else {
                validCount++;
            }
        }

        return {
            total: this.cache.size,
            valid: validCount,
            expired: expiredCount,
            pendingRequests: this.pendingRequests.size
        };
    }

    /**
     * Clean expired entries (should be called periodically)
     */
    cleanExpired() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, cached] of this.cache.entries()) {
            if (now > cached.expiresAt) {
                this.cache.delete(key);
                cleaned++;
            }
        }

        return cleaned;
    }
}

// Singleton instance
const cacheService = new CacheService();

// Clean expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        cacheService.cleanExpired();
    }, 5 * 60 * 1000);
}

module.exports = cacheService;


