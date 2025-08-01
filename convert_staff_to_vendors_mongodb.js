// Script to convert existing maintenance staff to vendors/suppliers
// Run this in MongoDB shell or MongoDB Compass

print("=== Converting Maintenance Staff to Vendors/Suppliers ===");

// Find all maintenance staff
const maintenanceStaff = db.maintenancestaff.find({}).toArray();

print(`\n--- Found ${maintenanceStaff.length} Maintenance Staff to Convert ---`);

if (maintenanceStaff.length === 0) {
    print("❌ No maintenance staff found to convert!");
    quit();
}

// Show staff to be converted
maintenanceStaff.forEach((staff, index) => {
    print(`${index + 1}. ${staff.name} ${staff.surname} - ${staff.speciality} (${staff.location})`);
});

// Check if vendors collection exists and get count for vendor code generation
const vendorCount = db.vendors ? db.vendors.countDocuments() : 0;
print(`\n--- Current vendor count: ${vendorCount} ---`);

// Category mapping from speciality to vendor category
const categoryMapping = {
    'electrician': 'electrical',
    'electrical': 'electrical',
    'plumber': 'plumbing',
    'plumbing': 'plumbing',
    'carpenter': 'carpentry',
    'carpentry': 'carpentry',
    'painter': 'painting',
    'painting': 'painting',
    'cleaner': 'cleaning',
    'cleaning': 'cleaning',
    'security': 'security',
    'gardener': 'landscaping',
    'landscaping': 'landscaping',
    'general': 'maintenance',
    'maintenance': 'maintenance'
};

// Expense account mapping
const expenseAccountMapping = {
    'electrical': '5000',
    'plumbing': '5000',
    'carpentry': '5000',
    'painting': '5000',
    'cleaning': '5010',
    'security': '5011',
    'landscaping': '5000',
    'maintenance': '5000'
};

const convertedVendors = [];
const errors = [];

maintenanceStaff.forEach((staff, index) => {
    try {
        // Generate vendor code
        const vendorCode = `V25${(vendorCount + index + 1).toString().padStart(3, '0')}`;
        
        // Map speciality to category
        const speciality = staff.speciality ? staff.speciality.toLowerCase() : 'maintenance';
        const category = categoryMapping[speciality] || 'maintenance';
        const expenseAccountCode = expenseAccountMapping[category] || '5000';
        
        // Generate chart of accounts code
        const chartOfAccountsCode = `200${(vendorCount + index + 1).toString().padStart(3, '0')}`;
        
        // Create vendor document
        const vendor = {
            vendorCode: vendorCode,
            businessName: `${staff.name} ${staff.surname} ${staff.speciality ? staff.speciality.charAt(0).toUpperCase() + staff.speciality.slice(1) : 'Services'}`,
            tradingName: `${staff.name} ${staff.surname}`,
            
            // Contact Information
            contactPerson: {
                firstName: staff.name,
                lastName: staff.surname,
                email: staff.email,
                phone: staff.contact,
                mobile: staff.contact
            },
            
            // Business Details
            businessAddress: {
                street: staff.location || 'Not specified',
                city: staff.location || 'Not specified',
                state: '',
                postalCode: '',
                country: 'Zimbabwe'
            },
            
            // Chart of Accounts Integration
            chartOfAccountsCode: chartOfAccountsCode,
            expenseAccountCode: expenseAccountCode,
            
            // Business Classification
            category: category,
            
            // Specializations
            specializations: [staff.speciality || 'general'],
            
            // Service Areas
            serviceAreas: [staff.location || 'Not specified'],
            
            // Status and Rating
            status: staff.isActive ? 'active' : 'inactive',
            
            rating: {
                average: staff.performance?.rating || 0,
                totalReviews: 0,
                lastReviewDate: null
            },
            
            // Performance Metrics
            performance: {
                totalOrders: staff.performance?.completedTasks || 0,
                completedOrders: staff.performance?.completedTasks || 0,
                averageResponseTime: staff.performance?.averageResponseTime || 0,
                onTimeDelivery: 0,
                qualityRating: staff.performance?.rating || 0
            },
            
            // Financial Information
            creditLimit: 0,
            currentBalance: 0,
            paymentTerms: 30,
            
            // Notes and Comments
            notes: `Converted from maintenance staff. Original speciality: ${staff.speciality}. Original location: ${staff.location}`,
            
            // Audit Trail
            createdBy: staff.createdBy || ObjectId("67c023adae5e27657502e887"), // Default admin user
            updatedBy: staff.updatedBy || ObjectId("67c023adae5e27657502e887"),
            
            // History
            history: [{
                action: 'Vendor created from maintenance staff',
                description: `Converted from maintenance staff record`,
                user: staff.createdBy || ObjectId("67c023adae5e27657502e887"),
                timestamp: new Date(),
                changes: [
                    {
                        field: 'source',
                        oldValue: 'maintenance_staff',
                        newValue: 'vendor'
                    },
                    {
                        field: 'originalId',
                        oldValue: staff._id.toString(),
                        newValue: 'converted'
                    }
                ]
            }],
            
            // Timestamps
            createdAt: staff.createdAt || new Date(),
            updatedAt: new Date()
        };
        
        // Insert vendor
        const result = db.vendors.insertOne(vendor);
        
        if (result.insertedId) {
            convertedVendors.push({
                originalId: staff._id,
                vendorId: result.insertedId,
                vendorCode: vendor.vendorCode,
                businessName: vendor.businessName,
                category: vendor.category
            });
            
            print(`✅ Converted: ${staff.name} ${staff.surname} -> ${vendor.businessName} (${vendor.vendorCode})`);
        } else {
            errors.push(`Failed to insert vendor for ${staff.name} ${staff.surname}`);
        }
        
    } catch (error) {
        errors.push(`Error converting ${staff.name} ${staff.surname}: ${error.message}`);
        print(`❌ Error converting ${staff.name} ${staff.surname}: ${error.message}`);
    }
});

