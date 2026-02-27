const mongoose = require('mongoose');
const Application = require('../models/Application');
const Debtor = require('../models/Debtor');
const RentalAccrualService = require('./rentalAccrualService');
const TransactionEntry = require('../models/TransactionEntry');

/**
 * Tenant Accrual Check Service
 * 
 * Checks all current tenants to ensure they have all required monthly accruals
 * for their lease period and creates any missing accruals.
 */
class TenantAccrualCheckService {
    
    /**
     * Check all current tenants for missing accruals and create them
     * @returns {Promise<Object>} Summary of the check and creation process
     */
    static async checkAllTenantsForMissingAccruals() {
        try {
            console.log(`\n🔍 TENANT ACCRUAL CHECK STARTED`);
            console.log(`   Date: ${new Date().toISOString()}`);
            
            // Ensure database connection
            if (mongoose.connection.readyState !== 1) {
                throw new Error('Database connection not available');
            }
            
            const now = new Date();
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();
            
            // Find all tenants that should have accruals checked:
            // 1. Current tenants (lease hasn't ended yet)
            // 2. Recently ended tenants (ended within last 3 months) - to catch missing accruals
            const threeMonthsAgo = new Date(now);
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            
            const currentTenants = await Application.find({
                status: 'approved',
                startDate: { $lte: now }, // Lease has started
                $or: [
                    { endDate: { $gte: now } }, // Lease hasn't ended (current tenants)
                    { endDate: { $gte: threeMonthsAgo, $lt: now } } // Lease ended recently (within last 3 months)
                ],
                paymentStatus: { $ne: 'cancelled' }
            })
            .populate('student', 'firstName lastName email')
            .lean();
            
            console.log(`   Found ${currentTenants.length} tenants to check (current + recently ended)`);
            
            if (currentTenants.length === 0) {
                return {
                    success: true,
                    tenantsChecked: 0,
                    accrualsCreated: 0,
                    accrualsSkipped: 0,
                    errors: []
                };
            }
            
            let totalAccrualsCreated = 0;
            let totalAccrualsSkipped = 0;
            const errors = [];
            
            // Process each tenant
            for (const application of currentTenants) {
                try {
                    const studentId = application.student?._id?.toString() || application.student?.toString() || application.student;
                    const studentName = application.student 
                        ? `${application.student.firstName} ${application.student.lastName}`
                        : `${application.firstName} ${application.lastName}`;
                    
                    if (!studentId) {
                        console.warn(`   ⚠️ Skipping application ${application.applicationCode} - no student ID`);
                        continue;
                    }
                    
                    console.log(`   👤 Checking tenant: ${studentName} (${application.applicationCode})`);
                    console.log(`      Lease period: ${application.startDate?.toISOString().split('T')[0]} to ${application.endDate?.toISOString().split('T')[0]}`);
                    
                    // Get debtor information
                    const debtor = await Debtor.findOne({ user: studentId }).lean();
                    const debtorId = debtor?._id?.toString();
                    const arAccountCode = debtor?.accountCode 
                        ? (typeof debtor.accountCode === 'string' && debtor.accountCode.startsWith('1100-') 
                            ? debtor.accountCode 
                            : `1100-${debtorId}`)
                        : (debtorId ? `1100-${debtorId}` : null);
                    
                    console.log(`      Debtor ID: ${debtorId || 'N/A'}, AR Account Code: ${arAccountCode || 'N/A'}`);
                    
                    // Calculate lease period
                    const leaseStartDate = new Date(application.startDate);
                    const leaseEndDate = new Date(application.endDate);
                    
                    // Start checking from lease start month (skip lease start month as it's handled separately)
                    const startMonth = leaseStartDate.getMonth() + 1;
                    const startYear = leaseStartDate.getFullYear();
                    
                    // Check up to current month (don't create future accruals)
                    const endMonth = currentMonth;
                    const endYear = currentYear;
                    
                    console.log(`      Checking months from ${startMonth}/${startYear} to ${endMonth}/${endYear}`);
                    
                    // Skip if lease hasn't started yet
                    if (leaseStartDate > now) {
                        console.log(`      ⏭️ Lease hasn't started yet (starts: ${leaseStartDate.toISOString().split('T')[0]})`);
                        continue;
                    }
                    
                    // 🆕 ENHANCED: Check for missing lease start transaction
                    if (leaseStartDate <= now) {
                        console.log(`      🔍 Checking for lease start transaction...`);
                        
                        const existingLeaseStart = await TransactionEntry.findOne({
                            $or: [
                                { 'metadata.applicationId': application._id, 'metadata.type': 'lease_start' },
                                { 'metadata.applicationCode': application.applicationCode, 'metadata.type': 'lease_start' },
                                ...(debtorId ? [
                                    { source: 'rental_accrual', 'metadata.type': 'lease_start', 'metadata.debtorId': debtorId },
                                    { source: 'rental_accrual', sourceModel: 'Debtor', sourceId: debtorId, 'metadata.type': 'lease_start' }
                                ] : []),
                                ...(arAccountCode ? [
                                    { source: 'rental_accrual', 'metadata.type': 'lease_start', 'entries.accountCode': arAccountCode }
                                ] : [])
                            ],
                            status: { $ne: 'deleted' }
                        });
                        
                        if (!existingLeaseStart) {
                            console.log(`      ⚠️ Lease start transaction missing - will create`);
                            try {
                                const RentalAccrualService = require('./rentalAccrualService');
                                const leaseStartResult = await RentalAccrualService.processLeaseStart(application);
                                
                                if (leaseStartResult && leaseStartResult.success && !leaseStartResult.skipped) {
                                    console.log(`      ✅ Created missing lease start transaction`);
                                } else if (leaseStartResult && leaseStartResult.skipped) {
                                    console.log(`      ⏭️ Lease start skipped: ${leaseStartResult.message}`);
                                } else {
                                    console.log(`      ⚠️ Lease start creation returned warning: ${leaseStartResult?.error || 'Unknown'}`);
                                    errors.push({
                                        tenant: studentName,
                                        applicationCode: application.applicationCode,
                                        error: `Lease start creation failed: ${leaseStartResult?.error || 'Unknown'}`
                                    });
                                }
                            } catch (leaseStartError) {
                                console.error(`      ❌ Error creating lease start: ${leaseStartError.message}`);
                                errors.push({
                                    tenant: studentName,
                                    applicationCode: application.applicationCode,
                                    error: `Lease start creation failed: ${leaseStartError.message}`
                                });
                            }
                        } else {
                            console.log(`      ✅ Lease start transaction exists (ID: ${existingLeaseStart._id})`);
                        }
                    }
                    
                    let tenantAccrualsCreated = 0;
                    let tenantAccrualsSkipped = 0;
                    const monthsChecked = [];
                    const monthsMissing = [];
                    const monthsWithAccruals = [];
                    
                    // Calculate which months should have monthly accruals
                    // Monthly accruals are needed for every month from lease start to lease end
                    // EXCEPT the lease start month (which is handled by lease_start process)
                    const leaseEndMonth = leaseEndDate.getMonth() + 1;
                    const leaseEndYear = leaseEndDate.getFullYear();
                    
                    console.log(`      Lease start: ${startMonth}/${startYear}, Lease end: ${leaseEndMonth}/${leaseEndYear}`);
                    console.log(`      Current date: ${now.toISOString().split('T')[0]} (${currentMonth}/${currentYear})`);
                    
                    // Determine the range of months to check
                    // Start from the month AFTER lease start, up to the earlier of: current month or lease end month
                    let checkStartMonth = startMonth;
                    let checkStartYear = startYear;
                    
                    // Move to the month after lease start (skip lease start month)
                    checkStartMonth++;
                    if (checkStartMonth > 12) {
                        checkStartMonth = 1;
                        checkStartYear++;
                    }
                    
                    // End at the earlier of: current month or lease end month
                    // But we need to handle the case where lease end is in a different year
                    let checkEndMonth, checkEndYear;
                    if (currentYear < leaseEndYear) {
                        // Current year is before lease end year - check up to current month
                        checkEndMonth = currentMonth;
                        checkEndYear = currentYear;
                    } else if (currentYear > leaseEndYear) {
                        // Current year is after lease end year - check up to lease end month
                        checkEndMonth = leaseEndMonth;
                        checkEndYear = leaseEndYear;
                    } else {
                        // Same year - check up to the earlier of current month or lease end month
                        checkEndMonth = Math.min(currentMonth, leaseEndMonth);
                        checkEndYear = currentYear;
                    }
                    
                    console.log(`      Monthly accruals needed from ${checkStartMonth}/${checkStartYear} to ${checkEndMonth}/${checkEndYear}`);
                    
                    // Validate the range makes sense
                    // If lease started in current month, checkStartMonth will be currentMonth + 1, which is > currentMonth
                    // In this case, there are no months to check yet (will check next month)
                    if (checkStartYear > checkEndYear || (checkStartYear === checkEndYear && checkStartMonth > checkEndMonth)) {
                        console.log(`      ℹ️ No months to check yet - lease started in current month (${startMonth}/${startYear}), monthly accruals will be created starting next month`);
                        continue;
                    }
                    
                    // Iterate through each month that should have a monthly accrual
                    let month = checkStartMonth;
                    let year = checkStartYear;
                    let monthsProcessed = 0;
                    
                    console.log(`      Starting iteration: month=${month}, year=${year}, endMonth=${checkEndMonth}, endYear=${checkEndYear}`);
                    
                    // Safety check: prevent infinite loops
                    const maxIterations = 100;
                    let iterations = 0;
                    
                    while ((year < checkEndYear || (year === checkEndYear && month <= checkEndMonth)) && iterations < maxIterations) {
                        iterations++;
                        monthsProcessed++;
                        console.log(`      [${monthsProcessed}] Processing ${month}/${year} (iteration ${iterations})...`);
                        
                        // Skip future months (only check up to current month)
                        if (year > currentYear || (year === currentYear && month > currentMonth)) {
                            console.log(`      ⏭️ Skipping future month ${month}/${year}`);
                            month++;
                            if (month > 12) {
                                month = 1;
                                year++;
                            }
                            continue;
                        }
                        
                        // Ensure month is within lease period
                        const monthStart = new Date(year, month - 1, 1);
                        const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
                        
                        // Skip if month is completely before lease start or after lease end
                        if (monthEnd < leaseStartDate || monthStart > leaseEndDate) {
                            console.log(`      ⏭️ Skipping month ${month}/${year} - outside lease period`);
                            month++;
                            if (month > 12) {
                                month = 1;
                                year++;
                            }
                            continue;
                        }
                        
                        // Break if we've passed the lease end
                        if (monthStart > leaseEndDate) {
                            break;
                        }
                        
                        monthsChecked.push(`${month}/${year}`);
                        
                        // Check if monthly accrual already exists for this month
                        console.log(`      🔍 Checking for monthly accrual for ${month}/${year}...`);
                        console.log(`         Using studentId: ${studentId}, applicationId: ${application._id}, debtorId: ${debtorId || 'N/A'}`);
                        let existingAccrual = await RentalAccrualService.checkExistingMonthlyAccrual(
                            studentId,
                            month,
                            year,
                            application._id,
                            debtorId
                        );
                        
                        // Also check by AR account code if we have it
                        if (!existingAccrual && arAccountCode) {
                            console.log(`      🔍 Checking by AR account code ${arAccountCode} for ${month}/${year}...`);
                            const monthKey = `${year}-${String(month).padStart(2, '0')}`;
                            existingAccrual = await TransactionEntry.findOne({
                                source: 'rental_accrual',
                                status: { $ne: 'deleted' },
                                'entries.accountCode': arAccountCode,
                                $and: [
                                    {
                                        $or: [
                                            { 'metadata.type': 'monthly_rent_accrual' },
                                            { description: { $regex: /Monthly.*accrual/i } }
                                        ]
                                    },
                                    {
                                        $or: [
                                            { 'metadata.accrualMonth': month, 'metadata.accrualYear': year },
                                            { 'metadata.month': monthKey },
                                            { description: { $regex: new RegExp(monthKey) } }
                                        ]
                                    }
                                ]
                            });
                        }
                        
                        if (existingAccrual) {
                            // Verify the accrual actually belongs to this tenant
                            const accrualSourceId = existingAccrual.sourceId?.toString();
                            const accrualStudentId = existingAccrual.metadata?.studentId?.toString();
                            const accrualApplicationId = existingAccrual.metadata?.applicationId?.toString();
                            
                            // Check if accrual matches this tenant
                            const matchesStudentId = accrualStudentId === studentId.toString();
                            const matchesApplicationId = accrualApplicationId === application._id.toString();
                            const matchesDebtorId = debtorId && accrualSourceId === debtorId.toString() && existingAccrual.sourceModel === 'Debtor';
                            const matchesSourceId = !debtorId && accrualSourceId === studentId.toString();
                            
                            const isCorrectTenant = matchesStudentId || matchesApplicationId || matchesDebtorId || matchesSourceId;
                            
                            if (!isCorrectTenant) {
                                console.log(`      ⚠️ Found accrual but it doesn't match this tenant!`);
                                console.log(`         Expected: studentId=${studentId}, applicationId=${application._id}, debtorId=${debtorId || 'N/A'}`);
                                console.log(`         Found: studentId=${accrualStudentId || 'N/A'}, applicationId=${accrualApplicationId || 'N/A'}, sourceId=${accrualSourceId || 'N/A'}, sourceModel=${existingAccrual.sourceModel || 'N/A'}`);
                                console.log(`         This accrual belongs to a different tenant - will create correct one`);
                                existingAccrual = null; // Treat as missing so we create the correct one
                            } else {
                                console.log(`      ✅ Monthly accrual already exists for ${month}/${year} (ID: ${existingAccrual._id})`);
                                console.log(`         Accrual details: sourceId=${accrualSourceId}, sourceModel=${existingAccrual.sourceModel}`);
                                console.log(`         Accrual metadata: studentId=${accrualStudentId}, applicationId=${accrualApplicationId}`);
                                tenantAccrualsSkipped++;
                                monthsWithAccruals.push(`${month}/${year}`);
                            }
                        }
                        
                        if (!existingAccrual) {
                            console.log(`      ⚠️ Monthly accrual missing for ${month}/${year} - will create`);
                            monthsMissing.push(`${month}/${year}`);
                            // Create missing monthly accrual
                            try {
                                console.log(`      🔄 Creating missing monthly accrual for ${month}/${year}...`);
                                
                                // Create student-like object from application for createStudentRentAccrual
                                // Include debtor information to ensure same debtor account code is used as monthly cron service
                                const studentData = {
                                    student: studentId,
                                    firstName: application.student?.firstName || application.firstName,
                                    lastName: application.student?.lastName || application.lastName,
                                    email: application.student?.email || application.email || '',
                                    residence: application.residence,
                                    allocatedRoom: application.allocatedRoom || application.allocatedRoomDetails?.roomNumber || '',
                                    startDate: application.startDate,
                                    endDate: application.endDate,
                                    application: application._id,
                                    applicationCode: application.applicationCode,
                                    // 🆕 CRITICAL: Pass debtor information to ensure same debtor account code is used
                                    debtor: debtorId, // Pass debtor ID so createStudentRentAccrual uses the same debtor
                                    debtorAccountCode: arAccountCode // Pass the account code we already validated
                                };
                                
                                const result = await RentalAccrualService.createStudentRentAccrual(studentData, month, year);
                                
                                if (result.success) {
                                    console.log(`      ✅ Created monthly accrual for ${month}/${year}: $${result.amount}`);
                                    tenantAccrualsCreated++;
                                    totalAccrualsCreated++;
                                    monthsWithAccruals.push(`${month}/${year}`);
                                } else {
                                    console.log(`      ⚠️ Failed to create monthly accrual for ${month}/${year}: ${result.error}`);
                                    errors.push({
                                        tenant: studentName,
                                        applicationCode: application.applicationCode,
                                        month,
                                        year,
                                        error: result.error
                                    });
                                }
                            } catch (error) {
                                console.error(`      ❌ Error creating monthly accrual for ${month}/${year}: ${error.message}`);
                                errors.push({
                                    tenant: studentName,
                                    applicationCode: application.applicationCode,
                                    month,
                                    year,
                                    error: error.message
                                });
                            }
                        }
                        
                        // Move to next month
                        month++;
                        if (month > 12) {
                            month = 1;
                            year++;
                        }
                    }
                    
                    if (iterations >= maxIterations) {
                        console.error(`      ❌ ERROR: Loop exceeded maximum iterations (${maxIterations}) - possible infinite loop!`);
                        errors.push({
                            tenant: studentName,
                            applicationCode: application.applicationCode,
                            error: `Loop exceeded maximum iterations - possible infinite loop`
                        });
                    }
                    
                    if (monthsProcessed === 0) {
                        console.log(`      ⚠️ WARNING: No months were processed in the loop!`);
                        console.log(`         Loop condition: year=${year}, checkEndYear=${checkEndYear}, month=${month}, checkEndMonth=${checkEndMonth}`);
                        console.log(`         Condition result: ${year < checkEndYear || (year === checkEndYear && month <= checkEndMonth)}`);
                    }
                    
                    // Summary for this tenant
                    if (monthsChecked.length > 0) {
                        console.log(`      📊 ${studentName} - Monthly Accrual Summary:`);
                        console.log(`         Months checked: ${monthsChecked.length} (${monthsChecked.join(', ')})`);
                        console.log(`         Months with accruals: ${monthsWithAccruals.length} (${monthsWithAccruals.join(', ')})`);
                        if (monthsMissing.length > 0) {
                            console.log(`         ⚠️ Months missing accruals: ${monthsMissing.length} (${monthsMissing.join(', ')})`);
                        }
                        console.log(`         Created: ${tenantAccrualsCreated}, Already existed: ${tenantAccrualsSkipped}`);
                    } else {
                        console.log(`      ⚠️ ${studentName}: No months were checked!`);
                        console.log(`         Check range was: ${checkStartMonth}/${checkStartYear} to ${checkEndMonth}/${checkEndYear}`);
                        console.log(`         This might indicate a logic error in month range calculation`);
                    }
                    
                    totalAccrualsSkipped += tenantAccrualsSkipped;
                    
                } catch (error) {
                    console.error(`   ❌ Error checking tenant ${application.applicationCode}: ${error.message}`);
                    errors.push({
                        tenant: application.applicationCode,
                        error: error.message
                    });
                }
            }
            
            console.log(`\n✅ TENANT ACCRUAL CHECK COMPLETED`);
            console.log(`   ==========================================`);
            console.log(`   Tenants checked: ${currentTenants.length}`);
            console.log(`   Accruals created: ${totalAccrualsCreated}`);
            console.log(`   Accruals skipped (already exist): ${totalAccrualsSkipped}`);
            console.log(`   Errors: ${errors.length}`);
            console.log(`   ==========================================`);
            
            if (totalAccrualsCreated === 0 && totalAccrualsSkipped === 0 && currentTenants.length > 0) {
                console.log(`   ⚠️ WARNING: No accruals were created or skipped for ${currentTenants.length} tenants!`);
                console.log(`   This might indicate that no months were checked, or all months were skipped.`);
            }
            
            if (errors.length > 0) {
                console.log(`\n   Error details:`);
                errors.forEach((err, index) => {
                    console.log(`      ${index + 1}. ${err.tenant || err.applicationCode}: ${err.month || 'N/A'}/${err.year || 'N/A'} - ${err.error}`);
                });
            }
            
            return {
                success: true,
                tenantsChecked: currentTenants.length,
                accrualsCreated: totalAccrualsCreated,
                accrualsSkipped: totalAccrualsSkipped,
                errors
            };
            
        } catch (error) {
            console.error(`❌ Error in tenant accrual check: ${error.message}`);
            return {
                success: false,
                error: error.message,
                tenantsChecked: 0,
                accrualsCreated: 0,
                accrualsSkipped: 0,
                errors: [{ error: error.message }]
            };
        }
    }
    
