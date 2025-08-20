const Debtor = require('../models/Debtor');
const User = require('../models/User');
const Residence = require('../models/Residence');
const Application = require('../models/Application');
const Lease = require('../models/Lease');
const Payment = require('../models/Payment');

/**
 * Automatically create a debtor account for a new student with full financial data
 * @param {Object} user - The user object (student) OR application object
 * @param {Object} options - Additional options
 * @param {string} options.residenceId - Residence ID if available
 * @param {string} options.roomNumber - Room number if available
 * @param {string} options.createdBy - User ID who created the student
 * @param {Date} options.startDate - Lease start date if available
 * @param {Date} options.endDate - Lease end date if available
 * @param {number} options.roomPrice - Room price if available
 * @param {string} options.application - Application ID if available
 * @param {string} options.applicationCode - Application code if available
 * @returns {Promise<Object>} Created debtor object
 */
exports.createDebtorForStudent = async (user, options = {}) => {
    try {
        let actualUser = user;
        let application = null;
        
        // If we have an application code, find the user by it
        if (options.applicationCode) {
            console.log(`🔍 Looking for user with application code: ${options.applicationCode}`);
            
            // Find user by application code
            const userByCode = await User.findOne({ applicationCode: options.applicationCode });
            if (userByCode) {
                actualUser = userByCode;
                console.log(`✅ Found user by application code: ${actualUser.email}`);
            } else {
                console.log(`⚠️  No user found with application code: ${options.applicationCode}`);
                // Continue with the provided user object
            }
        }
        
        // If we have an application ID, get the application data
        if (options.application) {
            application = await Application.findById(options.application).populate('residence', 'name rooms');
            if (application) {
                console.log(`📋 Found application: ${application._id} (${application.status})`);
                console.log(`   Residence: ${application.residence ? application.residence.name : 'Not set'}`);
                console.log(`   Room: ${application.allocatedRoom || 'Not set'}`);
                console.log(`   Start Date: ${application.startDate || 'Not set'}`);
                console.log(`   End Date: ${application.endDate || 'Not set'}`);
            } else {
                console.log(`⚠️  Application ID provided but not found: ${options.application}`);
            }
        }
        
        // Check if debtor already exists for this user
        const existingDebtor = await Debtor.findOne({ user: actualUser._id });
        if (existingDebtor) {
            console.log(`Debtor already exists for user ${actualUser.email} - updating with new data`);
            
            // Update existing debtor with new application data
            const updateData = {};
            
            if (options.residenceId && !existingDebtor.residence) {
                updateData.residence = options.residenceId;
                console.log(`   📍 Updating residence: ${options.residenceId}`);
            }
            
            if (options.roomNumber && !existingDebtor.roomNumber) {
                updateData.roomNumber = options.roomNumber;
                console.log(`   🏠 Updating room: ${options.roomNumber}`);
            }
            
            if (options.roomPrice && existingDebtor.roomPrice !== options.roomPrice) {
                updateData.roomPrice = options.roomPrice;
                console.log(`   💰 Updating room price: $${options.roomPrice}`);
            }
            
            // Update application linking if provided
            if (options.application && !existingDebtor.application) {
                updateData.application = options.application;
                console.log(`   🔗 Linking to application: ${options.application}`);
            }
            
            if (options.applicationCode && !existingDebtor.applicationCode) {
                updateData.applicationCode = options.applicationCode;
                console.log(`   🔗 Linking to application code: ${options.applicationCode}`);
            }
            
            if (options.startDate && options.endDate) {
                // Recalculate billing period
                const billingPeriodMonths = Math.ceil((new Date(options.endDate) - new Date(options.startDate)) / (1000 * 60 * 60 * 24 * 30.44));
                
                // Determine admin fee based on residence
                let adminFee = 0;
                if (options.residenceId) {
                    try {
                        const residence = await Residence.findById(options.residenceId);
                        if (residence && residence.name.toLowerCase().includes('st kilda')) {
                            adminFee = 20; // St Kilda has $20 admin fee
                        }
                    } catch (error) {
                        console.log(`⚠️  Could not determine admin fee: ${error.message}`);
                    }
                }
                
                // Calculate deposit (typically 1 month's rent)
                const deposit = options.roomPrice || 0;
                
                // Calculate total owed: (Room Price × Months) + Admin Fee + Deposit
                const totalRent = (options.roomPrice || 0) * billingPeriodMonths;
                const expectedTotal = totalRent + adminFee + deposit;
                
                updateData.billingPeriod = {
                    type: billingPeriodMonths === 3 ? 'quarterly' : 
                          billingPeriodMonths === 6 ? 'semester' : 
                          billingPeriodMonths === 12 ? 'annual' : 'monthly',
                    duration: {
                        value: billingPeriodMonths,
                        unit: 'months'
                    },
                    startDate: new Date(options.startDate),
                    endDate: new Date(options.endDate),
                    billingCycle: {
                        frequency: 'monthly',
                        dayOfMonth: 1,
                        gracePeriod: 5
                    },
                    amount: {
                        monthly: options.roomPrice,
                        total: expectedTotal,
                        currency: 'USD'
                    },
                    status: 'active',
                    description: `Billing period for ${actualUser.email}`,
                    notes: options.applicationCode ? 
                        `Updated from approved application ${options.applicationCode}` : 
                        `Updated from application data`,
                    autoRenewal: {
                        enabled: false,
                        renewalType: 'same_period',
                        customRenewalPeriod: null
                    }
                };
                
                updateData.totalOwed = expectedTotal;
                updateData.currentBalance = Math.max(expectedTotal - (existingDebtor.totalPaid || 0), 0);
                updateData.billingPeriodLegacy = `${billingPeriodMonths} months`;
                updateData.startDate = options.startDate;
                updateData.endDate = options.endDate;
                
                // Add financial breakdown
                updateData.financialBreakdown = {
                    monthlyRent: options.roomPrice || 0,
                    numberOfMonths: billingPeriodMonths,
                    totalRent: totalRent,
                    adminFee: adminFee,
                    deposit: deposit,
                    totalOwed: expectedTotal
                };
                
                console.log(`   📅 Updating billing period: ${billingPeriodMonths} months`);
                console.log(`   💰 Updating total owed: $${expectedTotal}`);
            }
            
            // Update the existing debtor if we have new data
            if (Object.keys(updateData).length > 0) {
                await Debtor.findByIdAndUpdate(existingDebtor._id, updateData);
                console.log(`✅ Updated existing debtor with new application data`);
                
                // Return the updated debtor
                return await Debtor.findById(existingDebtor._id);
            } else {
                console.log(`✅ Existing debtor already has all current data`);
                return existingDebtor;
            }
        }

        // Generate debtor code and account code
        const debtorCode = await Debtor.generateDebtorCode();
        const accountCode = await Debtor.generateAccountCode();

        // Prepare contact info
        const contactInfo = {
            name: `${actualUser.firstName} ${actualUser.lastName}`,
            email: actualUser.email,
            phone: actualUser.phone
        };

        // Initialize financial data
        let roomPrice = 0;
        let startDate = null;
        let endDate = null;
        let residenceId = options.residenceId;
        let roomNumber = options.roomNumber;

        // Try to get financial data from various sources
        try {
            // 1. Check for existing application (PRIORITY: Use application data first)
            if (application) {
                console.log(`📝 Using provided application data for ${actualUser.email}`);
                
                // Use application dates as primary source
                if (application.startDate && application.endDate) {
                    startDate = application.startDate;
                    endDate = application.endDate;
                    console.log(`   📅 Using application dates: ${startDate.toDateString()} to ${endDate.toDateString()}`);
                }
                
                // Extract residence and room data from application
                if (application.residence) {
                    residenceId = application.residence._id;
                    console.log(`   📍 Residence: ${application.residence.name}`);
                    
                    // Extract room number from application (prioritize allocated room)
                    roomNumber = application.allocatedRoom || application.preferredRoom || application.roomNumber;
                    if (roomNumber) {
                        console.log(`   🏠 Room: ${roomNumber}`);
                        
                        // Find room price from residence rooms array
                        if (application.residence.rooms && application.residence.rooms.length > 0) {
                            const room = application.residence.rooms.find(r => 
                                r.roomNumber === roomNumber || r.name === roomNumber
                            );
                            if (room && room.price) {
                                roomPrice = room.price;
                                console.log(`   💰 Room Price: $${roomPrice}`);
                            } else {
                                console.log(`   ⚠️  Room price not found for ${roomNumber}`);
                            }
                        }
                    }
                }
            } else {
                // Try to find application by user ID
                const foundApplication = await Application.findOne({ 
                    student: actualUser._id,
                    status: 'approved' // Only use approved applications for debtor creation
                }).populate('residence', 'name rooms');
                
                if (foundApplication) {
                    console.log(`📝 Found APPROVED application for ${actualUser.email}`);
                    application = foundApplication;
                    
                    // Use application dates as primary source
                    if (foundApplication.startDate && foundApplication.endDate) {
                        startDate = foundApplication.startDate;
                        endDate = foundApplication.endDate;
                        console.log(`   📅 Using application dates: ${startDate.toDateString()} to ${endDate.toDateString()}`);
                    }
                    
                    // Extract residence and room data from application
                    if (foundApplication.residence) {
                        residenceId = foundApplication.residence._id;
                        console.log(`   📍 Residence: ${foundApplication.residence.name}`);
                        
                        // Extract room number from application (prioritize allocated room)
                        roomNumber = foundApplication.allocatedRoom || foundApplication.preferredRoom || foundApplication.roomNumber;
                        if (roomNumber) {
                            console.log(`   🏠 Room: ${roomNumber}`);
                            
                            // Find room price from residence rooms array
                            if (foundApplication.residence.rooms && foundApplication.residence.rooms.length > 0) {
                                const room = foundApplication.residence.rooms.find(r => 
                                    r.roomNumber === roomNumber || r.name === roomNumber
                                );
                                if (room && room.price) {
                                    roomPrice = room.price;
                                    console.log(`   💰 Room Price: $${roomPrice}`);
                                } else {
                                    console.log(`   ⚠️  Room price not found for ${roomNumber}`);
                                }
                            }
                        }
                    }
                } else {
                    console.log(`ℹ️  No approved application found for ${actualUser.email} - will use fallback data`);
                }
            }
            
            // If no room price found, try to get it from options or use default
            if (!roomPrice) {
                roomPrice = options.roomPrice || 150;
                console.log(`   💰 Using fallback room price: $${roomPrice}`);
            }

            // 2. Check for existing lease if no application data
            if (!startDate || !endDate) {
                const lease = await Lease.findOne({ studentId: actualUser._id });
                if (lease) {
                    console.log(`�� Found lease for ${actualUser.email}`);
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
                    console.log(`🏠 Getting room price from residence: ${residence.name}`);
                    
                    // Try to find room price in rooms array
                    if (residence.rooms && residence.rooms.length > 0) {
                        const room = residence.rooms.find(r => 
                            r.roomNumber === roomNumber || r.name === roomNumber
                        );
                        if (room && room.price) {
                            roomPrice = room.price;
                            console.log(`   💰 Found room price: $${roomPrice}`);
                        } else if (residence.rooms[0] && residence.rooms[0].price) {
                            // Use first room's price as fallback
                            roomPrice = residence.rooms[0].price;
                            roomNumber = roomNumber || residence.rooms[0].roomNumber || residence.rooms[0].name;
                            console.log(`   💰 Using fallback room price: $${roomPrice}`);
                        }
                    }
                }
            }

            // 4. Set default values if still no data
            if (!roomPrice) {
                roomPrice = options.roomPrice || 150; // Default room price
                console.log(`⚠️  Using default room price $${roomPrice} for ${actualUser.email}`);
            }

            if (!startDate) {
                startDate = options.startDate || new Date(); // Default to current date
                console.log(`⚠️  Using current date as start date for ${actualUser.email}`);
            }

            if (!endDate) {
                endDate = options.endDate || new Date(new Date().setMonth(new Date().getMonth() + 6)); // Default to 6 months
                console.log(`⚠️  Using 6-month default end date for ${actualUser.email}`);
            }

        } catch (error) {
            console.error(`❌ Error gathering financial data for ${actualUser.email}:`, error);
            // Continue with default values
            roomPrice = options.roomPrice || 150;
            startDate = options.startDate || new Date();
            endDate = options.endDate || new Date(new Date().setMonth(new Date().getMonth() + 6));
        }

        // Calculate billing period and expected total
        const billingPeriodMonths = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24 * 30.44));
        
        // Determine admin fee based on residence
        let adminFee = 0;
        if (residenceId) {
            try {
                const residence = await Residence.findById(residenceId);
                if (residence && residence.name.toLowerCase().includes('st kilda')) {
                    adminFee = 20; // St Kilda has $20 admin fee
                }
            } catch (error) {
                console.log(`⚠️  Could not determine admin fee: ${error.message}`);
            }
        }
        
        // Calculate deposit (typically 1 month's rent)
        const deposit = roomPrice;
        
        // Calculate total owed: (Room Price × Months) + Admin Fee + Deposit
        const totalRent = roomPrice * billingPeriodMonths;
        const expectedTotal = totalRent + adminFee + deposit;
        
        console.log(`💰 Financial Calculation:`);
        console.log(`   Monthly Rent: $${roomPrice} × ${billingPeriodMonths} months = $${totalRent}`);
        console.log(`   Admin Fee: $${adminFee}`);
        console.log(`   Deposit: $${deposit}`);
        console.log(`   Total Owed: $${expectedTotal}`);

        // Get existing payments for this student
        const payments = await Payment.find({
            student: actualUser._id,
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
            
            description: `Billing period for ${actualUser.email}`,
            notes: options.applicationCode ? 
                `Auto-generated from approved application ${options.applicationCode}` : 
                `Auto-generated from application data`,
            
            autoRenewal: {
                enabled: false,
                renewalType: 'same_period',
                customRenewalPeriod: null
            }
        };

        // Create debtor object with full financial data
        const debtorData = {
            debtorCode,
            user: actualUser._id,
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
            // Add application linking if provided
            ...(options.application && { application: options.application }),
            ...(options.applicationCode && { applicationCode: options.applicationCode }),
            // Add financial breakdown
            financialBreakdown: {
                monthlyRent: roomPrice,
                numberOfMonths: billingPeriodMonths,
                totalRent: totalRent,
                adminFee: adminFee,
                deposit: deposit,
                totalOwed: expectedTotal
            },
            contactInfo,
            createdBy: options.createdBy || actualUser._id
        };

        // Log the data being set in debtor
        console.log(`\n📊 DEBTOR DATA BEING SET:`);
        console.log(`   Residence ID: ${residenceId || 'Not set'}`);
        console.log(`   Room Number: ${roomNumber || 'Not set'}`);
        console.log(`   Room Price: $${roomPrice}`);
        console.log(`   Start Date: ${startDate}`);
        console.log(`   End Date: ${endDate}`);

        // Create the debtor
        const debtor = new Debtor(debtorData);
        await debtor.save();

        console.log(`\n✅ Debtor account created for student ${actualUser.email}: ${debtorCode}`);
        console.log(`   Room Price: $${roomPrice}`);
        console.log(`   Billing Period: ${billingPeriodObject.type} (${billingPeriodMonths} months)`);
        console.log(`   Expected Total: $${expectedTotal}`);
        console.log(`   Total Paid: $${totalPaid}`);
        console.log(`   Current Balance: $${currentBalance}`);
        console.log(`   Status: ${status}`);
        console.log(`   Residence: ${residenceId || 'Not linked'}`);
        console.log(`   Room: ${roomNumber || 'Not set'}`);

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

/**
 * Create debtors from approved applications
 * This function processes all approved applications and creates/updates debtors
 * @returns {Promise<Object>} Summary of operations
 */
exports.createDebtorsFromApprovedApplications = async () => {
    try {
        console.log('🚀 Creating debtors from approved applications...\n');
        
        // Get all approved applications
        const approvedApplications = await Application.find({ 
            status: 'approved',
            student: { $exists: true, $ne: null }
        }).populate('student', 'firstName lastName email role')
          .populate('residence', 'name rooms');
        
        console.log(`📋 Found ${approvedApplications.length} approved applications with students\n`);
        
        let newDebtorsCreated = 0;
        let existingDebtorsUpdated = 0;
        let errors = [];
        
        for (const application of approvedApplications) {
            try {
                console.log(`\n🔍 Processing: ${application.applicationCode} - ${application.firstName} ${application.lastName}`);
                
                if (!application.student) {
                    console.log('   ❌ No student linked, skipping...');
                    continue;
                }
                
                if (application.student.role !== 'student') {
                    console.log(`   ⚠️  User is not a student (${application.student.role}), skipping...`);
                    continue;
                }
                
                // Check if debtor already exists
                const existingDebtor = await Debtor.findOne({ user: application.student._id });
                
                if (existingDebtor) {
                    console.log(`   🔄 Updating existing debtor: ${existingDebtor.debtorCode}`);
                    
                    // Update debtor with application data
                    const updateData = {};
                    
                    if (application.residence && !existingDebtor.residence) {
                        updateData.residence = application.residence._id;
                    }
                    
                    if (application.allocatedRoom && !existingDebtor.roomNumber) {
                        updateData.roomNumber = application.allocatedRoom;
                    }
                    
                    if (application.startDate && application.endDate) {
                        updateData.startDate = application.startDate;
                        updateData.endDate = application.endDate;
                        
                        // Get room price and calculate financials
                        let roomPrice = 0;
                        if (application.residence && application.residence.rooms) {
                            const room = application.residence.rooms.find(r => 
                                r.roomNumber === application.allocatedRoom
                            );
                            if (room && room.price) {
                                roomPrice = room.price;
                                updateData.roomPrice = roomPrice;
                                
                                // Calculate months and total owed
                                const startDate = new Date(application.startDate);
                                const endDate = new Date(application.endDate);
                                const monthsDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24 * 30.44));
                                
                                // Determine admin fee
                                let adminFee = 0;
                                if (application.residence.name.toLowerCase().includes('st kilda')) {
                                    adminFee = 20;
                                }
                                
                                const deposit = roomPrice;
                                const totalRent = roomPrice * monthsDiff;
                                const totalOwed = totalRent + adminFee + deposit;
                                
                                updateData.totalOwed = totalOwed;
                                updateData.financialBreakdown = {
                                    monthlyRent: roomPrice,
                                    numberOfMonths: monthsDiff,
                                    totalRent: totalRent,
                                    adminFee: adminFee,
                                    deposit: deposit,
                                    totalOwed: totalOwed
                                };
                                
                                console.log(`   💰 Updated financials: $${roomPrice}/month × ${monthsDiff} months + $${adminFee} admin + $${deposit} deposit = $${totalOwed}`);
                            }
                        }
                    }
                    
                    if (Object.keys(updateData).length > 0) {
                        await Debtor.findByIdAndUpdate(existingDebtor._id, updateData);
                        console.log(`   ✅ Debtor updated successfully`);
                        existingDebtorsUpdated++;
                    } else {
                        console.log(`   ℹ️  No updates needed`);
                    }
                    
                } else {
                    console.log(`   🆕 Creating new debtor...`);
                    
                    // Create new debtor using the existing service
                    const newDebtor = await exports.createDebtorForStudent(application.student, {
                        residenceId: application.residence?._id,
                        roomNumber: application.allocatedRoom,
                        startDate: application.startDate,
                        endDate: application.endDate,
                        createdBy: application.student._id
                    });
                    
                    console.log(`   ✅ New debtor created: ${newDebtor.debtorCode}`);
                    newDebtorsCreated++;
                }
                
            } catch (error) {
                console.error(`   ❌ Error processing application ${application.applicationCode}:`, error.message);
                errors.push({
                    applicationCode: application.applicationCode,
                    error: error.message
                });
            }
        }
        
        const summary = {
            totalApplications: approvedApplications.length,
            newDebtorsCreated,
            existingDebtorsUpdated,
            errors: errors.length,
            errorDetails: errors
        };
        
        console.log(`\n📊 Summary:`);
        console.log(`   Total Approved Applications: ${summary.totalApplications}`);
        console.log(`   New Debtors Created: ${summary.newDebtorsCreated}`);
        console.log(`   Existing Debtors Updated: ${summary.existingDebtorsUpdated}`);
        console.log(`   Errors: ${summary.errors}`);
        
        if (errors.length > 0) {
            console.log('\n❌ Errors encountered:');
            errors.forEach(error => {
                console.log(`   - ${error.applicationCode}: ${error.error}`);
            });
        }
        
        console.log('\n✅ Debtor creation from applications completed!');
        return summary;
        
    } catch (error) {
        console.error('❌ Error in createDebtorsFromApprovedApplications:', error);
        throw error;
    }
};

