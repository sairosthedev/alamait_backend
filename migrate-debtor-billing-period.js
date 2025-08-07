// Migrate Debtor Billing Period to Object Structure
// This script converts existing debtors from simple billingPeriod string to comprehensive object

const { MongoClient, ObjectId } = require('mongodb');

async function migrateDebtorBillingPeriod() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait';
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('🔗 Connected to MongoDB');

        const db = client.db();
        const debtorsCollection = db.collection('debtors');

        console.log('\n📋 Migrating Debtor Billing Periods to Object Structure...');

        // Find all debtors that need migration
        const debtors = await debtorsCollection.find({
            $or: [
                { billingPeriod: { $type: "string" } },
                { billingPeriod: { $exists: false } },
                { billingPeriodLegacy: { $exists: false } }
            ]
        }).toArray();

        console.log(`📊 Found ${debtors.length} debtors to migrate`);

        if (debtors.length === 0) {
            console.log('✅ No debtors need migration');
            return;
        }

        let migratedCount = 0;
        let skippedCount = 0;

        for (const debtor of debtors) {
            try {
                console.log(`\n🔄 Processing debtor: ${debtor.debtorCode} (${debtor.user})`);

                // Preserve legacy billing period
                const legacyBillingPeriod = debtor.billingPeriod || 'Unknown';

                // Calculate new billing period object
                const newBillingPeriod = calculateBillingPeriodObject(debtor, legacyBillingPeriod);

                // Update the debtor
                const updateResult = await debtorsCollection.updateOne(
                    { _id: debtor._id },
                    {
                        $set: {
                            billingPeriod: newBillingPeriod,
                            billingPeriodLegacy: legacyBillingPeriod
                        }
                    }
                );

                if (updateResult.modifiedCount > 0) {
                    migratedCount++;
                    console.log(`✅ Migrated debtor ${debtor.debtorCode}:`);
                    console.log(`   Type: ${newBillingPeriod.type}`);
                    console.log(`   Duration: ${newBillingPeriod.duration.value} ${newBillingPeriod.duration.unit}`);
                    console.log(`   Amount: $${newBillingPeriod.amount.monthly}/month`);
                    console.log(`   Total: $${newBillingPeriod.amount.total}`);
                    console.log(`   Legacy: "${legacyBillingPeriod}"`);
                } else {
                    skippedCount++;
                    console.log(`⚠️  No changes needed for debtor ${debtor.debtorCode}`);
                }

            } catch (error) {
                console.error(`❌ Error migrating debtor ${debtor.debtorCode}:`, error.message);
                skippedCount++;
            }
        }

        console.log('\n🎯 Migration Summary:');
        console.log(`   Total debtors processed: ${debtors.length}`);
        console.log(`   Successfully migrated: ${migratedCount}`);
        console.log(`   Skipped/Errors: ${skippedCount}`);

        // Show examples of migrated data
        const sampleDebtors = await debtorsCollection.find({
            'billingPeriod.type': { $exists: true }
        }).limit(3).toArray();

        console.log('\n📋 Sample Migrated Debtors:');
        sampleDebtors.forEach((debtor, index) => {
            console.log(`   ${index + 1}. ${debtor.debtorCode}:`);
            console.log(`      Type: ${debtor.billingPeriod.type}`);
            console.log(`      Duration: ${debtor.billingPeriod.duration.value} ${debtor.billingPeriod.duration.unit}`);
            console.log(`      Monthly Amount: $${debtor.billingPeriod.amount.monthly}`);
            console.log(`      Total Amount: $${debtor.billingPeriod.amount.total}`);
            console.log(`      Status: ${debtor.billingPeriod.status}`);
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
                         durationValue === 6 ? 'semester' : 'monthly';
        }
    }

    // Calculate dates
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
migrateDebtorBillingPeriod().catch(console.error);