    /**
     * Check a specific tenant for missing accruals (manual trigger)
     * @param {string} studentId - Student ID
     * @param {string} applicationCode - Application code (optional)
     * @returns {Promise<Object>} Summary of the check and creation process
     */
    static async checkSpecificTenantForMissingAccruals(studentId, applicationCode = null) {
        try {
            console.log(`\n🔍 CHECKING SPECIFIC TENANT FOR MISSING ACCRUALS`);
            console.log(`   Student ID: ${studentId}`);
            console.log(`   Application Code: ${applicationCode || 'N/A'}`);
            console.log(`   Date: ${new Date().toISOString()}`);
            
            // Ensure database connection
            if (mongoose.connection.readyState !== 1) {
                throw new Error('Database connection not available');
            }
            
            const now = new Date();
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();
            
            // Find the tenant's application
            const query = {
                student: studentId,
                status: 'approved',
                paymentStatus: { $ne: 'cancelled' }
            };
            
            if (applicationCode) {
                query.applicationCode = applicationCode;
            }
            
            const application = await Application.findOne(query)
                .populate('student', 'firstName lastName email')
                .lean();
            
            if (!application) {
                return {
                    success: false,
                    error: 'No approved application found for this student',
                    tenantsChecked: 0,
                    accrualsCreated: 0,
                    accrualsSkipped: 0,
                    errors: []
                };
            }
            
            const studentName = application.student 
                ? `${application.student.firstName} ${application.student.lastName}`
                : `${application.firstName} ${application.lastName}`;
            
            console.log(`   Found tenant: ${studentName} (${application.applicationCode})`);
            console.log(`   Lease period: ${application.startDate?.toISOString().split('T')[0]} to ${application.endDate?.toISOString().split('T')[0]}`);
            
            // Get debtor information
            const debtor = await Debtor.findOne({ user: studentId }).lean();
            const debtorId = debtor?._id?.toString();
            const arAccountCode = debtor?.accountCode 
                ? (typeof debtor.accountCode === 'string' && debtor.accountCode.startsWith('1100-') 
                    ? debtor.accountCode 
                    : `1100-${debtorId}`)
                : (debtorId ? `1100-${debtorId}` : null);
            
            console.log(`   Debtor ID: ${debtorId || 'N/A'}, AR Account Code: ${arAccountCode || 'N/A'}`);
            
            // Calculate lease period
            const leaseStartDate = new Date(application.startDate);
            const leaseEndDate = new Date(application.endDate);
            
            // Calculate which months should have monthly accruals
            const leaseStartMonth = leaseStartDate.getMonth() + 1;
            const leaseStartYear = leaseStartDate.getFullYear();
            const leaseEndMonth = leaseEndDate.getMonth() + 1;
            const leaseEndYear = leaseEndDate.getFullYear();
            
            // Determine the range of months to check
            // Start from the month AFTER lease start, up to the earlier of: current month or lease end month
            let checkStartMonth = leaseStartMonth;
            let checkStartYear = leaseStartYear;
            
            // Move to the month after lease start (skip lease start month)
            checkStartMonth++;
            if (checkStartMonth > 12) {
                checkStartMonth = 1;
                checkStartYear++;
            }
            
            // End at the earlier of: current month or lease end month
            const checkEndMonth = Math.min(currentMonth, leaseEndMonth);
            const checkEndYear = currentMonth <= leaseEndMonth ? currentYear : leaseEndYear;
            
            console.log(`   Monthly accruals needed from ${checkStartMonth}/${checkStartYear} to ${checkEndMonth}/${checkEndYear}`);
            
            let accrualsCreated = 0;
            let accrualsSkipped = 0;
            const errors = [];
            const monthsChecked = [];
            const monthsMissing = [];
            const monthsWithAccruals = [];
            
            // Iterate through each month that should have a monthly accrual
            let month = checkStartMonth;
            let year = checkStartYear;
            
            while (year < checkEndYear || (year === checkEndYear && month <= checkEndMonth)) {
                // Skip future months
                if (year > currentYear || (year === currentYear && month > currentMonth)) {
                    console.log(`   ⏭️ Skipping future month ${month}/${year}`);
                    month++;
                    if (month > 12) {
                        month = 1;
                        year++;
                    }
                    continue;
                }
                
                // Ensure month is within lease period
                const monthStart = new Date(year, month - 1, 1);
                const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
                
                // Skip if month is completely before lease start or after lease end
                if (monthEnd < leaseStartDate || monthStart > leaseEndDate) {
                    console.log(`   ⏭️ Skipping month ${month}/${year} - outside lease period`);
                    month++;
                    if (month > 12) {
                        month = 1;
                        year++;
                    }
                    continue;
                }
                
                // Break if we've passed the lease end
                if (monthStart > leaseEndDate) {
                    break;
                }
                
                monthsChecked.push(`${month}/${year}`);
                
                // Check if monthly accrual already exists for this month
                console.log(`   🔍 Checking for monthly accrual for ${month}/${year}...`);
                let existingAccrual = await RentalAccrualService.checkExistingMonthlyAccrual(
                    studentId,
                    month,
                    year,
                    application._id,
                    debtorId
                );
                
                // Also check by AR account code if we have it
                if (!existingAccrual && arAccountCode) {
                    console.log(`   🔍 Checking by AR account code ${arAccountCode} for ${month}/${year}...`);
                    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
                    existingAccrual = await TransactionEntry.findOne({
                        source: 'rental_accrual',
                        status: { $ne: 'deleted' },
                        'entries.accountCode': arAccountCode,
                        $and: [
                            {
                                $or: [
                                    { 'metadata.type': 'monthly_rent_accrual' },
                                    { description: { $regex: /Monthly.*accrual/i } }
                                ]
                            },
                            {
                                $or: [
                                    { 'metadata.accrualMonth': month, 'metadata.accrualYear': year },
                                    { 'metadata.month': monthKey },
                                    { description: { $regex: new RegExp(monthKey) } }
                                ]
                            }
                        ]
                    });
                }
                
                if (existingAccrual) {
                    console.log(`   ✅ Monthly accrual already exists for ${month}/${year} (ID: ${existingAccrual._id})`);
                    accrualsSkipped++;
                    monthsWithAccruals.push(`${month}/${year}`);
                } else {
                    console.log(`   ⚠️ Monthly accrual missing for ${month}/${year} - will create`);
                    monthsMissing.push(`${month}/${year}`);
                    
                    // Create missing monthly accrual
                    try {
                        console.log(`   🔄 Creating missing monthly accrual for ${month}/${year}...`);
                        
                        // Create student-like object from application for createStudentRentAccrual
                        // Include debtor information to ensure same debtor account code is used as monthly cron service
                        const studentData = {
                            student: studentId,
                            firstName: application.student?.firstName || application.firstName,
                            lastName: application.student?.lastName || application.lastName,
                            email: application.student?.email || application.email || '',
                            residence: application.residence,
                            allocatedRoom: application.allocatedRoom || application.allocatedRoomDetails?.roomNumber || '',
                            startDate: application.startDate,
                            endDate: application.endDate,
                            application: application._id,
                            applicationCode: application.applicationCode,
                            // 🆕 CRITICAL: Pass debtor information to ensure same debtor account code is used
                            debtor: debtorId, // Pass debtor ID so createStudentRentAccrual uses the same debtor
                            debtorAccountCode: arAccountCode // Pass the account code we already validated
                        };
                        
                        const result = await RentalAccrualService.createStudentRentAccrual(studentData, month, year);
                        
                        if (result.success) {
                            console.log(`   ✅ Created monthly accrual for ${month}/${year}: $${result.amount}`);
                            accrualsCreated++;
                            monthsWithAccruals.push(`${month}/${year}`);
                        } else {
                            console.log(`   ⚠️ Failed to create monthly accrual for ${month}/${year}: ${result.error}`);
                            errors.push({
                                tenant: studentName,
                                applicationCode: application.applicationCode,
                                month,
                                year,
                                error: result.error
                            });
                        }
                    } catch (error) {
                        console.error(`   ❌ Error creating monthly accrual for ${month}/${year}: ${error.message}`);
                        errors.push({
                            tenant: studentName,
                            applicationCode: application.applicationCode,
                            month,
                            year,
                            error: error.message
                        });
                    }
                }
                
                // Move to next month
                month++;
                if (month > 12) {
                    month = 1;
                    year++;
                }
            }
            
            console.log(`\n✅ TENANT ACCRUAL CHECK COMPLETED FOR ${studentName}`);
            console.log(`   📊 Monthly Accrual Summary:`);
            console.log(`      Months checked: ${monthsChecked.length} (${monthsChecked.join(', ')})`);
            console.log(`      Months with accruals: ${monthsWithAccruals.length} (${monthsWithAccruals.join(', ')})`);
            if (monthsMissing.length > 0) {
                console.log(`      Months missing accruals: ${monthsMissing.length} (${monthsMissing.join(', ')})`);
            }
            console.log(`   Created: ${accrualsCreated}, Already existed: ${accrualsSkipped}`);
            console.log(`   Errors: ${errors.length}`);
            
            return {
                success: true,
                tenant: studentName,
                applicationCode: application.applicationCode,
                accrualsCreated,
                accrualsSkipped,
                monthsChecked,
                monthsWithAccruals,
                monthsMissing,
                errors
            };
            
        } catch (error) {
            console.error(`❌ Error checking specific tenant: ${error.message}`);
            return {
                success: false,
                error: error.message,
                accrualsCreated: 0,
                accrualsSkipped: 0,
                errors: [{ error: error.message }]
            };
        }
    }
    
