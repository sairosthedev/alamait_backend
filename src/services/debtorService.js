const Debtor = require('../models/Debtor');
const User = require('../models/User');
const Residence = require('../models/Residence');
const Application = require('../models/Application');
const Lease = require('../models/Lease');
const Payment = require('../models/Payment');

/**
 * Automatically create a debtor account for a new student with full financial data
 * @param {Object} user - The user object (student)
 * @param {Object} options - Additional options
 * @param {string} options.residenceId - Residence ID if available
 * @param {string} options.roomNumber - Room number if available
 * @param {string} options.createdBy - User ID who created the student
 * @param {Date} options.startDate - Lease start date if available
 * @param {Date} options.endDate - Lease end date if available
 * @param {number} options.roomPrice - Room price if available
 * @returns {Promise<Object>} Created debtor object
 */
exports.createDebtorForStudent = async (user, options = {}) => {
    try {
        // Check if debtor already exists for this user
        const existingDebtor = await Debtor.findOne({ user: user._id });
        if (existingDebtor) {
            console.log(`Debtor already exists for user ${user.email}`);
            return existingDebtor;
        }

        // Generate debtor code and account code
        const debtorCode = await Debtor.generateDebtorCode();
        const accountCode = await Debtor.generateAccountCode();

        // Prepare contact info
        const contactInfo = {
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            phone: user.phone
        };

        // Initialize financial data
        let roomPrice = 0;
        let startDate = null;
        let endDate = null;
        let residenceId = options.residenceId;
        let roomNumber = options.roomNumber;

        // Try to get financial data from various sources
        try {
            // 1. Check for existing application
            const application = await Application.findOne({ student: user._id })
                .populate('residence', 'name rooms roomPrice');
            
            if (application) {
                console.log(`📝 Found application for ${user.email}`);
                startDate = application.startDate || options.startDate;
                endDate = application.endDate || options.endDate;
                roomPrice = application.roomPrice || 0;
                residenceId = residenceId || application.residence?._id;
                roomNumber = roomNumber || application.allocatedRoom || application.roomNumber;
                
                // If no room price from application, try residence
                if (!roomPrice && application.residence) {
                    roomPrice = application.residence.roomPrice || 0;
                    
                    // If still no room price, try to find it in rooms array
                    if (!roomPrice && application.residence.rooms && application.residence.rooms.length > 0) {
                        const room = application.residence.rooms.find(r => 
                            r.roomNumber === roomNumber || r.name === roomNumber
                        );
                        if (room && room.price) {
                            roomPrice = room.price;
                        }
                    }
                }
            }

            // 2. Check for existing lease if no application data
            if (!startDate || !endDate) {
                const lease = await Lease.findOne({ studentId: user._id });
                if (lease) {
                    console.log(`📄 Found lease for ${user.email}`);
                    startDate = startDate || lease.startDate;
                    endDate = endDate || lease.endDate;
                    residenceId = residenceId || lease.residence;
                    roomNumber = roomNumber || lease.room;
                }
            }

            // 3. Get residence data if we have residenceId but no room price
            if (residenceId && !roomPrice) {
                const residence = await Residence.findById(residenceId);
                if (residence) {
                    roomPrice = residence.roomPrice || 0;
                    
                    // Try to find room price in rooms array
                    if (!roomPrice && residence.rooms && residence.rooms.length > 0) {
                        const room = residence.rooms.find(r => 
                            r.roomNumber === roomNumber || r.name === roomNumber
                        );
                        if (room && room.price) {
                            roomPrice = room.price;
                        } else if (residence.rooms[0] && residence.rooms[0].price) {
                            // Use first room's price as fallback
                            roomPrice = residence.rooms[0].price;
                            roomNumber = roomNumber || residence.rooms[0].roomNumber || residence.rooms[0].name;
                        }
                    }
                }
            }

            // 4. Set default values if still no data
            if (!roomPrice) {
                roomPrice = options.roomPrice || 150; // Default room price
                console.log(`⚠️  Using default room price $${roomPrice} for ${user.email}`);
            }

            if (!startDate) {
                startDate = options.startDate || new Date(); // Default to current date
                console.log(`⚠️  Using current date as start date for ${user.email}`);
            }

            if (!endDate) {
                endDate = options.endDate || new Date(new Date().setMonth(new Date().getMonth() + 6)); // Default to 6 months
                console.log(`⚠️  Using 6-month default end date for ${user.email}`);
            }

        } catch (error) {
            console.error(`❌ Error gathering financial data for ${user.email}:`, error);
            // Continue with default values
            roomPrice = options.roomPrice || 150;
            startDate = options.startDate || new Date();
            endDate = options.endDate || new Date(new Date().setMonth(new Date().getMonth() + 6));
        }

        // Calculate billing period and expected total
        const billingPeriodMonths = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24 * 30.44));
        const expectedTotal = roomPrice * billingPeriodMonths;

        // Get existing payments for this student
        const payments = await Payment.find({
            student: user._id,
            status: { $in: ['verified', 'paid', 'confirmed'] }
        });

        // Calculate total paid
        const totalPaid = payments.reduce((sum, payment) => {
            let paymentTotal = 0;
            if (payment.rentAmount && payment.rentAmount > 0) paymentTotal += payment.rentAmount;
            if (payment.rent && payment.rent > 0) paymentTotal += payment.rent;
            if (payment.adminFee && payment.adminFee > 0) paymentTotal += payment.adminFee;
            if (payment.deposit && payment.deposit > 0) paymentTotal += payment.deposit;
            if (payment.amount && payment.amount > 0) paymentTotal += payment.amount;
            return sum + paymentTotal;
        }, 0);

        // Calculate current balance
        const currentBalance = Math.max(expectedTotal - totalPaid, 0);
        const overdueAmount = currentBalance > 0 ? currentBalance : 0;

        // Determine status
        let status = 'active';
        if (currentBalance === 0) {
            status = 'paid';
        } else if (currentBalance > 0 && new Date(endDate) < new Date()) {
            status = 'overdue';
        }

        // Create comprehensive billing period object
        const billingPeriodObject = {
            type: billingPeriodMonths === 3 ? 'quarterly' : 
                  billingPeriodMonths === 6 ? 'semester' : 
                  billingPeriodMonths === 12 ? 'annual' : 'monthly',
            
            duration: {
                value: billingPeriodMonths,
                unit: 'months'
            },
            
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            
            billingCycle: {
                frequency: 'monthly',
                dayOfMonth: 1,
                gracePeriod: 5
            },
            
            amount: {
                monthly: roomPrice,
                total: expectedTotal,
                currency: 'USD'
            },
            
            status: 'active',
            
            description: `Billing period for ${user.email}`,
            notes: `Auto-generated from application data`,
            
            autoRenewal: {
                enabled: false,
                renewalType: 'same_period',
                customRenewalPeriod: null
            }
        };

        // Create debtor object with full financial data
        const debtorData = {
            debtorCode,
            user: user._id,
            accountCode,
            status,
            currentBalance,
            totalOwed: expectedTotal,
            totalPaid,
            overdueAmount,
            creditLimit: roomPrice * 2, // 2 months credit limit
            paymentTerms: 'monthly',
            residence: residenceId,
            roomNumber,
            billingPeriod: billingPeriodObject,
            billingPeriodLegacy: `${billingPeriodMonths} months`, // For backward compatibility
            startDate,
            endDate,
            roomPrice,
            contactInfo,
            createdBy: options.createdBy || user._id
        };

        // Create the debtor
        const debtor = new Debtor(debtorData);
        await debtor.save();

        console.log(`✅ Debtor account created for student ${user.email}: ${debtorCode}`);
        console.log(`   Room Price: $${roomPrice}`);
        console.log(`   Billing Period: ${billingPeriodObject.type} (${billingPeriodMonths} months)`);
        console.log(`   Expected Total: $${expectedTotal}`);
        console.log(`   Total Paid: $${totalPaid}`);
        console.log(`   Current Balance: $${currentBalance}`);
        console.log(`   Status: ${status}`);

        return debtor;
    } catch (error) {
        console.error('Error creating debtor for student:', error);
        throw error;
    }
};

