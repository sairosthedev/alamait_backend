const mongoose = require('mongoose');
const MonthlyRequest = require('../models/MonthlyRequest');
const Request = require('../models/Request');
const Residence = require('../models/Residence');
const User = require('../models/User');

class MonthlyRequestDeductionService {
    /**
     * Create a maintenance request from an approved monthly request
     * @param {Object} deductionData - Deduction data
     * @param {string} deductionData.monthlyRequestId - Monthly request ID
     * @param {number} deductionData.itemIndex - Item index in the monthly request
     * @param {number} deductionData.amount - Amount to deduct
     * @param {string} deductionData.description - Description for the maintenance request
     * @param {Object} deductionData.user - User creating the deduction
     * @param {string} deductionData.week - Week number (e.g., "Week 1", "Week 2")
     * @returns {Object} Created maintenance request
     */
    static async createMaintenanceRequestFromMonthly(deductionData) {
        try {
            const { monthlyRequestId, itemIndex, amount, description, user, week } = deductionData;
            
            console.log(`🔧 Creating maintenance request from monthly request ${monthlyRequestId}, item ${itemIndex}, amount $${amount}`);
            
            // Get the monthly request
            const monthlyRequest = await MonthlyRequest.findById(monthlyRequestId)
                .populate('residence', 'name')
                .populate('submittedBy', 'firstName lastName email');
            
            if (!monthlyRequest) {
                throw new Error('Monthly request not found');
            }
            
            // Check if monthly request is approved
            if (monthlyRequest.status !== 'approved' && monthlyRequest.status !== 'approved_for_installments') {
                throw new Error('Monthly request must be approved before creating maintenance requests');
            }
            
            // Get the specific item
            const item = monthlyRequest.items[itemIndex];
            if (!item) {
                throw new Error('Item not found in monthly request');
            }
            
            // Check if the deduction amount is valid
            if (amount <= 0) {
                throw new Error('Deduction amount must be greater than 0');
            }
            
            // Get residence information
            const residence = await Residence.findById(monthlyRequest.residence);
            if (!residence) {
                throw new Error('Residence not found');
            }
            
            // Create maintenance request title
            const maintenanceTitle = `${item.title} - ${week} (${monthlyRequest.title})`;
            
            // Create maintenance request description
            const maintenanceDescription = `${description || item.description}\n\nDeducted from: ${monthlyRequest.title}\nOriginal Item: ${item.title}\nWeek: ${week}\nAmount: $${amount}`;
            
            // Create the maintenance request
            const maintenanceRequest = new Request({
                title: maintenanceTitle,
                description: maintenanceDescription,
                type: 'maintenance',
                category: item.category || 'maintenance',
                submittedBy: user._id,
                residence: monthlyRequest.residence,
                priority: item.priority || 'medium',
                status: 'pending',
                financeStatus: 'pending',
                // Link to original monthly request
                linkedMonthlyRequestId: monthlyRequestId,
                linkedMonthlyRequestItemIndex: itemIndex,
                linkedMonthlyRequestWeek: week,
                // Financial information
                amount: amount,
                totalEstimatedCost: amount,
                // Vendor information from monthly request item
                proposedVendor: item.provider || 'TBD',
                vendorName: item.provider || 'TBD',
                // Additional metadata
                metadata: {
                    source: 'monthly_request_deduction',
                    originalMonthlyRequest: monthlyRequestId,
                    originalItem: itemIndex,
                    week: week,
                    deductedBy: user._id,
                    deductedAt: new Date()
                }
            });
            
            await maintenanceRequest.save();
            
            // Update monthly request with deduction tracking
            if (!monthlyRequest.deductions) {
                monthlyRequest.deductions = [];
            }
            
            monthlyRequest.deductions.push({
                maintenanceRequestId: maintenanceRequest._id,
                itemIndex: itemIndex,
                amount: amount,
                week: week,
                description: description,
                createdBy: user._id,
                createdAt: new Date()
            });
            
            // Update the item's deducted amount
            if (!item.deductedAmount) {
                item.deductedAmount = 0;
            }
            item.deductedAmount += amount;
            
            // Check if item is fully deducted
            const remainingAmount = (item.estimatedCost || item.totalCost || 0) - item.deductedAmount;
            if (remainingAmount <= 0) {
                item.fullyDeducted = true;
                item.fullyDeductedAt = new Date();
            }
            
            await monthlyRequest.save();
            
            console.log(`✅ Maintenance request created: ${maintenanceRequest._id}`);
            console.log(`   - Title: ${maintenanceTitle}`);
            console.log(`   - Amount: $${amount}`);
            console.log(`   - Week: ${week}`);
            console.log(`   - Linked to monthly request: ${monthlyRequestId}`);
            
            return {
                maintenanceRequest,
                monthlyRequest,
                item,
                remainingAmount: Math.max(0, remainingAmount),
                isFullyDeducted: remainingAmount <= 0
            };
            
        } catch (error) {
            console.error('❌ Error creating maintenance request from monthly:', error);
            throw error;
        }
    }
    
