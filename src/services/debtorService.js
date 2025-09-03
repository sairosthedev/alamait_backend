const Debtor = require('../models/Debtor');
const User = require('../models/User');
const Residence = require('../models/Residence');
const Application = require('../models/Application');
const Lease = require('../models/Lease');
const Payment = require('../models/Payment');
const Account = require('../models/Account');

async function ensureStudentARAccount(studentId, studentName) {
    const mainAR = await Account.findOne({ code: '1100' });
    if (!mainAR) {
        throw new Error('Main AR account (1100) not found');
    }
    const code = `1100-${studentId}`;
    let acc = await Account.findOne({ code });
    if (acc) return acc;
    acc = new Account({
        code,
        name: `Accounts Receivable - ${studentName || studentId}`,
        type: 'Asset',
        category: 'Current Assets',
        subcategory: 'Accounts Receivable',
        description: 'Student-specific AR control account',
        isActive: true,
        parentAccount: mainAR._id,
        level: 2,
        sortOrder: 0,
        metadata: new Map([
            ['parent', '1100'],
            ['hasParent', 'true'],
            ['studentId', String(studentId)]
        ])
    });
    await acc.save();
    
    // Log account creation
    const { logSystemOperation } = require('../utils/auditLogger');
    await logSystemOperation('create', 'Account', acc._id, {
        source: 'Debtor Service',
        type: 'student_ar_account',
        studentId: studentId,
        studentName: studentName,
        parentAccount: '1100',
        accountCode: code
    });
    
    return acc;
}

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
 * @param {boolean} options.isReapplication - Whether this is a re-application
 * @param {string} options.previousDebtorCode - Previous debtor code for re-applications
 * @returns {Promise<Object>} Created debtor object
 */
