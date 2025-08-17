// MongoDB Shell Script to Migrate Debtors to New Billing Period Object
// Run this script directly in mongosh

// Function to calculate billing period object
function calculateBillingPeriodObject(debtor, legacyBillingPeriod) {
    // Parse legacy billing period string
    const legacyMatch = legacyBillingPeriod.match(/(\d+)\s*(months?|years?|weeks?|days?)/i);
    
    let durationValue = 6; // Default to 6 months
    let durationUnit = 'months';
    let billingType = 'monthly';
    
    if (legacyMatch) {
        durationValue = parseInt(legacyMatch[1]);
        const unit = legacyMatch[2].toLowerCase();
        
        if (unit.includes('year')) {
            durationUnit = 'years';
            billingType = 'annual';
        } else if (unit.includes('week')) {
            durationUnit = 'weeks';
            billingType = 'weekly';
        } else if (unit.includes('day')) {
            durationUnit = 'days';
            billingType = 'custom';
        } else {
            durationUnit = 'months';
            billingType = durationValue === 3 ? 'quarterly' : 
                         durationValue === 6 ? 'semester' : 
                         durationValue === 8 ? 'custom' : 'monthly';
        }
    }

    // Use existing dates or calculate from duration
    const startDate = debtor.startDate || debtor.createdAt || new Date();
    const endDate = debtor.endDate || calculateEndDate(startDate, durationValue, durationUnit);

    // Calculate amounts
    const monthlyAmount = debtor.roomPrice || 0;
    const totalAmount = calculateTotalAmount(monthlyAmount, durationValue, durationUnit);

    return {
        // Period Information
        type: billingType,
        
        // Duration
        duration: {
            value: durationValue,
            unit: durationUnit
        },
        
        // Date Range
        startDate: startDate,
        endDate: endDate,
        
        // Billing Cycle
        billingCycle: {
            frequency: 'monthly',
            dayOfMonth: 1,
            gracePeriod: 5
        },
        
        // Amount Information
        amount: {
            monthly: monthlyAmount,
            total: totalAmount,
            currency: 'USD'
        },
        
        // Status
        status: debtor.status === 'paid' ? 'completed' : 'active',
        
        // Additional Information
        description: `Billing period for ${debtor.debtorCode}`,
        notes: `Migrated from legacy format: "${legacyBillingPeriod}"`,
        
        // Auto-renewal settings
        autoRenewal: {
            enabled: false,
            renewalType: 'same_period',
            customRenewalPeriod: null
        }
    };
}

function calculateEndDate(startDate, durationValue, durationUnit) {
    const start = new Date(startDate);
    
    switch (durationUnit) {
        case 'years':
            return new Date(start.setFullYear(start.getFullYear() + durationValue));
        case 'months':
            return new Date(start.setMonth(start.getMonth() + durationValue));
        case 'weeks':
            return new Date(start.setDate(start.getDate() + (durationValue * 7)));
        case 'days':
            return new Date(start.setDate(start.getDate() + durationValue));
        default:
            return new Date(start.setMonth(start.getMonth() + durationValue));
    }
}

function calculateTotalAmount(monthlyAmount, durationValue, durationUnit) {
    switch (durationUnit) {
        case 'years':
            return monthlyAmount * 12 * durationValue;
        case 'months':
            return monthlyAmount * durationValue;
        case 'weeks':
            return monthlyAmount * (durationValue / 4.33); // Approximate weeks per month
        case 'days':
            return monthlyAmount * (durationValue / 30.44); // Approximate days per month
        default:
            return monthlyAmount * durationValue;
    }
}

