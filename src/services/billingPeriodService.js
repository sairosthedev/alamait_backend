/**
 * Billing Period Service
 * Handles operations for the new billing period object structure
 */

const mongoose = require('mongoose');

/**
 * Calculate billing period duration in days
 * @param {Object} billingPeriod - Billing period object
 * @returns {number} Duration in days
 */
exports.calculateDurationInDays = (billingPeriod) => {
    if (!billingPeriod || !billingPeriod.duration) {
        return 0;
    }

    const { value, unit } = billingPeriod.duration;
    
    switch (unit) {
        case 'years':
            return value * 365;
        case 'months':
            return value * 30.44; // Average days per month
        case 'weeks':
            return value * 7;
        case 'days':
            return value;
        default:
            return value * 30.44;
    }
};

/**
 * Calculate total amount for billing period
 * @param {Object} billingPeriod - Billing period object
 * @returns {number} Total amount
 */
exports.calculateTotalAmount = (billingPeriod) => {
    if (!billingPeriod || !billingPeriod.amount) {
        return 0;
    }

    const { monthly, total } = billingPeriod.amount;
    
    // If total is already calculated, use it
    if (total && total > 0) {
        return total;
    }

    // Calculate based on duration
    const durationInMonths = this.calculateDurationInMonths(billingPeriod);
    return monthly * durationInMonths;
};

/**
 * Calculate billing period duration in months
 * @param {Object} billingPeriod - Billing period object
 * @returns {number} Duration in months
 */
exports.calculateDurationInMonths = (billingPeriod) => {
    if (!billingPeriod || !billingPeriod.duration) {
        return 0;
    }

    const { value, unit } = billingPeriod.duration;
    
    switch (unit) {
        case 'years':
            return value * 12;
        case 'months':
            return value;
        case 'weeks':
            return value / 4.33; // Approximate weeks per month
        case 'days':
            return value / 30.44; // Approximate days per month
        default:
            return value;
    }
};

/**
 * Check if billing period is overdue
 * @param {Object} billingPeriod - Billing period object
 * @returns {boolean} True if overdue
 */
exports.isOverdue = (billingPeriod) => {
    if (!billingPeriod || !billingPeriod.endDate) {
        return false;
    }

    const endDate = new Date(billingPeriod.endDate);
    const gracePeriod = billingPeriod.billingCycle?.gracePeriod || 0;
    const graceDate = new Date(endDate.getTime() + (gracePeriod * 24 * 60 * 60 * 1000));
    
    return new Date() > graceDate;
};

/**
 * Get next billing date
 * @param {Object} billingPeriod - Billing period object
 * @returns {Date} Next billing date
 */
exports.getNextBillingDate = (billingPeriod) => {
    if (!billingPeriod || !billingPeriod.billingCycle) {
        return null;
    }

    const { frequency, dayOfMonth } = billingPeriod.billingCycle;
    const now = new Date();
    
    switch (frequency) {
        case 'weekly':
            return new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
        case 'bi-weekly':
            return new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000));
        case 'monthly':
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth);
            return nextMonth;
        case 'quarterly':
            const nextQuarter = new Date(now.getFullYear(), now.getMonth() + 3, dayOfMonth);
            return nextQuarter;
        case 'annual':
            const nextYear = new Date(now.getFullYear() + 1, now.getMonth(), dayOfMonth);
            return nextYear;
        default:
            return new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
    }
};

/**
 * Create a new billing period object
 * @param {Object} options - Billing period options
 * @returns {Object} Billing period object
 */
exports.createBillingPeriod = (options = {}) => {
    const {
        type = 'monthly',
        duration = { value: 6, unit: 'months' },
        startDate = new Date(),
        endDate,
        monthlyAmount = 0,
        billingCycle = {
            frequency: 'monthly',
            dayOfMonth: 1,
            gracePeriod: 5
        },
        description = '',
        notes = '',
        autoRenewal = {
            enabled: false,
            renewalType: 'same_period',
            customRenewalPeriod: null
        }
    } = options;

    // Calculate end date if not provided
    const calculatedEndDate = endDate || this.calculateEndDate(startDate, duration);
    
    // Calculate total amount
    const totalAmount = this.calculateTotalAmount({
        duration,
        amount: { monthly: monthlyAmount }
    });

    return {
        type,
        duration,
        startDate: new Date(startDate),
        endDate: new Date(calculatedEndDate),
        billingCycle,
        amount: {
            monthly: monthlyAmount,
            total: totalAmount,
            currency: 'USD'
        },
        status: 'active',
        description,
        notes,
        autoRenewal
    };
};

/**
 * Calculate end date based on start date and duration
 * @param {Date} startDate - Start date
 * @param {Object} duration - Duration object
 * @returns {Date} End date
 */
