const mongoose = require('mongoose');
const Vendor = require('./src/models/Vendor');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_backend';

// Sample bank details for vendors (you can modify this)
const vendorBankDetails = {
    "Trust Jings Electrician": {
        bankName: "CBZ Bank",
        accountNumber: "1234567890",
        accountType: "Business Account",
        branchCode: "12345",
        swiftCode: "CBZAZW2X"
    },
    "Gift Fashu Plumber": {
        bankName: "Stanbic Bank",
        accountNumber: "0987654321",
        accountType: "Business Account",
        branchCode: "54321",
        swiftCode: "SBICZMWX"
    },
    "Admire Kumba Electrician": {
        bankName: "NMB Bank",
        accountNumber: "1122334455",
        accountType: "Business Account",
        branchCode: "67890",
        swiftCode: "NMBZZW2X"
    }
};

async function addBankDetailsToVendors() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB successfully');

        let updatedCount = 0;
        let skippedCount = 0;

        for (const [vendorName, bankDetails] of Object.entries(vendorBankDetails)) {
            console.log(`\n🔄 Processing vendor: ${vendorName}`);
            
            // Find vendor by business name (case-insensitive)
            const vendor = await Vendor.findOne({
                businessName: { $regex: new RegExp(vendorName, 'i') }
            });

            if (!vendor) {
                console.log(`   ❌ Vendor not found: ${vendorName}`);
                continue;
            }

            // Check if vendor already has bank details
            if (vendor.bankDetails && vendor.bankDetails.bankName) {
                console.log(`   ⏭️  Skipped vendor: ${vendorName} (already has bank details)`);
                skippedCount++;
                continue;
            }

            // Update vendor with bank details
            try {
                const updates = {
                    bankDetails: bankDetails,
                    defaultPaymentMethod: 'Bank Transfer' // Update payment method since bank details are added
                };

                await Vendor.findByIdAndUpdate(vendor._id, updates, { new: true });
                updatedCount++;
                console.log(`   ✅ Updated vendor: ${vendorName} with bank details`);

                // Add to history
                const historyEntry = {
                    action: 'Bank details added',
                    description: `Added bank details for ${vendorName}`,
                    user: vendor.createdBy,
                    timestamp: new Date(),
                    changes: [
                        `Added bankName: ${bankDetails.bankName}`,
                        `Added accountNumber: ${bankDetails.accountNumber}`,
                        `Updated paymentMethod: Bank Transfer`
                    ]
                };

                await Vendor.findByIdAndUpdate(vendor._id, {
                    $push: { history: historyEntry }
                });

                console.log(`   💳 Bank Details:`);
                console.log(`      Bank: ${bankDetails.bankName}`);
                console.log(`      Account: ${bankDetails.accountNumber}`);
                console.log(`      Payment Method: Bank Transfer`);

            } catch (error) {
                console.error(`   ❌ Error updating vendor ${vendorName}:`, error.message);
            }
        }

        console.log(`\n📈 Bank Details Update Summary:`);
        console.log(`   ✅ Updated: ${updatedCount} vendors with bank details`);
        console.log(`   ⏭️  Skipped: ${skippedCount} vendors (already had bank details)`);

        // Display all vendors with their payment methods
        console.log(`\n📋 All vendors payment methods:`);
        const allVendors = await Vendor.find({}).select('businessName defaultPaymentMethod bankDetails');
        allVendors.forEach(vendor => {
            const hasBankDetails = vendor.bankDetails && vendor.bankDetails.bankName;
            console.log(`   ${vendor.businessName}: ${vendor.defaultPaymentMethod} ${hasBankDetails ? '(has bank details)' : '(no bank details)'}`);
        });

    } catch (error) {
        console.error('❌ Error adding bank details:', error);
    } finally {
        console.log('\n🔌 Disconnecting from MongoDB...');
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

// Function to list all vendors without bank details
async function listVendorsWithoutBankDetails() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB successfully');

        const vendorsWithoutBankDetails = await Vendor.find({
            $or: [
                { bankDetails: { $exists: false } },
                { 'bankDetails.bankName': { $exists: false } },
                { 'bankDetails.bankName': null }
            ]
        }).select('businessName category vendorType defaultPaymentMethod');

        console.log(`\n📋 Vendors without bank details (${vendorsWithoutBankDetails.length}):`);
        vendorsWithoutBankDetails.forEach(vendor => {
            console.log(`   ${vendor.businessName} (${vendor.category}) - ${vendor.defaultPaymentMethod || 'Cash'}`);
        });

    } catch (error) {
        console.error('❌ Error listing vendors:', error);
    } finally {
        await mongoose.disconnect();
    }
}

// Run the script based on command line argument
if (require.main === module) {
    const command = process.argv[2];

    switch (command) {
        case 'update':
            updateExistingVendors()
                .then(() => {
                    console.log('\n🎉 Vendor update script completed successfully!');
                    process.exit(0);
                })
                .catch((error) => {
                    console.error('\n💥 Vendor update script failed:', error);
                    process.exit(1);
                });
            break;
            
        case 'add-bank-details':
            addBankDetailsToVendors()
                .then(() => {
                    console.log('\n🎉 Bank details update script completed successfully!');
                    process.exit(0);
                })
                .catch((error) => {
                    console.error('\n💥 Bank details update script failed:', error);
                    process.exit(1);
                });
            break;
            
        case 'list-no-bank':
            listVendorsWithoutBankDetails()
                .then(() => {
                    console.log('\n🎉 List script completed successfully!');
                    process.exit(0);
                })
                .catch((error) => {
                    console.error('\n💥 List script failed:', error);
                    process.exit(1);
                });
            break;
            
        default:
            console.log('Usage:');
            console.log('  node update_existing_vendors.js update          - Update all vendors with new fields');
            console.log('  node update_existing_vendors.js add-bank-details - Add bank details to specific vendors');
            console.log('  node update_existing_vendors.js list-no-bank     - List vendors without bank details');
            process.exit(1);
    }
}

module.exports = { 
    updateExistingVendors, 
    addBankDetailsToVendors, 
    listVendorsWithoutBankDetails 
}; 