// Main migration function
function migrateDebtors() {
    print("🔗 Starting Debtor Billing Period Migration...");
    
    // Specific debtors to migrate
    const debtorsToMigrate = [
        {
            _id: ObjectId("6892533cf3c211159d96cf54"),
            debtorCode: "DR0004",
            billingPeriod: "3 months",
            startDate: new Date("2025-08-05T00:00:00.000+00:00"),
            endDate: new Date("2025-10-05T00:00:00.000+00:00"),
            roomPrice: 150
        },
        {
            _id: ObjectId("68935a016a1babaf7774d67f"),
            debtorCode: "DR0005",
            billingPeriod: null,
            startDate: null,
            endDate: null,
            roomPrice: 0
        },
        {
            _id: ObjectId("68935a016a1babaf7774d68a"),
            debtorCode: "DR0006",
            billingPeriod: null,
            startDate: null,
            endDate: null,
            roomPrice: 0
        },
        {
            _id: ObjectId("689399b8beb18032feaddfc6"),
            debtorCode: "DR0007",
            billingPeriod: "8 months",
            startDate: new Date("2025-05-30T00:00:00.000+00:00"),
            endDate: new Date("2025-12-31T00:00:00.000+00:00"),
            roomPrice: 180
        }
    ];
    
    print(`📊 Found ${debtorsToMigrate.length} debtors to migrate`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    
    debtorsToMigrate.forEach(function(debtorData) {
        try {
            print(`\n🔄 Processing debtor: ${debtorData.debtorCode}`);
            
            // Get the current debtor from database
            const currentDebtor = db.debtors.findOne({ _id: debtorData._id });
            
            if (!currentDebtor) {
                print(`⚠️  Debtor ${debtorData.debtorCode} not found in database`);
                skippedCount++;
                return;
            }
            
            // Preserve legacy billing period
            const legacyBillingPeriod = currentDebtor.billingPeriod || debtorData.billingPeriod || 'Unknown';
            
            // Calculate new billing period object
            const newBillingPeriod = calculateBillingPeriodObject(currentDebtor, legacyBillingPeriod);
            
            // Update the debtor
            const updateResult = db.debtors.updateOne(
                { _id: debtorData._id },
                {
                    $set: {
                        billingPeriod: newBillingPeriod,
                        billingPeriodLegacy: legacyBillingPeriod
                    }
                }
            );
            
            if (updateResult.modifiedCount > 0) {
                migratedCount++;
                print(`✅ Migrated debtor ${debtorData.debtorCode}:`);
                print(`   Type: ${newBillingPeriod.type}`);
                print(`   Duration: ${newBillingPeriod.duration.value} ${newBillingPeriod.duration.unit}`);
                print(`   Amount: $${newBillingPeriod.amount.monthly}/month`);
                print(`   Total: $${newBillingPeriod.amount.total}`);
                print(`   Legacy: "${legacyBillingPeriod}"`);
                print(`   Start Date: ${newBillingPeriod.startDate}`);
                print(`   End Date: ${newBillingPeriod.endDate}`);
            } else {
                skippedCount++;
                print(`⚠️  No changes needed for debtor ${debtorData.debtorCode}`);
            }
            
        } catch (error) {
            print(`❌ Error migrating debtor ${debtorData.debtorCode}: ${error.message}`);
            skippedCount++;
        }
    });
    
    print('\n🎯 Migration Summary:');
    print(`   Total debtors processed: ${debtorsToMigrate.length}`);
    print(`   Successfully migrated: ${migratedCount}`);
    print(`   Skipped/Errors: ${skippedCount}`);
    
    // Show examples of migrated data
    const sampleDebtors = db.debtors.find({
        _id: { $in: debtorsToMigrate.map(d => d._id) }
    }).toArray();
    
    print('\n📋 Migrated Debtors Summary:');
    sampleDebtors.forEach(function(debtor, index) {
        print(`   ${index + 1}. ${debtor.debtorCode}:`);
        if (debtor.billingPeriod && typeof debtor.billingPeriod === 'object') {
            print(`      Type: ${debtor.billingPeriod.type}`);
            print(`      Duration: ${debtor.billingPeriod.duration.value} ${debtor.billingPeriod.duration.unit}`);
            print(`      Monthly Amount: $${debtor.billingPeriod.amount.monthly}`);
            print(`      Total Amount: $${debtor.billingPeriod.amount.total}`);
            print(`      Status: ${debtor.billingPeriod.status}`);
            print(`      Legacy: "${debtor.billingPeriodLegacy}"`);
        } else {
            print(`      ❌ Still using old format: "${debtor.billingPeriod}"`);
        }
    });
    
    print('\n✅ Migration completed successfully!');
    print('💡 Benefits of new structure:');
    print('   - Flexible billing cycles (weekly, monthly, quarterly, etc.)');
    print('   - Detailed amount tracking (monthly vs total)');
    print('   - Auto-renewal settings');
    print('   - Grace period management');
    print('   - Better reporting and analytics');
}

// Run the migration
migrateDebtors();
