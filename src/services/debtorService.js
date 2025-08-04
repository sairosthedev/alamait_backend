const Debtor = require('../models/Debtor');
const User = require('../models/User');
const Residence = require('../models/Residence');

/**
 * Automatically create a debtor account for a new student
 * @param {Object} user - The user object (student)
 * @param {Object} options - Additional options
 * @param {string} options.residenceId - Residence ID if available
 * @param {string} options.roomNumber - Room number if available
 * @param {string} options.createdBy - User ID who created the student
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

        // Create debtor object
        const debtorData = {
            debtorCode,
            user: user._id,
            accountCode,
            status: 'active',
            contactInfo,
            createdBy: options.createdBy || user._id
        };

        // Add residence info if provided
        if (options.residenceId) {
            debtorData.residence = options.residenceId;
        }

        // Add room number if provided
        if (options.roomNumber) {
            debtorData.roomNumber = options.roomNumber;
        }

        // Create the debtor
        const debtor = new Debtor(debtorData);
        await debtor.save();

        console.log(`✅ Debtor account created for student ${user.email}: ${debtorCode}`);

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