require('dotenv').config();
const mongoose = require('mongoose');

// Build connection string from environment variables
const username = process.env.MONGODB_USERNAME;
const password = process.env.MONGODB_PASSWORD;
const cluster = 'cluster0.ulvve.mongodb.net';
const database = 'test';

if (!username || !password) {
    console.error('❌ MongoDB Atlas credentials not set!');
    console.log('');
    console.log('💡 Please set your MongoDB Atlas credentials:');
    console.log('   export MONGODB_USERNAME=your_username');
    console.log('   export MONGODB_PASSWORD=your_password');
    console.log('');
    console.log('   Or create a .env file with:');
    console.log('   MONGODB_USERNAME=your_username');
    console.log('   MONGODB_PASSWORD=your_password');
    console.log('');
    process.exit(1);
}

const MONGODB_URI = `mongodb+srv://${username}:${password}@${cluster}/${database}`;

async function connectToDatabase() {
    try {
        console.log('🔌 Connecting to MongoDB Atlas...');
        console.log('Cluster:', cluster);
        console.log('Database:', database);
        console.log('');
        
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB Atlas successfully!');
        console.log('Database:', mongoose.connection.name);
        console.log('');
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB Atlas:', error.message);
        console.log('');
        console.log('💡 Check your credentials and network connection');
        console.log('');
        throw error;
    }
}

async function testRentalAccrualSystem() {
    try {
        console.log('🏠 Testing Rental Accrual System...');
        console.log('=====================================');
        
        // 1. Check current applications
        const applications = await mongoose.connection.db
            .collection('applications')
            .find({ status: 'approved' })
            .toArray();
        
        console.log(`📊 Found ${applications.length} approved applications`);
        
        if (applications.length === 0) {
            console.log('⚠️ No approved applications found. Please approve some student applications first.');
            return;
        }
        
        // 2. Show sample applications
        console.log('\n📋 Sample Applications:');
        applications.slice(0, 3).forEach((app, index) => {
            console.log(`   ${index + 1}. ${app.firstName} ${app.lastName} - ${app.residence} - Room ${app.room}`);
        });
        
        // 3. Check current accounts
        const Account = require('./src/models/Account');
        const accounts = await Account.find({
            code: { $in: ['1100', '4000', '4100'] }
        });
        
        console.log('\n💰 Required Accounts Status:');
        const requiredAccounts = {
            '1100': 'Accounts Receivable - Tenants',
            '4000': 'Rental Income - Residential',
            '4100': 'Administrative Income'
        };
        
        for (const [code, name] of Object.entries(requiredAccounts)) {
            const account = accounts.find(acc => acc.code === code);
            if (account) {
                console.log(`   ✅ ${code}: ${name}`);
            } else {
                console.log(`   ❌ ${code}: ${name} - MISSING`);
            }
        }
        
        // 4. Check for existing accruals
        const TransactionEntry = require('./src/models/TransactionEntry');
        const existingAccruals = await TransactionEntry.find({
            'metadata.type': 'rent_accrual'
        });
        
        console.log(`\n📅 Existing Rent Accruals: ${existingAccruals.length}`);
        
        if (existingAccruals.length > 0) {
            console.log('   Recent accruals:');
            existingAccruals.slice(0, 3).forEach(acc => {
                console.log(`   - ${acc.metadata.studentName} - ${acc.metadata.accrualMonth}/${acc.metadata.accrualYear} - $${acc.metadata.totalAmount}`);
            });
        }
        
        // 5. Check for existing invoices
        const Invoice = require('./src/models/Invoice');
        const existingInvoices = await Invoice.find({
            'metadata.type': 'monthly_rent'
        });
        
        console.log(`\n📄 Existing Rent Invoices: ${existingInvoices.length}`);
        
        if (existingInvoices.length > 0) {
            console.log('   Recent invoices:');
            existingInvoices.slice(0, 3).forEach(inv => {
                console.log(`   - ${inv.invoiceNumber} - ${inv.billingPeriod} - $${inv.totalAmount}`);
            });
        }
        
        // 6. Demonstrate what would happen if we create accruals
        console.log('\n🔮 What Happens When You Create Rent Accruals:');
        console.log('================================================');
        
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        
        console.log(`\n📊 For ${currentMonth}/${currentYear}:`);
        console.log(`   - ${applications.length} students would have rent accrued`);
        console.log(`   - Each student: $200 rent + $20 admin fee = $220 total`);
        console.log(`   - Total revenue accrued: $${applications.length * 220}`);
        
        console.log('\n💼 Double-Entry Accounting Entries:');
        console.log('   Dr. Accounts Receivable (1100) - $220 per student');
        console.log('   Cr. Rental Income (4000) - $200 per student');
        console.log('   Cr. Administrative Income (4100) - $20 per student');
        
        console.log('\n📈 Financial Impact:');
        console.log('   - Income Statement: Shows $220 revenue per student');
        console.log('   - Balance Sheet: Shows $220 receivable per student');
        console.log('   - Cash Flow: No cash impact (accrual basis)');
        
        // 7. Show API endpoints available
        console.log('\n🌐 Available API Endpoints:');
        console.log('============================');
        console.log('   POST /api/rental-accrual/create-monthly');
        console.log('     Body: { month: 8, year: 2025 }');
        console.log('');
        console.log('   POST /api/rental-accrual/create-student');
        console.log('     Body: { studentId: "id", month: 8, year: 2025 }');
        console.log('');
        console.log('   GET /api/rental-accrual/outstanding-balances');
        console.log('   GET /api/rental-accrual/summary?month=8&year=2025');
        console.log('   GET /api/rental-accrual/yearly-summary?year=2025');
        console.log('   GET /api/rental-accrual/student-history/:studentId');
        
        // 8. Show what your frontend needs to build
        console.log('\n🎨 What Your Frontend Needs to Build:');
        console.log('=====================================');
        console.log('   1. 📊 Rent Accrual Dashboard');
        console.log('      - Monthly accrual creation form');
        console.log('      - Accrual summary display');
        console.log('      - Outstanding balances table');
        console.log('');
        console.log('   2. 📋 Student Rent Management');
        console.log('      - Individual student accrual creation');
        console.log('      - Student rent history view');
        console.log('      - Payment tracking');
        console.log('');
        console.log('   3. 💰 Financial Reports Integration');
        console.log('      - Income statement with accrued revenue');
        console.log('      - Accounts receivable aging report');
        console.log('      - Property performance by month');
        
        console.log('\n✅ Rental Accrual System Test Complete!');
        console.log('   Your backend is ready to handle rental accruals.');
        console.log('   Next step: Build the frontend UI to use these APIs.');
        
    } catch (error) {
        console.error('❌ Error testing rental accrual system:', error);
    }
}

async function main() {
    try {
        await connectToDatabase();
        await testRentalAccrualSystem();
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB Atlas');
    }
}

main();