exports.createDebtorForStudent = async (user, options = {}) => {
    try {
        console.log(`🏗️  Creating debtor account for student...`);
        console.log(`   User: ${user.email || user.firstName} ${user.lastName}`);
        console.log(`   Options:`, options);
        
        // Determine if this is a re-application scenario
        const isReapplication = options.isReapplication || false;
        const previousDebtorCode = options.previousDebtorCode;
        
        if (isReapplication && previousDebtorCode) {
            console.log(`🔄 Re-application detected with previous debtor: ${previousDebtorCode}`);
            
            // Try to find existing debtor by previous code
            let existingDebtor = await Debtor.findOne({ debtorCode: previousDebtorCode });
            
            if (existingDebtor) {
                console.log(`✅ Found existing debtor account: ${existingDebtor.debtorCode}`);
                console.log(`   Previous balance: $${existingDebtor.currentBalance}`);
                console.log(`   Total paid: $${existingDebtor.totalPaid}`);
                console.log(`   Total owed: $${existingDebtor.totalOwed}`);
                
                // Update existing debtor with new application information
                const updateData = {
                    // Link to new application
                    application: options.application || null,
                    applicationCode: options.applicationCode || null,
                    
                    // Update residence and room information
                    residence: options.residenceId || existingDebtor.residence,
                    roomNumber: options.roomNumber || existingDebtor.roomNumber,
                    
                    // Update status to active
                    status: 'active',
                    
                    // Preserve financial history but update current lease details
                    updatedAt: new Date()
                };
                
                // Update room details if new information is available
                if (options.roomNumber && options.residenceId) {
                    try {
                        const residence = await Residence.findById(options.residenceId);
                        if (residence) {
                            const room = residence.rooms.find(r => r.roomNumber === options.roomNumber);
                            if (room) {
                                updateData.roomDetails = {
                                    roomId: room._id,
                                    roomType: room.type,
                                    roomCapacity: room.capacity,
                                    roomFeatures: room.features || [],
                                    roomAmenities: room.amenities || [],
                                    roomFloor: room.floor || 1,
                                    roomArea: room.area || 0
                                };
                            }
                        }
                    } catch (error) {
                        console.log(`⚠️  Could not update room details: ${error.message}`);
                    }
                }
                
                // Update billing period if new dates are provided
                if (options.startDate && options.endDate) {
                    const startDate = new Date(options.startDate);
                    const endDate = new Date(options.endDate);
                    const billingPeriodMonths = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24 * 30.44));
                    
                    if (billingPeriodMonths > 0) {
                        const roomPrice = options.roomPrice || existingDebtor.roomPrice || 0;
                        let adminFee = 0;
                        
                        try {
                            if (options.residenceId) {
                                const residence = await Residence.findById(options.residenceId);
                                if (residence && residence.name.toLowerCase().includes('st kilda')) {
                                    adminFee = 20; // St Kilda has $20 admin fee
                                }
                            }
                        } catch (error) {
                            console.log(`⚠️  Could not determine admin fee: ${error.message}`);
                        }
                        
                        const deposit = roomPrice || 0;
                        const totalRent = (roomPrice || 0) * billingPeriodMonths;
                        const expectedTotal = totalRent + adminFee + deposit;
                        
                        updateData.billingPeriod = {
                            type: billingPeriodMonths === 3 ? 'quarterly' : 
                                  billingPeriodMonths === 6 ? 'semester' : 
                                  billingPeriodMonths === 12 ? 'annual' : 'monthly',
                            duration: {
                                value: billingPeriodMonths,
                                unit: 'months'
                            },
                            startDate: startDate,
                            endDate: endDate,
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
                            description: `Billing period for ${user.email || user.firstName} ${user.lastName}`,
                            notes: `Updated from re-application ${options.applicationCode || 'N/A'}`,
                            autoRenewal: {
                                enabled: false,
                                renewalType: 'same_period',
                                customRenewalPeriod: null
                            }
                        };
                        
                        updateData.totalOwed = expectedTotal;
                        updateData.currentBalance = Math.max(expectedTotal - (existingDebtor.totalPaid || 0), 0);
                        updateData.billingPeriodLegacy = `${billingPeriodMonths} months`;
                        updateData.startDate = startDate;
                        updateData.endDate = endDate;
                        updateData.roomPrice = roomPrice;
                        
                        // Add financial breakdown
                        updateData.financialBreakdown = {
                            monthlyRent: roomPrice || 0,
                            numberOfMonths: billingPeriodMonths,
                            totalRent: totalRent,
                            adminFee: adminFee,
                            deposit: deposit,
                            totalOwed: expectedTotal
                        };
                        
                        console.log(`   📅 Updated billing period: ${billingPeriodMonths} months`);
                        console.log(`   💰 Updated total owed: $${expectedTotal}`);
                    }
                }
                
                // Update the existing debtor
                await Debtor.findByIdAndUpdate(existingDebtor._id, updateData);
                console.log(`✅ Updated existing debtor for re-application`);
                
                // Return the updated debtor
                return await Debtor.findById(existingDebtor._id);
            } else {
                console.log(`⚠️  Previous debtor code ${previousDebtorCode} not found, creating new debtor`);
            }
        }

        // Check if debtor already exists for this user
        const actualUser = user.student ? await User.findById(user.student) : user;
        if (!actualUser) {
            throw new Error('User not found');
        }
        
        const existingDebtor = await Debtor.findOne({ user: actualUser._id });

        // Ensure student AR account exists asap
        try {
            await ensureStudentARAccount(actualUser._id, `${actualUser.firstName} ${actualUser.lastName}`);
        } catch (e) {
            console.error('Failed to ensure student AR account:', e.message);
        }
        
        if (existingDebtor) {
            console.log(`ℹ️  Debtor account already exists for user: ${actualUser.email}`);
            
            // If this is a re-application, update the existing debtor
            if (isReapplication) {
                console.log(`🔄 Updating existing debtor for re-application`);
                
                const updateData = {
                    application: options.application || existingDebtor.application,
                    applicationCode: options.applicationCode || existingDebtor.applicationCode,
                    residence: options.residenceId || existingDebtor.residence,
                    roomNumber: options.roomNumber || existingDebtor.roomNumber,
                    status: 'active',
                    updatedAt: new Date()
                };
                
                // Update room details if new information is available
                if (options.roomNumber && options.residenceId) {
                    try {
                        const residence = await Residence.findById(options.residenceId);
                        if (residence) {
                            const room = residence.rooms.find(r => r.roomNumber === options.roomNumber);
                            if (room) {
                                updateData.roomDetails = {
                                    roomId: room._id,
                                    roomType: room.type,
                                    roomCapacity: room.capacity,
                                    roomFeatures: room.features || [],
                                    roomAmenities: room.amenities || [],
                                    roomFloor: room.floor || 1,
                                    roomArea: room.area || 0
                                };
                            }
                        }
                    } catch (error) {
                        console.log(`⚠️  Could not update room details: ${error.message}`);
                    }
                }
                
                // Update billing period if new dates are provided
                if (options.startDate && options.endDate) {
                    const startDate = new Date(options.startDate);
                    const endDate = new Date(options.endDate);
                    const billingPeriodMonths = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24 * 30.44));
                    
                    if (billingPeriodMonths > 0) {
                        const roomPrice = options.roomPrice || existingDebtor.roomPrice || 0;
                        let adminFee = 0;
                        
                        try {
                            if (options.residenceId) {
                                const residence = await Residence.findById(options.residenceId);
                                if (residence && residence.name.toLowerCase().includes('st kilda')) {
                                    adminFee = 20; // St Kilda has $20 admin fee
                                }
                            }
                        } catch (error) {
                            console.log(`⚠️  Could not determine admin fee: ${error.message}`);
                        }
                        
                        const deposit = roomPrice || 0;
                        const totalRent = (roomPrice || 0) * billingPeriodMonths;
                        const expectedTotal = totalRent + adminFee + deposit;
                        
                        updateData.billingPeriod = {
                            type: billingPeriodMonths === 3 ? 'quarterly' : 
                                  billingPeriodMonths === 6 ? 'semester' : 
                                  billingPeriodMonths === 12 ? 'annual' : 'monthly',
                            duration: {
                                value: billingPeriodMonths,
                                unit: 'months'
                            },
                            startDate: startDate,
                            endDate: endDate,
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
                                `Updated from re-application ${options.applicationCode}` : 
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
                        updateData.startDate = startDate;
                        updateData.endDate = endDate;
                        updateData.roomPrice = roomPrice;
                        
                        // Add financial breakdown
                        updateData.financialBreakdown = {
                            monthlyRent: roomPrice || 0,
                            numberOfMonths: billingPeriodMonths,
                            totalRent: totalRent,
                            adminFee: adminFee,
                            deposit: deposit,
                            totalOwed: expectedTotal
                        };
                        
                        console.log(`   📅 Updated billing period: ${billingPeriodMonths} months`);
                        console.log(`   💰 Updated total owed: $${expectedTotal}`);
                    }
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
            
            return existingDebtor;
        }

        // Generate debtor code
        const debtorCode = await Debtor.generateDebtorCode();
        
        // Get the correct AR account code for this student
        const arAccount = await Account.findOne({
            code: `1100-${actualUser._id.toString()}`
        });
        
        if (!arAccount) {
            throw new Error(`AR account not found for student ${actualUser.email}. Account code should be: 1100-${actualUser._id.toString()}`);
        }
        
        const accountCode = arAccount.code;
        
        console.log(`   🔢 Generated debtor code: ${debtorCode}`);
        console.log(`   🔢 Using existing AR account code: ${accountCode}`);

        // Prepare contact info
        const contactInfo = {
            name: `${actualUser.firstName} ${actualUser.lastName}`,
            email: actualUser.email,
            phone: actualUser.phone
        };

        // Extract financial data from options
        let residenceId = options.residenceId;
        let roomNumber = options.roomNumber;
        let startDate = options.startDate ? new Date(options.startDate) : null;
        let endDate = options.endDate ? new Date(options.endDate) : null;
        let roomPrice = options.roomPrice;

        // Continue with additional data sources if needed
        try {
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

        // 🆕 INTEGRATED: Auto-backfill transactions for the new debtor
        // NOTE: Only run backfill if rental accrual service is NOT handling transactions
        // (Rental accrual service creates transactions when lease starts via application approval)
        try {
            const { backfillTransactionsForDebtor } = require('./transactionBackfillService');
            console.log(`🔄 Auto-backfilling transactions for new debtor: ${debtorCode}`);
            const backfillResult = await backfillTransactionsForDebtor(debtor, { auto: true });
            
            if (backfillResult.success) {
                console.log(`✅ Auto-backfill completed for ${debtorCode}:`);
                console.log(`   - Lease start created: ${backfillResult.leaseStartCreated}`);
                console.log(`   - Monthly transactions created: ${backfillResult.monthlyTransactionsCreated}`);
            } else if (backfillResult.skipped) {
                console.log(`⏭️  Backfill skipped for ${debtorCode}: ${backfillResult.reason || 'not in bulk mode'}`);
            } else {
                console.error(`❌ Auto-backfill failed for ${debtorCode}: ${backfillResult.error}`);
            }
        } catch (backfillError) {
            console.error(`❌ Failed to auto-backfill transactions for debtor ${debtorCode}:`, backfillError);
        }

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
 * 🆕 NEW: Real-time debtor update when AR transactions are created
 * This method is called automatically by TransactionEntry post-save hook
 * @param {string} studentId - The student/user ID
 * @param {Object} transactionData - The transaction data that was just created
 */
exports.updateDebtorFromARTransaction = async (studentId, transactionData) => {
    try {
        console.log(`🔄 Real-time update for debtor (User: ${studentId})`);
        
        // Find debtor by user ID
        const debtor = await Debtor.findOne({ user: studentId });
        
        if (!debtor) {
            console.log(`   ⚠️ No debtor found for user ID: ${studentId}`);
            return { success: false, message: 'Debtor not found' };
        }
        
        console.log(`   📊 Updating debtor: ${debtor.debtorCode}`);
        
        // Use the enhanced transaction-based calculation
        const DebtorTransactionSyncService = require('./debtorTransactionSyncService');
        const calculationResult = await DebtorTransactionSyncService.recalculateDebtorTotalsFromTransactionEntries(debtor, studentId);
        
        await debtor.save();
        
        console.log(`   ✅ Real-time update completed for ${debtor.debtorCode}:`);
        console.log(`      Expected: $${calculationResult.totalOwed.toFixed(2)}`);
        console.log(`      Paid: $${calculationResult.totalPaid.toFixed(2)}`);
        console.log(`      Balance: $${calculationResult.currentBalance.toFixed(2)}`);
        console.log(`      Status: ${debtor.status}`);
        
        return {
            success: true,
            debtor: debtor,
            calculationResult: calculationResult
        };
        
    } catch (error) {
        console.error(`❌ Error in real-time debtor update:`, error);
        return { success: false, error: error.message };
    }
};

/**
 * Get debtor collection summary with AR data
 * Returns a summary of all debtors with their AR-linked totals
 */
exports.getDebtorCollectionSummary = async () => {
    try {
        const TransactionEntry = require('../models/TransactionEntry');
        const Account = require('../models/Account');

        // Get all debtor accounts
        const debtorAccounts = await Account.find({
            type: 'Asset',
            code: { $regex: '^1100-' } // Debtor AR accounts
        });

        let totalExpected = 0;
        let totalPaid = 0;
        let totalOutstanding = 0;
        let debtorCount = 0;
        let overdueCount = 0;

        for (const account of debtorAccounts) {
            // Get AR transactions for this account
            const arTransactions = await TransactionEntry.find({
                'entries.accountCode': account.code
            }).lean();

            let accountExpected = 0;
            let accountPaid = 0;

            arTransactions.forEach(transaction => {
                transaction.entries.forEach(entry => {
                    if (entry.accountCode === account.code) {
                        if (transaction.source === 'rental_accrual' || transaction.source === 'lease_start') {
                            accountExpected += entry.debit || 0;
                        } else if (transaction.source === 'payment' || transaction.source === 'accounts_receivable_collection') {
                            accountPaid += entry.credit || 0;
                        }
                    }
                });
            });

            const accountOutstanding = accountExpected - accountPaid;

            totalExpected += accountExpected;
            totalPaid += accountPaid;
            totalOutstanding += accountOutstanding;
            debtorCount++;

            if (accountOutstanding > 0) {
                overdueCount++;
            }
        }

        return {
            totalExpected,
            totalPaid,
            totalOutstanding,
            debtorCount,
            overdueCount,
            collectionRate: totalExpected > 0 ? (totalPaid / totalExpected) * 100 : 0
        };

    } catch (error) {
        console.error('❌ Error in getDebtorCollectionSummary:', error);
        throw error;
    }
};

/**
 * Sync debtor totals with AR data
 * This ensures the debtors collection reflects the correct expected and paid amounts from the accounting system
 */
exports.syncDebtorTotalsWithAR = async (debtorId = null) => {
    try {
        const TransactionEntry = require('../models/TransactionEntry');
        const Account = require('../models/Account');
        
        let debtorsToSync = [];
        
        if (debtorId) {
            // Sync specific debtor
            const debtor = await Debtor.findById(debtorId);
            if (!debtor) {
                throw new Error(`Debtor with ID ${debtorId} not found`);
            }
            debtorsToSync = [debtor];
        } else {
            // Sync all debtors
            debtorsToSync = await Debtor.find({});
        }

        console.log(`🔄 Syncing ${debtorsToSync.length} debtor(s) with AR data...`);

        let syncedCount = 0;
        let errorCount = 0;

        for (const debtor of debtorsToSync) {
            try {
                // Find the debtor's AR account
                const debtorAccount = await Account.findOne({ 
                    code: debtor.accountCode,
                    type: 'Asset'
                });

                if (!debtorAccount) {
                    console.warn(`⚠️ No AR account found for debtor ${debtor.debtorCode} (${debtor.accountCode})`);
                    continue;
                }
                
                // Get all AR transactions for this debtor
                const arTransactions = await TransactionEntry.find({
                    'entries.accountCode': debtor.accountCode
                })
                .sort({ date: 1 })
                .lean();

                let totalExpectedFromAR = 0;
                let totalPaidFromAR = 0;
                let monthlyBreakdown = {};

                // Calculate totals from AR transactions
                arTransactions.forEach(transaction => {
                    const transactionDate = new Date(transaction.date);
                    const monthKey = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
                    
                    // Initialize month if not exists
                    if (!monthlyBreakdown[monthKey]) {
                        monthlyBreakdown[monthKey] = {
                            month: monthKey,
                            expected: 0,
                            paid: 0,
                            outstanding: 0
                        };
                    }

                    // Process each entry in the transaction
                    transaction.entries.forEach(entry => {
                        if (entry.accountCode === debtor.accountCode) {
                            if (transaction.source === 'rental_accrual' || transaction.source === 'lease_start') {
                                // This is expected amount (accrual)
                                totalExpectedFromAR += entry.debit || 0;
                                monthlyBreakdown[monthKey].expected += entry.debit || 0;
                                monthlyBreakdown[monthKey].outstanding += entry.debit || 0;
                            } else if (transaction.source === 'payment' || transaction.source === 'accounts_receivable_collection') {
                                // This is payment received
                                totalPaidFromAR += entry.credit || 0;
                                monthlyBreakdown[monthKey].paid += entry.credit || 0;
                                monthlyBreakdown[monthKey].outstanding -= entry.credit || 0;
                            }
                        }
                    });
                });

                // Calculate current balance from AR data
                const currentBalanceFromAR = totalExpectedFromAR - totalPaidFromAR;

                // Update debtor with AR data
                const updateData = {
                    totalOwed: totalExpectedFromAR,
                    totalPaid: totalPaidFromAR,
                    currentBalance: currentBalanceFromAR,
                    overdueAmount: currentBalanceFromAR > 0 ? currentBalanceFromAR : 0,
                    updatedAt: new Date()
                };

                // Update status based on balance and payment timeline
                const DebtorTransactionSyncService = require('./debtorTransactionSyncService');
                updateData.status = DebtorTransactionSyncService.determineDebtorStatus(currentBalanceFromAR, arTransactions);

                // Update monthly payments if they don't exist or need updating
                if (!debtor.monthlyPayments || debtor.monthlyPayments.length === 0) {
                    updateData.monthlyPayments = Object.values(monthlyBreakdown).map(monthData => ({
                        month: monthData.month,
                        expectedAmount: monthData.expected,
                        expectedComponents: {
                            rent: monthData.expected,
                            admin: 0,
                            deposit: 0,
                            utilities: 0,
                            other: 0
                        },
                        paidAmount: monthData.paid,
                        paidComponents: {
                            rent: monthData.paid,
                            admin: 0,
                            deposit: 0,
                            utilities: 0,
                            other: 0
                        },
                        outstandingAmount: Math.max(0, monthData.outstanding), // Ensure non-negative
                        outstandingComponents: {
                            rent: Math.max(0, monthData.outstanding),
                            admin: 0,
                            deposit: 0,
                            utilities: 0,
                            other: 0
                        },
                        status: monthData.outstanding === 0 ? 'paid' : (monthData.paid > 0 ? 'partial' : 'unpaid'),
                        paymentCount: 0,
                        paymentIds: [],
                        paymentMonths: monthData.paid > 0 ? [{
                            paymentMonth: monthData.month,
                            paymentDate: new Date(),
                            amount: monthData.paid,
                            paymentId: `AR-${monthData.month}-${Date.now()}`,
                            status: 'Confirmed'
                        }] : [],
                        paymentMonthSummary: {
                            totalPaymentMonths: 0,
                            firstPaymentMonth: null,
                            lastPaymentMonth: null,
                            paymentMonthBreakdown: []
                        },
                        updatedAt: new Date()
                    }));
                }

                await Debtor.findByIdAndUpdate(debtor._id, updateData);

                console.log(`✅ Synced debtor ${debtor.debtorCode}: Expected $${totalExpectedFromAR.toFixed(2)}, Paid $${totalPaidFromAR.toFixed(2)}, Balance $${currentBalanceFromAR.toFixed(2)}`);
                syncedCount++;
                
            } catch (error) {
                console.error(`❌ Error syncing debtor ${debtor.debtorCode}:`, error.message);
                errorCount++;
            }
        }

        console.log(`🔄 Sync completed: ${syncedCount} synced, ${errorCount} errors`);

        return {
            success: true,
            syncedCount,
            errorCount,
            totalProcessed: debtorsToSync.length
        };
        
    } catch (error) {
        console.error('❌ Error in syncDebtorTotalsWithAR:', error);
        throw error;
    }
}; 