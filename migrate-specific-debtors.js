// Migrate Specific Debtors to New Billing Period Object Structure
// This script migrates the specific debtors shown in the user's data

const { MongoClient, ObjectId } = require('mongodb');

async function migrateSpecificDebtors() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait';
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('🔗 Connected to MongoDB');

        const db = client.db();
        const debtorsCollection = db.collection('debtors');

        console.log('\n📋 Migrating Specific Debtors to New Billing Period Structure...');

        // Specific debtors to migrate based on the user's data
        const debtorsToMigrate = [
            {
                _id: new ObjectId("6892533cf3c211159d96cf54"),
                debtorCode: "DR0004",
                billingPeriod: "3 months",
                startDate: new Date("2025-08-05T00:00:00.000+00:00"),
                endDate: new Date("2025-10-05T00:00:00.000+00:00"),
                roomPrice: 150,
                status: "active"
            },
            {
                _id: new ObjectId("68935a016a1babaf7774d67f"),
                debtorCode: "DR0005",
                billingPeriod: null, // No billing period specified
                startDate: null,
                endDate: null,
                roomPrice: 0,
                status: "active"
            },
            {
                _id: new ObjectId("68935a016a1babaf7774d68a"),
                debtorCode: "DR0006",
                billingPeriod: null, // No billing period specified
                startDate: null,
                endDate: null,
                roomPrice: 0,
                status: "active"
            },
            {
                _id: new ObjectId("689399b8beb18032feaddfc6"),
                debtorCode: "DR0007",
                billingPeriod: "8 months",
                startDate: new Date("2025-05-30T00:00:00.000+00:00"),
                endDate: new Date("2025-12-31T00:00:00.000+00:00"),
                roomPrice: 180,
                status: "active"
            }
        ];

        console.log(`📊 Found ${debtorsToMigrate.length} debtors to migrate`);

        let migratedCount = 0;
        let skippedCount = 0;

        for (const debtorData of debtorsToMigrate) {
            try {
                console.log(`\n🔄 Processing debtor: ${debtorData.debtorCode}`);

                // Get the current debtor from database
                const currentDebtor = await debtorsCollection.findOne({ _id: debtorData._id });
                
                if (!currentDebtor) {
                    console.log(`⚠️  Debtor ${debtorData.debtorCode} not found in database`);
                    skippedCount++;
                    continue;
                }

                // Preserve legacy billing period
                const legacyBillingPeriod = currentDebtor.billingPeriod || debtorData.billingPeriod || 'Unknown';

                // Calculate new billing period object
                const newBillingPeriod = calculateBillingPeriodObject(currentDebtor, legacyBillingPeriod, debtorData);

                // Update the debtor
                const updateResult = await debtorsCollection.updateOne(
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
                    console.log(`✅ Migrated debtor ${debtorData.debtorCode}:`);
                    console.log(`   Type: ${newBillingPeriod.type}`);
                    console.log(`   Duration: ${newBillingPeriod.duration.value} ${newBillingPeriod.duration.unit}`);
                    console.log(`   Amount: $${newBillingPeriod.amount.monthly}/month`);
                    console.log(`   Total: $${newBillingPeriod.amount.total}`);
                    console.log(`   Legacy: "${legacyBillingPeriod}"`);
                    console.log(`   Start Date: ${newBillingPeriod.startDate}`);
                    console.log(`   End Date: ${newBillingPeriod.endDate}`);
                } else {
                    skippedCount++;
                    console.log(`⚠️  No changes needed for debtor ${debtorData.debtorCode}`);
                }

            } catch (error) {
                console.error(`❌ Error migrating debtor ${debtorData.debtorCode}:`, error.message);
                skippedCount++;
            }
        }

        console.log('\n🎯 Migration Summary:');
        console.log(`   Total debtors processed: ${debtorsToMigrate.length}`);
        console.log(`   Successfully migrated: ${migratedCount}`);
        console.log(`   Skipped/Errors: ${skippedCount}`);

        // Show examples of migrated data
        const sampleDebtors = await debtorsCollection.find({
            _id: { $in: debtorsToMigrate.map(d => d._id) }
        }).toArray();

        console.log('\n📋 Migrated Debtors Summary:');
        sampleDebtors.forEach((debtor, index) => {
            console.log(`   ${index + 1}. ${debtor.debtorCode}:`);
            if (debtor.billingPeriod && typeof debtor.billingPeriod === 'object') {
                console.log(`      Type: ${debtor.billingPeriod.type}`);
                console.log(`      Duration: ${debtor.billingPeriod.duration.value} ${debtor.billingPeriod.duration.unit}`);
                console.log(`      Monthly Amount: $${debtor.billingPeriod.amount.monthly}`);
                console.log(`      Total Amount: $${debtor.billingPeriod.amount.total}`);
                console.log(`      Status: ${debtor.billingPeriod.status}`);
                console.log(`      Legacy: "${debtor.billingPeriodLegacy}"`);
            } else {
                console.log(`      ❌ Still using old format: "${debtor.billingPeriod}"`);
            }
        });

        console.log('\n✅ Migration completed successfully!');
        console.log('💡 Benefits of new structure:');
        console.log('   - Flexible billing cycles (weekly, monthly, quarterly, etc.)');
        console.log('   - Detailed amount tracking (monthly vs total)');
        console.log('   - Auto-renewal settings');
        console.log('   - Grace period management');
        console.log('   - Better reporting and analytics');

    } catch (error) {
        console.error('❌ Error during migration:', error);
    } finally {
        await client.close();
        console.log('🔌 Disconnected from MongoDB');
    }
}

function calculateBillingPeriodObject(debtor, legacyBillingPeriod, debtorData) {
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

    // Use provided dates or calculate from duration
    const startDate = debtorData.startDate || debtor.startDate || debtor.createdAt || new Date();
    const endDate = debtorData.endDate || debtor.endDate || calculateEndDate(startDate, durationValue, durationUnit);

    // Calculate amounts
    const monthlyAmount = debtorData.roomPrice || debtor.roomPrice || 0;
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
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        
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

// Run the migration
migrateSpecificDebtors().catch(console.error);
