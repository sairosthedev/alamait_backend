const mongoose = require('mongoose');

async function fixDebtorBillingPeriod() {
    try {
        // Connect to Atlas database
        const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
        
        console.log('🔍 Connecting to Atlas database...');
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Connected to Atlas database');
        
        const Debtor = require('./src/models/Debtor');
        const Payment = require('./src/models/Payment');
        
        // Get the specific debtor that needs fixing
        const debtor = await Debtor.findOne({ user: '688a965155fe1a1fd35411c0' });
        if (!debtor) {
            console.log('❌ Debtor not found');
            return;
        }
        
        console.log(`\n🎯 Found debtor:`);
        console.log(`   ID: ${debtor._id}`);
        console.log(`   Code: ${debtor.debtorCode}`);
        console.log(`   Current Balance: $${debtor.currentBalance}`);
        console.log(`   Total Paid: $${debtor.totalPaid}`);
        console.log(`   Status: ${debtor.status}`);
        
        // Check current billingPeriod
        console.log(`\n📅 Current billingPeriod:`, debtor.billingPeriod);
        
        // Get the payment to understand the billing period
        const payment = await Payment.findOne({ paymentId: 'PAY-1755226825185' });
        if (!payment) {
            console.log('❌ Payment not found');
            return;
        }
        
        console.log(`\n💰 Payment details:`);
        console.log(`   Month: ${payment.paymentMonth}`);
        console.log(`   Amount: $${payment.totalAmount}`);
        console.log(`   Date: ${payment.date}`);
        
        // Fix the debtor document
        console.log(`\n🔧 Fixing debtor document...`);
        
        // Set proper status (from the enum: 'active', 'inactive', 'overdue', 'defaulted', 'paid')
        debtor.status = 'active';
        
        // Set billingPeriod based on payment information
        const paymentDate = new Date(payment.date);
        const paymentMonth = payment.paymentMonth; // Format: "2025-06"
        const [year, month] = paymentMonth.split('-');
        
        // Calculate billing period (assuming monthly billing)
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1); // First day of month
        const endDate = new Date(parseInt(year), parseInt(month), 0); // Last day of month
        
        debtor.billingPeriod = {
            type: 'monthly',
            duration: {
                value: 1,
                unit: 'months'
            },
            startDate: startDate,
            endDate: endDate,
            billingCycle: {
                frequency: 'monthly',
                dayOfMonth: 1,
                gracePeriod: 5
            },
            amount: {
                monthly: payment.totalAmount, // Use payment amount as monthly amount
                total: payment.totalAmount,   // For monthly, total = monthly
                currency: 'USD'
            },
            status: 'active',
            description: `Monthly billing for ${paymentMonth}`,
            notes: `Auto-generated from payment ${payment.paymentId}`
        };
        
        // Save the debtor
        console.log(`💾 Saving debtor...`);
        await debtor.save();
        
        console.log(`✅ Debtor fixed successfully!`);
        console.log(`   New Status: ${debtor.status}`);
        console.log(`   Billing Period: ${debtor.billingPeriod.startDate.toISOString().split('T')[0]} to ${debtor.billingPeriod.endDate.toISOString().split('T')[0]}`);
        console.log(`   Monthly Amount: $${debtor.billingPeriod.amount.monthly}`);
        
        // Now try to add the payment
        console.log(`\n💰 Adding payment to debtor...`);
        
        try {
            await debtor.addPayment({
                paymentId: payment.paymentId,
                amount: payment.totalAmount,
                allocatedMonth: payment.paymentMonth,
                components: {
                    rent: payment.rentAmount || 0,
                    admin: payment.adminFee || 0,
                    deposit: payment.deposit || 0
                },
                paymentMethod: payment.method,
                paymentDate: payment.date,
                status: 'Confirmed',
                notes: `Payment ${payment.paymentId} - ${payment.paymentMonth}`,
                createdBy: payment.createdBy
            });
            
            console.log(`✅ Payment added to debtor successfully!`);
            console.log(`   New Balance: $${debtor.currentBalance}`);
            console.log(`   New Total Paid: $${debtor.totalPaid}`);
            console.log(`   Payment History Count: ${debtor.paymentHistory.length}`);
            
        } catch (error) {
            console.error(`❌ Error adding payment:`, error.message);
        }
        
    } catch (error) {
        console.error('❌ Error in script:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from database');
    }
}

fixDebtorBillingPeriod();
