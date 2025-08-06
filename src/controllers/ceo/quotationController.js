const { validationResult } = require('express-validator');
const Request = require('../../models/Request');
const AuditLog = require('../../models/AuditLog');

// CEO override quotation selection with strategic reasoning
exports.ceoOverrideQuotation = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { itemIndex, quotationIndex, reason } = req.body;

        if (!itemIndex || quotationIndex === undefined || !reason) {
            return res.status(400).json({ 
                message: 'Item index, quotation index, and strategic reason are required' 
            });
        }

        const request = await Request.findById(id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        // Only CEO can override quotations
        if (req.user.role !== 'ceo') {
            return res.status(403).json({ message: 'Access denied - CEO only' });
        }

        // Check if request is in correct status for CEO override
        if (request.status !== 'pending_ceo_approval' && request.financeStatus !== 'approved') {
            return res.status(400).json({ 
                message: 'Request is not in correct status for CEO override' 
            });
        }

        // Validate item and quotation indices
        if (!request.items || !request.items[itemIndex]) {
            return res.status(400).json({ message: 'Item not found' });
        }

        const item = request.items[itemIndex];
        if (!item.quotations || !item.quotations[quotationIndex]) {
            return res.status(400).json({ message: 'Quotation not found' });
        }

        // Find the previously selected quotation
        const previouslySelectedQuotation = item.quotations.find(q => q.isSelected === true);

        // Deselect all quotations for this item
        item.quotations.forEach(quotation => {
            quotation.isSelected = false;
            quotation.deselectedBy = req.user._id;
            quotation.deselectedAt = new Date();
            quotation.deselectedByEmail = req.user.email;
            
            // Add to selection history
            if (quotation.selectionHistory) {
                quotation.selectionHistory.push({
                    action: 'deselected',
                    user: req.user._id,
                    userEmail: req.user.email,
                    timestamp: new Date(),
                    reason: reason || 'CEO strategic override'
                });
            }
        });

        // Select the new quotation
        const newSelectedQuotation = item.quotations[quotationIndex];
        newSelectedQuotation.isSelected = true;
        newSelectedQuotation.selectedBy = req.user._id;
        newSelectedQuotation.selectedAt = new Date();
        newSelectedQuotation.selectedByEmail = req.user.email;
        newSelectedQuotation.ceoOverride = true;
        newSelectedQuotation.ceoOverrideDate = new Date();
        newSelectedQuotation.ceoOverrideReason = reason;

        // Add to selection history
        if (newSelectedQuotation.selectionHistory) {
            newSelectedQuotation.selectionHistory.push({
                action: 'selected',
                user: req.user._id,
                userEmail: req.user.email,
                timestamp: new Date(),
                reason: reason || 'CEO strategic override'
            });
        }

        // Update item cost to match the new selected quotation
        const oldUnitCost = item.unitCost;
        const oldTotalCost = item.totalCost;

        item.unitCost = newSelectedQuotation.amount;
        item.totalCost = newSelectedQuotation.amount * (item.quantity || 1);

        // Recalculate total estimated cost for the request
        if (request.items && request.items.length > 0) {
            request.totalEstimatedCost = request.items.reduce((total, reqItem) => {
                return total + (reqItem.totalCost || 0);
            }, 0);
        }

        // Mark that CEO has overridden finance selections
        request.ceoOverride = true;
        request.ceoOverrideDate = new Date();
        request.ceoOverrideBy = req.user._id;
        request.ceoOverrideByEmail = req.user.email;

        // Add to request history
        const changes = [
            `CEO strategically overrode quotation selection for item ${itemIndex + 1}`,
            `Changed from ${previouslySelectedQuotation ? previouslySelectedQuotation.provider : 'none'} to ${newSelectedQuotation.provider}`,
            `Updated cost from $${oldTotalCost} to $${item.totalCost}`,
            `Strategic reason: ${reason}`
        ];

        request.requestHistory.push({
            date: new Date(),
            action: 'CEO Strategic Quotation Override',
            user: req.user._id,
            changes: changes
        });

        await request.save();

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'ceo_quotation_override',
            collection: 'Request',
            recordId: request._id,
            before: {
                selectedQuotation: previouslySelectedQuotation ? {
                    provider: previouslySelectedQuotation.provider,
                    amount: previouslySelectedQuotation.amount
                } : null,
                itemCost: oldTotalCost
            },
            after: {
                selectedQuotation: {
                    provider: newSelectedQuotation.provider,
                    amount: newSelectedQuotation.amount
                },
                itemCost: item.totalCost,
                strategicReason: reason
            }
        });

        res.json({
            message: 'CEO quotation override successful',
            request: {
                id: request._id,
                title: request.title,
                changes: {
                    itemIndex,
                    quotationIndex,
                    newProvider: newSelectedQuotation.provider,
                    newAmount: newSelectedQuotation.amount,
                    oldAmount: oldTotalCost,
                    newTotalCost: item.totalCost,
                    strategicReason: reason
                }
            }
        });

    } catch (error) {
        console.error('Error in CEO quotation override:', error);
        res.status(500).json({ 
            message: 'Error processing CEO quotation override',
            error: error.message 
        });
    }
};

// Get quotation analysis for CEO decision making
exports.getQuotationAnalysis = async (req, res) => {
    try {
        const { id } = req.params;

        const request = await Request.findById(id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        // Only CEO can access quotation analysis
        if (req.user.role !== 'ceo') {
            return res.status(403).json({ message: 'Access denied - CEO only' });
        }

        let allQuotations = [];
        let quotationStats = null;

        // Collect all quotations from items
        if (request.items && Array.isArray(request.items)) {
            request.items.forEach((item, itemIndex) => {
                if (item.quotations && Array.isArray(item.quotations)) {
                    const quotationsWithItemIndex = item.quotations.map(quotation => ({
                        ...quotation.toObject(),
                        itemIndex: itemIndex
                    }));
                    allQuotations = [...allQuotations, ...quotationsWithItemIndex];
                }
            });
        }

        // Calculate statistics
        if (allQuotations.length > 0) {
            const amounts = allQuotations.map(q => q.amount || q.totalPrice || 0).filter(amount => amount > 0);
            if (amounts.length > 0) {
                const min = Math.min(...amounts);
                const max = Math.max(...amounts);
                const avg = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
                const savings = max - min;
                const savingsPercentage = ((savings / max) * 100).toFixed(1);

                quotationStats = {
                    totalQuotations: allQuotations.length,
                    lowestQuote: min,
                    highestQuote: max,
                    averageQuote: avg.toFixed(2),
                    potentialSavings: savings,
                    savingsPercentage: savingsPercentage,
                    selectedQuotations: allQuotations.filter(q => q.isSelected).length
                };
            }
        }

        res.json({
            message: 'Quotation analysis retrieved successfully',
            analysis: {
                requestId: request._id,
                requestTitle: request.title,
                totalQuotations: allQuotations.length,
                quotations: allQuotations,
                statistics: quotationStats,
                selectedQuotations: allQuotations.filter(q => q.isSelected),
                ceoOverride: request.ceoOverride || false,
                ceoOverrideDate: request.ceoOverrideDate,
                ceoOverrideReason: request.ceoOverrideReason
            }
        });

    } catch (error) {
        console.error('Error getting quotation analysis:', error);
        res.status(500).json({ 
            message: 'Error retrieving quotation analysis',
            error: error.message 
        });
    }
}; 