// Create chart of accounts entries for new vendors
print(`\n--- Creating Chart of Accounts Entries ---`);

convertedVendors.forEach(vendor => {
    try {
        // Check if vendor account exists
        const existingVendorAccount = db.accounts.findOne({ code: vendor.chartOfAccountsCode });
        if (!existingVendorAccount) {
            const vendorAccount = {
                code: vendor.chartOfAccountsCode,
                name: `Accounts Payable - ${vendor.businessName}`,
                type: 'Liability'
            };
            db.accounts.insertOne(vendorAccount);
            print(`✅ Created vendor account: ${vendor.chartOfAccountsCode} - ${vendorAccount.name}`);
        }
        
        // Check if expense account exists (this should already exist from seed data)
        const existingExpenseAccount = db.accounts.findOne({ code: vendor.expenseAccountCode });
        if (!existingExpenseAccount) {
            const expenseAccount = {
                code: vendor.expenseAccountCode,
                name: `${vendor.category.charAt(0).toUpperCase() + vendor.category.slice(1)} Expenses`,
                type: 'Expense'
            };
            db.accounts.insertOne(expenseAccount);
            print(`✅ Created expense account: ${vendor.expenseAccountCode} - ${expenseAccount.name}`);
        }
        
    } catch (error) {
        print(`❌ Error creating chart of accounts entries for ${vendor.businessName}: ${error.message}`);
    }
});

// Summary
print(`\n=== Conversion Summary ===`);
print(`✅ Successfully converted: ${convertedVendors.length} staff to vendors`);
print(`❌ Errors: ${errors.length}`);

if (convertedVendors.length > 0) {
    print(`\n--- Converted Vendors ---`);
    convertedVendors.forEach(vendor => {
        print(`${vendor.vendorCode}: ${vendor.businessName} (${vendor.category})`);
    });
}

if (errors.length > 0) {
    print(`\n--- Errors ---`);
    errors.forEach(error => print(`❌ ${error}`));
}

print(`\n=== Conversion Complete ===`);
print("Maintenance staff have been converted to vendors!");
print("You can now use the vendor system for these converted suppliers.");
print("\nNext steps:");
print("1. Review the converted vendors in the vendors collection");
print("2. Update any missing information (banking details, tax numbers, etc.)");
print("3. Start using the vendor system for quotations and payments"); 