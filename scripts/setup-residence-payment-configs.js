const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Residence = require('../src/models/Residence');

async function setupResidencePaymentConfigurations() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Get all residences
        const residences = await Residence.find({});
        console.log(`📋 Found ${residences.length} residences`);

        for (const residence of residences) {
            console.log(`\n🏠 Processing: ${residence.name}`);
            
            let config;
            
            // Set configuration based on residence name
            if (residence.name.toLowerCase().includes('st kilda')) {
                config = {
                    adminFee: {
                        enabled: true,
                        amount: 20,
                        description: 'Administration fee',
                        application: 'first_month'
                    },
                    deposit: {
                        enabled: true,
                        amount: 0,
                        calculation: 'one_month_rent',
                        percentage: 100,
                        description: 'Security deposit',
                        application: 'upfront'
                    },
                    utilities: {
                        enabled: false,
                        amount: 0,
                        description: 'Utilities fee',
                        application: 'every_month'
                    },
                    maintenance: {
                        enabled: false,
                        amount: 0,
                        description: 'Maintenance fee',
                        application: 'every_month'
                    }
                };
                console.log('   ✅ Applied St Kilda configuration');
                
            } else if (residence.name.toLowerCase().includes('belvedere')) {
                config = {
                    adminFee: {
                        enabled: false,
                        amount: 0,
                        description: 'Administration fee',
                        application: 'first_month'
                    },
                    deposit: {
                        enabled: false,
                        amount: 0,
                        calculation: 'one_month_rent',
                        percentage: 100,
                        description: 'Security deposit',
                        application: 'upfront'
                    },
                    utilities: {
                        enabled: false,
                        amount: 0,
                        description: 'Utilities fee',
                        application: 'every_month'
                    },
                    maintenance: {
                        enabled: false,
                        amount: 0,
                        description: 'Maintenance fee',
                        application: 'every_month'
                    }
                };
                console.log('   ✅ Applied Belvedere configuration');
                
            } else if (residence.name.toLowerCase().includes('newlands')) {
                config = {
                    adminFee: {
                        enabled: true,
                        amount: 15,
                        description: 'Administration fee',
                        application: 'first_month'
                    },
                    deposit: {
                        enabled: true,
                        amount: 0,
                        calculation: 'one_month_rent',
                        percentage: 100,
                        description: 'Security deposit',
                        application: 'upfront'
                    },
                    utilities: {
                        enabled: false,
                        amount: 0,
                        description: 'Utilities fee',
                        application: 'every_month'
                    },
                    maintenance: {
                        enabled: false,
                        amount: 0,
                        description: 'Maintenance fee',
                        application: 'every_month'
                    }
                };
                console.log('   ✅ Applied Newlands configuration');
                
            } else {
                // Default configuration for other residences
                config = {
                    adminFee: {
                        enabled: false,
                        amount: 0,
                        description: 'Administration fee',
                        application: 'first_month'
                    },
                    deposit: {
                        enabled: true,
                        amount: 0,
                        calculation: 'one_month_rent',
                        percentage: 100,
                        description: 'Security deposit',
                        application: 'upfront'
                    },
                    utilities: {
                        enabled: false,
                        amount: 0,
                        description: 'Utilities fee',
                        application: 'every_month'
                    },
                    maintenance: {
                        enabled: false,
                        amount: 0,
                        description: 'Maintenance fee',
                        application: 'every_month'
                    }
                };
                console.log('   ✅ Applied default configuration');
            }
            
            // Update residence with payment configuration
            residence.paymentConfiguration = config;
            await residence.save();
            
            console.log(`   💰 Configuration saved for ${residence.name}`);
        }

        console.log('\n✅ All residence payment configurations have been set up successfully!');
        console.log('\n📊 Summary:');
        console.log('   - St Kilda: Admin fee $20 (first month) + Deposit (1 month rent)');
        console.log('   - Belvedere: No admin fee, no deposit (rent only)');
        console.log('   - Newlands: Admin fee $15 (first month) + Deposit (1 month rent)');
        console.log('   - Others: Default configuration (deposit only)');

    } catch (error) {
        console.error('❌ Error setting up residence payment configurations:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the script
setupResidencePaymentConfigurations();