/**
 * Create debtor for existing students (migration function)
 * @param {string} userId - User ID to create debtor for
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Created debtor object
 */
exports.createDebtorForExistingStudent = async (userId, options = {}) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error(`User not found: ${userId}`);
        }

        if (user.role !== 'student') {
            throw new Error(`User is not a student: ${user.email}`);
        }

        return await exports.createDebtorForStudent(user, options);
    } catch (error) {
        console.error('Error creating debtor for existing student:', error);
        throw error;
    }
};

/**
 * Bulk create debtors for all existing students without debtor accounts
 * @param {Object} options - Additional options
 * @returns {Promise<Array>} Array of created debtors
 */
exports.createDebtorsForAllStudents = async (options = {}) => {
    try {
        // Find all students
        const students = await User.find({ role: 'student' });
        console.log(`Found ${students.length} students`);

        const createdDebtors = [];
        const errors = [];

        for (const student of students) {
            try {
                // Check if debtor already exists
                const existingDebtor = await Debtor.findOne({ user: student._id });
                if (existingDebtor) {
                    console.log(`Debtor already exists for ${student.email}`);
                    continue;
                }

                // Create debtor
                const debtor = await exports.createDebtorForStudent(student, {
                    ...options,
                    createdBy: options.createdBy || student._id
                });

                createdDebtors.push(debtor);
                console.log(`Created debtor for ${student.email}`);
            } catch (error) {
                console.error(`Error creating debtor for ${student.email}:`, error);
                errors.push({ student: student.email, error: error.message });
            }
        }

        console.log(`✅ Created ${createdDebtors.length} debtors`);
        if (errors.length > 0) {
            console.log(`❌ ${errors.length} errors occurred:`, errors);
        }

        return { createdDebtors, errors };
    } catch (error) {
        console.error('Error in bulk debtor creation:', error);
        throw error;
    }
};

