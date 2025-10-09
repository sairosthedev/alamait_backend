const { Residence } = require('../models/Residence');

/**
 * Service for calculating residence-specific payment amounts and requirements
 */
class ResidencePaymentService {
    
    /**
     * Get payment configuration for a residence
     * @param {string} residenceId - Residence ID
     * @returns {Promise<Object>} Payment configuration
     */
    static async getPaymentConfiguration(residenceId) {
        try {
            const residence = await Residence.findById(residenceId).select('paymentConfiguration name');
            if (!residence) {
                throw new Error('Residence not found');
            }
            
            return {
                residenceId,
                residenceName: residence.name,
                configuration: residence.paymentConfiguration || this.getDefaultConfiguration()
            };
        } catch (error) {
            console.error('Error getting payment configuration:', error);
            throw error;
        }
    }
    
    /**
     * Update payment configuration for a residence
     * @param {string} residenceId - Residence ID
     * @param {Object} paymentConfig - Payment configuration
     * @returns {Promise<Object>} Updated configuration
     */
    static async updatePaymentConfiguration(residenceId, paymentConfig) {
        try {
            const residence = await Residence.findById(residenceId);
            if (!residence) {
                throw new Error('Residence not found');
            }
            
            // Validate and merge configuration
            const validatedConfig = this.validatePaymentConfiguration(paymentConfig);
            residence.paymentConfiguration = validatedConfig;
            
            await residence.save();
            
            return {
                success: true,
                residenceId,
                residenceName: residence.name,
                configuration: residence.paymentConfiguration
            };
        } catch (error) {
            console.error('Error updating payment configuration:', error);
            throw error;
        }
    }
    
    /**
     * Calculate payment amounts for a specific student and residence
     * @param {string} residenceId - Residence ID
     * @param {Object} room - Room object with price
     * @param {Date} startDate - Lease start date
     * @param {Date} endDate - Lease end date
     * @param {number} currentMonth - Current month (1-12)
     * @param {number} currentYear - Current year
     * @returns {Promise<Object>} Payment breakdown
     */
    static async calculatePaymentAmounts(residenceId, room, startDate, endDate, currentMonth, currentYear) {
        try {
            const residence = await Residence.findById(residenceId).select('paymentConfiguration name');
            if (!residence) {
                throw new Error('Residence not found');
            }
            
            const config = residence.paymentConfiguration || this.getDefaultConfiguration();
            const roomPrice = room.price || 0;
            
            const leaseStartMonth = new Date(startDate).getMonth() + 1;
            const leaseStartYear = new Date(startDate).getFullYear();
            const leaseEndMonth = new Date(endDate).getMonth() + 1;
            const leaseEndYear = new Date(endDate).getFullYear();
            
            const paymentBreakdown = {
                residenceId,
                residenceName: residence.name,
                roomPrice,
                currentMonth,
                currentYear,
                leaseStartMonth,
                leaseStartYear,
                leaseEndMonth,
                leaseEndYear,
                amounts: {
                    rent: roomPrice,
                    adminFee: 0,
                    deposit: 0,
                    utilities: 0,
                    maintenance: 0
                },
                breakdown: {}
            };
            
            // Calculate Admin Fee
            if (config.adminFee.enabled) {
                paymentBreakdown.amounts.adminFee = this.calculateAdminFee(
                    config.adminFee, 
                    roomPrice, 
                    currentMonth, 
                    currentYear, 
                    leaseStartMonth, 
                    leaseStartYear
                );
                paymentBreakdown.breakdown.adminFee = {
                    amount: paymentBreakdown.amounts.adminFee,
                    description: config.adminFee.description,
                    application: config.adminFee.application,
                    enabled: config.adminFee.enabled
                };
            }
            
            // Calculate Deposit
            if (config.deposit.enabled) {
                paymentBreakdown.amounts.deposit = this.calculateDeposit(
                    config.deposit,
                    roomPrice,
                    currentMonth,
                    currentYear,
                    leaseStartMonth,
                    leaseStartYear,
                    leaseEndMonth,
                    leaseEndYear
                );
                paymentBreakdown.breakdown.deposit = {
                    amount: paymentBreakdown.amounts.deposit,
                    description: config.deposit.description,
                    calculation: config.deposit.calculation,
                    application: config.deposit.application,
                    enabled: config.deposit.enabled
                };
            }
            
            // Calculate Utilities
            if (config.utilities.enabled) {
                paymentBreakdown.amounts.utilities = this.calculateUtilities(
                    config.utilities,
                    currentMonth,
                    currentYear,
                    leaseStartMonth,
                    leaseStartYear
                );
                paymentBreakdown.breakdown.utilities = {
                    amount: paymentBreakdown.amounts.utilities,
                    description: config.utilities.description,
                    application: config.utilities.application,
                    enabled: config.utilities.enabled
                };
            }
            
            // Calculate Maintenance
            if (config.maintenance.enabled) {
                paymentBreakdown.amounts.maintenance = this.calculateMaintenance(
                    config.maintenance,
                    currentMonth,
                    currentYear,
                    leaseStartMonth,
                    leaseStartYear
                );
                paymentBreakdown.breakdown.maintenance = {
                    amount: paymentBreakdown.amounts.maintenance,
                    description: config.maintenance.description,
                    application: config.maintenance.application,
                    enabled: config.maintenance.enabled
                };
            }
            
            // Calculate total
            paymentBreakdown.total = Object.values(paymentBreakdown.amounts).reduce((sum, amount) => sum + amount, 0);
            
            return paymentBreakdown;
        } catch (error) {
            console.error('Error calculating payment amounts:', error);
            throw error;
        }
    }
    
