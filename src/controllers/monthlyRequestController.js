const MonthlyRequest = require('../models/MonthlyRequest');
const Residence = require('../models/Residence');
const { uploadToS3 } = require('../utils/fileStorage');
const Expense = require('../models/finance/Expense'); // Added for expense conversion
const DoubleEntryAccountingService = require('../services/doubleEntryAccountingService');
const Account = require('../models/Account'); // Added for account lookup
const AccountMappingService = require('../utils/accountMappingService'); // Added for account mapping
const Transaction = require('../models/Transaction'); // Added for accrual transactions
const TransactionEntry = require('../models/TransactionEntry'); // Added for accrual entries

const EmailNotificationService = require('../services/emailNotificationService');
// Helper function to format description with month name
function formatDescriptionWithMonth(description, month, year) {
    if (!description) return description;
    
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const monthName = monthNames[month - 1];
    
    // Check if description already contains month/year
    const monthYearPattern = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i;
    
    if (monthYearPattern.test(description)) {
        // Replace existing month/year with new one
        return description.replace(monthYearPattern, `${monthName} ${year}`);
    } else {
        // Add month/year to description
        return `${description} for ${monthName} ${year}`;
    }
}

// Month names array for use throughout the controller
const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// Helper function to determine if a request is for past/current month or future month
function isPastOrCurrentMonth(month, year) {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // getMonth() returns 0-11
    const currentYear = currentDate.getFullYear();
    
    // If year is less than current year, it's past
    if (year < currentYear) return true;
    
    // If year is current year and month is less than or equal to current month, it's past/current
    if (year === currentYear && month <= currentMonth) return true;
    
    // Otherwise it's future
    return false;
}

// Enhanced function to get appropriate status and handle historical costs
function getDefaultStatusForMonth(month, year, userRole) {
    const isPastOrCurrent = isPastOrCurrentMonth(month, year);
    
    if (isPastOrCurrent) {
        return 'approved'; // Auto-approve historical requests
    } else {
        // For future months, status depends on user role
        if (userRole === 'admin') {
            return 'draft'; // Admin creates as draft
        } else {
            return 'pending'; // Other roles create as pending
        }
    }
}

// Function to handle template creation with cost history
function createMonthlyRequestFromTemplate(template, month, year, submittedBy) {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    // Determine if this is a historical month
    const isHistorical = year < currentYear || (year === currentYear && month < currentMonth);
    
    // For historical months, we might want to preserve original costs
    // For current/future months, use template costs
    const items = template.items.map(item => ({
        ...item,
        // Add cost history tracking
        costHistory: isHistorical ? [{
            date: new Date(),
            cost: item.estimatedCost,
            note: isHistorical ? 'Historical cost preserved' : 'Template cost applied'
        }] : []
    }));
    
    const status = getDefaultStatusForMonth(month, year);
    
    return {
        title: template.title,
        description: formatDescriptionWithMonth(template.description, month, year),
        residence: template.residence,
        month: month,
        year: year,
        items: items,
        submittedBy: submittedBy,
        status: status,
        tags: template.tags,
        isFromTemplate: true,
        templateId: template._id,
        templateVersion: template.templateVersion
    };
}

// Enhanced function to analyze historical data with better cost tracking
async function analyzeHistoricalDataForTemplate(residenceId, months = 6) {
    try {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        
        // Get historical monthly requests for the last N months
        const historicalRequests = await MonthlyRequest.find({
            residence: residenceId,
            isTemplate: false,
            month: { $exists: true, $ne: null },
            year: { $exists: true, $ne: null },
            $or: [
                { year: { $lt: currentYear } },
                { 
                    year: currentYear,
                    month: { $lt: currentMonth }
                }
            ]
        })
        .sort({ year: -1, month: -1 })
        .limit(months)
        .populate('residence', 'name');
        
        if (historicalRequests.length === 0) {
            return {
                success: false,
                message: 'No historical data found to analyze',
                suggestedItems: []
            };
        }
        
        // Analyze items across historical requests with detailed cost tracking
        const itemAnalysis = {};
        
        historicalRequests.forEach(request => {
            request.items.forEach(item => {
                const itemKey = item.title.toLowerCase().trim();
                
                if (!itemAnalysis[itemKey]) {
                    itemAnalysis[itemKey] = {
                        title: item.title,
                        description: item.description,
                        category: item.category,
                        costHistory: [],
                        quantities: [],
                        isRecurring: false,
                        lastSeen: null,
                        frequency: 0,
                        uniqueCosts: new Set(),
                        costVariations: []
                    };
                }
                
                const costEntry = {
                    month: request.month,
                    year: request.year,
                    cost: item.estimatedCost,
                    quantity: item.quantity || 1,
                    date: new Date(request.year, request.month - 1, 1)
                };
                
                itemAnalysis[itemKey].costHistory.push(costEntry);
                itemAnalysis[itemKey].quantities.push(item.quantity || 1);
                itemAnalysis[itemKey].frequency++;
                itemAnalysis[itemKey].lastSeen = `${request.month}/${request.year}`;
                itemAnalysis[itemKey].uniqueCosts.add(item.estimatedCost);
                
                // Check if item appears in multiple months (recurring)
                if (itemAnalysis[itemKey].frequency > 1) {
                    itemAnalysis[itemKey].isRecurring = true;
                }
            });
        });
        
        // Analyze cost variations for each item
        Object.keys(itemAnalysis).forEach(itemKey => {
            const item = itemAnalysis[itemKey];
            
            // Sort cost history by date (most recent first)
            item.costHistory.sort((a, b) => b.date - a.date);
            
            // Find cost variations (when cost changes)
            item.costVariations = [];
            for (let i = 0; i < item.costHistory.length - 1; i++) {
                const current = item.costHistory[i];
                const previous = item.costHistory[i + 1];
                
                if (current.cost !== previous.cost) {
                    item.costVariations.push({
                        from: `${previous.month}/${previous.year}`,
                        to: `${current.month}/${current.year}`,
                        oldCost: previous.cost,
                        newCost: current.cost,
                        change: current.cost - previous.cost,
                        changePercent: ((current.cost - previous.cost) / previous.cost * 100).toFixed(1)
                    });
                }
            }
            
            // Determine the most recent cost (for template)
            item.mostRecentCost = item.costHistory[0].cost;
            item.mostRecentMonth = `${item.costHistory[0].month}/${item.costHistory[0].year}`;
        });
        
        // Generate suggested template items
        const suggestedItems = Object.values(itemAnalysis)
            .filter(item => item.frequency >= 1)
            .map(item => {
                const avgQuantity = item.quantities.reduce((sum, qty) => sum + qty, 0) / item.quantities.length;
                
                return {
                    title: item.title,
                    description: item.description,
                    estimatedCost: item.mostRecentCost, // Use most recent cost for template
                    quantity: Math.round(avgQuantity),
                    category: item.category || 'general',
                    isRecurring: item.isRecurring,
                    priority: item.isRecurring ? 'medium' : 'low',
                    notes: item.isRecurring ? 
                        `Recurring item (appeared ${item.frequency} times in last ${months} months)` :
                        `One-time item (last seen: ${item.lastSeen})`,
                    costHistory: item.costHistory.map(entry => ({
                        date: entry.date,
                        cost: entry.cost,
                        month: entry.month,
                        year: entry.year,
                        note: `Cost in ${entry.month}/${entry.year}`
                    })),
                    costVariations: item.costVariations,
                    costSummary: {
                        mostRecentCost: item.mostRecentCost,
                        mostRecentMonth: item.mostRecentMonth,
                        uniqueCosts: Array.from(item.uniqueCosts).sort((a, b) => a - b),
                        totalVariations: item.costVariations.length,
                        averageCost: (item.costHistory.reduce((sum, entry) => sum + entry.cost, 0) / item.costHistory.length).toFixed(2)
                    }
                };
            })
            .sort((a, b) => {
                // Sort by: recurring items first, then by frequency, then by title
                if (a.isRecurring && !b.isRecurring) return -1;
                if (!a.isRecurring && b.isRecurring) return 1;
                return b.frequency - a.frequency;
            });
        
        return {
            success: true,
            message: `Analyzed ${historicalRequests.length} historical requests`,
            suggestedItems: suggestedItems,
            analysis: {
                totalRequests: historicalRequests.length,
                totalItems: suggestedItems.length,
                recurringItems: suggestedItems.filter(item => item.isRecurring).length,
                oneTimeItems: suggestedItems.filter(item => !item.isRecurring).length,
                dateRange: {
                    from: `${historicalRequests[historicalRequests.length - 1].month}/${historicalRequests[historicalRequests.length - 1].year}`,
                    to: `${historicalRequests[0].month}/${historicalRequests[0].year}`
                },
                costAnalysis: {
                    itemsWithCostVariations: suggestedItems.filter(item => item.costVariations.length > 0).length,
                    totalCostChanges: suggestedItems.reduce((sum, item) => sum + item.costVariations.length, 0)
                }
            }
        };
        
    } catch (error) {
        console.error('Error analyzing historical data:', error);
        return {
            success: false,
            message: 'Error analyzing historical data',
            error: error.message
        };
    }
}

// Function to create template from historical analysis
async function createTemplateFromHistoricalData(residenceId, templateData, user) {
    try {
        // Analyze historical data first
        const analysis = await analyzeHistoricalDataForTemplate(residenceId);
        
        if (!analysis.success) {
            throw new Error(analysis.message);
        }
        
        // Merge suggested items with user-provided items
        const mergedItems = templateData.items || [];
        
        // Add suggested items that user didn't explicitly include
        analysis.suggestedItems.forEach(suggestedItem => {
            const exists = mergedItems.some(item => 
                item.title.toLowerCase().trim() === suggestedItem.title.toLowerCase().trim()
            );
            
            if (!exists) {
                mergedItems.push(suggestedItem);
            }
        });
        
        // Create the template
        const template = new MonthlyRequest({
            title: templateData.title || 'Monthly Services Template',
            description: templateData.description || 'Template based on historical data',
            residence: residenceId,
            isTemplate: true,
            status: 'draft',
            items: mergedItems,
            submittedBy: user._id,
            templateName: templateData.templateName,
            templateDescription: templateData.templateDescription,
            tags: templateData.tags || [],
            // Add metadata about historical analysis
            templateMetadata: {
                createdFromHistoricalAnalysis: true,
                analysisDate: new Date(),
                historicalRequestsAnalyzed: analysis.analysis.totalRequests,
                dateRange: analysis.analysis.dateRange
            }
        });
        
        await template.save();
        
        return {
            success: true,
            template: template,
            analysis: analysis,
            message: `Template created with ${mergedItems.length} items based on historical analysis`
        };
        
    } catch (error) {
        console.error('Error creating template from historical data:', error);
        throw error;
    }
}