/**
 * Update debtor when student's residence/room changes
 * @param {string} userId - User ID
 * @param {Object} updates - Updates to apply
 * @returns {Promise<Object>} Updated debtor object
 */
exports.updateDebtorForStudent = async (userId, updates = {}) => {
    try {
        const debtor = await Debtor.findOne({ user: userId });
        if (!debtor) {
            throw new Error(`Debtor not found for user: ${userId}`);
        }

        // Update allowed fields
        if (updates.residence) {
            debtor.residence = updates.residence;
        }
        if (updates.roomNumber) {
            debtor.roomNumber = updates.roomNumber;
        }
        if (updates.status) {
            debtor.status = updates.status;
        }

        // Update contact info if user details changed
        if (updates.contactInfo) {
            debtor.contactInfo = { ...debtor.contactInfo, ...updates.contactInfo };
        }

        debtor.updatedBy = updates.updatedBy || userId;
        await debtor.save();

        console.log(`✅ Updated debtor for user ${userId}`);
        return debtor;
    } catch (error) {
        console.error('Error updating debtor for student:', error);
        throw error;
    }
};

/**
 * Get debtor for a student
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Debtor object or null
 */
exports.getDebtorForStudent = async (userId) => {
    try {
        const debtor = await Debtor.findOne({ user: userId })
            .populate('user', 'firstName lastName email phone')
            .populate('residence', 'name address')
            .populate('createdBy', 'firstName lastName email');

        return debtor;
    } catch (error) {
        console.error('Error getting debtor for student:', error);
        throw error;
    }
};

/**
 * Check if student has a debtor account
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if debtor exists
 */
exports.studentHasDebtor = async (userId) => {
    try {
        const debtor = await Debtor.findOne({ user: userId });
        return !!debtor;
    } catch (error) {
        console.error('Error checking if student has debtor:', error);
        throw error;
    }
}; 