    /**
     * Diagnostic function to check why a specific month's accrual might be missing
     * @param {string} studentId - Student ID
     * @param {number} month - Month to check (1-12)
     * @param {number} year - Year to check
     * @returns {Promise<Object>} Diagnostic information
     */
    static async diagnoseMissingAccrual(studentId, month, year) {
        try {
            console.log(`\n🔍 DIAGNOSING MISSING ACCRUAL FOR ${month}/${year}`);
            console.log(`   Student ID: ${studentId}`);
            
            // Ensure database connection
            if (mongoose.connection.readyState !== 1) {
                throw new Error('Database connection not available');
            }
            
            const Application = require('../models/Application');
            const Debtor = require('../models/Debtor');
            const TransactionEntry = require('../models/TransactionEntry');
            const RentalAccrualService = require('./rentalAccrualService');
            
            // Find application
            const application = await Application.findOne({
                student: studentId,
                status: 'approved',
                paymentStatus: { $ne: 'cancelled' }
            })
            .populate('student', 'firstName lastName email')
            .lean();
            
            if (!application) {
                return {
                    found: false,
                    reason: 'No approved application found for this student'
                };
            }
            
            const studentName = application.student 
                ? `${application.student.firstName} ${application.student.lastName}`
                : `${application.firstName} ${application.lastName}`;
            
            console.log(`   Tenant: ${studentName} (${application.applicationCode})`);
            console.log(`   Lease: ${application.startDate?.toISOString().split('T')[0]} to ${application.endDate?.toISOString().split('T')[0]}`);
            
            // Get debtor
            const debtor = await Debtor.findOne({ user: studentId }).lean();
            const debtorId = debtor?._id?.toString();
            const arAccountCode = debtor?.accountCode 
                ? (typeof debtor.accountCode === 'string' && debtor.accountCode.startsWith('1100-') 
                    ? debtor.accountCode 
                    : `1100-${debtorId}`)
                : (debtorId ? `1100-${debtorId}` : null);
            
            console.log(`   Debtor ID: ${debtorId || 'N/A'}, AR Account Code: ${arAccountCode || 'N/A'}`);
            
            // Check lease dates
            const leaseStartDate = new Date(application.startDate);
            const leaseEndDate = new Date(application.endDate);
            const leaseStartMonth = leaseStartDate.getMonth() + 1;
            const leaseStartYear = leaseStartDate.getFullYear();
            const leaseEndMonth = leaseEndDate.getMonth() + 1;
            const leaseEndYear = leaseEndDate.getFullYear();
            
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
            
            const now = new Date();
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();
            
            const diagnostics = {
                found: true,
                tenant: studentName,
                applicationCode: application.applicationCode,
                month,
                year,
                leaseStart: {
                    date: leaseStartDate.toISOString().split('T')[0],
                    month: leaseStartMonth,
                    year: leaseStartYear
                },
                leaseEnd: {
                    date: leaseEndDate.toISOString().split('T')[0],
                    month: leaseEndMonth,
                    year: leaseEndYear
                },
                targetMonth: {
                    start: monthStart.toISOString().split('T')[0],
                    end: monthEnd.toISOString().split('T')[0]
                },
                currentDate: {
                    date: now.toISOString().split('T')[0],
                    month: currentMonth,
                    year: currentYear
                },
                checks: {}
            };
            
            // Check 1: Is this the lease start month?
            if (month === leaseStartMonth && year === leaseStartYear) {
                diagnostics.checks.isLeaseStartMonth = true;
                diagnostics.reason = 'This is the lease start month - monthly accrual is not created (handled by lease_start process)';
                console.log(`   ⚠️ ${month}/${year} is the lease start month - monthly accrual not created`);
                return diagnostics;
            }
            diagnostics.checks.isLeaseStartMonth = false;
            
            // Check 2: Is month within lease period?
            const isWithinLease = monthEnd >= leaseStartDate && monthStart <= leaseEndDate;
            diagnostics.checks.isWithinLease = isWithinLease;
            if (!isWithinLease) {
                diagnostics.reason = `Month ${month}/${year} is outside lease period`;
                console.log(`   ❌ Month ${month}/${year} is outside lease period`);
                return diagnostics;
            }
            console.log(`   ✅ Month ${month}/${year} is within lease period`);
            
            // Check 3: Is month in the future?
            const isFuture = year > currentYear || (year === currentYear && month > currentMonth);
            diagnostics.checks.isFuture = isFuture;
            if (isFuture) {
                diagnostics.reason = `Month ${month}/${year} is in the future - accrual will be created when month arrives`;
                console.log(`   ⏭️ Month ${month}/${year} is in the future`);
                return diagnostics;
            }
            console.log(`   ✅ Month ${month}/${year} is not in the future`);
            
            // Check 4: Does accrual already exist?
            let existingAccrual = await RentalAccrualService.checkExistingMonthlyAccrual(
                studentId,
                month,
                year,
                application._id,
                debtorId
            );
            
            if (!existingAccrual && arAccountCode) {
                const monthKey = `${year}-${String(month).padStart(2, '0')}`;
                existingAccrual = await TransactionEntry.findOne({
                    source: 'rental_accrual',
                    status: { $ne: 'deleted' },
                    'entries.accountCode': arAccountCode,
                    $and: [
                        {
                            $or: [
                                { 'metadata.type': 'monthly_rent_accrual' },
                                { description: { $regex: /Monthly.*accrual/i } }
                            ]
                        },
                        {
                            $or: [
                                { 'metadata.accrualMonth': month, 'metadata.accrualYear': year },
                                { 'metadata.month': monthKey },
                                { description: { $regex: new RegExp(monthKey) } }
                            ]
                        }
                    ]
                });
            }
            
            diagnostics.checks.accrualExists = !!existingAccrual;
            if (existingAccrual) {
                diagnostics.existingAccrual = {
                    id: existingAccrual._id,
                    date: existingAccrual.date?.toISOString().split('T')[0],
                    description: existingAccrual.description
                };
                diagnostics.reason = `Accrual already exists (ID: ${existingAccrual._id})`;
                console.log(`   ✅ Accrual already exists: ${existingAccrual._id}`);
                return diagnostics;
            }
            console.log(`   ❌ No accrual found for ${month}/${year}`);
            
            // Check 5: Should this month be checked by the service?
            // Calculate what the service would check
            let checkStartMonth = leaseStartMonth;
            let checkStartYear = leaseStartYear;
            checkStartMonth++;
            if (checkStartMonth > 12) {
                checkStartMonth = 1;
                checkStartYear++;
            }
            
            let checkEndMonth, checkEndYear;
            if (currentYear < leaseEndYear) {
                checkEndMonth = currentMonth;
                checkEndYear = currentYear;
            } else if (currentYear > leaseEndYear) {
                checkEndMonth = leaseEndMonth;
                checkEndYear = leaseEndYear;
            } else {
                checkEndMonth = Math.min(currentMonth, leaseEndMonth);
                checkEndYear = currentYear;
            }
            
            diagnostics.checks.serviceWouldCheck = {
                startMonth: checkStartMonth,
                startYear: checkStartYear,
                endMonth: checkEndMonth,
                endYear: checkEndYear
            };
            
            const wouldBeChecked = (year > checkStartYear || (year === checkStartYear && month >= checkStartMonth)) &&
                                   (year < checkEndYear || (year === checkEndYear && month <= checkEndMonth));
            
            diagnostics.checks.wouldBeChecked = wouldBeChecked;
            
            if (!wouldBeChecked) {
                diagnostics.reason = `Service would not check ${month}/${year} - outside check range (${checkStartMonth}/${checkStartYear} to ${checkEndMonth}/${checkEndYear})`;
                console.log(`   ⚠️ Service would not check ${month}/${year}`);
                console.log(`      Check range: ${checkStartMonth}/${checkStartYear} to ${checkEndMonth}/${checkEndYear}`);
            } else {
                diagnostics.reason = `Accrual is missing and should be created`;
                console.log(`   ✅ Service should check ${month}/${year}`);
            }
            
            return diagnostics;
            
        } catch (error) {
            console.error(`❌ Error diagnosing missing accrual: ${error.message}`);
            return {
                found: false,
                error: error.message
            };
        }
    }
    