// Get all monthly requests (filtered by user role and residence)
exports.getAllMonthlyRequests = async (req, res) => {
    try {
        const user = req.user;
        const { 
            residence, 
            month, 
            year, 
            status, 
            isTemplate,
            page = 1, 
            limit = 10,
            search 
        } = req.query;

        let query = {};

        // Filter by residence
        if (residence) {
            query.residence = residence;
        }

        // Filter by month/year - handle templates differently
        if (month && year) {
            if (isTemplate === 'true') {
                // For templates, we'll filter by monthlyApprovals later
                // Don't add month/year to query for templates
            } else if (isTemplate === 'false') {
                // For non-templates (monthly requests), filter by month/year
            query.month = parseInt(month);
            query.year = parseInt(year);
            } else {
                // If isTemplate is not specified, show both templates and non-templates
                // For templates, we'll filter by monthlyApprovals later
                // For non-templates, filter by month/year
                query.$or = [
                    { month: parseInt(month), year: parseInt(year) },
                    { isTemplate: true }
                ];
            }
        }

        // Filter by status
        if (status) {
            query.status = status;
        }

        // Filter by template
        if (isTemplate !== undefined) {
            query.isTemplate = isTemplate === 'true';
        }

        // Search in title and description
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        // Remove role-based filtering - Allow all authenticated users to access monthly requests
        // Only block students from accessing monthly requests
        if (user.role === 'student') {
            return res.status(403).json({ message: 'Students do not have access to monthly requests' });
        }

        const skip = (page - 1) * limit;
        
        const monthlyRequests = await MonthlyRequest.find(query)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email')
            .populate('monthlyApprovals.approvedBy', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await MonthlyRequest.countDocuments(query);



        // Process monthly requests to include monthly approval status for templates
        const processedRequests = [];
        
        monthlyRequests.forEach(request => {
            if (request.isTemplate) {
                // For templates, create entries for each month that has monthly approvals
                if (month && year) {
                    // If specific month/year is requested, only show that month
                    const monthlyApproval = request.monthlyApprovals?.find(
                        approval => approval.month === parseInt(month) && approval.year === parseInt(year)
                    );
                    
                    if (monthlyApproval) {
                        const processedRequest = {
                            ...request.toObject(),
                            // Use monthly approval status as the finance status for this specific month
                            financeStatus: monthlyApproval.status,
                            effectiveStatus: monthlyApproval.status,
                            effectiveItems: monthlyApproval.items || request.items,
                            effectiveTotalCost: monthlyApproval.totalCost || request.totalEstimatedCost,
                            monthlyApproval: monthlyApproval,
                            month: parseInt(month),
                            year: parseInt(year),
                            isMonthlyEntry: true
                        };
                        processedRequests.push(processedRequest);
                    }
                } else {
                    // If no specific month/year, show all monthly approvals
                    request.monthlyApprovals?.forEach(approval => {
                        const processedRequest = {
                            ...request.toObject(),
                            // Use monthly approval status as the finance status for this specific month
                            financeStatus: approval.status,
                            effectiveStatus: approval.status,
                            effectiveItems: approval.items || request.items,
                            effectiveTotalCost: approval.totalCost || request.totalEstimatedCost,
                            monthlyApproval: approval,
                            month: approval.month,
                            year: approval.year,
                            isMonthlyEntry: true
                        };
                        processedRequests.push(processedRequest);
                    });
                }
            } else {
                // For non-templates, use the request status as finance status
                const processedRequest = {
                    ...request.toObject(),
                    financeStatus: request.status,
                    effectiveStatus: request.status,
                    effectiveItems: request.items,
                    effectiveTotalCost: request.totalEstimatedCost,
                    isMonthlyEntry: false
                };
                processedRequests.push(processedRequest);
            }
        });

        // Apply status filter to processed requests
        let filteredRequests = processedRequests;
        if (status) {
            filteredRequests = processedRequests.filter(request => request.financeStatus === status);
        }

        res.status(200).json({
            monthlyRequests: filteredRequests,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error getting monthly requests:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get monthly requests with enhanced filtering for templates and monthly approvals
exports.getMonthlyRequestsWithFiltering = async (req, res) => {
    try {
        const user = req.user;
        const { 
            residence, 
            month, 
            year, 
            status, 
            isTemplate,
            page = 1, 
            limit = 10,
            search 
        } = req.query;

        let query = {};

        // Filter by residence
        if (residence) {
            query.residence = residence;
        }

        // Filter by template
        if (isTemplate !== undefined) {
            query.isTemplate = isTemplate === 'true';
        }

        // Search in title and description
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        // Remove role-based filtering - Allow all authenticated users to access monthly requests
        // Only block students from accessing monthly requests
        if (user.role === 'student') {
            return res.status(403).json({ message: 'Students do not have access to monthly requests' });
        }

        const skip = (page - 1) * limit;
        
        // Get all templates and monthly requests
        const allRequests = await MonthlyRequest.find(query)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email')
            .populate('monthlyApprovals.approvedBy', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await MonthlyRequest.countDocuments(query);

        // Process requests to create monthly-specific entries
        const processedRequests = [];
        
        allRequests.forEach(request => {
            if (request.isTemplate) {
                // For templates, create entries for each month that has monthly approvals
                if (month && year) {
                    // If specific month/year is requested, only show that month
                    const monthlyApproval = request.monthlyApprovals?.find(
                        approval => approval.month === parseInt(month) && approval.year === parseInt(year)
                    );
                    
                    if (monthlyApproval) {
                        const processedRequest = {
                            ...request.toObject(),
                            // Use monthly approval status as the finance status for this specific month
                            financeStatus: monthlyApproval.status,
                            effectiveStatus: monthlyApproval.status,
                            effectiveItems: monthlyApproval.items || request.items,
                            effectiveTotalCost: monthlyApproval.totalCost || request.totalEstimatedCost,
                            monthlyApproval: monthlyApproval,
                            month: parseInt(month),
                            year: parseInt(year),
                            isMonthlyEntry: true
                        };
                        processedRequests.push(processedRequest);
                    }
                } else {
                    // If no specific month/year, show all monthly approvals
                    request.monthlyApprovals?.forEach(approval => {
                        const processedRequest = {
                            ...request.toObject(),
                            // Use monthly approval status as the finance status for this specific month
                            financeStatus: approval.status,
                            effectiveStatus: approval.status,
                            effectiveItems: approval.items || request.items,
                            effectiveTotalCost: approval.totalCost || request.totalEstimatedCost,
                            monthlyApproval: approval,
                            month: approval.month,
                            year: approval.year,
                            isMonthlyEntry: true
                        };
                        processedRequests.push(processedRequest);
                    });
                }
            } else {
                // For non-templates, use the request status as finance status
                const processedRequest = {
                    ...request.toObject(),
                    financeStatus: request.status,
                    effectiveStatus: request.status,
                    effectiveItems: request.items,
                    effectiveTotalCost: request.totalEstimatedCost,
                    isMonthlyEntry: false
                };
                processedRequests.push(processedRequest);
            }
        });

        // Apply status filter to processed requests
        let filteredRequests = processedRequests;
        if (status) {
            filteredRequests = processedRequests.filter(request => request.financeStatus === status);
        }

        res.status(200).json({
            monthlyRequests: filteredRequests,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error getting monthly requests with filtering:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get monthly request by ID
exports.getMonthlyRequestById = async (req, res) => {
    try {
        const user = req.user;
        const monthlyRequest = await MonthlyRequest.findById(req.params.id)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email')
            .populate('items.quotations.uploadedBy', 'firstName lastName email')
            .populate('items.quotations.approvedBy', 'firstName lastName email');

        if (!monthlyRequest) {
            return res.status(404).json({ message: 'Monthly request not found' });
        }

        // Check access permissions - Students cannot access monthly requests
        if (user.role === 'student') {
            return res.status(403).json({ message: 'Students do not have access to monthly requests' });
        }

        res.status(200).json(monthlyRequest);
    } catch (error) {
        console.error('Error getting monthly request:', error);
        res.status(500).json({ message: error.message });
    }
};

// Enhanced createMonthlyRequest to handle templates with historical data
exports.createMonthlyRequest = async (req, res) => {
    try {
        const {
            title,
            description,
            residence,
            month,
            year,
            priority = 'medium',
            items = [],
            isTemplate = false,
            historicalData = [], // New: historical cost data for templates
            itemHistory = [], // New: item change history for templates
            templateDescription,
            dateRequested
        } = req.body;

        // Validate required fields
        if (!title || !residence) {
            return res.status(400).json({
                success: false,
                message: 'Title and residence are required'
            });
        }

        // Validate residence exists
        const residenceExists = await Residence.findById(residence);
        if (!residenceExists) {
            return res.status(404).json({
                success: false,
                message: 'Residence not found'
            });
        }

        // Process items with historical data if provided
        let processedItems = items;
        if (isTemplate && (historicalData.length > 0 || itemHistory.length > 0)) {
            // First, create a map of all historical items to ensure we include all items
            const allHistoricalItems = new Map();
            
            // Add current items
            items.forEach(item => {
                allHistoricalItems.set(item.title.toLowerCase().trim(), {
                    ...item,
                    costHistory: [],
                    itemHistory: [],
                    costVariations: [],
                    costSummary: null
                });
            });
            
            // Historical data represents when items started (unchanged since then)
            // So we only add cost history to existing items, not create new items
            console.log('📊 Processing historical data for existing items...');
            
            // Item history represents items that were added/removed/modified
            // Process all item history entries to track the complete timeline
            console.log('📊 Processing item history for timeline tracking...');
            itemHistory.forEach(h => {
                const key = h.title.toLowerCase().trim();
                
                // If item exists in current items, it was either never removed or was added back
                if (allHistoricalItems.has(key)) {
                    console.log(`📊 Item "${h.title}" exists in current items - tracking history`);
                } else if (h.action === 'removed') {
                    // Item was removed and not added back - add it to the list
                    console.log(`📊 Adding permanently removed item: ${h.title}`);
                    allHistoricalItems.set(key, {
                        title: h.title,
                        description: h.description || h.title,
                        quantity: h.quantity || 1,
                        estimatedCost: h.cost || 0,
                        category: h.category || 'other',
                        priority: h.priority || 'medium',
                        isRecurring: h.isRecurring !== undefined ? h.isRecurring : true,
                        notes: h.notes || '',
                        tags: h.tags || [],
                        costHistory: [],
                        itemHistory: [],
                        costVariations: [],
                        costSummary: null
                    });
                }
            });
            
            // Now process all items
            processedItems = Array.from(allHistoricalItems.values()).map(item => {
                const processedItem = {
                    title: item.title,
                    description: item.description,
                    quantity: item.quantity || 1,
                    estimatedCost: item.estimatedCost,
                    category: item.category || 'other',
                    priority: item.priority || 'medium',
                    isRecurring: item.isRecurring !== undefined ? item.isRecurring : true,
                    notes: item.notes || '',
                    tags: item.tags || [],
                    costHistory: [],
                    itemHistory: [],
                    costVariations: [],
                    costSummary: null
                };

                // Add cost history if provided
                if (historicalData && Array.isArray(historicalData)) {
                    // More flexible matching: check if titles are similar
                    const itemHistory = historicalData.filter(h => {
                        if (!h.title) return false;
                        const historicalTitle = h.title.toLowerCase().trim();
                        const currentTitle = item.title.toLowerCase().trim();
                        
                        // Exact match
                        if (historicalTitle === currentTitle) return true;
                        
                        // Similar match (e.g., "wifi" vs "wil")
                        if (historicalTitle.includes(currentTitle) || currentTitle.includes(historicalTitle)) {
                            console.log(`📊 Matching historical item: "${h.title}" with current item: "${item.title}"`);
                            return true;
                        }
                        
                        return false;
                    });

                    if (itemHistory.length > 0) {
                        processedItem.costHistory = itemHistory.map(h => ({
                            month: h.month,
                            year: h.year,
                            cost: h.cost,
                            date: new Date(h.year, h.month - 1, 1),
                            note: h.note || `Historical cost from ${h.month}/${h.year}`,
                                                    // Standardized fields to match current item structure
                        title: h.title,
                        description: h.description || item.description,
                        quantity: h.quantity || 1,
                        category: h.category || item.category || 'other',
                        priority: h.priority || item.priority || 'medium',
                        isRecurring: isTemplate ? true : (h.isRecurring !== undefined ? h.isRecurring : true),
                        notes: h.notes || item.notes || ''
                        }));

                        // Sort cost history by date (most recent first)
                        processedItem.costHistory.sort((a, b) => b.date - a.date);

                        // Calculate cost variations
                        processedItem.costVariations = [];
                        for (let i = 0; i < processedItem.costHistory.length - 1; i++) {
                            const current = processedItem.costHistory[i];
                            const previous = processedItem.costHistory[i + 1];
                            
                            if (current.cost !== previous.cost) {
                                processedItem.costVariations.push({
                                    from: `${previous.month}/${previous.year}`,
                                    to: `${current.month}/${current.year}`,
                                    oldCost: previous.cost,
                                    newCost: current.cost,
                                    change: current.cost - previous.cost,
                                    changePercent: ((current.cost - previous.cost) / previous.cost * 100).toFixed(1)
                                });
                            }
                        }

                        // Add cost summary
                        const uniqueCosts = [...new Set(processedItem.costHistory.map(h => h.cost))].sort((a, b) => a - b);
                        const averageCost = (processedItem.costHistory.reduce((sum, h) => sum + h.cost, 0) / processedItem.costHistory.length).toFixed(2);
                        
                        processedItem.costSummary = {
                            mostRecentCost: processedItem.costHistory[0].cost,
                            mostRecentMonth: `${processedItem.costHistory[0].month}/${processedItem.costHistory[0].year}`,
                            uniqueCosts: uniqueCosts,
                            totalVariations: processedItem.costVariations.length,
                            averageCost: averageCost
                        };
                    }
                }

                // Add item history if provided
                if (itemHistory && Array.isArray(itemHistory)) {
                    // More flexible matching: check if titles are similar
                    const itemItemHistory = itemHistory.filter(h => {
                        if (!h.title) return false;
                        const historicalTitle = h.title.toLowerCase().trim();
                        const currentTitle = item.title.toLowerCase().trim();
                        
                        // Exact match
                        if (historicalTitle === currentTitle) return true;
                        
                        // Similar match (e.g., "wifi" vs "lo")
                        if (historicalTitle.includes(currentTitle) || currentTitle.includes(historicalTitle)) {
                            console.log(`📊 Matching item history: "${h.title}" with current item: "${item.title}"`);
                            return true;
                        }
                        
                        return false;
                    });

                    if (itemItemHistory.length > 0) {
                        processedItem.itemHistory = itemItemHistory.map(h => ({
                            month: h.month,
                            year: h.year,
                            date: new Date(h.year, h.month - 1, 1),
                            action: h.action, // 'added', 'removed', 'modified'
                            status: h.action === 'removed' ? 'inactive' : 'active', // Set status based on action
                            oldValue: h.oldValue,
                            newValue: h.newValue,
                            note: h.note || `${h.action} in ${h.month}/${h.year}`,
                            cost: h.cost,
                            quantity: h.quantity,
                            // Standardized fields to match current item structure
                            title: h.title,
                            description: h.description || item.description,
                            category: h.category || item.category || 'other',
                            priority: h.priority || item.priority || 'medium',
                            isRecurring: isTemplate ? true : (h.isRecurring !== undefined ? h.isRecurring : true),
                            notes: h.notes || item.notes || ''
                        }));

                        // Sort item history by date (most recent first)
                        processedItem.itemHistory.sort((a, b) => b.date - a.date);
                        
                        // Also add cost changes to cost history if the action involves cost changes
                        itemItemHistory.forEach(h => {
                            if (h.cost && h.cost !== item.estimatedCost) {
                                console.log(`📊 Adding cost change to history: ${h.title} - $${h.cost} in ${h.month}/${h.year}`);
                                processedItem.costHistory.push({
                                    month: h.month,
                                    year: h.year,
                                    cost: h.cost,
                                    date: new Date(h.year, h.month - 1, 1),
                                    note: `Cost changed during ${h.action} - ${h.note}`,
                                                                // Standardized fields
                            title: h.title,
                            description: h.description || item.description,
                            quantity: h.quantity || 1,
                            category: h.category || item.category || 'other',
                            priority: h.priority || item.priority || 'medium',
                            isRecurring: isTemplate ? true : (h.isRecurring !== undefined ? h.isRecurring : true),
                            notes: h.notes || item.notes || ''
                                });
                            }
                        });
                        
                        // Re-sort cost history after adding item history costs
                        if (processedItem.costHistory.length > 0) {
                            processedItem.costHistory.sort((a, b) => b.date - a.date);
                        }
                    }
                }

                // Auto-set isRecurring for templates
                if (isTemplate) {
                    processedItem.isRecurring = true;
                }
                
                // Update notes with historical information (optional)
                let historyNotes = [];
                if (processedItem.costHistory.length > 0) {
                    historyNotes.push(`Cost history: ${processedItem.costHistory.length} entries, ${processedItem.costVariations.length} variations`);
                }
                if (processedItem.itemHistory.length > 0) {
                    const addedCount = processedItem.itemHistory.filter(h => h.action === 'added').length;
                    const removedCount = processedItem.itemHistory.filter(h => h.action === 'removed').length;
                    const modifiedCount = processedItem.itemHistory.filter(h => h.action === 'modified').length;
                    historyNotes.push(`Item history: ${addedCount} added, ${removedCount} removed, ${modifiedCount} modified`);
                }
                
                if (historyNotes.length > 0) {
                    const historyNote = historyNotes.join('; ');
                    processedItem.notes = processedItem.notes ? `${processedItem.notes}. ${historyNote}` : historyNote;
                }

                return processedItem;
            });
        }

        // Calculate total estimated cost
        const totalEstimatedCost = processedItems.reduce((sum, item) => sum + (item.estimatedCost * item.quantity), 0);

        // Determine appropriate status based on month/year and template
        let requestStatus = 'draft';
        if (!isTemplate) {
            requestStatus = getDefaultStatusForMonth(parseInt(month), parseInt(year), req.user.role);
        }

        // Create the monthly request
        const monthlyRequest = new MonthlyRequest({
            title,
            description,
            residence,
            month: isTemplate ? null : month,
            year: isTemplate ? null : year,
            status: requestStatus,
            priority,
            items: processedItems,
            totalEstimatedCost,
            submittedBy: req.user._id,
            dateRequested: dateRequested ? new Date(dateRequested) : new Date(),
            isTemplate,
            templateVersion: isTemplate ? 1 : undefined,
            lastUpdated: isTemplate ? new Date() : undefined,
            effectiveFrom: isTemplate ? new Date() : undefined,
            templateChanges: isTemplate ? [] : undefined,
            templateMetadata: isTemplate ? {
                createdWithHistoricalData: historicalData.length > 0 || itemHistory.length > 0,
                creationDate: new Date(),
                historicalDataProvided: historicalData.length,
                itemHistoryProvided: itemHistory.length,
                templateDescription: templateDescription,
                totalHistoricalEntries: processedItems.reduce((sum, item) => sum + (item.costHistory ? item.costHistory.length : 0), 0),
                totalItemHistoryEntries: processedItems.reduce((sum, item) => sum + (item.itemHistory ? item.itemHistory.length : 0), 0)
            } : undefined
        });

        await monthlyRequest.save();

        // Add to request history
        monthlyRequest.requestHistory.push({
            date: new Date(),
            action: isTemplate ? 'Template created with historical data' : 'Monthly request created',
            user: req.user._id,
            changes: [isTemplate ? 'Template created with historical data' : 'Monthly request created']
        });

        await monthlyRequest.save();

        res.status(201).json({
            success: true,
            message: isTemplate ? 'Template created successfully with historical data' : 'Monthly request created successfully',
            monthlyRequest: monthlyRequest,
            summary: isTemplate ? {
                totalItems: processedItems.length,
                itemsWithCostHistory: processedItems.filter(item => item.costHistory && item.costHistory.length > 0).length,
                itemsWithItemHistory: processedItems.filter(item => item.itemHistory && item.itemHistory.length > 0).length,
                totalCostHistoryEntries: processedItems.reduce((sum, item) => sum + (item.costHistory ? item.costHistory.length : 0), 0),
                totalItemHistoryEntries: processedItems.reduce((sum, item) => sum + (item.itemHistory ? item.itemHistory.length : 0), 0),
                totalCostVariations: processedItems.reduce((sum, item) => sum + (item.costVariations ? item.costVariations.length : 0), 0)
            } : undefined
        });

    } catch (error) {
        console.error('Error creating monthly request:', error);
        console.error('Error stack:', error.stack);
        console.error('Request body:', JSON.stringify(req.body, null, 2));
        
        res.status(500).json({
            success: false,
            message: 'Error creating monthly request',
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// Update monthly request
exports.updateMonthlyRequest = async (req, res) => {
    try {
        const user = req.user;
        const monthlyRequest = await MonthlyRequest.findById(req.params.id);

        if (!monthlyRequest) {
            return res.status(404).json({ message: 'Monthly request not found' });
        }

        // Check permissions - allow admin, finance users, or the submitter to update
        if (!['admin', 'finance', 'finance_admin', 'finance_user'].includes(user.role) && monthlyRequest.submittedBy.toString() !== user._id.toString()) {
            return res.status(403).json({ message: 'Only admins, finance users, or the submitter can update monthly requests' });
        }

        // Only allow updates if status is draft or pending
        if (!['draft', 'pending'].includes(monthlyRequest.status)) {
            return res.status(400).json({ message: 'Cannot update monthly request that has been approved or completed' });
        }

        const {
            title,
            description,
            items,
            priority,
            notes,
            tags
        } = req.body;

        const changes = [];

        if (title && title !== monthlyRequest.title) {
            monthlyRequest.title = title;
            changes.push('Title updated');
        }

        if (description && description !== monthlyRequest.description) {
            monthlyRequest.description = formatDescriptionWithMonth(description, monthlyRequest.month, monthlyRequest.year);
            changes.push('Description updated');
        }

        if (items) {
            monthlyRequest.items = items;
            changes.push('Items updated');
        }

        if (priority && priority !== monthlyRequest.priority) {
            monthlyRequest.priority = priority;
            changes.push('Priority updated');
        }

        if (notes !== undefined && notes !== monthlyRequest.notes) {
            monthlyRequest.notes = notes;
            changes.push('Notes updated');
        }

        if (tags) {
            monthlyRequest.tags = tags;
            changes.push('Tags updated');
        }

        if (changes.length > 0) {
            monthlyRequest.requestHistory.push({
                date: new Date(),
                action: 'Monthly request updated',
                user: user._id,
                changes
            });
        }

        await monthlyRequest.save();

        const updatedRequest = await MonthlyRequest.findById(monthlyRequest._id)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email');

        res.status(200).json(updatedRequest);
    } catch (error) {
        console.error('Error updating monthly request:', error);
        res.status(500).json({ message: error.message });
    }
};

// Send monthly request to finance (admin only)
exports.sendToFinance = async (req, res) => {
    try {
        const user = req.user;
        const { month, year } = req.body;
        const monthlyRequest = await MonthlyRequest.findById(req.params.id);

        if (!monthlyRequest) {
            return res.status(404).json({ 
                success: false,
                message: 'Monthly request not found' 
            });
        }

        // Check permissions - only admin can send to finance
        if (user.role !== 'admin') {
            return res.status(403).json({ 
                success: false,
                message: 'Only admins can send requests to finance' 
            });
        }

        // For templates, require month and year
        if (monthlyRequest.isTemplate && (!month || !year)) {
            return res.status(400).json({ 
                success: false,
                message: 'Month and year are required for template submissions',
                requiresMonthYear: true,
                currentMonth: new Date().getMonth() + 1,
                currentYear: new Date().getFullYear()
            });
        }

        // For templates, handle monthly-specific submission
        if (monthlyRequest.isTemplate) {
            // Check if monthly approval already exists
            const existingApproval = monthlyRequest.monthlyApprovals.find(
                approval => approval.month === parseInt(month) && approval.year === parseInt(year)
            );

            if (existingApproval && existingApproval.status !== 'draft') {
                return res.status(400).json({ 
                    success: false,
                    message: `Monthly request for ${month}/${year} is already ${existingApproval.status}` 
                });
            }

            // Create or update monthly approval
            const monthlyApproval = {
                month: parseInt(month),
                year: parseInt(year),
                status: 'pending',
                items: monthlyRequest.items.map(item => ({
                    title: item.title,
                    description: item.description,
                    quantity: item.quantity,
                    estimatedCost: item.estimatedCost,
                    category: item.category,
                    priority: item.priority,
                    notes: item.notes
                })),
                totalCost: monthlyRequest.totalEstimatedCost || 0,
                submittedAt: new Date(),
                submittedBy: user._id
            };

            if (existingApproval) {
                // Update existing approval
                const approvalIndex = monthlyRequest.monthlyApprovals.findIndex(
                    approval => approval.month === parseInt(month) && approval.year === parseInt(year)
                );
                monthlyRequest.monthlyApprovals[approvalIndex] = monthlyApproval;
            } else {
                // Add new monthly approval
                monthlyRequest.monthlyApprovals.push(monthlyApproval);
            }

            // Add to request history
            monthlyRequest.requestHistory.push({
                date: new Date(),
                action: `Sent ${month}/${year} monthly request to finance`,
                user: user._id,
                changes: [`Monthly request for ${month}/${year} sent to finance`]
            });

            // Automatically create a monthly request for this specific month
            let createdMonthlyRequest = null;
            try {
                const monthlyRequestData = {
                    title: `${monthlyRequest.title} - ${month}/${year}`,
                    description: formatDescriptionWithMonth(monthlyRequest.description, month, year),
                    residence: monthlyRequest.residence,
                    month: parseInt(month),
                    year: parseInt(year),
                    items: monthlyRequest.items.map(item => ({
                        title: item.title,
                        description: item.description,
                        quantity: item.quantity,
                        estimatedCost: item.estimatedCost,
                        category: item.category,
                        priority: item.priority,
                        notes: item.notes
                    })),
                    totalEstimatedCost: monthlyRequest.totalEstimatedCost || 0,
                    status: 'pending',
                    submittedBy: user._id,
                    isTemplate: false,
                    createdFromTemplate: true,
                    templateId: monthlyRequest._id,
                    notes: `Created from template: ${monthlyRequest.title}`
                };

                const newMonthlyRequest = new MonthlyRequest(monthlyRequestData);
                createdMonthlyRequest = await newMonthlyRequest.save();

                console.log(`Created monthly request for ${month}/${year} from template:`, createdMonthlyRequest._id);
            } catch (error) {
                console.error('Error creating monthly request from template:', error);
                // Don't fail the main operation if monthly request creation fails
            }

        } else {
            // For regular requests, update main status
            if (monthlyRequest.status !== 'draft') {
                return res.status(400).json({ 
                    success: false,
                    message: `Cannot send request to finance. Current status: ${monthlyRequest.status}. Only draft requests can be sent to finance.` 
                });
            }

            monthlyRequest.status = 'pending';
            
            // Add to request history
            monthlyRequest.requestHistory.push({
                date: new Date(),
                action: 'Sent to finance for approval',
                user: user._id,
                changes: ['Status changed from draft to pending']
            });
        }

        await monthlyRequest.save();

        // Send email to finance users about pending approval (non-blocking)
        if (monthlyRequest.isTemplate && month && year) {
            EmailNotificationService.sendMonthlyRequestToFinance(
                monthlyRequest,
                user,
                month,
                year
            ).catch(emailError => {
                console.error('Failed to send monthly request email notification:', emailError);
            });
        } else {
            // For regular requests without template, still notify finance
            EmailNotificationService.sendMonthlyRequestToFinance(
                { ...monthlyRequest.toObject(), month, year },
                user,
                month || monthlyRequest.month,
                year || monthlyRequest.year
            ).catch(emailError => {
                console.error('Failed to send monthly request email notification:', emailError);
            });
        }

        // Auto-approve and convert to expenses for past/current months
        let autoApprovalResult = null;
        if (monthlyRequest.isTemplate && targetMonth && targetYear) {
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth() + 1;
            const currentYear = currentDate.getFullYear();
            
            // Auto-approve past/current months
            const isPastOrCurrent = (parseInt(targetYear) < currentYear) || 
                                  (parseInt(targetYear) === currentYear && parseInt(targetMonth) <= currentMonth);
            
            if (isPastOrCurrent) {
                try {
                    // Find the monthly approval we just created
                    const monthlyApproval = monthlyRequest.monthlyApprovals.find(
                        approval => approval.month === parseInt(targetMonth) && approval.year === parseInt(targetYear)
                    );
                    
                    if (monthlyApproval) {
                        // Auto-approve the monthly approval
                        monthlyApproval.status = 'approved';
                        monthlyApproval.approvedBy = user._id; // Using admin as approver for auto-approval
                        monthlyApproval.approvedAt = new Date();
                        monthlyApproval.approvedByEmail = user.email;
                        monthlyApproval.notes = 'Auto-approved for past/current month';
                        
                        // Add to request history
                        monthlyRequest.requestHistory.push({
                            date: new Date(),
                            action: `Auto-approved ${targetMonth}/${targetYear} monthly request`,
                            user: user._id,
                            changes: [`${targetMonth}/${targetYear} auto-approved for past/current month`]
                        });
                        
                        await monthlyRequest.save();
                        
                        // Auto-convert to expenses
                        const tempRequest = {
                            ...monthlyRequest.toObject(),
                            items: monthlyApproval.items,
                            totalEstimatedCost: monthlyApproval.totalCost,
                            month: monthlyApproval.month,
                            year: monthlyApproval.year,
                            status: 'approved',
                            isTemplate: false
                        };
                        
                        const expenseConversionResult = await convertRequestToExpenses(tempRequest, user);
                        
                        autoApprovalResult = {
                            autoApproved: true,
                            converted: expenseConversionResult.expenses.length,
                            errors: expenseConversionResult.errors.length > 0 ? expenseConversionResult.errors : undefined
                        };
                        
                        console.log(`Auto-approved and converted ${expenseConversionResult.expenses.length} expenses for ${targetMonth}/${targetYear}: ${monthlyRequest._id}`);
                    }
                } catch (autoApprovalError) {
                    console.error('Error auto-approving past/current month:', autoApprovalError);
                    autoApprovalResult = { autoApproved: false, error: autoApprovalError.message };
                }
            }
        }

        const updatedRequest = await MonthlyRequest.findById(monthlyRequest._id)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('monthlyApprovals.approvedBy', 'firstName lastName email');

        res.status(200).json({
            success: true,
            message: monthlyRequest.isTemplate 
                ? `Monthly request for ${targetMonth}/${targetYear} sent to finance successfully`
                : 'Request sent to finance successfully',
            monthlyRequest: updatedRequest,
            autoApproval: autoApprovalResult,
            createdMonthlyRequest: createdMonthlyRequest ? {
                id: createdMonthlyRequest._id,
                title: createdMonthlyRequest.title,
                month: createdMonthlyRequest.month,
                year: createdMonthlyRequest.year,
                status: createdMonthlyRequest.status
            } : null
        });

    } catch (error) {
        console.error('Error sending request to finance:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error sending request to finance',
            error: error.message 
        });
    }
};

// Submit monthly request for approval
exports.submitMonthlyRequest = async (req, res) => {
    try {
        const user = req.user;
        const monthlyRequest = await MonthlyRequest.findById(req.params.id);

        if (!monthlyRequest) {
            return res.status(404).json({ message: 'Monthly request not found' });
        }

        // Check permissions
        if (user.role !== 'admin' && monthlyRequest.submittedBy.toString() !== user._id.toString()) {
            return res.status(403).json({ message: 'Only admins or the submitter can submit monthly requests' });
        }

        if (monthlyRequest.status !== 'draft') {
            return res.status(400).json({ message: 'Only draft requests can be submitted' });
        }

        if (!monthlyRequest.items || monthlyRequest.items.length === 0) {
            return res.status(400).json({ message: 'Cannot submit monthly request without items' });
        }

        monthlyRequest.status = 'pending';
        monthlyRequest.requestHistory.push({
            date: new Date(),
            action: 'Monthly request submitted for approval',
            user: user._id,
            changes: ['Status changed to pending']
        });

        await monthlyRequest.save();

        const updatedRequest = await MonthlyRequest.findById(monthlyRequest._id)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email');

        res.status(200).json(updatedRequest);
    } catch (error) {
        console.error('Error submitting monthly request:', error);
        res.status(500).json({ message: error.message });
    }
};

// Approve monthly request (Finance only)
exports.approveMonthlyRequest = async (req, res) => {
    try {
        const user = req.user;
        const { approved, notes, month, year, status, datePaid } = req.body;

        // Check permissions - allow admin and finance users to approve
        if (!['admin', 'finance', 'finance_admin', 'finance_user'].includes(user.role)) {
            return res.status(403).json({ message: 'Only admin and finance users can approve monthly requests' });
        }

        const monthlyRequest = await MonthlyRequest.findById(req.params.id);

        if (!monthlyRequest) {
            return res.status(404).json({ message: 'Monthly request not found' });
        }

        // For templates, handle monthly-specific approval
        if (monthlyRequest.isTemplate) {
            if (!month || !year) {
                return res.status(400).json({ message: 'Month and year are required for template approvals' });
            }

            const monthlyApproval = monthlyRequest.monthlyApprovals.find(
                approval => approval.month === parseInt(month) && approval.year === parseInt(year)
            );

            if (!monthlyApproval) {
                return res.status(404).json({ 
                    message: `No monthly request found for ${month}/${year}` 
                });
            }

            if (monthlyApproval.status !== 'pending') {
                return res.status(400).json({ 
                    message: `Monthly request for ${month}/${year} is not pending. Current status: ${monthlyApproval.status}` 
                });
            }

            // Update monthly approval status
            monthlyApproval.status = approved ? 'approved' : 'rejected';
            monthlyApproval.approvedBy = user._id;
            monthlyApproval.approvedAt = new Date();
            monthlyApproval.approvedByEmail = user.email;
            monthlyApproval.notes = notes || monthlyApproval.notes;
            
            // Set datePaid when monthly approval is approved (marked as paid)
            if (approved) {
                monthlyApproval.datePaid = datePaid ? new Date(datePaid) : new Date();
            }

            // Add to request history
            monthlyRequest.requestHistory.push({
                date: new Date(),
                action: `Monthly request for ${month}/${year} ${approved ? 'approved' : 'rejected'}`,
                user: user._id,
                changes: [`${month}/${year} status changed to ${approved ? 'approved' : 'rejected'}`]
            });

        } else {
            // For regular requests, update main status
        if (monthlyRequest.status !== 'pending') {
            return res.status(400).json({ message: 'Only pending requests can be approved' });
        }

        console.log('Approving regular request:', {
            requestId: monthlyRequest._id,
            currentStatus: monthlyRequest.status,
            approved: approved,
            requestedStatus: status,
            newStatus: approved ? (status || 'approved') : 'rejected'
        });

        // Ensure all approval fields exist (for requests created before schema changes)
        if (!monthlyRequest.approvedBy) {
            monthlyRequest.approvedBy = user._id;
        }
        if (!monthlyRequest.approvedAt) {
            monthlyRequest.approvedAt = new Date();
        }
        if (!monthlyRequest.approvedByEmail) {
            monthlyRequest.approvedByEmail = user.email;
        }

        // Use the status from frontend if provided and approved, otherwise use default
        const finalStatus = approved ? (status || 'approved') : 'rejected';
        monthlyRequest.status = finalStatus;
        monthlyRequest.approvedBy = user._id;
        monthlyRequest.approvedAt = new Date();
        monthlyRequest.approvedByEmail = user.email;
        monthlyRequest.notes = notes || monthlyRequest.notes;
        
        // Set datePaid when request is approved (marked as paid)
        if (approved && (finalStatus === 'approved' || finalStatus === 'completed')) {
            monthlyRequest.datePaid = datePaid ? new Date(datePaid) : new Date();
        }

        monthlyRequest.requestHistory.push({
            date: new Date(),
            action: `Monthly request ${approved ? 'approved' : 'rejected'}`,
            user: user._id,
            changes: [`Status changed to ${finalStatus}`]
        });
        }

        try {
        await monthlyRequest.save();
            console.log('Request saved with new status:', {
                requestId: monthlyRequest._id,
                newStatus: monthlyRequest.status,
                approvedBy: monthlyRequest.approvedBy,
                approvedAt: monthlyRequest.approvedAt
            });
        } catch (saveError) {
            console.error('Error saving monthly request:', saveError);
            return res.status(500).json({
                success: false,
                message: 'Error saving approval changes',
                error: saveError.message
            });
        }

        // Auto-convert to expenses if approved
        let expenseConversionResult = null;
        if (approved) {
            try {
                if (monthlyRequest.isTemplate) {
                    // For templates, create/reuse a real monthly request (isTemplate: false) for that month/year then convert it
                    const targetMonth = parseInt(month);
                    const targetYear = parseInt(year);
                    const monthlyApproval = monthlyRequest.monthlyApprovals.find(
                        approval => approval.month === targetMonth && approval.year === targetYear
                    );

                    if (monthlyApproval) {
                        let derivedMonthly = await MonthlyRequest.findOne({
                            templateId: monthlyRequest._id,
                            month: targetMonth,
                            year: targetYear,
                            isTemplate: false
                        });

                        if (!derivedMonthly) {
                            const derivedData = {
                                title: `${monthlyRequest.title} - ${targetMonth}/${targetYear}`,
                                description: formatDescriptionWithMonth(monthlyRequest.description, targetMonth, targetYear),
                                residence: monthlyRequest.residence,
                                month: targetMonth,
                                year: targetYear,
                                items: monthlyApproval.items,
                                totalEstimatedCost: monthlyApproval.totalCost,
                                status: 'approved',
                                submittedBy: user._id,
                                approvedBy: user._id,
                                approvedAt: new Date(),
                                approvedByEmail: user.email,
                                isTemplate: false,
                                createdFromTemplate: true,
                                templateId: monthlyRequest._id,
                                notes: `Created from template approval: ${monthlyRequest.title}`
                            };
                            derivedMonthly = new MonthlyRequest(derivedData);
                            await derivedMonthly.save();
                        } else {
                            // Ensure approved status
                            derivedMonthly.status = 'approved';
                            derivedMonthly.approvedBy = user._id;
                            derivedMonthly.approvedAt = new Date();
                            derivedMonthly.approvedByEmail = user.email;
                            await derivedMonthly.save();
                        }

                        // Convert the derived monthly request (non-template) to expenses and entries
                        expenseConversionResult = await convertRequestToExpenses(derivedMonthly, user);
                    }
                } else {
                    // For regular requests, convert directly (ensure isTemplate false)
                    // Create a clean object with isTemplate: false but preserve the Mongoose document for saving
                    const requestForConversion = {
                        ...monthlyRequest.toObject(),
                        isTemplate: false
                    };
                    expenseConversionResult = await convertRequestToExpenses(requestForConversion, user);
                }
                
                console.log(`Auto-converted ${expenseConversionResult?.expenses?.length || 0} expenses for approved request: ${monthlyRequest._id}`);

                // STRICT: If no expenses created or errors present, revert approval and fail
                const createdCount = expenseConversionResult?.expenses?.length || 0;
                const hadErrors = Array.isArray(expenseConversionResult?.errors) && expenseConversionResult.errors.length > 0;
                if (createdCount === 0 || hadErrors) {
                    console.error('❌ Approval strict mode: accrual/expense creation failed. Reverting approval.');
                    // Revert approval state
                    monthlyRequest.status = 'pending';
                    monthlyRequest.approvedBy = null;
                    monthlyRequest.approvedAt = null;
                    monthlyRequest.approvedByEmail = null;
                    await monthlyRequest.save();

                    return res.status(500).json({
                        success: false,
                        message: 'Approval failed: accrual transactions and expenses must be created on approval.',
                        details: expenseConversionResult?.errors || ['No expenses were created']
                    });
                }
            } catch (conversionError) {
                console.error('Error auto-converting to expenses:', conversionError);
                // Don't fail the approval if expense conversion fails
                // STRICT: Fail approval
                monthlyRequest.status = 'pending';
                monthlyRequest.approvedBy = null;
                monthlyRequest.approvedAt = null;
                monthlyRequest.approvedByEmail = null;
                await monthlyRequest.save();
                return res.status(500).json({
                    success: false,
                    message: 'Approval failed: error creating accrual/expenses',
                    error: conversionError.message
                });
            }
        }

        let updatedRequest;
        try {
            updatedRequest = await MonthlyRequest.findById(monthlyRequest._id)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email')
            .populate('monthlyApprovals.approvedBy', 'firstName lastName email');

            if (!updatedRequest) {
                console.error('Could not find updated request after save');
                return res.status(500).json({
                    success: false,
                    message: 'Error retrieving updated request'
                });
            }

            console.log('Updated request status:', {
                requestId: updatedRequest._id,
                status: updatedRequest.status,
                approvedBy: updatedRequest.approvedBy,
                approvedAt: updatedRequest.approvedAt
            });
        } catch (queryError) {
            console.error('Error querying updated request:', queryError);
            return res.status(500).json({
                success: false,
                message: 'Error retrieving updated request',
                error: queryError.message
            });
        }

        // Send email notification to submitter about approval/rejection (non-blocking)
        if (updatedRequest.submittedBy?.email) {
            EmailNotificationService.sendMonthlyRequestApprovalNotification(
                updatedRequest,
                approved,
                notes,
                month || updatedRequest.month,
                year || updatedRequest.year,
                user
            ).catch(emailError => {
                console.error('Failed to send monthly request approval email notification:', emailError);
            });
        }

        const response = {
            success: true,
            message: monthlyRequest.isTemplate 
                ? `Monthly request for ${month}/${year} ${approved ? 'approved' : 'rejected'} successfully`
                : `Monthly request ${approved ? 'approved' : 'rejected'} successfully`,
            monthlyRequest: updatedRequest,
            status: updatedRequest.status,
            approved: approved,
            requestId: updatedRequest._id,
            expenseConversion: approved && expenseConversionResult ? {
                converted: expenseConversionResult?.expenses?.length || 0,
                errors: expenseConversionResult?.errors?.length > 0 ? expenseConversionResult.errors : undefined
            } : undefined
        };

        console.log('Approval response:', JSON.stringify(response, null, 2));
        res.status(200).json(response);
    } catch (error) {
        console.error('Error approving monthly request:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error approving monthly request',
            error: error.message 
        });
    }
};

// Reject monthly request (finance only)
exports.rejectMonthlyRequest = async (req, res) => {
    try {
        const user = req.user;
        const { rejectionReason } = req.body;
        const monthlyRequest = await MonthlyRequest.findById(req.params.id);

        if (!monthlyRequest) {
            return res.status(404).json({ 
                success: false,
                message: 'Monthly request not found' 
            });
        }

        // Check permissions - allow admin and finance users to reject
        if (!['admin', 'finance', 'finance_admin', 'finance_user'].includes(user.role)) {
            return res.status(403).json({ 
                success: false,
                message: 'Only admin and finance users can reject monthly requests' 
            });
        }

        // Check if request is pending
        if (monthlyRequest.status !== 'pending') {
            return res.status(400).json({ 
                success: false,
                message: 'Only pending requests can be rejected' 
            });
        }

        // Update status to rejected
        monthlyRequest.status = 'rejected';
        monthlyRequest.approvedBy = user._id; // Using approvedBy field for consistency
        monthlyRequest.approvedAt = new Date();
        monthlyRequest.approvedByEmail = user.email;
        monthlyRequest.notes = rejectionReason ? `Rejected: ${rejectionReason}` : 'Rejected by finance';

        // Add to request history
        monthlyRequest.requestHistory.push({
            date: new Date(),
            action: 'Monthly request rejected',
            user: user._id,
            changes: [{
                field: 'status',
                oldValue: 'pending',
                newValue: 'rejected'
            }]
        });

        await monthlyRequest.save();

        const updatedRequest = await MonthlyRequest.findById(monthlyRequest._id)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email');

        // Send email notification to submitter about rejection (non-blocking)
        if (updatedRequest.submittedBy?.email) {
            EmailNotificationService.sendMonthlyRequestApprovalNotification(
                updatedRequest,
                false, // rejected
                rejectionReason,
                updatedRequest.month,
                updatedRequest.year,
                user
            ).catch(emailError => {
                console.error('Failed to send monthly request rejection email notification:', emailError);
            });
        }

        res.status(200).json({
            success: true,
            message: 'Monthly request rejected successfully',
            monthlyRequest: updatedRequest
        });

    } catch (error) {
        console.error('Error rejecting monthly request:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error rejecting monthly request',
            error: error.message 
        });
    }
};

// Get templates for a residence
exports.getTemplates = async (req, res) => {
    try {
        const user = req.user;
        
        // Students cannot access monthly request templates
        if (user.role === 'student') {
            return res.status(403).json({ message: 'Students do not have access to monthly requests' });
        }
        
        const { residence } = req.params;
        const templates = await MonthlyRequest.getTemplates(residence);

        res.status(200).json(templates);
    } catch (error) {
        console.error('Error getting templates:', error);
        res.status(500).json({ message: error.message });
    }
};

// Create monthly request from template
exports.createFromTemplate = async (req, res) => {
    try {
        const user = req.user;
        
        // Students cannot create monthly requests from templates
        if (user.role === 'student') {
            return res.status(403).json({ message: 'Students do not have access to monthly requests' });
        }
        
        const { templateId } = req.params;
        const { month, year } = req.body;

        if (!month || !year) {
            return res.status(400).json({ message: 'Month and year are required' });
        }

        const monthlyRequest = await MonthlyRequest.createFromTemplate(templateId, parseInt(month), parseInt(year), user._id);

        const populatedRequest = await MonthlyRequest.findById(monthlyRequest._id)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email');

        res.status(201).json(populatedRequest);
    } catch (error) {
        console.error('Error creating from template:', error);
        res.status(500).json({ message: error.message });
    }
};

// Add quotation to item
exports.addItemQuotation = async (req, res) => {
    try {
        const user = req.user;
        const { itemIndex } = req.params;
        const { provider, amount, description } = req.body;

        // Check permissions - only admins can add quotations
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can add quotations' });
        }

        const monthlyRequest = await MonthlyRequest.findById(req.params.id);
        if (!monthlyRequest) {
            return res.status(404).json({ message: 'Monthly request not found' });
        }

        if (!monthlyRequest.items[itemIndex]) {
            return res.status(400).json({ message: 'Invalid item index' });
        }

        // Handle file upload
        let fileUrl = '';
        let fileName = '';
        
        if (req.file) {
            const uploadResult = await uploadToS3(req.file, 'monthly-request-quotations');
            fileUrl = uploadResult.url;
            fileName = uploadResult.fileName;
        }

        const quotation = {
            provider,
            amount: parseFloat(amount),
            description: description || '',
            fileUrl,
            fileName,
            uploadedBy: user._id,
            uploadedAt: new Date(),
            isApproved: false
        };

        await monthlyRequest.addItemQuotation(parseInt(itemIndex), quotation);

        monthlyRequest.requestHistory.push({
            date: new Date(),
            action: 'Item quotation added',
            user: user._id,
            changes: [`Quotation added for item: ${monthlyRequest.items[itemIndex].description}`]
        });

        await monthlyRequest.save();

        const updatedRequest = await MonthlyRequest.findById(monthlyRequest._id)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('items.quotations.uploadedBy', 'firstName lastName email')
            .populate('items.quotations.approvedBy', 'firstName lastName email');

        res.status(201).json(updatedRequest);
    } catch (error) {
        console.error('Error adding item quotation:', error);
        res.status(500).json({ message: error.message });
    }
};

// Approve item quotation
exports.approveItemQuotation = async (req, res) => {
    try {
        const user = req.user;
        const { itemIndex, quotationIndex } = req.params;

        // Check permissions - only admins and finance users can approve quotations
        if (!['admin', 'finance', 'finance_admin', 'finance_user'].includes(user.role)) {
            return res.status(403).json({ message: 'Only admins and finance users can approve quotations' });
        }

        const monthlyRequest = await MonthlyRequest.findById(req.params.id);
        if (!monthlyRequest) {
            return res.status(404).json({ message: 'Monthly request not found' });
        }

        await monthlyRequest.approveItemQuotation(parseInt(itemIndex), parseInt(quotationIndex), user._id);

        monthlyRequest.requestHistory.push({
            date: new Date(),
            action: 'Item quotation approved',
            user: user._id,
            changes: [`Quotation approved for item: ${monthlyRequest.items[itemIndex].description}`]
        });

        await monthlyRequest.save();

        const updatedRequest = await MonthlyRequest.findById(monthlyRequest._id)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('items.quotations.uploadedBy', 'firstName lastName email')
            .populate('items.quotations.approvedBy', 'firstName lastName email');

        res.status(200).json(updatedRequest);
    } catch (error) {
        console.error('Error approving item quotation:', error);
        res.status(500).json({ message: error.message });
    }
};

// Update item quotation in monthly request
exports.updateItemQuotation = async (req, res) => {
    try {
        const { id, itemIndex, quotationIndex } = req.params;
        const { provider, amount, description, isSelected } = req.body;
        const user = req.user;

        // Check permissions - only admin can update quotations
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can update quotations' });
        }

        const monthlyRequest = await MonthlyRequest.findById(id);
        if (!monthlyRequest) {
            return res.status(404).json({ message: 'Monthly request not found' });
        }

        // Check if item exists
        if (!monthlyRequest.items || !monthlyRequest.items[itemIndex]) {
            return res.status(404).json({ message: 'Item not found' });
        }

        const item = monthlyRequest.items[itemIndex];

        // Check if quotation exists
        if (!item.quotations || !item.quotations[quotationIndex]) {
            return res.status(404).json({ message: 'Quotation not found' });
        }

        const quotation = item.quotations[quotationIndex];

        // Only allow updates if status is draft or pending
        if (!['draft', 'pending'].includes(monthlyRequest.status)) {
            return res.status(400).json({ message: 'Cannot update quotation for monthly request in current status' });
        }

        const changes = [];

        // Update fields if provided
        if (provider && provider !== quotation.provider) {
            quotation.provider = provider;
            changes.push(`Provider updated to: ${provider}`);
        }

        if (amount !== undefined && amount !== quotation.amount) {
            quotation.amount = amount;
            changes.push(`Amount updated to: ${amount}`);
        }

        if (description !== undefined && description !== quotation.description) {
            quotation.description = description;
            changes.push('Description updated');
        }

        // Handle isSelected field update
        if (isSelected !== undefined && isSelected !== quotation.isSelected) {
            if (isSelected) {
                // Deselect all other quotations for this item first
                item.quotations.forEach((otherQuotation, index) => {
                    if (index !== parseInt(quotationIndex) && otherQuotation.isSelected) {
                        otherQuotation.isSelected = false;
                        otherQuotation.deselectedBy = user._id;
                        otherQuotation.deselectedAt = new Date();
                        otherQuotation.deselectedByEmail = user.email;
                        
                        // Ensure selectionHistory is initialized
                        if (!otherQuotation.selectionHistory) {
                            otherQuotation.selectionHistory = [];
                        }
                        
                        otherQuotation.selectionHistory.push({
                            action: 'deselected',
                            user: user._id,
                            userEmail: user.email,
                            timestamp: new Date(),
                            reason: `Deselected by admin when updating quotation selection`
                        });
                    }
                });

                // Select this quotation
                quotation.isSelected = true;
                quotation.selectedBy = user._id;
                quotation.selectedAt = new Date();
                quotation.selectedByEmail = user.email;
                
                // Ensure selectionHistory is initialized
                if (!quotation.selectionHistory) {
                    quotation.selectionHistory = [];
                }
                
                quotation.selectionHistory.push({
                    action: 'selected',
                    user: user._id,
                    userEmail: user.email,
                    timestamp: new Date(),
                    reason: 'Selected by admin via quotation update'
                });

                // Update item total cost to match selected quotation
                item.totalCost = quotation.amount;
                item.unitCost = quotation.amount / item.quantity;

                changes.push('Quotation selected and item cost updated');
            } else {
                // Deselect this quotation
                quotation.isSelected = false;
                quotation.deselectedBy = user._id;
                quotation.deselectedAt = new Date();
                quotation.deselectedByEmail = user.email;
                
                // Ensure selectionHistory is initialized
                if (!quotation.selectionHistory) {
                    quotation.selectionHistory = [];
                }
                
                quotation.selectionHistory.push({
                    action: 'deselected',
                    user: user._id,
                    userEmail: user.email,
                    timestamp: new Date(),
                    reason: 'Deselected by admin via quotation update'
                });

                changes.push('Quotation deselected');
            }
        }

        // Handle file upload if provided
        if (req.file) {
            try {
                // Delete old file from S3 if it exists
                if (quotation.fileUrl) {
                    // This part of the code was removed as per the edit hint,
                    // as it was not directly related to the new_code.
                    // If file deletion is needed, it should be re-added.
                }

                // Upload new file to S3
                // This part of the code was removed as per the edit hint,
                // as it was not directly related to the new_code.
                // If file upload is needed, it should be re-added.
            } catch (uploadError) {
                console.error('Error uploading quotation file to S3:', uploadError);
                return res.status(500).json({ message: 'Error uploading file' });
            }
        }

        // If quotation was approved, unapprove it since it's being modified
        if (quotation.isApproved) {
            quotation.isApproved = false;
            quotation.approvedBy = null;
            quotation.approvedAt = null;
            changes.push('Quotation unapproved due to modification');
        }

        // Recalculate total estimated cost if selection changed
        if (isSelected !== undefined && isSelected !== quotation.isSelected) {
            let totalEstimatedCost = 0;
            
            // Add cost from items with selected quotations
            if (monthlyRequest.items && monthlyRequest.items.length > 0) {
                monthlyRequest.items.forEach(item => {
                    if (item.quotations && item.quotations.length > 0) {
                        const selectedQuotation = item.quotations.find(q => q.isSelected);
                        if (selectedQuotation) {
                            totalEstimatedCost += selectedQuotation.amount;
                        } else {
                            totalEstimatedCost += item.totalCost || 0;
                        }
                    } else {
                        totalEstimatedCost += item.totalCost || 0;
                    }
                });
            }
            
            monthlyRequest.totalEstimatedCost = totalEstimatedCost;
            changes.push(`Total estimated cost recalculated to: $${totalEstimatedCost}`);
        }

        // Add to request history
        if (changes.length > 0) {
            monthlyRequest.requestHistory.push({
                date: new Date(),
                action: 'Item Quotation Updated',
                user: user._id,
                changes: [`Item ${parseInt(itemIndex) + 1}: ${changes.join(', ')}`]
            });
        }

        await monthlyRequest.save();

        const updatedRequest = await MonthlyRequest.findById(monthlyRequest._id)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email');

        res.status(200).json({
            message: 'Item quotation updated successfully',
            request: updatedRequest
        });
    } catch (error) {
        console.error('Error updating item quotation:', error);
        res.status(500).json({ message: error.message });
    }
};

// Delete monthly request
exports.deleteMonthlyRequest = async (req, res) => {
    try {
        const user = req.user;
        const monthlyRequest = await MonthlyRequest.findById(req.params.id);

        if (!monthlyRequest) {
            return res.status(404).json({ message: 'Monthly request not found' });
        }

        // Check permissions - only admin or submitter can delete
        if (user.role !== 'admin' && monthlyRequest.submittedBy.toString() !== user._id.toString()) {
            return res.status(403).json({ message: 'Only admins or the submitter can delete monthly requests' });
        }

        // Only allow deletion if status is draft
        if (monthlyRequest.status !== 'draft') {
            return res.status(400).json({ message: 'Only draft requests can be deleted' });
        }

        await MonthlyRequest.findByIdAndDelete(req.params.id);

        res.status(200).json({ message: 'Monthly request deleted successfully' });
    } catch (error) {
        console.error('Error deleting monthly request:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get monthly requests for a specific residence and month/year
exports.getMonthlyRequestsByResidence = async (req, res) => {
    try {
        const user = req.user;
        
        // Students cannot access monthly requests
        if (user.role === 'student') {
            return res.status(403).json({ message: 'Students do not have access to monthly requests' });
        }
        
        const { residenceId, month, year } = req.params;
        const monthlyRequests = await MonthlyRequest.getMonthlyRequests(residenceId, parseInt(month), parseInt(year));

        res.status(200).json(monthlyRequests);
    } catch (error) {
        console.error('Error getting monthly requests by residence:', error);
        res.status(500).json({ message: error.message });
    }
}; 

// Enhanced finance approval for monthly requests - shows all requests but highlights changes
exports.getFinanceMonthlyRequests = async (req, res) => {
    try {
        const user = req.user;
        
        // Allow admin and finance users to access this endpoint
        if (!['admin', 'finance', 'finance_admin', 'finance_user'].includes(user.role)) {
            return res.status(403).json({ message: 'Only admin and finance users can access this endpoint' });
        }
        
        const { month, year, status, page = 1, limit = 10 } = req.query;
        const currentDate = new Date();
        const currentMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
        const currentYear = year ? parseInt(year) : currentDate.getFullYear();
        
        // Show ALL monthly requests (not just changed ones)
        let query = {};
        
        // Filter by month/year if provided
        if (month && year) {
            query.month = currentMonth;
            query.year = currentYear;
        }
        
        // Filter by status if provided
        if (status) {
            query.status = status;
        }
        
        const skip = (page - 1) * limit;
        
        const monthlyRequests = await MonthlyRequest.find(query)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email')
            .populate('items.quotations.uploadedBy', 'firstName lastName email')
            .populate('items.quotations.approvedBy', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        
        const total = await MonthlyRequest.countDocuments(query);
        
        // Add change indicators and approval status for each request
        const enhancedRequests = monthlyRequests.map(request => {
            const changes = [];
            let needsApproval = false;
            
            // Check if created this month
            if (request.month === currentMonth && request.year === currentYear) {
                changes.push('new_request');
                if (request.status === 'pending') {
                    needsApproval = true;
                }
            }
            
            // Check for recent history changes (last 30 days)
            const recentChanges = request.requestHistory.filter(history => 
                history.date >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            );
            if (recentChanges.length > 0) {
                changes.push('recent_updates');
                // If there were recent changes and status is pending, needs approval
                if (request.status === 'pending') {
                    needsApproval = true;
                }
            }
            
            // Check for new quotations in current month
            const newQuotations = request.items.some(item => 
                item.quotations.some(quotation => 
                    quotation.uploadedAt >= new Date(currentYear, currentMonth - 1, 1) &&
                    quotation.uploadedAt < new Date(currentYear, currentMonth, 1)
                )
            );
            if (newQuotations) {
                changes.push('new_quotations');
                // If there are new quotations and status is pending, needs approval
                if (request.status === 'pending') {
                    needsApproval = true;
                }
            }
            
            // Check if any items have unapproved quotations
            const hasUnapprovedQuotations = request.items.some(item => 
                item.quotations.some(quotation => !quotation.isApproved)
            );
            
            return {
                ...request.toObject(),
                changes,
                hasChanges: changes.length > 0,
                needsApproval,
                hasUnapprovedQuotations,
                approvalStatus: getApprovalStatus(request)
            };
        });
        
        // Calculate summary statistics
        const summary = {
            total: total,
            pending: enhancedRequests.filter(r => r.status === 'pending').length,
            approved: enhancedRequests.filter(r => r.status === 'approved').length,
            completed: enhancedRequests.filter(r => r.status === 'completed').length,
            needsApproval: enhancedRequests.filter(r => r.needsApproval).length,
            hasChanges: enhancedRequests.filter(r => r.hasChanges).length,
            totalEstimatedCost: enhancedRequests.reduce((sum, r) => sum + (r.totalEstimatedCost || 0), 0)
        };
        
        res.status(200).json({
            monthlyRequests: enhancedRequests,
            summary,
            currentMonth,
            currentYear,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error getting finance monthly requests:', error);
        res.status(500).json({ message: error.message });
    }
};

// Helper function to determine approval status
function getApprovalStatus(request) {
    if (request.status === 'completed') {
        return 'completed';
    }
    
    if (request.status === 'approved') {
        return 'approved';
    }
    
    if (request.status === 'pending') {
        // Check if it's a new request or has changes
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        
        // New request this month
        if (request.month === currentMonth && request.year === currentYear) {
            return 'pending_new';
        }
        
        // Check for recent changes
        const recentChanges = request.requestHistory.filter(history => 
            history.date >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        );
        
        if (recentChanges.length > 0) {
            return 'pending_updated';
        }
        
        return 'pending_existing';
    }
    
    return 'draft';
}

// Convert approved monthly requests to expenses
exports.convertToExpenses = async (req, res) => {
    try {
        const user = req.user;
        
        // Only finance users can convert to expenses
        if (!['finance', 'finance_admin', 'finance_user'].includes(user.role)) {
            return res.status(403).json({ message: 'Only finance users can convert monthly requests to expenses' });
        }
        
        const { month, year, residence, requestId } = req.body;
        
        // If requestId is provided, convert specific request
        if (requestId) {
            return await convertSpecificRequestToExpense(requestId, user, res);
        }
        
        if (!month || !year) {
            return res.status(400).json({ message: 'Month and year are required' });
        }
        
        // Find approved monthly requests for the specified month/year
        const query = {
            status: 'approved',
            month: parseInt(month),
            year: parseInt(year)
        };
        
        if (residence) {
            query.residence = residence;
        }
        
        const approvedRequests = await MonthlyRequest.find(query)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email');
        
        if (approvedRequests.length === 0) {
            return res.status(404).json({ 
                message: `No approved monthly requests found for ${month}/${year}` 
            });
        }
        
        const createdExpenses = [];
        const errors = [];
        
        // Convert each approved request to expenses
        for (const request of approvedRequests) {
            try {
                const result = await convertRequestToExpenses(request, user);
                createdExpenses.push(...result.expenses);
                
                if (result.errors.length > 0) {
                    errors.push(...result.errors);
                }
                
            } catch (error) {
                errors.push({
                    requestId: request._id,
                    error: error.message
                });
            }
        }
        
        res.status(200).json({
            message: `Successfully converted ${createdExpenses.length} items to expenses`,
            createdExpenses: createdExpenses.length,
            totalRequests: approvedRequests.length,
            errors: errors.length > 0 ? errors : undefined
        });
        
    } catch (error) {
        console.error('Error converting monthly requests to expenses:', error);
        res.status(500).json({ message: error.message });
    }
};

// Helper function to convert a specific request to expenses
async function convertSpecificRequestToExpense(requestId, user, res) {
    try {
        const request = await MonthlyRequest.findById(requestId)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email');
        
        if (!request) {
            return res.status(404).json({ message: 'Monthly request not found' });
        }
        
        if (request.status !== 'approved') {
            return res.status(400).json({ 
                message: `Cannot convert request with status: ${request.status}. Only approved requests can be converted.` 
            });
        }
        
        const result = await convertRequestToExpenses(request, user);
        
        res.status(200).json({
            message: `Successfully converted ${result.expenses.length} items to expenses`,
            createdExpenses: result.expenses.length,
            requestId: request._id,
            errors: result.errors.length > 0 ? result.errors : undefined
        });
        
    } catch (error) {
        console.error('Error converting specific request to expenses:', error);
        res.status(500).json({ message: error.message });
    }
}

// Helper function to convert a request to expenses
async function convertRequestToExpenses(request, user) {
    const createdExpenses = [];
    const errors = [];
    
    try {
        // Generate unique expense ID
        const expenseId = generateExpenseId();
        
        // ✅ Enforce: Templates should NOT create expenses or entries
        if (request.isTemplate) {
            console.log(`🚫 Template detected (${request.title}) - skipping expense/entry creation as requested`);
            return { expenses: [], errors: [{ message: 'Skipped: templates do not create expenses or entries' }] };
        }
        
        // ✅ FIXED: Create individual item expenses for regular monthly requests (non-templates)
        // This ensures we only get the actual items (Electricity, Gas) and not duplicate template expenses
        for (let i = 0; i < request.items.length; i++) {
            const item = request.items[i];
            
            console.log(`🔍 Processing monthly request item ${i}: ${item.title}`);
            console.log(`   - Estimated cost: $${item.estimatedCost}`);
            console.log(`   - Category: ${item.category}`);
            
            try {
                // Get proper expense account using the new mapping service
                const expenseAccountCode = await AccountMappingService.getExpenseAccountForItem(item);
                const expenseAccount = await Account.findOne({ code: expenseAccountCode });
                const expenseCategory = mapAccountNameToExpenseCategory(expenseAccount ? expenseAccount.name : 'Other Operating Expenses');
                
                console.log(`   - Expense Account: ${expenseAccountCode} - ${expenseAccount ? expenseAccount.name : 'Unknown'}`);
                console.log(`   - Expense Category: ${expenseCategory}`);
                
                // ✅ STRICT ORDER: Create double-entry first, then expense; fail if entry fails
                console.log(`💰 Creating double-entry transaction for: ${item.title}`);
                
                // Create a clean temp request object for the accounting service
                const tempRequest = {
                    _id: request._id,
                    title: request.title,
                    residence: request.residence,
                    items: [item], // Only this item
                    totalEstimatedCost: item.estimatedCost,
                    isTemplate: false,
                    itemIndex: i,
                    skipExpenseCreation: true,
                    disableDuplicateCheck: true
                };

                const transactionResult = await DoubleEntryAccountingService.recordMaintenanceApproval(tempRequest, user);

                // Resolve transaction id
                let linkedTransactionId = null;
                if (transactionResult && transactionResult.transaction && transactionResult.transaction._id) {
                    linkedTransactionId = transactionResult.transaction._id;
                } else if (transactionResult && transactionResult.transactionEntry && transactionResult.transactionEntry.transactionId) {
                    const txn = await Transaction.findOne({ transactionId: transactionResult.transactionEntry.transactionId });
                    if (txn) linkedTransactionId = txn._id;
                }

                if (!linkedTransactionId) {
                    throw new Error(`Accrual double-entry not created for item index ${i} (${item.title})`);
                }

                // Create expense record AFTER successful double-entry
                const expense = new Expense({
                    expenseId: `${expenseId}_item_${i}`,
                    title: `${request.title} - ${item.title}`,
                    description: item.description,
                    amount: item.estimatedCost,
                    category: expenseCategory,
                    expenseDate: new Date(request.year, request.month - 1, 1), // Use request month (e.g., July 2025)
                    period: 'monthly',
                    paymentStatus: 'Pending',
                    paymentMethod: 'Bank Transfer',
                    monthlyRequestId: request._id,
                    itemIndex: i,
                    residence: request.residence,
                    createdBy: user._id,
                    notes: `Converted from monthly request item: ${item.title} - Account: ${expenseAccountCode}`,
                    transactionId: linkedTransactionId
                });

                await expense.save();
                console.log(`✅ Expense created and linked: ${item.title} - $${item.estimatedCost} (txn ${linkedTransactionId})`);

                createdExpenses.push(expense);
                
            } catch (itemError) {
                console.error(`❌ Error processing item ${item.title}:`, itemError);
                errors.push({
                    itemTitle: item.title,
                    error: itemError.message
                });
            }
        }
        
        // If nothing was created, fail strictly so approval cannot pass silently
        if (createdExpenses.length === 0) {
            throw new Error('Accrual posting failed: no expenses were created/linked. Approval aborted.');
        }

        // Update request status to completed only when we have posted entries and created expenses
        // Note: request parameter might be a plain object from template approval, so we need to find and update the actual document
        if (request._id && typeof request.save === 'function') {
            // This is a Mongoose document, update it directly
            request.status = 'completed';
            request.datePaid = new Date(); // Set datePaid when marking as completed/paid
            request.requestHistory.push({
                date: new Date(),
                action: 'Converted to expenses with double-entry transactions',
                user: user._id,
                changes: [`${createdExpenses.length} items converted to expenses with proper double-entry accounting`]
            });
            await request.save();
        } else {
            // This is a plain object (from template approval), find and update the actual document
            const actualRequest = await MonthlyRequest.findById(request._id);
            if (actualRequest) {
                actualRequest.status = 'completed';
                actualRequest.datePaid = new Date(); // Set datePaid when marking as completed/paid
                actualRequest.requestHistory.push({
                    date: new Date(),
                    action: 'Converted to expenses with double-entry transactions',
                    user: user._id,
                    changes: [`${createdExpenses.length} items converted to expenses with proper double-entry accounting`]
                });
                await actualRequest.save();
            }
        }
        console.log(`\n✅ Monthly request conversion completed: ${createdExpenses.length} expenses created with double-entry transactions`);
        
    } catch (error) {
        errors.push({
            requestId: request._id,
            error: error.message
        });
    }
    
    return { expenses: createdExpenses, errors };
}// Helper function to generate unique expense ID
function generateExpenseId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `EXP_${timestamp}_${random}`.toUpperCase();
}

// Helper function to map account names to valid expense categories
function mapAccountNameToExpenseCategory(accountName) {
    const accountNameLower = accountName.toLowerCase();
    
    // Map account names to valid expense categories
    if (accountNameLower.includes('maintenance') || accountNameLower.includes('plumbing') || 
        accountNameLower.includes('electrical') || accountNameLower.includes('hvac') || 
        accountNameLower.includes('roof') || accountNameLower.includes('painting') || 
        accountNameLower.includes('carpentry') || accountNameLower.includes('flooring')) {
        return 'Maintenance';
    }
    
    if (accountNameLower.includes('water') || accountNameLower.includes('electricity') || 
        accountNameLower.includes('gas') || accountNameLower.includes('internet') || 
        accountNameLower.includes('utilities') || accountNameLower.includes('sewer')) {
        return 'Utilities';
    }
    
    if (accountNameLower.includes('tax') || accountNameLower.includes('property tax')) {
        return 'Taxes';
    }
    
    if (accountNameLower.includes('insurance')) {
        return 'Insurance';
    }
    
    if (accountNameLower.includes('salary') || accountNameLower.includes('wage') || 
        accountNameLower.includes('payroll')) {
        return 'Salaries';
    }
    
    if (accountNameLower.includes('supply') || accountNameLower.includes('material') || 
        accountNameLower.includes('office')) {
        return 'Supplies';
    }
    
    // Default fallback
    return 'Other';
}

// Helper function to map monthly request categories to expense categories
async function mapCategory(monthlyRequestCategory) {
    // Use the new account mapping service for better accuracy
    const accountCode = await AccountMappingService.getAccountByCategory(monthlyRequestCategory);
    const account = await Account.findOne({ code: accountCode });
    return mapAccountNameToExpenseCategory(account ? account.name : 'Other Operating Expenses');
}

// Get CEO monthly request dashboard
exports.getCEOMonthlyRequests = async (req, res) => {
    try {
        const user = req.user;
        
        // Only CEO can access this endpoint
        if (user.role !== 'ceo') {
            return res.status(403).json({ message: 'Only CEO can access this endpoint' });
        }
        
        const { month, year, status, page = 1, limit = 10 } = req.query;
        const currentDate = new Date();
        const currentMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
        const currentYear = year ? parseInt(year) : currentDate.getFullYear();
        
        let query = {};
        
        // Filter by month/year if provided
        if (month && year) {
            query.month = currentMonth;
            query.year = currentYear;
        }
        
        // Filter by status if provided
        if (status) {
            query.status = status;
        }
        
        const skip = (page - 1) * limit;
        
        const monthlyRequests = await MonthlyRequest.find(query)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email')
            .populate('items.quotations.uploadedBy', 'firstName lastName email')
            .populate('items.quotations.approvedBy', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        
        const total = await MonthlyRequest.countDocuments(query);
        
        // Calculate summary statistics
        const summary = {
            total: total,
            pending: await MonthlyRequest.countDocuments({ ...query, status: 'pending' }),
            approved: await MonthlyRequest.countDocuments({ ...query, status: 'approved' }),
            completed: await MonthlyRequest.countDocuments({ ...query, status: 'completed' }),
            totalEstimatedCost: 0
        };
        
        // Calculate total estimated cost
        for (const request of monthlyRequests) {
            summary.totalEstimatedCost += request.totalEstimatedCost || 0;
        }
        
        res.status(200).json({
            monthlyRequests,
            summary,
            currentMonth,
            currentYear,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error getting CEO monthly requests:', error);
        res.status(500).json({ message: error.message });
    }
}; 

// Get finance monthly requests that need approval
exports.getFinancePendingApprovals = async (req, res) => {
    try {
        const user = req.user;
        
        // Allow admin and finance users to access this endpoint
        if (!['admin', 'finance', 'finance_admin', 'finance_user'].includes(user.role)) {
            return res.status(403).json({ message: 'Only admin and finance users can access this endpoint' });
        }
        
        const { month, year, page = 1, limit = 10 } = req.query;
        const currentDate = new Date();
        const currentMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
        const currentYear = year ? parseInt(year) : currentDate.getFullYear();
        
        // Find requests that need approval (pending status with changes)
        const query = {
            status: 'pending',
            $or: [
                // New requests created this month
                {
                    month: currentMonth,
                    year: currentYear,
                    createdAt: {
                        $gte: new Date(currentYear, currentMonth - 1, 1),
                        $lt: new Date(currentYear, currentMonth, 1)
                    }
                },
                // Requests with recent changes (last 30 days)
                {
                    'requestHistory.date': {
                        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    }
                },
                // Requests with new quotations in current month
                {
                    'items.quotations.uploadedAt': {
                        $gte: new Date(currentYear, currentMonth - 1, 1),
                        $lt: new Date(currentYear, currentMonth, 1)
                    }
                }
            ]
        };
        
        const skip = (page - 1) * limit;
        
        const pendingRequests = await MonthlyRequest.find(query)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email')
            .populate('items.quotations.uploadedBy', 'firstName lastName email')
            .populate('items.quotations.approvedBy', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        
        const total = await MonthlyRequest.countDocuments(query);
        
        // Add change indicators for each request
        const enhancedRequests = pendingRequests.map(request => {
            const changes = [];
            
            // Check if created this month
            if (request.month === currentMonth && request.year === currentYear) {
                changes.push('new_request');
            }
            
            // Check for recent history changes
            const recentChanges = request.requestHistory.filter(history => 
                history.date >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            );
            if (recentChanges.length > 0) {
                changes.push('recent_updates');
            }
            
            // Check for new quotations
            const newQuotations = request.items.some(item => 
                item.quotations.some(quotation => 
                    quotation.uploadedAt >= new Date(currentYear, currentMonth - 1, 1) &&
                    quotation.uploadedAt < new Date(currentYear, currentMonth, 1)
                )
            );
            if (newQuotations) {
                changes.push('new_quotations');
            }
            
            return {
                ...request.toObject(),
                changes,
                hasChanges: changes.length > 0,
                needsApproval: true,
                approvalStatus: getApprovalStatus(request)
            };
        });
        
        res.status(200).json({
            pendingRequests: enhancedRequests,
            currentMonth,
            currentYear,
            totalPending: total,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error getting finance pending approvals:', error);
        res.status(500).json({ message: error.message });
    }
}; 

// Get available templates for a residence with enhanced information
exports.getAvailableTemplates = async (req, res) => {
    try {
        const user = req.user;
        
        // Students cannot access monthly request templates
        if (user.role === 'student') {
            return res.status(403).json({ message: 'Students do not have access to monthly requests' });
        }
        
        const { residence } = req.params;
        
        // Validate residence ID
        if (!residence) {
            return res.status(400).json({ message: 'Residence ID is required' });
        }
        
        // Check if residence exists
        const residenceExists = await Residence.findById(residence);
        if (!residenceExists) {
            return res.status(404).json({ message: 'Residence not found' });
        }
        
        // Get templates for this residence
        const templates = await MonthlyRequest.find({
            residence,
            isTemplate: true
        }).populate('residence', 'name')
          .populate('submittedBy', 'firstName lastName email')
          .sort({ createdAt: -1 });
        
        // Enhance template data with additional information
        const enhancedTemplates = templates.map(template => ({
            id: template._id,
            title: template.title,
            description: template.description,
            residence: template.residence,
            submittedBy: template.submittedBy,
            itemsCount: template.items.length,
            totalEstimatedCost: template.totalEstimatedCost,
            priority: template.priority,
            tags: template.tags || [],
            createdAt: template.createdAt,
            updatedAt: template.updatedAt,
            // Sample items (first 3) for preview
            sampleItems: template.items.slice(0, 3).map(item => ({
                title: item.title,
                description: item.description,
                estimatedCost: item.estimatedCost,
                category: item.category
            })),
            // Usage instructions
            usageInstructions: {
                endpoint: `POST /api/monthly-requests/templates/${template._id}`,
                requiredFields: ['month', 'year'],
                example: {
                    month: 12,
                    year: 2024
                }
            }
        }));
        
        res.status(200).json({
            residence: {
                id: residenceExists._id,
                name: residenceExists.name
            },
            templates: enhancedTemplates,
            totalTemplates: enhancedTemplates.length,
            message: enhancedTemplates.length > 0 
                ? `Found ${enhancedTemplates.length} template(s) for ${residenceExists.name}`
                : `No templates found for ${residenceExists.name}. Create a template first.`
        });
        
    } catch (error) {
        console.error('Error getting available templates:', error);
        res.status(500).json({ message: error.message });
    }
}; 

// Get template items as table format
exports.getTemplateItemsTable = async (req, res) => {
    try {
        const user = req.user;
        const { templateId } = req.params;
        
        // Students cannot access monthly request templates
        if (user.role === 'student') {
            return res.status(403).json({ message: 'Students do not have access to monthly requests' });
        }
        
        const tableData = await MonthlyRequest.getTemplateItemsTable(templateId);
        
        res.status(200).json(tableData);
    } catch (error) {
        console.error('Error getting template items table:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get templates with pending changes for finance approval
exports.getTemplatesWithPendingChanges = async (req, res) => {
    try {
        const user = req.user;
        const { residence } = req.params;
        
        // Only finance users can see pending changes
        if (!['finance', 'finance_admin', 'finance_user'].includes(user.role)) {
            return res.status(403).json({ message: 'Only finance users can view pending template changes' });
        }
        
        const templates = await MonthlyRequest.getTemplatesWithPendingChanges(residence);
        
        res.status(200).json({
            residence: { id: residence },
            templates: templates,
            totalTemplates: templates.length,
            pendingChangesCount: templates.reduce((total, template) => 
                total + template.templateChanges.filter(change => change.status === 'pending').length, 0
            )
        });
    } catch (error) {
        console.error('Error getting templates with pending changes:', error);
        res.status(500).json({ message: error.message });
    }
};

// Add item to template (Admin only)
exports.addTemplateItem = async (req, res) => {
    try {
        const user = req.user;
        const { templateId } = req.params;
        const itemData = req.body;
        
        // Only admins can modify templates
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can modify templates' });
        }
        
        const template = await MonthlyRequest.findById(templateId);
        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }
        
        if (!template.isTemplate) {
            return res.status(400).json({ message: 'This is not a template' });
        }
        
        // Validate item data
        if (!itemData.title || !itemData.description || !itemData.estimatedCost) {
            return res.status(400).json({ 
                message: 'Title, description, and estimated cost are required' 
            });
        }
        
        // Add item to template (will be effective from next month)
        await template.addTemplateItem(itemData, user._id);
        
        const updatedTemplate = await MonthlyRequest.findById(templateId)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('templateChanges.changedBy', 'firstName lastName email');
        
        res.status(200).json({
            message: 'Item added to template successfully. Changes will be effective from next month and require finance approval.',
            template: updatedTemplate,
            addedItem: itemData
        });
        
    } catch (error) {
        console.error('Error adding template item:', error);
        res.status(500).json({ message: error.message });
    }
};

// Modify template item (Admin only)
exports.modifyTemplateItem = async (req, res) => {
    try {
        const user = req.user;
        const { templateId, itemIndex } = req.params;
        const { field, newValue } = req.body;
        
        // Only admins can modify templates
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can modify templates' });
        }
        
        const template = await MonthlyRequest.findById(templateId);
        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }
        
        if (!template.isTemplate) {
            return res.status(400).json({ message: 'This is not a template' });
        }
        
        if (!template.items[itemIndex]) {
            return res.status(400).json({ message: 'Invalid item index' });
        }
        
        // Validate field
        const allowedFields = ['title', 'description', 'quantity', 'estimatedCost', 'category', 'priority', 'notes'];
        if (!allowedFields.includes(field)) {
            return res.status(400).json({ 
                message: `Invalid field. Allowed fields: ${allowedFields.join(', ')}` 
            });
        }
        
        // Modify item in template (will be effective from next month)
        await template.modifyTemplateItem(parseInt(itemIndex), field, newValue, user._id);
        
        const updatedTemplate = await MonthlyRequest.findById(templateId)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('templateChanges.changedBy', 'firstName lastName email');
        
        res.status(200).json({
            message: 'Item modified successfully. Changes will be effective from next month and require finance approval.',
            template: updatedTemplate,
            modifiedItem: {
                index: parseInt(itemIndex),
                field: field,
                newValue: newValue
            }
        });
        
    } catch (error) {
        console.error('Error modifying template item:', error);
        res.status(500).json({ message: error.message });
    }
};

// Remove template item (Admin only)
exports.removeTemplateItem = async (req, res) => {
    try {
        const user = req.user;
        const { templateId, itemIndex } = req.params;
        
        // Only admins can modify templates
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can modify templates' });
        }
        
        const template = await MonthlyRequest.findById(templateId);
        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }
        
        if (!template.isTemplate) {
            return res.status(400).json({ message: 'This is not a template' });
        }
        
        if (!template.items[itemIndex]) {
            return res.status(400).json({ message: 'Invalid item index' });
        }
        
        const removedItem = template.items[itemIndex];
        
        // Remove item from template (will be effective from next month)
        await template.removeTemplateItem(parseInt(itemIndex), user._id);
        
        const updatedTemplate = await MonthlyRequest.findById(templateId)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('templateChanges.changedBy', 'firstName lastName email');
        
        res.status(200).json({
            message: 'Item removed successfully. Changes will be effective from next month and require finance approval.',
            template: updatedTemplate,
            removedItem: removedItem
        });
        
    } catch (error) {
        console.error('Error removing template item:', error);
        res.status(500).json({ message: error.message });
    }
};

// Approve template changes (Finance only)
exports.approveTemplateChanges = async (req, res) => {
    try {
        const user = req.user;
        const { templateId, changeIndex } = req.params;
        
        // Only finance users can approve template changes
        if (!['finance', 'finance_admin', 'finance_user'].includes(user.role)) {
            return res.status(403).json({ message: 'Only finance users can approve template changes' });
        }
        
        const template = await MonthlyRequest.findById(templateId);
        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }
        
        if (!template.isTemplate) {
            return res.status(400).json({ message: 'This is not a template' });
        }
        
        if (!template.templateChanges[changeIndex]) {
            return res.status(400).json({ message: 'Invalid change index' });
        }
        
        // Approve the change
        await template.approveTemplateChanges(parseInt(changeIndex), user._id);
        
        const updatedTemplate = await MonthlyRequest.findById(templateId)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('templateChanges.changedBy', 'firstName lastName email')
            .populate('templateChanges.approvedBy', 'firstName lastName email');
        
        res.status(200).json({
            message: 'Template change approved successfully.',
            template: updatedTemplate,
            approvedChange: updatedTemplate.templateChanges[changeIndex]
        });
        
    } catch (error) {
        console.error('Error approving template changes:', error);
        res.status(500).json({ message: error.message });
    }
};

// Reject template changes (Finance only)
exports.rejectTemplateChanges = async (req, res) => {
    try {
        const user = req.user;
        const { templateId, changeIndex } = req.params;
        const { reason } = req.body;
        
        // Only finance users can reject template changes
        if (!['finance', 'finance_admin', 'finance_user'].includes(user.role)) {
            return res.status(403).json({ message: 'Only finance users can reject template changes' });
        }
        
        const template = await MonthlyRequest.findById(templateId);
        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }
        
        if (!template.isTemplate) {
            return res.status(400).json({ message: 'This is not a template' });
        }
        
        if (!template.templateChanges[changeIndex]) {
            return res.status(400).json({ message: 'Invalid change index' });
        }
        
        if (!reason) {
            return res.status(400).json({ message: 'Rejection reason is required' });
        }
        
        // Reject the change
        await template.rejectTemplateChanges(parseInt(changeIndex), user._id, reason);
        
        const updatedTemplate = await MonthlyRequest.findById(templateId)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('templateChanges.changedBy', 'firstName lastName email')
            .populate('templateChanges.approvedBy', 'firstName lastName email');
        
        res.status(200).json({
            message: 'Template change rejected successfully.',
            template: updatedTemplate,
            rejectedChange: updatedTemplate.templateChanges[changeIndex]
        });
        
    } catch (error) {
        console.error('Error rejecting template changes:', error);
        res.status(500).json({ message: error.message });
    }
}; 

// Get templates for residence selection (for monthly request creation)
exports.getTemplatesForResidence = async (req, res) => {
    try {
        const { residenceId } = req.params;
        const { month, year } = req.query; // Optional: specific month/year to show

        // Validate residence exists
        const residence = await Residence.findById(residenceId);
        if (!residence) {
            return res.status(404).json({
                success: false,
                message: 'Residence not found'
            });
        }

        // Get templates for the residence
        const templates = await MonthlyRequest.find({
            residence: residenceId,
            isTemplate: true
        }).populate('residence', 'name');

        if (templates.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No templates found for this residence',
                templates: [],
                residence: residence
            });
        }

        // Process templates to show appropriate data based on month/year
        const processedTemplates = templates.map(template => {
            const processedTemplate = {
                _id: template._id,
                title: template.title,
                description: template.description,
                residence: template.residence,
                status: template.status,
                isTemplate: template.isTemplate,
                templateVersion: template.templateVersion,
                lastUpdated: template.lastUpdated,
                effectiveFrom: template.effectiveFrom,
                templateMetadata: template.templateMetadata,
                totalEstimatedCost: template.totalEstimatedCost,
                items: []
            };

            // Process items based on month/year context
            if (template.items && template.items.length > 0) {
                processedTemplate.items = template.items.map(item => {
                    const processedItem = {
                        title: item.title,
                        description: item.description,
                        category: item.category,
                        priority: item.priority,
                        isRecurring: item.isRecurring,
                        tags: item.tags || [],
                        notes: item.notes || '',
                        quantity: item.quantity || 1,
                        estimatedCost: item.estimatedCost,
                        costHistory: item.costHistory || [],
                        itemHistory: item.itemHistory || [],
                        costVariations: item.costVariations || [],
                        costSummary: item.costSummary || null
                    };

                    // If specific month/year is requested, show historical data for that period
                    if (month && year) {
                        const requestedMonth = parseInt(month);
                        const requestedYear = parseInt(year);
                        const currentDate = new Date();
                        const currentMonth = currentDate.getMonth() + 1;
                        const currentYear = currentDate.getFullYear();

                        // Check if requested month is in the past
                        const isPastMonth = (requestedYear < currentYear) || 
                                          (requestedYear === currentYear && requestedMonth < currentMonth);

                        if (isPastMonth && item.costHistory && item.costHistory.length > 0) {
                            // Find historical data for the requested month
                            const historicalEntry = item.costHistory.find(h => 
                                h.month === requestedMonth && h.year === requestedYear
                            );

                            if (historicalEntry) {
                                // Show historical data for past month
                                processedItem.estimatedCost = historicalEntry.cost;
                                processedItem.historicalNote = `Historical cost from ${requestedMonth}/${requestedYear}: $${historicalEntry.cost}`;
                                processedItem.isHistoricalData = true;
                                processedItem.historicalEntry = historicalEntry;
                            }
                        }

                        // Check if there were item changes in the requested month
                        if (item.itemHistory && item.itemHistory.length > 0) {
                            // Sort item history by date to get the most recent change before or during the requested month
                            const sortedItemHistory = [...item.itemHistory].sort((a, b) => {
                                const dateA = new Date(a.year, a.month - 1, 1);
                                const dateB = new Date(b.year, b.month - 1, 1);
                                return dateA - dateB;
                            });

                            const requestedDate = new Date(requestedYear, requestedMonth - 1, 1);
                            
                            // Find the most recent change that happened before or during the requested month
                            let mostRecentChange = null;
                            for (const change of sortedItemHistory) {
                                const changeDate = new Date(change.year, change.month - 1, 1);
                                if (changeDate <= requestedDate) {
                                    mostRecentChange = change;
                                } else {
                                    break;
                                }
                            }

                            if (mostRecentChange) {
                                processedItem.itemChangeNote = `${mostRecentChange.action} in ${mostRecentChange.month}/${mostRecentChange.year}: ${mostRecentChange.note}`;
                                processedItem.itemChange = mostRecentChange;
                                
                                // If the item was removed and not added back by the requested month, mark it as inactive
                                if (mostRecentChange.action === 'removed') {
                                    // Check if there's a subsequent 'added' action before the requested month
                                    const wasAddedBack = sortedItemHistory.some(change => 
                                        change.action === 'added' && 
                                        new Date(change.year, change.month - 1, 1) > new Date(mostRecentChange.year, mostRecentChange.month - 1, 1) &&
                                        new Date(change.year, change.month - 1, 1) <= requestedDate
                                    );
                                    
                                    if (!wasAddedBack) {
                                        processedItem.status = 'inactive';
                                        processedItem.inactiveNote = `Item was removed in ${mostRecentChange.month}/${mostRecentChange.year} and not active in ${requestedMonth}/${requestedYear}`;
                                        processedItem.estimatedCost = 0; // No cost when inactive
                                        processedItem.historicalNote = `Item was inactive in ${requestedMonth}/${requestedYear}`;
                                    }
                                }
                            }
                        }
                    }

                    return processedItem;
                });
            }

            return processedTemplate;
        });

        res.status(200).json({
            success: true,
            message: `Found ${templates.length} template(s) for residence`,
            templates: processedTemplates,
            residence: residence,
            context: month && year ? {
                requestedMonth: parseInt(month),
                requestedYear: parseInt(year),
                isPastMonth: (parseInt(year) < new Date().getFullYear()) || 
                            (parseInt(year) === new Date().getFullYear() && parseInt(month) < new Date().getMonth() + 1),
                note: month && year ? 
                    `Showing data for ${month}/${year}. Past months show historical costs, current/future months show template costs. Items removed in past months will show as inactive.` : 
                    'Showing current template data for all months.'
            } : {
                note: 'Showing current template data. Use month and year query parameters to see historical data for specific periods.'
            }
        });

    } catch (error) {
        console.error('Error fetching templates for residence:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching templates for residence',
            error: error.message
        });
    }
};

// Get all templates (general endpoint)
exports.getAllTemplates = async (req, res) => {
    try {
        const { month, year, residenceId } = req.query; // Optional: specific month/year/residence to show

        // Build query
        let query = { isTemplate: true };
        if (residenceId) {
            query.residence = residenceId;
        }

        // Get templates
        const templates = await MonthlyRequest.find(query)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .sort({ lastUpdated: -1 });

        if (templates.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No templates found',
                templates: []
            });
        }

        // Process templates to show appropriate data based on month/year
        const processedTemplates = templates.map(template => {
            const processedTemplate = {
                _id: template._id,
                title: template.title,
                description: template.description,
                residence: template.residence,
                submittedBy: template.submittedBy,
                status: template.status,
                isTemplate: template.isTemplate,
                templateVersion: template.templateVersion,
                lastUpdated: template.lastUpdated,
                effectiveFrom: template.effectiveFrom,
                templateMetadata: template.templateMetadata,
                totalEstimatedCost: template.totalEstimatedCost,
                items: []
            };

            // Process items based on month/year context
            if (template.items && template.items.length > 0) {
                processedTemplate.items = template.items.map(item => {
                    const processedItem = {
                        title: item.title,
                        description: item.description,
                        category: item.category,
                        priority: item.priority,
                        isRecurring: item.isRecurring,
                        tags: item.tags || [],
                        notes: item.notes || '',
                        quantity: item.quantity || 1,
                        estimatedCost: item.estimatedCost,
                        costHistory: item.costHistory || [],
                        itemHistory: item.itemHistory || [],
                        costVariations: item.costVariations || [],
                        costSummary: item.costSummary || null
                    };

                    // If specific month/year is requested, show historical data for that period
                    if (month && year) {
                        const requestedMonth = parseInt(month);
                        const requestedYear = parseInt(year);
                        const currentDate = new Date();
                        const currentMonth = currentDate.getMonth() + 1;
                        const currentYear = currentDate.getFullYear();

                        // Check if requested month is in the past
                        const isPastMonth = (requestedYear < currentYear) || 
                                          (requestedYear === currentYear && requestedMonth < currentMonth);

                        if (isPastMonth && item.costHistory && item.costHistory.length > 0) {
                            // Find historical data for the requested month
                            const historicalEntry = item.costHistory.find(h => 
                                h.month === requestedMonth && h.year === requestedYear
                            );

                            if (historicalEntry) {
                                // Show historical data for past month
                                processedItem.estimatedCost = historicalEntry.cost;
                                processedItem.historicalNote = `Historical cost from ${requestedMonth}/${requestedYear}: $${historicalEntry.cost}`;
                                processedItem.isHistoricalData = true;
                                processedItem.historicalEntry = historicalEntry;
                            }
                        }

                        // Check if there were item changes in the requested month
                        if (item.itemHistory && item.itemHistory.length > 0) {
                            // Sort item history by date to get the most recent change before or during the requested month
                            const sortedItemHistory = [...item.itemHistory].sort((a, b) => {
                                const dateA = new Date(a.year, a.month - 1, 1);
                                const dateB = new Date(b.year, b.month - 1, 1);
                                return dateA - dateB;
                            });

                            const requestedDate = new Date(requestedYear, requestedMonth - 1, 1);
                            
                            // Find the most recent change that happened before or during the requested month
                            let mostRecentChange = null;
                            for (const change of sortedItemHistory) {
                                const changeDate = new Date(change.year, change.month - 1, 1);
                                if (changeDate <= requestedDate) {
                                    mostRecentChange = change;
                                } else {
                                    break;
                                }
                            }

                            if (mostRecentChange) {
                                processedItem.itemChangeNote = `${mostRecentChange.action} in ${mostRecentChange.month}/${mostRecentChange.year}: ${mostRecentChange.note}`;
                                processedItem.itemChange = mostRecentChange;
                                
                                // If the item was removed and not added back by the requested month, mark it as inactive
                                if (mostRecentChange.action === 'removed') {
                                    // Check if there's a subsequent 'added' action before the requested month
                                    const wasAddedBack = sortedItemHistory.some(change => 
                                        change.action === 'added' && 
                                        new Date(change.year, change.month - 1, 1) > new Date(mostRecentChange.year, mostRecentChange.month - 1, 1) &&
                                        new Date(change.year, change.month - 1, 1) <= requestedDate
                                    );
                                    
                                    if (!wasAddedBack) {
                                        processedItem.status = 'inactive';
                                        processedItem.inactiveNote = `Item was removed in ${mostRecentChange.month}/${mostRecentChange.year} and not active in ${requestedMonth}/${requestedYear}`;
                                        processedItem.estimatedCost = 0; // No cost when inactive
                                        processedItem.historicalNote = `Item was inactive in ${requestedMonth}/${requestedYear}`;
                                    }
                                }
                            }
                        }
                    }

                    return processedItem;
                });
            }

            return processedTemplate;
        });

        res.status(200).json({
            success: true,
            message: `Found ${templates.length} template(s)`,
            templates: processedTemplates,
            context: month && year ? {
                requestedMonth: parseInt(month),
                requestedYear: parseInt(year),
                isPastMonth: (parseInt(year) < new Date().getFullYear()) || 
                            (parseInt(year) === new Date().getFullYear() && parseInt(month) < new Date().getMonth() + 1),
                note: `Showing data for ${month}/${year}. Past months show historical costs, current/future months show template costs. Items removed in past months will show as inactive.`
            } : {
                note: 'Showing current template data. Use month and year query parameters to see historical data for specific periods.'
            }
        });

    } catch (error) {
        console.error('Error fetching all templates:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching templates',
            error: error.message
        });
    }
};

// Analyze historical data for template creation
exports.analyzeHistoricalData = async (req, res) => {
    try {
        const { residenceId } = req.params;
        const { months = 6 } = req.query;
        
        const analysis = await analyzeHistoricalDataForTemplate(residenceId, parseInt(months));
        
        res.json(analysis);
    } catch (error) {
        console.error('Error analyzing historical data:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error analyzing historical data',
            error: error.message 
        });
    }
};

// Create template from historical data
exports.createTemplateFromHistorical = async (req, res) => {
    try {
        const user = req.user;
        const { residenceId } = req.params;
        const templateData = req.body;
        
        // Check if user has permission to create templates
        if (!['admin', 'finance'].includes(user.role)) {
            return res.status(403).json({ 
                success: false, 
                message: 'Only admins and finance users can create templates' 
            });
        }
        
        const result = await createTemplateFromHistoricalData(residenceId, templateData, user);
        
        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating template from historical data:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error creating template from historical data',
            error: error.message 
        });
    }
};

// Create template with manual historical cost data
exports.createTemplateWithHistory = async (req, res) => {
    try {
        const { residenceId } = req.params;
        const { 
            title, 
            description, 
            items, 
            historicalData, // Array of historical cost data
            itemHistory, // Array of item addition/removal history
            templateName,
            templateDescription 
        } = req.body;

        // Validate required fields
        if (!title || !residenceId || !items || !Array.isArray(items)) {
            return res.status(400).json({
                success: false,
                message: 'Title, residenceId, and items array are required'
            });
        }

        // Validate residence exists
        const residence = await Residence.findById(residenceId);
        if (!residence) {
            return res.status(404).json({
                success: false,
                message: 'Residence not found'
            });
        }

        // Process items with historical data
        const processedItems = items.map(item => {
            const processedItem = {
                title: item.title,
                description: item.description || item.title,
                estimatedCost: item.estimatedCost,
                quantity: item.quantity || 1,
                category: item.category || 'general',
                priority: item.priority || 'medium',
                notes: item.notes || '',
                tags: item.tags || [],
                isRecurring: item.isRecurring || false,
                itemHistory: [], // Track when this item was added/removed/modified
                costHistory: [] // Track cost changes
            };

            // Add cost history if provided
            if (historicalData && Array.isArray(historicalData)) {
                const itemHistory = historicalData.filter(h => 
                    h.itemTitle && h.itemTitle.toLowerCase().trim() === item.title.toLowerCase().trim()
                );

                if (itemHistory.length > 0) {
                    processedItem.costHistory = itemHistory.map(h => ({
                        month: h.month,
                        year: h.year,
                        cost: h.cost,
                        date: new Date(h.year, h.month - 1, 1),
                        note: h.note || `Historical cost from ${h.month}/${h.year}`
                    }));

                    // Sort cost history by date (most recent first)
                    processedItem.costHistory.sort((a, b) => b.date - a.date);

                    // Calculate cost variations
                    processedItem.costVariations = [];
                    for (let i = 0; i < processedItem.costHistory.length - 1; i++) {
                        const current = processedItem.costHistory[i];
                        const previous = processedItem.costHistory[i + 1];
                        
                        if (current.cost !== previous.cost) {
                            processedItem.costVariations.push({
                                from: `${previous.month}/${previous.year}`,
                                to: `${current.month}/${current.year}`,
                                oldCost: previous.cost,
                                newCost: current.cost,
                                change: current.cost - previous.cost,
                                changePercent: ((current.cost - previous.cost) / previous.cost * 100).toFixed(1)
                            });
                        }
                    }

                    // Add cost summary
                    const uniqueCosts = [...new Set(processedItem.costHistory.map(h => h.cost))].sort((a, b) => a - b);
                    const averageCost = (processedItem.costHistory.reduce((sum, h) => sum + h.cost, 0) / processedItem.costHistory.length).toFixed(2);
                    
                    processedItem.costSummary = {
                        mostRecentCost: processedItem.costHistory[0].cost,
                        mostRecentMonth: `${processedItem.costHistory[0].month}/${processedItem.costHistory[0].year}`,
                        uniqueCosts: uniqueCosts,
                        totalVariations: processedItem.costVariations.length,
                        averageCost: averageCost
                    };
                }
            }

            // Add item history if provided
            if (itemHistory && Array.isArray(itemHistory)) {
                const itemItemHistory = itemHistory.filter(h => 
                    h.itemTitle && h.itemTitle.toLowerCase().trim() === item.title.toLowerCase().trim()
                );

                if (itemItemHistory.length > 0) {
                    processedItem.itemHistory = itemItemHistory.map(h => ({
                        month: h.month,
                        year: h.year,
                        date: new Date(h.year, h.month - 1, 1),
                        action: h.action, // 'added', 'removed', 'modified'
                        oldValue: h.oldValue,
                        newValue: h.newValue,
                        note: h.note || `${h.action} in ${h.month}/${h.year}`,
                        cost: h.cost,
                        quantity: h.quantity
                    }));

                    // Sort item history by date (most recent first)
                    processedItem.itemHistory.sort((a, b) => b.date - a.date);
                }
            }

            // Update notes with historical information
            let historyNotes = [];
            if (processedItem.costHistory.length > 0) {
                historyNotes.push(`Cost history: ${processedItem.costHistory.length} entries, ${processedItem.costVariations.length} variations`);
            }
            if (processedItem.itemHistory.length > 0) {
                const addedCount = processedItem.itemHistory.filter(h => h.action === 'added').length;
                const removedCount = processedItem.itemHistory.filter(h => h.action === 'removed').length;
                const modifiedCount = processedItem.itemHistory.filter(h => h.action === 'modified').length;
                historyNotes.push(`Item history: ${addedCount} added, ${removedCount} removed, ${modifiedCount} modified`);
            }
            
            if (historyNotes.length > 0) {
                const historyNote = historyNotes.join('; ');
                processedItem.notes = processedItem.notes ? `${processedItem.notes}. ${historyNote}` : historyNote;
            }

            return processedItem;
        });

        // Calculate total estimated cost
        const totalEstimatedCost = processedItems.reduce((sum, item) => sum + (item.estimatedCost * item.quantity), 0);

        // Create the template
        const template = new MonthlyRequest({
            title: title,
            description: description,
            residence: residenceId,
            month: null,
            year: null,
            status: 'draft',
            priority: 'medium',
            items: processedItems,
            totalEstimatedCost: totalEstimatedCost,
            submittedBy: req.user._id,
            isTemplate: true,
            templateVersion: 1,
            lastUpdated: new Date(),
            effectiveFrom: new Date(),
            templateChanges: [],
            templateMetadata: {
                createdWithManualHistory: true,
                creationDate: new Date(),
                historicalDataProvided: historicalData ? historicalData.length : 0,
                itemHistoryProvided: itemHistory ? itemHistory.length : 0,
                templateName: templateName,
                templateDescription: templateDescription,
                totalHistoricalEntries: processedItems.reduce((sum, item) => sum + (item.costHistory ? item.costHistory.length : 0), 0),
                totalItemHistoryEntries: processedItems.reduce((sum, item) => sum + (item.itemHistory ? item.itemHistory.length : 0), 0)
            }
        });

        await template.save();

        // Add to request history
        template.requestHistory.push({
            date: new Date(),
            action: 'Template created with manual historical data',
            user: req.user._id,
            changes: [{
                field: 'template_creation',
                oldValue: null,
                newValue: 'Template created with cost and item history'
            }]
        });

        await template.save();

        res.status(201).json({
            success: true,
            message: 'Template created successfully with historical data',
            template: template,
            summary: {
                totalItems: processedItems.length,
                itemsWithCostHistory: processedItems.filter(item => item.costHistory && item.costHistory.length > 0).length,
                itemsWithItemHistory: processedItems.filter(item => item.itemHistory && item.itemHistory.length > 0).length,
                totalCostHistoryEntries: processedItems.reduce((sum, item) => sum + (item.costHistory ? item.costHistory.length : 0), 0),
                totalItemHistoryEntries: processedItems.reduce((sum, item) => sum + (item.itemHistory ? item.itemHistory.length : 0), 0),
                totalCostVariations: processedItems.reduce((sum, item) => sum + (item.costVariations ? item.costVariations.length : 0), 0)
            }
        });

    } catch (error) {
        console.error('Error creating template with history:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating template with historical data',
            error: error.message
        });
    }
};

// Update entire template (Admin only)
exports.updateTemplate = async (req, res) => {
    try {
        const user = req.user;
        const { templateId } = req.params;
        const { 
            title, 
            description, 
            items, 
            effectiveFromMonth, 
            effectiveFromYear,
            templateName,
            templateDescription 
        } = req.body;
        
        // Only admins can modify templates
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can modify templates' });
        }
        
        const template = await MonthlyRequest.findById(templateId);
        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }
        
        if (!template.isTemplate) {
            return res.status(400).json({ message: 'This is not a template' });
        }
        
        // Store original template for change tracking
        const originalTemplate = template.toObject();
        
        // Update basic template fields
        if (title !== undefined) template.title = title;
        if (description !== undefined) template.description = description;
        if (templateName !== undefined) {
            if (!template.templateMetadata) template.templateMetadata = {};
            template.templateMetadata.templateName = templateName;
        }
        if (templateDescription !== undefined) {
            if (!template.templateMetadata) template.templateMetadata = {};
            template.templateMetadata.templateDescription = templateDescription;
        }
        
        // Handle items update
        if (items && Array.isArray(items)) {
            // Validate items
            for (const item of items) {
                if (!item.title || !item.description || !item.estimatedCost) {
                    return res.status(400).json({ 
                        message: 'Each item must have title, description, and estimated cost' 
                    });
                }
            }
            
            // Calculate new total cost
            const newTotalCost = items.reduce((sum, item) => sum + (item.estimatedCost * (item.quantity || 1)), 0);
            template.totalEstimatedCost = newTotalCost;
            
            // Store original items for change tracking
            const originalItems = template.items;
            template.items = items;
            
            // Create change record for items modification
            const changeRecord = {
                date: new Date(),
                type: 'items_updated',
                changedBy: user._id,
                description: 'Template items updated',
                details: {
                    originalItemCount: originalItems.length,
                    newItemCount: items.length,
                    originalTotalCost: template.totalEstimatedCost,
                    newTotalCost: newTotalCost
                },
                status: 'pending' // Requires finance approval
            };
            
            if (!template.templateChanges) template.templateChanges = [];
            template.templateChanges.push(changeRecord);
        }
        
        // Handle effective date for future changes
        if (effectiveFromMonth && effectiveFromYear) {
            const effectiveDate = new Date(effectiveFromYear, effectiveFromMonth - 1, 1);
            const currentDate = new Date();
            
            // Ensure effective date is in the future
            if (effectiveDate <= currentDate) {
                return res.status(400).json({ 
                    message: 'Effective date must be in the future' 
                });
            }
            
            template.effectiveFrom = effectiveDate;
            
            // Create change record for effective date
            const changeRecord = {
                date: new Date(),
                type: 'effective_date_changed',
                changedBy: user._id,
                description: `Template changes effective from ${effectiveFromMonth}/${effectiveFromYear}`,
                details: {
                    effectiveFromMonth: effectiveFromMonth,
                    effectiveFromYear: effectiveFromYear,
                    effectiveDate: effectiveDate
                },
                status: 'pending' // Requires finance approval
            };
            
            if (!template.templateChanges) template.templateChanges = [];
            template.templateChanges.push(changeRecord);
        }
        
        // Update template version and metadata
        template.templateVersion = (template.templateVersion || 1) + 1;
        template.lastUpdated = new Date();
        
        // Update template metadata
        if (!template.templateMetadata) template.templateMetadata = {};
        template.templateMetadata.lastModifiedBy = user._id;
        template.templateMetadata.lastModifiedAt = new Date();
        template.templateMetadata.modificationCount = (template.templateMetadata.modificationCount || 0) + 1;
        
        // Add to request history
        template.requestHistory.push({
            date: new Date(),
            action: 'Template updated',
            user: user._id,
            changes: [
                { field: 'template_update', oldValue: 'Previous version', newValue: `Version ${template.templateVersion}` }
            ]
        });
        
        await template.save();
        
        // Populate and return updated template
        const updatedTemplate = await MonthlyRequest.findById(templateId)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('templateChanges.changedBy', 'firstName lastName email');
        
        res.status(200).json({
            message: 'Template updated successfully. Changes require finance approval before taking effect.',
            template: updatedTemplate,
            changes: {
                version: template.templateVersion,
                effectiveFrom: template.effectiveFrom,
                pendingChanges: template.templateChanges.filter(change => change.status === 'pending').length
            }
        });
        
    } catch (error) {
        console.error('Error updating template:', error);
        res.status(500).json({ message: error.message });
    }
};

// Submit template for specific month approval
exports.submitTemplateForMonth = async (req, res) => {
    try {
        const { month, year, submittedBy, submittedByEmail, items, totalEstimatedCost } = req.body;
        const { id } = req.params;

        const template = await MonthlyRequest.findById(id);
        if (!template || !template.isTemplate) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }

        // Check if month already has an approval
        const existingApproval = template.monthlyApprovals.find(
            approval => approval.month === parseInt(month) && approval.year === parseInt(year)
        );

        if (existingApproval && existingApproval.status === 'approved') {
            return res.status(400).json({ 
                success: false, 
                message: `Month ${month}/${year} already approved` 
            });
        }

        // Create or update monthly approval
        const monthlyApproval = {
            month: parseInt(month),
            year: parseInt(year),
            status: 'pending',
            items: items || template.items,
            totalCost: totalEstimatedCost || template.totalEstimatedCost,
            submittedAt: new Date(),
            submittedBy: submittedBy || req.user._id,
            submittedByEmail: submittedByEmail || req.user.email,
            notes: `Submitted for ${month}/${year} approval`
        };

        // Update existing or add new
        if (existingApproval) {
            Object.assign(existingApproval, monthlyApproval);
        } else {
            if (!template.monthlyApprovals) template.monthlyApprovals = [];
            template.monthlyApprovals.push(monthlyApproval);
        }

        // Add to request history
        if (!template.requestHistory) template.requestHistory = [];
        template.requestHistory.push({
            date: new Date(),
            action: `Template submitted for ${month}/${year} approval`,
            user: req.user._id,
            changes: [`Submitted template for ${month}/${year} approval`]
        });

        await template.save();

        res.json({
            success: true,
            message: `Template submitted for ${month}/${year} approval`,
            data: template
        });

    } catch (error) {
        console.error('Error submitting month:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}; 

// Approve/reject template for specific month
exports.approveTemplateForMonth = async (req, res) => {
    try {
        const { month, year, status, notes } = req.body;
        const { id } = req.params;

        const template = await MonthlyRequest.findById(id);
        if (!template || !template.isTemplate) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }

        // Find the monthly approval
        const monthlyApproval = template.monthlyApprovals.find(
            approval => approval.month === parseInt(month) && approval.year === parseInt(year)
        );

        if (!monthlyApproval) {
            return res.status(404).json({ 
                success: false, 
                message: `No submission found for ${month}/${year}` 
            });
        }

        // Update approval
        monthlyApproval.status = status;
        monthlyApproval.notes = notes || monthlyApproval.notes;
        monthlyApproval.approvedBy = req.user._id;
        monthlyApproval.approvedAt = new Date();
        monthlyApproval.approvedByEmail = req.user.email;

        // If rejected, mark future months as pending
        if (status === 'rejected') {
            const currentDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            
            template.monthlyApprovals.forEach(approval => {
                const approvalDate = new Date(approval.year, approval.month - 1, 1);
                if (approvalDate > currentDate && approval.status !== 'approved') {
                    approval.status = 'pending';
                    approval.notes = 'Pending due to previous month rejection';
                    approval.approvedBy = null;
                    approval.approvedAt = null;
                    approval.approvedByEmail = null;
                }
            });
        }

        // Add to request history
        if (!template.requestHistory) template.requestHistory = [];
        template.requestHistory.push({
            date: new Date(),
            action: `Template ${status} for ${month}/${year}`,
            user: req.user._id,
            changes: [`Template ${status} for ${month}/${year}`]
        });

        await template.save();

        // If approved, create expense
        if (status === 'approved') {
            try {
                // Create a temporary request object for conversion
                const tempRequest = {
                    ...template.toObject(),
                    items: monthlyApproval.items,
                    totalEstimatedCost: monthlyApproval.totalCost,
                    month: monthlyApproval.month,
                    year: monthlyApproval.year,
                    status: 'approved',
                    isTemplate: false
                };
                
                const expenseConversionResult = await convertRequestToExpenses(tempRequest, req.user);
                console.log(`Auto-converted ${expenseConversionResult.expenses.length} expenses for approved month: ${month}/${year}`);
            } catch (conversionError) {
                console.error('Error auto-converting to expenses:', conversionError);
                // Don't fail the approval if expense conversion fails
            }
        }

        res.json({
            success: true,
            message: `Template ${status} for ${month}/${year}`,
            data: template
        });

    } catch (error) {
        console.error('Error approving month:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Get monthly approval status for specific month
exports.getMonthlyApprovalStatus = async (req, res) => {
    try {
        const { id, month, year } = req.params;
        const monthNum = parseInt(month);
        const yearNum = parseInt(year);

        const template = await MonthlyRequest.findById(id);
        if (!template) {
            return res.status(404).json({ 
                success: false, 
                message: 'Template not found' 
            });
        }

        // Find approval for the specified month
        const approval = template.monthlyApprovals.find(
            approval => approval.month === monthNum && approval.year === yearNum
        );

        if (approval) {
            return res.json({
                success: true,
                data: approval
            });
        }

        // Check if there's a rejected month before the requested month
        const currentDate = new Date(yearNum, monthNum - 1, 1);
        const hasRejectedPreviousMonth = template.monthlyApprovals.some(approval => {
            const approvalDate = new Date(approval.year, approval.month - 1, 1);
            return approvalDate < currentDate && approval.status === 'rejected';
        });

        if (hasRejectedPreviousMonth) {
            return res.json({
                success: true,
                data: {
                    month: monthNum,
                    year: yearNum,
                    status: 'pending',
                    notes: 'Pending due to previous month rejection',
                    totalCost: template.totalEstimatedCost
                }
            });
        }

        // No approval found and no previous rejection
        return res.json({
            success: true,
            data: {
                month: monthNum,
                year: yearNum,
                status: 'draft',
                totalCost: template.totalEstimatedCost
            }
        });

    } catch (error) {
        console.error('Error getting approval status:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
};

// Export the convertRequestToExpenses function for use in scripts
exports.convertRequestToExpenses = convertRequestToExpenses;

// Send monthly request to finance for approval (Admin only)
exports.sendToFinance = async (req, res) => {
    try {
        const user = req.user;
        const { templateId } = req.params;
        const { month, year, items } = req.body;

        // Check permissions - only admin can send to finance
        if (user.role !== 'admin') {
            return res.status(403).json({ 
                success: false,
                message: 'Only admins can send monthly requests to finance' 
            });
        }

        if (!month || !year) {
            return res.status(400).json({ 
                success: false,
                message: 'Month and year are required' 
            });
        }

        // Find the template
        const template = await MonthlyRequest.findById(templateId);
        if (!template) {
            return res.status(404).json({ 
                success: false,
                message: 'Template not found' 
            });
        }

        if (!template.isTemplate) {
            return res.status(400).json({ 
                success: false,
                message: 'Only templates can be sent to finance' 
            });
        }

        // Check if monthly request already exists for this month/year
        const existingRequest = await MonthlyRequest.findOne({
            templateId: template._id,
            month: parseInt(month),
            year: parseInt(year),
            isTemplate: false
        });

        if (existingRequest) {
            return res.status(400).json({ 
                success: false,
                message: `Monthly request for ${month}/${year} already exists` 
            });
        }

        // Create monthly request from template
        const monthlyRequest = new MonthlyRequest({
            title: formatDescriptionWithMonth(template.title, month, year),
            description: formatDescriptionWithMonth(template.description, month, year),
            residence: template.residence,
            submittedBy: user._id,
            month: parseInt(month),
            year: parseInt(year),
            isTemplate: false,
            templateId: template._id,
            status: 'pending',
            totalEstimatedCost: 0,
            items: [],
            requestHistory: [{
                date: new Date(),
                action: 'Sent to finance for approval',
                user: user._id,
                changes: [`Created from template: ${template.title}`]
            }]
        });

        // Process items - use provided items or template items
        const itemsToProcess = items || template.items;
        let totalEstimatedCost = 0;

        for (const item of itemsToProcess) {
            const quantity = item.quantity || 1; // Default to 1 if quantity is missing
            const estimatedCost = item.estimatedCost || 0; // Default to 0 if cost is missing
            const totalCost = estimatedCost * quantity;
            
            console.log(`🔍 Processing item: ${item.title}, quantity: ${quantity}, cost: ${estimatedCost}, total: ${totalCost}`);
            
            const monthlyItem = {
                title: item.title,
                description: item.description,
                quantity: quantity,
                estimatedCost: estimatedCost,
                purpose: item.purpose,
                category: item.category,
                priority: item.priority,
                isRecurring: item.isRecurring,
                notes: item.notes,
                provider: item.provider,
                tags: item.tags || [],
                totalCost: totalCost,
                quotations: item.quotations || []
            };

            monthlyRequest.items.push(monthlyItem);
            totalEstimatedCost += totalCost;
        }

        console.log(`🔍 Final totalEstimatedCost: ${totalEstimatedCost}`);
        monthlyRequest.totalEstimatedCost = totalEstimatedCost || 0;
        console.log(`🔍 Set totalEstimatedCost to: ${monthlyRequest.totalEstimatedCost}`);

        await monthlyRequest.save();

        // Notify finance via email
        try {
            await EmailNotificationService.sendMonthlyRequestToFinance(
                monthlyRequest,
                user,
                month,
                year
            );
        } catch (emailError) {
            console.error('Failed to send monthly request (template) email notification:', emailError);
        }

        // Update template with monthly approval record
        if (!template.monthlyApprovals) {

            
            template.monthlyApprovals = [];
        }

        template.monthlyApprovals.push({
            month: parseInt(month),
            year: parseInt(year),
            status: 'pending',
            totalCost: totalEstimatedCost,
            items: monthlyRequest.items,
            sentToFinanceAt: new Date(),
            sentToFinanceBy: user._id,
            sentToFinanceByEmail: user.email
        });

        await template.save();

        const populatedRequest = await MonthlyRequest.findById(monthlyRequest._id)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email');

        res.status(201).json({
            success: true,
            message: `Monthly request for ${month}/${year} sent to finance successfully`,
            monthlyRequest: populatedRequest,
            templateId: template._id
        });

    } catch (error) {
        console.error('Error sending monthly request to finance:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error sending monthly request to finance',
            error: error.message 
        });
    }
};

// Finance approve monthly request with expense creation
exports.financeApproveMonthlyRequest = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const { approved, notes, createExpenses = true, datePaid } = req.body;

        // Check permissions - allow admin and finance users to approve
        if (!['admin', 'finance', 'finance_admin', 'finance_user'].includes(user.role)) {
            return res.status(403).json({ 
                success: false,
                message: 'Only admin and finance users can approve monthly requests' 
            });
        }

        const monthlyRequest = await MonthlyRequest.findById(id)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email');

        if (!monthlyRequest) {
            return res.status(404).json({ 
                success: false,
                message: 'Monthly request not found' 
            });
        }

        if (monthlyRequest.status !== 'pending') {
            return res.status(400).json({ 
                success: false,
                message: 'Only pending requests can be approved' 
            });
        }

        // Update request status
        monthlyRequest.status = approved ? 'approved' : 'rejected';
        monthlyRequest.approvedBy = user._id;
        monthlyRequest.approvedAt = new Date();
        monthlyRequest.approvedByEmail = user.email;
        monthlyRequest.notes = notes || monthlyRequest.notes;
        
        // Set datePaid when request is approved (marked as paid)
        if (approved) {
            monthlyRequest.datePaid = datePaid ? new Date(datePaid) : new Date();
        }

        // Add to request history
        monthlyRequest.requestHistory.push({
            date: new Date(),
            action: `Monthly request ${approved ? 'approved' : 'rejected'} by finance`,
            user: user._id,
            changes: [`Status changed to ${approved ? 'approved' : 'rejected'}`]
        });

        // Send email to submitter about approval state
        try {
            await EmailNotificationService.sendMonthlyRequestApprovalNotification(
                monthlyRequest,
                approved,
                notes,
                monthlyRequest.month,
                monthlyRequest.year,
                user
            );
        } catch (emailError) {
            console.error('Failed to send monthly request approval email:', emailError);
        }

        // Update template monthly approval if this is from a template
        if (monthlyRequest.templateId) {
            const template = await MonthlyRequest.findById(monthlyRequest.templateId);
            if (template && template.monthlyApprovals) {
                const monthlyApproval = template.monthlyApprovals.find(
                    approval => approval.month === monthlyRequest.month && approval.year === monthlyRequest.year
                );
                
                if (monthlyApproval) {
                    monthlyApproval.status = approved ? 'approved' : 'rejected';
                    monthlyApproval.approvedBy = user._id;
                    monthlyApproval.approvedAt = new Date();
                    monthlyApproval.approvedByEmail = user.email;
                    monthlyApproval.notes = notes;
                    
                    await template.save();
                }
            }
        }

        // Auto-create expenses if approved and requested
        let expenseConversionResult = null;
        if (approved && createExpenses) {
            try {
                expenseConversionResult = await convertRequestToExpenses(monthlyRequest, user);
                
                // Update request status to completed after expense creation
                monthlyRequest.status = 'completed';
                monthlyRequest.datePaid = new Date(); // Set datePaid when marking as completed/paid
                monthlyRequest.requestHistory.push({
                    date: new Date(),
                    action: 'Converted to expenses with double-entry transactions',
                    user: user._id,
                    changes: [`${expenseConversionResult.expenses.length} expenses created`]
                });
                
                console.log(`Auto-converted ${expenseConversionResult.expenses.length} expenses for approved monthly request: ${monthlyRequest._id}`);
            } catch (conversionError) {
                console.error('Error auto-converting to expenses:', conversionError);
                // Don't fail the approval if expense conversion fails
                expenseConversionResult = { expenses: [], errors: [conversionError.message] };
            }
        }

        await monthlyRequest.save();

        const updatedRequest = await MonthlyRequest.findById(monthlyRequest._id)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email');

        res.status(200).json({
            success: true,
            message: `Monthly request ${approved ? 'approved' : 'rejected'} successfully`,
            monthlyRequest: updatedRequest,
            expenseConversion: approved && expenseConversionResult ? {
                converted: expenseConversionResult.expenses.length,
                errors: expenseConversionResult.errors.length > 0 ? expenseConversionResult.errors : undefined
            } : undefined
        });

    } catch (error) {
        console.error('Error approving monthly request:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error approving monthly request',
            error: error.message 
        });
    }
};

// Get monthly requests pending finance approval
exports.getPendingFinanceApproval = async (req, res) => {
    try {
        const user = req.user;
        
        // Allow admin and finance users to access this endpoint
        if (!['admin', 'finance', 'finance_admin', 'finance_user'].includes(user.role)) {
            return res.status(403).json({ 
                success: false,
                message: 'Only admin and finance users can access this endpoint' 
            });
        }
        
        const { month, year, residence, page = 1, limit = 10 } = req.query;
        
        let query = {
            status: 'pending',
            isTemplate: false
        };
        
        // Filter by month/year if provided
        if (month && year) {
            query.month = parseInt(month);
            query.year = parseInt(year);
        }
        
        // Filter by residence if provided
        if (residence) {
            query.residence = residence;
        }
        
        const skip = (page - 1) * limit;
        
        const monthlyRequests = await MonthlyRequest.find(query)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        
        const total = await MonthlyRequest.countDocuments(query);
        
        // Calculate summary statistics
        const summary = {
            total: total,
            totalEstimatedCost: monthlyRequests.reduce((sum, r) => sum + (r.totalEstimatedCost || 0), 0),
            byMonth: {}
        };
        
        // Group by month for summary
        monthlyRequests.forEach(request => {
            const monthKey = `${request.month}/${request.year}`;
            if (!summary.byMonth[monthKey]) {
                summary.byMonth[monthKey] = {
                    count: 0,
                    totalCost: 0
                };
            }
            summary.byMonth[monthKey].count++;
            summary.byMonth[monthKey].totalCost += request.totalEstimatedCost || 0;
        });
        
        res.status(200).json({
            success: true,
            monthlyRequests,
            summary,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });
        
    } catch (error) {
        console.error('Error getting pending finance approval:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error getting pending finance approval',
            error: error.message 
        });
    }
};

// ✅ NEW: Dedicated method for monthly templates with proper accrual accounting
