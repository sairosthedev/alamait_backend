const mongoose = require('mongoose');

const maintenanceSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    residence: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Residence',
        required: true
    },
    issue: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    room: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        enum: ['plumbing', 'electrical', 'hvac', 'appliance', 'structural', 'other'],
        required: true,
        set: function(value) {
            if (value) {
                return value.toLowerCase();
            }
            return value;
        }
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        required: true,
        set: function(value) {
            if (value) {
                return value.toLowerCase();
            }
            return value;
        }
    },
    status: {
        type: String,
        enum: ['pending', 'assigned', 'in-progress', 'on-hold', 'completed', 'approved', 'rejected', 'pending-ceo-approval', 'pending-finance-approval', 'pending-admin-approval'],
        default: 'pending',
        set: function(value) {
            if (value) {
                return value.toLowerCase().replace(/[\s_]+/g, '-');
            }
            return value;
        }
    },
    assignedTo: {
        _id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        name: String,
        surname: String,
        role: String
    },
    requestDate: {
        type: Date,
        default: Date.now
    },
    scheduledDate: {
        type: Date
    },
    estimatedCompletion: {
        type: Date
    },
    completedDate: {
        type: Date
    },
    amount: {
        type: Number,
        min: 0,
        default: 0
    },
    financeStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
        set: function(value) {
            if (value) {
                return value.toLowerCase();
            }
            return value;
        }
    },
    financeNotes: {
        type: String,
        trim: true
    },
    ceoStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
        set: function(value) {
            if (value) {
                return value.toLowerCase();
            }
            return value;
        }
    },
    ceoApprovalDate: {
        type: Date
    },
    ceoApprovalReason: {
        type: String,
        trim: true
    },
    paymentMethod: {
        type: String,
        enum: ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks', 'MasterCard', 'Visa', 'PayPal', 'bank transfer', 'cash', 'online payment', 'ecocash', 'innbucks', 'mastercard', 'visa', 'paypal'],
        required: false,
        set: function(value) {
            if (value) {
                // Normalize to title case
                const normalized = value.toLowerCase();
                const mapping = {
                    'bank transfer': 'Bank Transfer',
                    'cash': 'Cash',
                    'online payment': 'Online Payment',
                    'ecocash': 'Ecocash',
                    'innbucks': 'Innbucks',
                    'mastercard': 'MasterCard',
                    'visa': 'Visa',
                    'paypal': 'PayPal'
                };
                return mapping[normalized] || value;
            }
            return value;
        }
    },
    paymentIcon: {
        type: String,
        required: false
    },
    images: [{
        url: {
            type: String,
            required: true
        },
        caption: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    updates: [{
        date: {
            type: Date,
            default: Date.now
        },
        message: {
            type: String,
            required: true
        },
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }],
    requestHistory: [{
        date: {
            type: Date,
            default: Date.now
        },
        action: {
            type: String,
            required: true
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        changes: [String]
    }]
}, {
    timestamps: true
});

// Add indexes for common queries
maintenanceSchema.index({ status: 1 });
maintenanceSchema.index({ room: 1 });
maintenanceSchema.index({ requestDate: -1 });
maintenanceSchema.index({ priority: 1 });
maintenanceSchema.index({ category: 1 });
maintenanceSchema.index({ student: 1 });
maintenanceSchema.index({ assignedTo: 1 });

// Add compound index for duplicate detection
// This prevents multiple active requests for the same issue in the same room
maintenanceSchema.index({ 
    residence: 1, 
    room: 1, 
    issue: 1, 
    status: 1 
}, { 
    name: 'duplicate_detection_index',
    partialFilterExpression: { 
        status: { $in: ['pending', 'assigned', 'in-progress'] } 
    }
});

// Pre-save middleware to ensure dates are valid and normalize values
maintenanceSchema.pre('save', function(next) {
    if (this.isModified('status')) {
        this.status = this.status.toLowerCase().replace(/[\s_]+/g, '-');
    }

    if (this.isModified('category')) {
        this.category = this.category.toLowerCase();
    }

    if (this.isModified('priority')) {
        this.priority = this.priority.toLowerCase();
    }

    if (this.isModified('financeStatus')) {
        this.financeStatus = this.financeStatus.toLowerCase();
    }

    if (this.isModified('estimatedCompletion') && this.estimatedCompletion) {
        this.estimatedCompletion = new Date(this.estimatedCompletion);
    }
    if (this.isModified('scheduledDate') && this.scheduledDate) {
        this.scheduledDate = new Date(this.scheduledDate);
    }
    if (this.isModified('completedDate') && this.completedDate) {
        this.completedDate = new Date(this.completedDate);
    }
    next();
});

// Static method to check for duplicate maintenance requests
maintenanceSchema.statics.checkForDuplicates = async function(residenceId, room, issue, excludeId = null) {
    try {
        // Normalize the issue text for better matching
        const normalizedIssue = issue.toLowerCase().trim();
        
        // Define common maintenance issue keywords and their synonyms
        const issueKeywords = {
            'heater': ['heater', 'heating', 'radiator', 'warm', 'hot', 'temperature'],
            'water': ['water', 'tap', 'faucet', 'sink', 'shower', 'bath', 'leak', 'drip', 'flow'],
            'electricity': ['electric', 'electrical', 'power', 'outlet', 'socket', 'switch', 'light', 'bulb'],
            'plumbing': ['plumbing', 'pipe', 'drain', 'toilet', 'bathroom', 'kitchen', 'sink'],
            'hvac': ['hvac', 'air', 'conditioning', 'ac', 'ventilation', 'fan', 'cooling'],
            'appliance': ['appliance', 'fridge', 'refrigerator', 'microwave', 'oven', 'stove', 'washer', 'dryer'],
            'structural': ['structural', 'wall', 'ceiling', 'floor', 'door', 'window', 'lock', 'key'],
            'noise': ['noise', 'sound', 'loud', 'vibration', 'rattle', 'bang', 'squeak'],
            'smell': ['smell', 'odor', 'stink', 'foul', 'gas', 'sewage'],
            'broken': ['broken', 'damaged', 'cracked', 'faulty', 'not working', 'malfunction', 'defective'],
            'leaking': ['leaking', 'dripping', 'water', 'moisture', 'wet', 'damp'],
            'clogged': ['clogged', 'blocked', 'stuck', 'slow', 'backed up', 'overflow']
        };

        // Extract keywords from the issue
        const issueWords = normalizedIssue.split(/\s+/);
        const matchedKeywords = [];
        
        // Find matching keywords
        for (const [category, synonyms] of Object.entries(issueKeywords)) {
            for (const synonym of synonyms) {
                if (issueWords.some(word => word.includes(synonym) || synonym.includes(word))) {
                    matchedKeywords.push(category);
                    break;
                }
            }
        }

        // Build multiple queries for better duplicate detection
        const queries = [];
        
        // 1. Exact match (current behavior)
        queries.push({
            residence: residenceId,
            room: room,
            issue: { $regex: new RegExp(normalizedIssue, 'i') },
            status: { $in: ['pending', 'assigned', 'in-progress'] }
        });

        // 2. Keyword-based match for same category issues
        if (matchedKeywords.length > 0) {
            const keywordRegex = matchedKeywords.map(keyword => 
                issueKeywords[keyword].join('|')
            ).join('|');
            
            queries.push({
                residence: residenceId,
                room: room,
                issue: { $regex: new RegExp(keywordRegex, 'i') },
                status: { $in: ['pending', 'assigned', 'in-progress'] }
            });
        }

        // 3. Similar issue patterns (common phrases)
        const commonPatterns = [
            { pattern: /(no|not|isn't|isnt).*(hot|warm).*water/i, keywords: ['water', 'heater', 'hot'] },
            { pattern: /(broken|not working|faulty).*(heater|heating)/i, keywords: ['heater', 'broken'] },
            { pattern: /(leaking|dripping).*(tap|faucet|sink)/i, keywords: ['water', 'leaking'] },
            { pattern: /(clogged|blocked).*(drain|sink|toilet)/i, keywords: ['plumbing', 'clogged'] },
            { pattern: /(no|not).*(electricity|power|light)/i, keywords: ['electricity', 'power'] }
        ];

        for (const { pattern, keywords } of commonPatterns) {
            if (pattern.test(normalizedIssue)) {
                const keywordRegex = keywords.join('|');
                queries.push({
                    residence: residenceId,
                    room: room,
                    issue: { $regex: new RegExp(keywordRegex, 'i') },
                    status: { $in: ['pending', 'assigned', 'in-progress'] }
                });
            }
        }

        // Exclude current request if updating
        if (excludeId) {
            queries.forEach(query => {
                query._id = { $ne: excludeId };
            });
        }

        // Execute all queries and combine results
        const allDuplicates = [];
        for (const query of queries) {
            const results = await this.find(query)
                .populate('student', 'firstName lastName email')
                .populate('residence', 'name')
                .sort({ requestDate: -1 })
                .limit(5);
            
            allDuplicates.push(...results);
        }

        // Remove duplicates and sort by date
        const uniqueDuplicates = allDuplicates.filter((duplicate, index, self) => 
            index === self.findIndex(d => d._id.toString() === duplicate._id.toString())
        );

        // Sort by request date (most recent first) and limit results
        return uniqueDuplicates
            .sort((a, b) => new Date(b.requestDate) - new Date(a.requestDate))
            .slice(0, 5);

    } catch (error) {
        console.error('Error checking for duplicates:', error);
        throw error;
    }
};

// Static method to analyze issue similarity and provide feedback
maintenanceSchema.statics.analyzeIssueSimilarity = function(newIssue, existingIssue) {
    const normalizedNew = newIssue.toLowerCase().trim();
    const normalizedExisting = existingIssue.toLowerCase().trim();
    
    const similarityScore = {
        exactMatch: false,
        keywordMatch: false,
        patternMatch: false,
        commonWords: 0,
        score: 0
    };

    // Check for exact match
    if (normalizedNew === normalizedExisting) {
        similarityScore.exactMatch = true;
        similarityScore.score = 100;
        return similarityScore;
    }

    // Check for keyword matches
    const issueKeywords = {
        'heater': ['heater', 'heating', 'radiator', 'warm', 'hot', 'temperature'],
        'water': ['water', 'tap', 'faucet', 'sink', 'shower', 'bath', 'leak', 'drip', 'flow'],
        'electricity': ['electric', 'electrical', 'power', 'outlet', 'socket', 'switch', 'light', 'bulb'],
        'plumbing': ['plumbing', 'pipe', 'drain', 'toilet', 'bathroom', 'kitchen', 'sink'],
        'hvac': ['hvac', 'air', 'conditioning', 'ac', 'ventilation', 'fan', 'cooling'],
        'appliance': ['appliance', 'fridge', 'refrigerator', 'microwave', 'oven', 'stove', 'washer', 'dryer'],
        'structural': ['structural', 'wall', 'ceiling', 'floor', 'door', 'window', 'lock', 'key'],
        'noise': ['noise', 'sound', 'loud', 'vibration', 'rattle', 'bang', 'squeak'],
        'smell': ['smell', 'odor', 'stink', 'foul', 'gas', 'sewage'],
        'broken': ['broken', 'damaged', 'cracked', 'faulty', 'not working', 'malfunction', 'defective'],
        'leaking': ['leaking', 'dripping', 'water', 'moisture', 'wet', 'damp'],
        'clogged': ['clogged', 'blocked', 'stuck', 'slow', 'backed up', 'overflow']
    };

    const newWords = normalizedNew.split(/\s+/);
    const existingWords = normalizedExisting.split(/\s+/);
    
    // Count common words
    const commonWords = newWords.filter(word => existingWords.includes(word));
    similarityScore.commonWords = commonWords.length;

    // Check for keyword category matches
    for (const [category, synonyms] of Object.entries(issueKeywords)) {
        const newHasKeyword = synonyms.some(synonym => 
            newWords.some(word => word.includes(synonym) || synonym.includes(word))
        );
        const existingHasKeyword = synonyms.some(synonym => 
            existingWords.some(word => word.includes(synonym) || synonym.includes(word))
        );
        
        if (newHasKeyword && existingHasKeyword) {
            similarityScore.keywordMatch = true;
            similarityScore.score += 30;
            break;
        }
    }

    // Check for pattern matches
    const commonPatterns = [
        { pattern: /(no|not|isn't|isnt).*(hot|warm).*water/i, name: 'No hot water issue' },
        { pattern: /(broken|not working|faulty).*(heater|heating)/i, name: 'Heater malfunction' },
        { pattern: /(leaking|dripping).*(tap|faucet|sink)/i, name: 'Water leak issue' },
        { pattern: /(clogged|blocked).*(drain|sink|toilet)/i, name: 'Drain blockage' },
        { pattern: /(no|not).*(electricity|power|light)/i, name: 'Power/light issue' }
    ];

    for (const { pattern, name } of commonPatterns) {
        if (pattern.test(normalizedNew) && pattern.test(normalizedExisting)) {
            similarityScore.patternMatch = true;
            similarityScore.score += 40;
            break;
        }
    }

    // Calculate final score
    if (!similarityScore.keywordMatch && !similarityScore.patternMatch) {
        similarityScore.score = Math.min(similarityScore.commonWords * 10, 50);
    }

    return similarityScore;
};

// Static method to get similar requests (for reference)
maintenanceSchema.statics.getSimilarRequests = async function(residenceId, room, category, excludeId = null) {
    try {
        const query = {
            residence: residenceId,
            room: room,
            category: category,
            status: { $in: ['pending', 'assigned', 'in-progress', 'completed'] }
        };

        if (excludeId) {
            query._id = { $ne: excludeId };
        }

        const similar = await this.find(query)
            .populate('student', 'firstName lastName email')
            .populate('residence', 'name')
            .sort({ requestDate: -1 })
            .limit(10);

        return similar;
    } catch (error) {
        console.error('Error getting similar requests:', error);
        throw error;
    }
};

module.exports = mongoose.model('Maintenance', maintenanceSchema, 'maintenance'); 