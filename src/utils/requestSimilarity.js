/**
 * Utility functions for detecting similar requests
 */

/**
 * Calculate similarity score between two strings using Levenshtein distance
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity score (0-1, where 1 is identical)
 */
function calculateStringSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Distance
 */
function levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
}

/**
 * Check if two requests are similar based on title and description
 * @param {Object} request1 - First request
 * @param {Object} request2 - Second request
 * @param {number} threshold - Similarity threshold (0-1, default 0.7)
 * @returns {boolean} - True if requests are similar
 */
function areRequestsSimilar(request1, request2, threshold = 0.7) {
    const titleSimilarity = calculateStringSimilarity(
        request1.title?.toLowerCase() || '',
        request2.title?.toLowerCase() || ''
    );
    
    const descriptionSimilarity = calculateStringSimilarity(
        request1.description?.toLowerCase() || '',
        request2.description?.toLowerCase() || ''
    );
    
    // Consider requests similar if either title or description is similar
    return titleSimilarity >= threshold || descriptionSimilarity >= threshold;
}

/**
 * Find similar requests in the database
 * @param {Object} requestData - The request data to check against
 * @param {Array} existingRequests - Array of existing requests
 * @param {Object} options - Options for similarity check
 * @returns {Array} - Array of similar requests with similarity scores
 */
function findSimilarRequests(requestData, existingRequests, options = {}) {
    const {
        threshold = 0.7,
        maxResults = 5,
        includeOwnRequests = false
    } = options;
    
    const similarRequests = [];
    
    for (const existingRequest of existingRequests) {
        // Skip own requests if not included
        if (!includeOwnRequests && existingRequest.submittedBy === requestData.submittedBy) {
            continue;
        }
        
        const titleSimilarity = calculateStringSimilarity(
            requestData.title?.toLowerCase() || '',
            existingRequest.title?.toLowerCase() || ''
        );
        
        const descriptionSimilarity = calculateStringSimilarity(
            requestData.description?.toLowerCase() || '',
            existingRequest.description?.toLowerCase() || ''
        );
        
        const maxSimilarity = Math.max(titleSimilarity, descriptionSimilarity);
        
        if (maxSimilarity >= threshold) {
            similarRequests.push({
                request: existingRequest,
                similarity: maxSimilarity,
                titleSimilarity,
                descriptionSimilarity
            });
        }
    }
    
    // Sort by similarity score (highest first) and limit results
    return similarRequests
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, maxResults);
}

/**
 * Generate a query to find potentially similar requests
 * @param {Object} requestData - The request data
 * @param {Object} user - The user making the request
 * @returns {Object} - MongoDB query object
 */
function generateSimilarityQuery(requestData, user) {
    const query = {
        status: { $in: ['pending', 'assigned', 'in-progress'] }
    };
    
    if (user.role === 'student') {
        // For students: Check within the same residence
        query.residence = requestData.residence;
        query.type = requestData.type;
        
        // Add keyword-based search for better matching
        const keywords = extractKeywords(requestData.title + ' ' + requestData.description);
        if (keywords.length > 0) {
            query.$or = [
                { title: { $regex: keywords.join('|'), $options: 'i' } },
                { description: { $regex: keywords.join('|'), $options: 'i' } }
            ];
        }
    } else {
        // For non-students: Only check own requests
        query.submittedBy = user._id;
    }
    
    return query;
}

/**
 * Extract keywords from text for better matching
 * @param {string} text - Text to extract keywords from
 * @returns {Array} - Array of keywords
 */
function extractKeywords(text) {
    if (!text) return [];
    
    // Remove common words and extract meaningful keywords
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'];
    
    const words = text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !commonWords.includes(word));
    
    // Return unique words
    return [...new Set(words)];
}

module.exports = {
    calculateStringSimilarity,
    levenshteinDistance,
    areRequestsSimilar,
    findSimilarRequests,
    generateSimilarityQuery,
    extractKeywords
}; 