    /**
     * Get deduction summary for a monthly request item
     * @param {string} monthlyRequestId - Monthly request ID
     * @param {number} itemIndex - Item index
     * @returns {Object} Deduction summary
     */
    static async getDeductionSummary(monthlyRequestId, itemIndex) {
        try {
            const monthlyRequest = await MonthlyRequest.findById(monthlyRequestId);
            if (!monthlyRequest) {
                throw new Error('Monthly request not found');
            }
            
            const item = monthlyRequest.items[itemIndex];
            if (!item) {
                throw new Error('Item not found');
            }
            
            const totalAmount = item.estimatedCost || item.totalCost || 0;
            const deductedAmount = item.deductedAmount || 0;
            const remainingAmount = totalAmount - deductedAmount;
            
            // Get all maintenance requests created from this item
            const maintenanceRequests = await Request.find({
                linkedMonthlyRequestId: monthlyRequestId,
                linkedMonthlyRequestItemIndex: itemIndex
            }).sort({ createdAt: 1 });
            
            return {
                item,
                totalAmount,
                deductedAmount,
                remainingAmount,
                isFullyDeducted: remainingAmount <= 0,
                maintenanceRequests,
                deductionProgress: {
                    percentage: totalAmount > 0 ? (deductedAmount / totalAmount) * 100 : 0,
                    deductedAmount,
                    remainingAmount
                }
            };
            
        } catch (error) {
            console.error('❌ Error getting deduction summary:', error);
            throw error;
        }
    }
    
    /**
     * Get all deductions for a monthly request
     * @param {string} monthlyRequestId - Monthly request ID
     * @returns {Object} All deductions grouped by item
     */
    static async getAllDeductionsForRequest(monthlyRequestId) {
        try {
            const monthlyRequest = await MonthlyRequest.findById(monthlyRequestId);
            if (!monthlyRequest) {
                throw new Error('Monthly request not found');
            }
            
            // Get all maintenance requests created from this monthly request
            const maintenanceRequests = await Request.find({
                linkedMonthlyRequestId: monthlyRequestId
            }).sort({ linkedMonthlyRequestItemIndex: 1, createdAt: 1 });
            
            // Group by item index
            const deductionsByItem = {};
            monthlyRequest.items.forEach((item, index) => {
                const itemMaintenanceRequests = maintenanceRequests.filter(
                    req => req.linkedMonthlyRequestItemIndex === index
                );
                
                const totalAmount = item.estimatedCost || item.totalCost || 0;
                const deductedAmount = item.deductedAmount || 0;
                const remainingAmount = totalAmount - deductedAmount;
                
                deductionsByItem[index] = {
                    item,
                    totalAmount,
                    deductedAmount,
                    remainingAmount,
                    isFullyDeducted: remainingAmount <= 0,
                    maintenanceRequests: itemMaintenanceRequests,
                    deductionProgress: {
                        percentage: totalAmount > 0 ? (deductedAmount / totalAmount) * 100 : 0,
                        deductedAmount,
                        remainingAmount
                    }
                };
            });
            
            return {
                monthlyRequest,
                deductionsByItem,
                totalRequestAmount: monthlyRequest.items.reduce((sum, item) => sum + (item.estimatedCost || item.totalCost || 0), 0),
                totalDeductedAmount: Object.values(deductionsByItem).reduce((sum, deduction) => sum + deduction.deductedAmount, 0),
                overallProgress: monthlyRequest.items.length > 0 ? 
                    Object.values(deductionsByItem).reduce((sum, deduction) => sum + deduction.deductionProgress.percentage, 0) / monthlyRequest.items.length : 0
            };
            
        } catch (error) {
            console.error('❌ Error getting all deductions for request:', error);
            throw error;
        }
    }
    
    /**
     * Get maintenance requests that need finance approval
     * @param {Object} filters - Optional filters
     * @returns {Object} Maintenance requests pending finance approval
     */
    static async getMaintenanceRequestsForFinance(filters = {}) {
        try {
            const query = {
                type: 'maintenance',
                linkedMonthlyRequestId: { $exists: true },
                financeStatus: 'pending',
                status: { $ne: 'rejected' }
            };
            
            // Apply additional filters
            if (filters.residence) {
                query.residence = filters.residence;
            }
            
            if (filters.monthlyRequestId) {
                query.linkedMonthlyRequestId = filters.monthlyRequestId;
            }
            
            const maintenanceRequests = await Request.find(query)
                .populate('residence', 'name')
                .populate('submittedBy', 'firstName lastName email')
                .populate('linkedMonthlyRequestId', 'title month year status')
                .sort({ createdAt: -1 });
            
            return {
                maintenanceRequests,
                totalCount: maintenanceRequests.length,
                totalAmount: maintenanceRequests.reduce((sum, req) => sum + (req.amount || 0), 0)
            };
            
        } catch (error) {
            console.error('❌ Error getting maintenance requests for finance:', error);
            throw error;
        }
    }
}

module.exports = MonthlyRequestDeductionService;

