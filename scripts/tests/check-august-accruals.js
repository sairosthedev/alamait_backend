const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');

async function checkAccrualEntries() {
    try {
        await mongoose.connect('mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');

        // Check all accrual entries
        const allAccruals = await TransactionEntry.find({
            'metadata.type': 'rent_accrual'
        }).sort({'metadata.accrualYear': 1, 'metadata.accrualMonth': 1});

        console.log(`\n📊 Total accrual entries found: ${allAccruals.length}`);

        if (allAccruals.length === 0) {
            console.log('❌ No accrual entries found at all!');
            return;
        }

        // Group by month/year
        const monthCounts = {};
        allAccruals.forEach(entry => {
            const month = entry.metadata.accrualMonth;
            const year = entry.metadata.accrualYear;
            const key = `${month}/${year}`;
            monthCounts[key] = (monthCounts[key] || 0) + 1;
        });

        console.log('\n📅 Accrual entries by month:');
        Object.keys(monthCounts).sort().forEach(key => {
            console.log(`   ${key}: ${monthCounts[key]} entries`);
        });

        // Check specifically for August 2025
        const august2025Accruals = await TransactionEntry.find({
            'metadata.type': 'rent_accrual',
            'metadata.accrualMonth': 8,
            'metadata.accrualYear': 2025
        });

        console.log(`\n🔍 August 2025 accrual entries: ${august2025Accruals.length}`);

        if (august2025Accruals.length === 0) {
            console.log('❌ No August 2025 accruals found - this explains why revenue is 0!');
            
            // Check if there are any students who should have August accruals
            const applications = await mongoose.connection.db
                .collection('applications')
                .find({
                    status: 'approved',
                    startDate: { $lte: new Date(2025, 7, 31) }, // August 31, 2025
                    endDate: { $gte: new Date(2025, 7, 1) },   // August 1, 2025
                    paymentStatus: { $ne: 'cancelled' }
                }).toArray();

            console.log(`\n👥 Students who should have August 2025 accruals: ${applications.length}`);
            
            if (applications.length > 0) {
                console.log('Sample student:', {
                    name: `${applications[0].firstName} ${applications[0].lastName}`,
                    startDate: applications[0].startDate,
                    endDate: applications[0].endDate,
                    residence: applications[0].residence,
                    allocatedRoom: applications[0].allocatedRoom
                });
            }
        } else {
            console.log('✅ August 2025 accruals found');
            console.log('Sample entry:', JSON.stringify(august2025Accruals[0], null, 2));
        }

        // Check if accruals were created for other months in 2025
        const year2025Accruals = await TransactionEntry.find({
            'metadata.type': 'rent_accrual',
            'metadata.accrualYear': 2025
        });

        console.log(`\n📈 2025 accrual entries: ${year2025Accruals.length}`);

        if (year2025Accruals.length > 0) {
            const monthCounts2025 = {};
            year2025Accruals.forEach(entry => {
                const month = entry.metadata.accrualMonth;
                monthCounts2025[month] = (monthCounts2025[month] || 0) + 1;
            });

            console.log('2025 accruals by month:', monthCounts2025);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 MongoDB connection closed');
    }
}

checkAccrualEntries();