    /**
     * Calculate admin fee amount based on configuration
     */
    static calculateAdminFee(config, roomPrice, currentMonth, currentYear, leaseStartMonth, leaseStartYear) {
        if (!config.enabled || config.amount <= 0) return 0;
        
        switch (config.application) {
            case 'first_month':
                return (currentMonth === leaseStartMonth && currentYear === leaseStartYear) ? config.amount : 0;
            case 'every_month':
                return config.amount;
            case 'upfront':
                return (currentMonth === leaseStartMonth && currentYear === leaseStartYear) ? config.amount : 0;
            case 'last_month':
                return config.amount; // Will be handled by calling function
            default:
                return 0;
        }
    }
    
    /**
     * Calculate deposit amount based on configuration
     */
    static calculateDeposit(config, roomPrice, currentMonth, currentYear, leaseStartMonth, leaseStartYear, leaseEndMonth, leaseEndYear) {
        if (!config.enabled) return 0;
        
        let depositAmount = 0;
        
        // Calculate base deposit amount
        switch (config.calculation) {
            case 'fixed_amount':
                depositAmount = config.amount;
                break;
            case 'one_month_rent':
                depositAmount = roomPrice;
                break;
            case 'percentage_of_rent':
                depositAmount = (roomPrice * config.percentage) / 100;
                break;
            case 'custom':
                depositAmount = config.amount;
                break;
            default:
                depositAmount = roomPrice; // Default to one month's rent
        }
        
        // Determine when deposit is applied
        switch (config.application) {
            case 'upfront':
                return (currentMonth === leaseStartMonth && currentYear === leaseStartYear) ? depositAmount : 0;
            case 'last_month':
                return (currentMonth === leaseEndMonth && currentYear === leaseEndYear) ? depositAmount : 0;
            case 'first_month':
                return (currentMonth === leaseStartMonth && currentYear === leaseStartYear) ? depositAmount : 0;
            case 'split_months':
                // For now, apply in first month - can be enhanced later
                return (currentMonth === leaseStartMonth && currentYear === leaseStartYear) ? depositAmount : 0;
            default:
                return depositAmount;
        }
    }
    