    /**
     * 🆕 Comprehensive validation of all accruals for a single tenant
     * Validates both lease start and all monthly accruals
     * @param {string} applicationId - Application ID to validate
     * @param {boolean} createMissing - If true, create missing accruals (default: false)
     * @returns {Promise<Object>} Validation results
     */
    static async validateTenantAccruals(applicationId, createMissing = false) {
        try {
            const Application = require('../models/Application');
            const RentalAccrualService = require('./rentalAccrualService');
            const TransactionEntry = require('../models/TransactionEntry');
            
            const application = await Application.findById(applicationId)
                .populate('student', 'firstName lastName email')
                .lean();
            
            if (!application) {
                return { success: false, error: 'Application not found' };
            }
            
            const studentId = application.student?._id?.toString() || application.student?.toString();
            const studentName = application.student 
                ? `${application.student.firstName} ${application.student.lastName}`
                : `${application.firstName} ${application.lastName}`;
            
            // Get debtor information
            const Debtor = require('../models/Debtor');
            const debtor = await Debtor.findOne({ user: studentId }).lean();
            const debtorId = debtor?._id?.toString();
            const arAccountCode = debtor?.accountCode 
                ? (typeof debtor.accountCode === 'string' && debtor.accountCode.startsWith('1100-') 
                    ? debtor.accountCode 
                    : `1100-${debtorId}`)
                : (debtorId ? `1100-${debtorId}` : null);
            
            const now = new Date();
            const leaseStartDate = new Date(application.startDate);
            const leaseEndDate = new Date(application.endDate);
            
            const validation = {
                applicationId: applicationId.toString(),
                applicationCode: application.applicationCode,
                studentName,
                studentId: studentId,
                debtorId: debtorId || null,
                arAccountCode: arAccountCode || null,
                leaseStart: leaseStartDate.toISOString().split('T')[0],
                leaseEnd: leaseEndDate.toISOString().split('T')[0],
                leaseStartExists: false,
                leaseStartTransaction: null,
                monthlyAccruals: {
                    expected: [],
                    found: [],
                    missing: [],
                    duplicates: []
                },
                isValid: false,
                errors: [],
                warnings: []
            };
            
            // Check lease start
            if (leaseStartDate <= now) {
                const existingLeaseStart = await TransactionEntry.findOne({
                    $or: [
                        { 'metadata.applicationId': application._id, 'metadata.type': 'lease_start' },
                        { 'metadata.applicationCode': application.applicationCode, 'metadata.type': 'lease_start' },
                        ...(debtorId ? [
                            { source: 'rental_accrual', 'metadata.type': 'lease_start', 'metadata.debtorId': debtorId },
                            { source: 'rental_accrual', sourceModel: 'Debtor', sourceId: debtorId, 'metadata.type': 'lease_start' }
                        ] : []),
                        ...(arAccountCode ? [
                            { source: 'rental_accrual', 'metadata.type': 'lease_start', 'entries.accountCode': arAccountCode }
                        ] : [])
                    ],
                    status: { $ne: 'deleted' }
                });
                
                validation.leaseStartExists = !!existingLeaseStart;
                validation.leaseStartTransaction = existingLeaseStart?._id?.toString() || null;
                
                if (!validation.leaseStartExists && createMissing) {
                    try {
                        const leaseStartResult = await RentalAccrualService.processLeaseStart(application);
                        if (leaseStartResult && leaseStartResult.success && !leaseStartResult.skipped) {
                            validation.leaseStartExists = true;
                            validation.leaseStartTransaction = leaseStartResult.transactionId || 'created';
                        } else {
                            validation.errors.push({
                                type: 'lease_start',
                                error: leaseStartResult?.error || 'Failed to create lease start'
                            });
                        }
                    } catch (error) {
                        validation.errors.push({
                            type: 'lease_start',
                            error: error.message
                        });
                    }
                }
            } else {
                validation.warnings.push('Lease has not started yet');
            }
            
            // Check monthly accruals
            const startMonth = leaseStartDate.getMonth() + 1;
            const startYear = leaseStartDate.getFullYear();
            const endMonth = leaseEndDate.getMonth() + 1;
            const endYear = leaseEndDate.getFullYear();
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();
            
            // Calculate expected months (from month after start to lease end or current month)
            let checkMonth = startMonth;
            let checkYear = startYear;
            checkMonth++; // Start from month after lease start
            if (checkMonth > 12) {
                checkMonth = 1;
                checkYear++;
            }
            
            // End at the earlier of: lease end month or current month
            let endCheckMonth, endCheckYear;
            if (currentYear < endYear) {
                endCheckMonth = currentMonth;
                endCheckYear = currentYear;
            } else if (currentYear > endYear) {
                endCheckMonth = endMonth;
                endCheckYear = endYear;
            } else {
                endCheckMonth = Math.min(endMonth, currentMonth);
                endCheckYear = currentYear;
            }
            
            // Iterate through expected months
            while (checkYear < endCheckYear || (checkYear === endCheckYear && checkMonth <= endCheckMonth)) {
                const monthKey = `${checkYear}-${String(checkMonth).padStart(2, '0')}`;
                validation.monthlyAccruals.expected.push(monthKey);
                
                // Check for existing accrual
                const existingAccrual = await RentalAccrualService.checkExistingMonthlyAccrual(
                    studentId,
                    checkMonth,
                    checkYear,
                    application._id,
                    debtorId
                );
                
                if (existingAccrual) {
                    validation.monthlyAccruals.found.push({
                        month: monthKey,
                        transactionId: existingAccrual._id.toString(),
                        date: existingAccrual.date?.toISOString().split('T')[0] || null,
                        amount: existingAccrual.totalDebit || 0
                    });
                } else {
                    validation.monthlyAccruals.missing.push(monthKey);
                    
                    // Create if requested
                    if (createMissing) {
                        try {
                            const studentData = {
                                student: studentId,
                                firstName: application.student?.firstName || application.firstName,
                                lastName: application.student?.lastName || application.lastName,
                                email: application.student?.email || application.email || '',
                                residence: application.residence,
                                allocatedRoom: application.allocatedRoom || application.allocatedRoomDetails?.roomNumber || '',
                                startDate: application.startDate,
                                endDate: application.endDate,
                                application: application._id,
                                applicationCode: application.applicationCode,
                                debtor: debtorId,
                                debtorAccountCode: arAccountCode
                            };
                            
                            const result = await RentalAccrualService.createStudentRentAccrual(
                                studentData,
                                checkMonth,
                                checkYear
                            );
                            
                            if (result.success) {
                                validation.monthlyAccruals.found.push({
                                    month: monthKey,
                                    transactionId: result.transactionId || 'created',
                                    created: true,
                                    amount: result.amount || 0
                                });
                                // Remove from missing since we created it
                                validation.monthlyAccruals.missing = validation.monthlyAccruals.missing.filter(m => m !== monthKey);
                            } else {
                                validation.errors.push({
                                    month: monthKey,
                                    error: result.error || 'Failed to create accrual'
                                });
                            }
                        } catch (error) {
                            validation.errors.push({
                                month: monthKey,
                                error: error.message
                            });
                        }
                    }
                }
                
                // Move to next month
                checkMonth++;
                if (checkMonth > 12) {
                    checkMonth = 1;
                    checkYear++;
                }
            }
            
            // Determine if valid
            validation.isValid = 
                (leaseStartDate > now || validation.leaseStartExists) &&
                validation.monthlyAccruals.missing.length === 0 &&
                validation.errors.length === 0;
            
            return {
                success: true,
                validation
            };
            
        } catch (error) {
            console.error('Error validating tenant accruals:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = TenantAccrualCheckService;
