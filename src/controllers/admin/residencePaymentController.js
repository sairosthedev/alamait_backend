const ResidencePaymentService = require('../../services/residencePaymentService');
const { validationResult } = require('express-validator');

/**
 * Get payment configuration for a specific residence
 */
exports.getResidencePaymentConfiguration = async (req, res) => {
    try {
        const { residenceId } = req.params;
        
        const configuration = await ResidencePaymentService.getPaymentConfiguration(residenceId);
        
        res.status(200).json({
            success: true,
            data: configuration
        });
    } catch (error) {
        console.error('Error in getResidencePaymentConfiguration:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching residence payment configuration',
            error: error.message
        });
    }
};

/**
 * Update payment configuration for a specific residence
 */
exports.updateResidencePaymentConfiguration = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { residenceId } = req.params;
        const { paymentConfiguration } = req.body;
        
        const result = await ResidencePaymentService.updatePaymentConfiguration(residenceId, paymentConfiguration);
        
        res.status(200).json({
            success: true,
            data: result,
            message: 'Residence payment configuration updated successfully'
        });
    } catch (error) {
        console.error('Error in updateResidencePaymentConfiguration:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating residence payment configuration',
            error: error.message
        });
    }
};

/**
 * Calculate payment amounts for a residence and room
 */
exports.calculatePaymentAmounts = async (req, res) => {
    try {
        const { residenceId } = req.params;
        const { room, startDate, endDate, currentMonth, currentYear } = req.body;
        
        // Validate required fields
        if (!room || !startDate || !endDate || !currentMonth || !currentYear) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: room, startDate, endDate, currentMonth, currentYear'
            });
        }
        
        const paymentBreakdown = await ResidencePaymentService.calculatePaymentAmounts(
            residenceId,
            room,
            startDate,
            endDate,
            currentMonth,
            currentYear
        );
        
        res.status(200).json({
            success: true,
            data: paymentBreakdown
        });
    } catch (error) {
        console.error('Error in calculatePaymentAmounts:', error);
        res.status(500).json({
            success: false,
            message: 'Error calculating payment amounts',
            error: error.message
        });
    }
};

/**
 * Get all residences with their payment configurations
 */
exports.getAllResidencePaymentConfigurations = async (req, res) => {
    try {
        const configurations = await ResidencePaymentService.getAllResidencePaymentConfigurations();
        
        res.status(200).json({
            success: true,
            count: configurations.length,
            data: configurations
        });
    } catch (error) {
        console.error('Error in getAllResidencePaymentConfigurations:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching residence payment configurations',
            error: error.message
        });
    }
};

/**
 * Apply default payment configurations to a residence
 */
exports.applyDefaultPaymentConfiguration = async (req, res) => {
    try {
        const { residenceId } = req.params;
        const { residenceType } = req.body;
        
        let defaultConfig;
        
        // Define default configurations for different residence types
        switch (residenceType?.toLowerCase()) {
            case 'st_kilda':
                defaultConfig = {
                    adminFee: {
                        enabled: true,
                        amount: 20,
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
                break;
                
            case 'belvedere':
                defaultConfig = {
                    adminFee: {
                        enabled: false,
                        amount: 0,
                        description: 'Administration fee',
                        application: 'first_month'
                    },
                    deposit: {
                        enabled: false,
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
                break;
                
            case 'newlands':
                defaultConfig = {
                    adminFee: {
                        enabled: true,
                        amount: 15,
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
                break;
                
            default:
                defaultConfig = ResidencePaymentService.getDefaultConfiguration();
        }
        
        const result = await ResidencePaymentService.updatePaymentConfiguration(residenceId, defaultConfig);
        
        res.status(200).json({
            success: true,
            data: result,
            message: `Default ${residenceType || 'standard'} payment configuration applied successfully`
        });
    } catch (error) {
        console.error('Error in applyDefaultPaymentConfiguration:', error);
        res.status(500).json({
            success: false,
            message: 'Error applying default payment configuration',
            error: error.message
        });
    }
};
