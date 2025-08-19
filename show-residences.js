const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('🔌 Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

const Residence = require('./src/models/Residence');

async function showResidences() {
    try {
        const residences = await Residence.find({});
        
        console.log('\n🏠 AVAILABLE RESIDENCES FOR FILTERING:');
        console.log('=====================================');
        
        if (residences.length === 0) {
            console.log('No residences found in the database.');
        } else {
            residences.forEach((residence, index) => {
                console.log(`${index + 1}. ID: ${residence._id}`);
                console.log(`   Name: ${residence.name || 'N/A'}`);
                console.log(`   Address: ${residence.address || 'N/A'}`);
                console.log(`   Type: ${residence.type || 'N/A'}`);
                console.log('   ---');
            });
        }
        
        console.log(`\nTotal Residences: ${residences.length}`);
        
    } catch (error) {
        console.error('❌ Error fetching residences:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

showResidences();
