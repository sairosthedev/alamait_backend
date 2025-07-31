const mongoose = require('mongoose');
const MonthlyRequest = require('./src/models/MonthlyRequest');
const Residence = require('./src/models/Residence');
const User = require('./src/models/User');

// MongoDB connection
mongoose.connect('mongodb+srv://cluster0.ulvve.mongodb.net/test', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Helper function to format description with month name
function formatDescriptionWithMonth(description, month, year) {
    if (!description) return description;
    
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const monthName = monthNames[month - 1];
    
    // Check if description already contains month/year
    const monthYearPattern = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i;
    
    if (monthYearPattern.test(description)) {
        // Replace existing month/year with new one
        return description.replace(monthYearPattern, `${monthName} ${year}`);
    } else {
        // Add month/year to description
        return `${description} for ${monthName} ${year}`;
    }
}

// Monthly services data
const monthlyServices = [
    {
        title: "WiFi Service",
        description: "WiFi",
        category: "utilities",
        supplier: "Econet Wireless",
        amount: 150.00,
        paymentMethod: "Bank Transfer"
    },
    {
        title: "Electricity Supply",
        description: "Electricity",
        category: "utilities",
        supplier: "ZESA Holdings",
        amount: 450.00,
        paymentMethod: "Bank Transfer"
    },
    {
        title: "Gas Supply",
        description: "Gas",
        category: "utilities",
        supplier: "Progas Zimbabwe",
        amount: 200.00,
        paymentMethod: "Cash"
    },
    {
        title: "Security Services",
        description: "Security",
        category: "services",
        supplier: "Securico Security Services",
        amount: 800.00,
        paymentMethod: "Bank Transfer"
    },
    {
        title: "Water Council",
        description: "Water",
        category: "utilities",
        supplier: "Harare City Council",
        amount: 120.00,
        paymentMethod: "Bank Transfer"
    },
    {
        title: "Sanitary Services",
        description: "Sanitary",
        category: "services",
        supplier: "Harare City Council",
        amount: 80.00,
        paymentMethod: "Bank Transfer"
    },
    {
        title: "Waste Collection",
        description: "Waste Collection",
        category: "services",
        supplier: "Harare City Council",
        amount: 60.00,
        paymentMethod: "Bank Transfer"
    }
];

async function addMonthlyRequests() {
    try {
        console.log('Starting to add monthly requests...');

        // Get residences
        const belvedere = await Residence.findOne({ name: { $regex: /belvedere/i } });
        const stKilda = await Residence.findOne({ name: { $regex: /st kilda/i } });

        if (!belvedere) {
            console.error('Belvedere residence not found');
            return;
        }

        if (!stKilda) {
            console.error('St Kilda residence not found');
            return;
        }

        // Get admin user
        const adminUser = await User.findOne({ role: 'admin' });
        if (!adminUser) {
            console.error('Admin user not found');
            return;
        }

        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();

        const residences = [
            { residence: belvedere, name: 'Belvedere' },
            { residence: stKilda, name: 'St Kilda' }
        ];

        for (const { residence, name } of residences) {
            console.log(`\nProcessing ${name} residence...`);

            for (const service of monthlyServices) {
                // Check if request already exists for this month
                const existingRequest = await MonthlyRequest.findOne({
                    residence: residence._id,
                    month: currentMonth,
                    year: currentYear,
                    title: service.title,
                    isTemplate: false
                });

                if (existingRequest) {
                    console.log(`Request already exists for ${name} - ${service.title}`);
                    continue;
                }

                // Create monthly request
                const monthlyRequest = new MonthlyRequest({
                    title: service.title,
                    description: formatDescriptionWithMonth(service.description, currentMonth, currentYear),
                    residence: residence._id,
                    month: currentMonth,
                    year: currentYear,
                    items: [
                        {
                            description: service.description,
                            quantity: 1,
                            estimatedCost: service.amount,
                            purpose: `Monthly ${service.description.toLowerCase()} service`,
                            category: service.category,
                            isRecurring: true,
                            quotations: [
                                {
                                    provider: service.supplier,
                                    amount: service.amount,
                                    description: `Monthly ${service.description.toLowerCase()} service from ${service.supplier}`,
                                    fileUrl: '',
                                    fileName: '',
                                    uploadedBy: adminUser._id,
                                    uploadedAt: new Date(),
                                    isApproved: true,
                                    approvedBy: adminUser._id,
                                    approvedAt: new Date()
                                }
                            ]
                        }
                    ],
                    priority: 'medium',
                    notes: `Monthly ${service.description.toLowerCase()} service for ${name} residence`,
                    submittedBy: adminUser._id,
                    status: 'approved',
                    approvedBy: adminUser._id,
                    approvedAt: new Date(),
                    approvedByEmail: adminUser.email,
                    tags: [service.category, 'monthly', 'recurring'],
                    requestHistory: [
                        {
                            date: new Date(),
                            action: 'Monthly request created',
                            user: adminUser._id,
                            changes: ['Request created with approved quotation']
                        },
                        {
                            date: new Date(),
                            action: 'Monthly request approved',
                            user: adminUser._id,
                            changes: ['Request approved by admin']
                        }
                    ]
                });

                await monthlyRequest.save();
                console.log(`✓ Created ${name} - ${service.title} ($${service.amount})`);
            }
        }

        console.log('\n✅ All monthly requests added successfully!');
        
        // Display summary
        const totalRequests = await MonthlyRequest.countDocuments({
            month: currentMonth,
            year: currentYear
        });
        
        const totalCost = await MonthlyRequest.aggregate([
            {
                $match: {
                    month: currentMonth,
                    year: currentYear
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$totalEstimatedCost' }
                }
            }
        ]);

        console.log(`\n📊 Summary:`);
        console.log(`Total requests created: ${totalRequests}`);
        console.log(`Total estimated cost: $${totalCost[0]?.total?.toFixed(2) || '0.00'}`);
        console.log(`Month/Year: ${currentMonth}/${currentYear}`);

    } catch (error) {
        console.error('Error adding monthly requests:', error);
    } finally {
        mongoose.connection.close();
        console.log('\nDatabase connection closed.');
    }
}

// Run the script
addMonthlyRequests(); 