    /**
     * Calculate utilities fee amount based on configuration
     */
    static calculateUtilities(config, currentMonth, currentYear, leaseStartMonth, leaseStartYear) {
        if (!config.enabled || config.amount <= 0) return 0;
        
        switch (config.application) {
            case 'every_month':
                return config.amount;
            case 'first_month':
                return (currentMonth === leaseStartMonth && currentYear === leaseStartYear) ? config.amount : 0;
            case 'last_month':
                return config.amount; // Will be handled by calling function
            case 'upfront':
                return (currentMonth === leaseStartMonth && currentYear === leaseStartYear) ? config.amount : 0;
            default:
                return 0;
        }
    }
    
    /**
     * Calculate maintenance fee amount based on configuration
     */
    static calculateMaintenance(config, currentMonth, currentYear, leaseStartMonth, leaseStartYear) {
        if (!config.enabled || config.amount <= 0) return 0;
        
        switch (config.application) {
            case 'every_month':
                return config.amount;
            case 'first_month':
                return (currentMonth === leaseStartMonth && currentYear === leaseStartYear) ? config.amount : 0;
            case 'last_month':
                return config.amount; // Will be handled by calling function
            case 'upfront':
                return (currentMonth === leaseStartMonth && currentYear === leaseStartYear) ? config.amount : 0;
            default:
                return 0;
        }
    }
    
    /**
     * Validate payment configuration
     */
    static validatePaymentConfiguration(config) {
        const validated = {
            adminFee: {
                enabled: Boolean(config.adminFee?.enabled),
                amount: Math.max(0, Number(config.adminFee?.amount) || 0),
                description: String(config.adminFee?.description || 'Administration fee'),
                application: config.adminFee?.application || 'first_month'
            },
            deposit: {
                enabled: Boolean(config.deposit?.enabled),
                amount: Math.max(0, Number(config.deposit?.amount) || 0),
                calculation: config.deposit?.calculation || 'one_month_rent',
                percentage: Math.min(1000, Math.max(0, Number(config.deposit?.percentage) || 100)),
                description: String(config.deposit?.description || 'Security deposit'),
                application: config.deposit?.application || 'upfront'
            },
            utilities: {
                enabled: Boolean(config.utilities?.enabled),
                amount: Math.max(0, Number(config.utilities?.amount) || 0),
                description: String(config.utilities?.description || 'Utilities fee'),
                application: config.utilities?.application || 'every_month'
            },
            maintenance: {
                enabled: Boolean(config.maintenance?.enabled),
                amount: Math.max(0, Number(config.maintenance?.amount) || 0),
                description: String(config.maintenance?.description || 'Maintenance fee'),
                application: config.maintenance?.application || 'every_month'
            }
        };
        
        return validated;
    }
    
    /**
     * Get default payment configuration
     */
    static getDefaultConfiguration() {
        return {
            adminFee: {
                enabled: false,
                amount: 0,
                description: 'Administration fee',
                application: 'first_month'
            },
            deposit: {
                enabled: true,
                amount: 0,
                calculation: 'one_month_rent',
                percentage: 100,
                description: 'Security deposit',
                application: 'upfront'
            },
            utilities: {
                enabled: false,
                amount: 0,
                description: 'Utilities fee',
                application: 'every_month'
            },
            maintenance: {
                enabled: false,
                amount: 0,
                description: 'Maintenance fee',
                application: 'every_month'
            }
        };
    }
    
    /**
     * Get all residences with their payment configurations
     */
    static async getAllResidencePaymentConfigurations() {
        try {
            const residences = await Residence.find({ status: 'active' })
                .select('name paymentConfiguration status')
                .sort({ name: 1 });
            
            return residences.map(residence => ({
                residenceId: residence._id,
                residenceName: residence.name,
                status: residence.status,
                configuration: residence.paymentConfiguration || this.getDefaultConfiguration()
            }));
        } catch (error) {
            console.error('Error getting all residence payment configurations:', error);
            throw error;
        }
    }
}

module.exports = ResidencePaymentService;