/**
 * Create debtors from approved applications that don't have debtors yet
 * This is useful for migrating existing approved applications
 * @returns {Promise<Object>} Summary of created debtors
 */
exports.createDebtorsFromApprovedApplications = async () => {
    try {
        console.log('🔍 Finding approved applications without debtors...');
        
        // Find all approved applications that don't have debtors
        const applications = await Application.find({
            status: 'approved',
            $or: [
                { debtor: { $exists: false } },
                { debtor: null }
            ]
        }).populate('student', 'firstName lastName email phone')
          .populate('residence', 'name rooms');
        
        console.log(`📋 Found ${applications.length} approved applications without debtors`);
        
        const results = {
            total: applications.length,
            created: 0,
            failed: 0,
            errors: []
        };
        
        for (const application of applications) {
            try {
                if (!application.student) {
                    console.log(`⚠️  Application ${application._id} has no student - skipping`);
                    results.failed++;
                    continue;
                }
                
                // Check if debtor already exists for this student
                const existingDebtor = await Debtor.findOne({ user: application.student._id });
                if (existingDebtor) {
                    console.log(`ℹ️  Debtor already exists for student ${application.student.email} - linking to application`);
                    
                    // Link the existing debtor to the application
                    application.debtor = existingDebtor._id;
                    await application.save();
                    console.log(`✅ Linked existing debtor ${existingDebtor._id} to application ${application._id}`);
                    continue;
                }
                
                // Create new debtor for this student
                const debtor = await exports.createDebtorForStudent(application.student, {
                    createdBy: 'system',
                    residenceId: application.residence?._id,
                    roomNumber: application.allocatedRoom || application.preferredRoom,
                    startDate: application.startDate,
                    endDate: application.endDate,
                    application: application._id
                });
                
                // Link the debtor to the application
                application.debtor = debtor._id;
                await application.save();
                
                console.log(`✅ Created debtor ${debtor._id} for student ${application.student.email}`);
                results.created++;
                
            } catch (error) {
                console.error(`❌ Failed to create debtor for application ${application._id}:`, error.message);
                results.failed++;
                results.errors.push({
                    applicationId: application._id,
                    studentEmail: application.student?.email || 'unknown',
                    error: error.message
                });
            }
        }
        
        console.log(`📊 Debtor creation summary:`, results);
        return results;
        
    } catch (error) {
        console.error('❌ Error in createDebtorsFromApprovedApplications:', error);
        throw error;
    }
}; 