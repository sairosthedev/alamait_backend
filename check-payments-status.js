const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function checkPaymentsStatus() {
    try {
        console.log('🔍 Checking Payments Collection Status and Dates...\n');
        
        const db = mongoose.connection.db;
        
        // Check payments collection
        const payments = await db.collection('payments').find({}).toArray();
        console.log(`📊 Total payments found: ${payments.length}`);
        
        if (payments.length > 0) {
            console.log('\n📋 Sample payments with status and dates:');
            payments.slice(0, 5).forEach((payment, i) => {
                console.log(`\n  Payment ${i + 1}:`);
                console.log(`    _id: ${payment._id}`);
                console.log(`    paymentId: ${payment.paymentId}`);
                console.log(`    amount: ${payment.amount}`);
                console.log(`    totalAmount: ${payment.totalAmount}`);
                console.log(`    status: ${payment.status}`);
                console.log(`    date: ${payment.date}`);
                console.log(`    paymentMonth: ${payment.paymentMonth}`);
                console.log(`    method: ${payment.method}`);
                console.log(`    residence: ${payment.residence}`);
                console.log('    ---');
            });
            
            // Check unique status values
            const statuses = [...new Set(payments.map(p => p.status))];
            console.log(`\n🎯 Unique status values found: ${statuses.join(', ')}`);
            
            // Check date ranges
            const dates = payments.map(p => new Date(p.date)).sort();
            if (dates.length > 0) {
                console.log(`\n📅 Date range: ${dates[0].toISOString().split('T')[0]} to ${dates[dates.length - 1].toISOString().split('T')[0]}`);
            }
            
            // Check 2025 payments specifically
            const payments2025 = payments.filter(p => {
                const paymentDate = new Date(p.date);
                return paymentDate.getFullYear() === 2025;
            });
            console.log(`\n📅 Payments in 2025: ${payments2025.length}`);
            
            if (payments2025.length > 0) {
                console.log('\n  Sample 2025 payments:');
                payments2025.slice(0, 3).forEach((payment, i) => {
                    console.log(`    ${i + 1}. ${payment.paymentId} - $${payment.amount || payment.totalAmount} - ${payment.status} - ${payment.date}`);
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Error checking payments:', error);
    } finally {
        await mongoose.disconnect();
    }
}

// Wait for connection then run
mongoose.connection.once('open', () => {
    checkPaymentsStatus();
});