exports.calculateEndDate = (startDate, duration) => {
    const start = new Date(startDate);
    const { value, unit } = duration;
    
    switch (unit) {
        case 'years':
            return new Date(start.setFullYear(start.getFullYear() + value));
        case 'months':
            return new Date(start.setMonth(start.getMonth() + value));
        case 'weeks':
            return new Date(start.setDate(start.getDate() + (value * 7)));
        case 'days':
            return new Date(start.setDate(start.getDate() + value));
        default:
            return new Date(start.setMonth(start.getMonth() + value));
    }
};

/**
 * Validate billing period object
 * @param {Object} billingPeriod - Billing period object
 * @returns {Object} Validation result
 */
exports.validateBillingPeriod = (billingPeriod) => {
    const errors = [];

    if (!billingPeriod) {
        errors.push('Billing period is required');
        return { isValid: false, errors };
    }

    // Validate required fields
    if (!billingPeriod.type) {
        errors.push('Billing period type is required');
    }

    if (!billingPeriod.duration || !billingPeriod.duration.value || !billingPeriod.duration.unit) {
        errors.push('Duration with value and unit is required');
    }

    if (!billingPeriod.startDate) {
        errors.push('Start date is required');
    }

    if (!billingPeriod.endDate) {
        errors.push('End date is required');
    }

    if (!billingPeriod.amount || !billingPeriod.amount.monthly) {
        errors.push('Monthly amount is required');
    }

    // Validate date logic
    if (billingPeriod.startDate && billingPeriod.endDate) {
        const start = new Date(billingPeriod.startDate);
        const end = new Date(billingPeriod.endDate);
        
        if (end <= start) {
            errors.push('End date must be after start date');
        }
    }

    // Validate amount logic
    if (billingPeriod.amount && billingPeriod.amount.monthly < 0) {
        errors.push('Monthly amount cannot be negative');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Get billing period summary
 * @param {Object} billingPeriod - Billing period object
 * @returns {Object} Summary object
 */
exports.getBillingPeriodSummary = (billingPeriod) => {
    if (!billingPeriod) {
        return null;
    }

    const durationInDays = this.calculateDurationInDays(billingPeriod);
    const durationInMonths = this.calculateDurationInMonths(billingPeriod);
    const totalAmount = this.calculateTotalAmount(billingPeriod);
    const isOverdue = this.isOverdue(billingPeriod);
    const nextBillingDate = this.getNextBillingDate(billingPeriod);

    return {
        type: billingPeriod.type,
        duration: {
            ...billingPeriod.duration,
            inDays: durationInDays,
            inMonths: durationInMonths
        },
        amount: {
            ...billingPeriod.amount,
            total: totalAmount
        },
        status: billingPeriod.status,
        isOverdue,
        nextBillingDate,
        progress: this.calculateProgress(billingPeriod)
    };
};

/**
 * Calculate progress of billing period
 * @param {Object} billingPeriod - Billing period object
 * @returns {Object} Progress object
 */
exports.calculateProgress = (billingPeriod) => {
    if (!billingPeriod || !billingPeriod.startDate || !billingPeriod.endDate) {
        return { percentage: 0, daysRemaining: 0, daysElapsed: 0 };
    }

    const start = new Date(billingPeriod.startDate);
    const end = new Date(billingPeriod.endDate);
    const now = new Date();

    const totalDuration = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    
    const percentage = Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100);
    const daysRemaining = Math.max((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24), 0);
    const daysElapsed = Math.max((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24), 0);

    return {
        percentage: Math.round(percentage * 100) / 100,
        daysRemaining: Math.round(daysRemaining),
        daysElapsed: Math.round(daysElapsed)
    };
};

/**
 * Renew billing period
 * @param {Object} billingPeriod - Current billing period object
 * @param {Object} options - Renewal options
 * @returns {Object} New billing period object
 */
exports.renewBillingPeriod = (billingPeriod, options = {}) => {
    if (!billingPeriod || !billingPeriod.autoRenewal || !billingPeriod.autoRenewal.enabled) {
        throw new Error('Auto-renewal is not enabled for this billing period');
    }

    const { renewalType, customRenewalPeriod } = billingPeriod.autoRenewal;
    
    let newDuration = billingPeriod.duration;
    
    if (renewalType === 'custom_period' && customRenewalPeriod) {
        newDuration = customRenewalPeriod;
    }

    const newStartDate = new Date(billingPeriod.endDate);
    const newEndDate = this.calculateEndDate(newStartDate, newDuration);

    return this.createBillingPeriod({
        type: billingPeriod.type,
        duration: newDuration,
        startDate: newStartDate,
        endDate: newEndDate,
        monthlyAmount: billingPeriod.amount.monthly,
        billingCycle: billingPeriod.billingCycle,
        description: `Renewal of ${billingPeriod.description}`,
        notes: `Auto-renewed from previous period ending ${billingPeriod.endDate}`,
        autoRenewal: billingPeriod.autoRenewal
    });
};

module.exports = exports;
