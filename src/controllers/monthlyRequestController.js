const MonthlyRequest = require('../models/MonthlyRequest');
const Residence = require('../models/Residence');
const { uploadToS3 } = require('../utils/fileStorage');
const Expense = require('../models/finance/Expense'); // Added for expense conversion

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
        return 'pending'; // Require finance approval for future
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

        // Filter by month/year
        if (month && year) {
            query.month = parseInt(month);
            query.year = parseInt(year);
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

        // Role-based filtering - Students cannot access monthly requests
        if (user.role === 'student') {
            return res.status(403).json({ message: 'Students do not have access to monthly requests' });
        } else if (user.role === 'finance' || user.role === 'finance_admin' || user.role === 'finance_user') {
            // Finance users can see all approved requests
            query.status = { $in: ['approved', 'completed'] };
        }

        const skip = (page - 1) * limit;
        
        const monthlyRequests = await MonthlyRequest.find(query)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await MonthlyRequest.countDocuments(query);

        res.status(200).json({
            monthlyRequests,
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
            templateName,
            templateDescription
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
        if (isTemplate && (historicalData.length > 0 || itemHistory.length > 0)) {
            processedItems = items.map(item => {
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
                    const itemHistory = historicalData.filter(h => 
                        h.title && h.title.toLowerCase().trim() === item.title.toLowerCase().trim()
                    );

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
                            isRecurring: h.isRecurring !== undefined ? h.isRecurring : true,
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
                    const itemItemHistory = itemHistory.filter(h => 
                        h.title && h.title.toLowerCase().trim() === item.title.toLowerCase().trim()
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
                            quantity: h.quantity,
                            // Standardized fields to match current item structure
                            title: h.title,
                            description: h.description || item.description,
                            category: h.category || item.category || 'other',
                            priority: h.priority || item.priority || 'medium',
                            isRecurring: h.isRecurring !== undefined ? h.isRecurring : true,
                            notes: h.notes || item.notes || ''
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
                templateName: templateName,
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
            changes: [{
                field: isTemplate ? 'template_creation' : 'request_creation',
                oldValue: null,
                newValue: isTemplate ? 'Template created with historical data' : 'Monthly request created'
            }]
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
        res.status(500).json({
            success: false,
            message: 'Error creating monthly request',
            error: error.message
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

        // Check permissions - only admin or the submitter can update
        if (user.role !== 'admin' && monthlyRequest.submittedBy.toString() !== user._id.toString()) {
            return res.status(403).json({ message: 'Only admins or the submitter can update monthly requests' });
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
        const { approved, notes } = req.body;

        // Check permissions - only finance users can approve
        if (!['finance', 'finance_admin', 'finance_user'].includes(user.role)) {
            return res.status(403).json({ message: 'Only finance users can approve monthly requests' });
        }

        const monthlyRequest = await MonthlyRequest.findById(req.params.id);

        if (!monthlyRequest) {
            return res.status(404).json({ message: 'Monthly request not found' });
        }

        if (monthlyRequest.status !== 'pending') {
            return res.status(400).json({ message: 'Only pending requests can be approved' });
        }

        monthlyRequest.status = approved ? 'approved' : 'rejected';
        monthlyRequest.approvedBy = user._id;
        monthlyRequest.approvedAt = new Date();
        monthlyRequest.approvedByEmail = user.email;
        monthlyRequest.notes = notes || monthlyRequest.notes;

        monthlyRequest.requestHistory.push({
            date: new Date(),
            action: `Monthly request ${approved ? 'approved' : 'rejected'}`,
            user: user._id,
            changes: [`Status changed to ${approved ? 'approved' : 'rejected'}`]
        });

        await monthlyRequest.save();

        const updatedRequest = await MonthlyRequest.findById(monthlyRequest._id)
            .populate('residence', 'name')
            .populate('submittedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email');

        res.status(200).json(updatedRequest);
    } catch (error) {
        console.error('Error approving monthly request:', error);
        res.status(500).json({ message: error.message });
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
        const { provider, amount, description } = req.body;
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
        
        // Only finance users can access this endpoint
        if (!['finance', 'finance_admin', 'finance_user'].includes(user.role)) {
            return res.status(403).json({ message: 'Only finance users can access this endpoint' });
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
        
        const { month, year, residence } = req.body;
        
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
                // Create expense for each item with approved quotations
                for (const item of request.items) {
                    const approvedQuotation = item.quotations.find(q => q.isApproved);
                    
                    if (approvedQuotation) {
                        const expense = new Expense({
                            title: `${request.title} - ${item.description}`,
                            description: item.description,
                            amount: approvedQuotation.amount,
                            category: item.category || 'monthly_request',
                            type: 'expense',
                            date: new Date(year, month - 1, 1), // First day of the month
                            residence: request.residence,
                            submittedBy: request.submittedBy,
                            approvedBy: user._id,
                            approvedAt: new Date(),
                            status: 'approved',
                            paymentMethod: 'monthly_budget',
                            notes: `Converted from monthly request: ${request.title}`,
                            monthlyRequestId: request._id,
                            itemIndex: request.items.indexOf(item),
                            quotationId: approvedQuotation._id
                        });
                        
                        await expense.save();
                        createdExpenses.push(expense);
                        
                        // Update monthly request status to completed
                        request.status = 'completed';
                        request.requestHistory.push({
                            date: new Date(),
                            action: 'Converted to expense',
                            user: user._id,
                            changes: [`Item "${item.description}" converted to expense`]
                        });
                    }
                }
                
                await request.save();
                
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
        
        // Only finance users can access this endpoint
        if (!['finance', 'finance_admin', 'finance_user'].includes(user.role)) {
            return res.status(403).json({ message: 'Only finance users can access this endpoint' });
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
                            const itemChange = item.itemHistory.find(h => 
                                h.month === requestedMonth && h.year === requestedYear
                            );

                            if (itemChange) {
                                processedItem.itemChangeNote = `${itemChange.action} in ${requestedMonth}/${requestedYear}: ${itemChange.note}`;
                                processedItem.itemChange = itemChange;
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
                    `Showing data for ${month}/${year}. Past months show historical costs, current/future months show template costs.` : 
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
                            const itemChange = item.itemHistory.find(h => 
                                h.month === requestedMonth && h.year === requestedYear
                            );

                            if (itemChange) {
                                processedItem.itemChangeNote = `${itemChange.action} in ${requestedMonth}/${requestedYear}: ${itemChange.note}`;
                                processedItem.itemChange = itemChange;
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
                note: `Showing data for ${month}/${year}. Past months show historical costs, current/future months show template costs.`
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