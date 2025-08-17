const mongoose = require('mongoose');
const AccountingService = require('../src/services/accountingService');

async function createMonthlyAccruals2025() {
    try {
        await mongoose.connect('mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');

        console.log('\n🏠 CREATING MONTHLY RENT ACCRUALS FOR 2025...');
        console.log('This will create accrual entries for all months so your income statement shows proper revenue\n');

        // Check if accruals already exist
        const existingAccruals = await mongoose.connection.db
            .collection('transactionentries')
            .find({
                'metadata.type': 'rent_accrual',
                'metadata.accrualYear': 2025
            }).toArray();

        if (existingAccruals.length > 0) {
            console.log(`⚠️  Found ${existingAccruals.length} existing accruals for 2025`);
            console.log('Sample existing accrual:', {
                month: existingAccruals[0].metadata.accrualMonth,
                year: existingAccruals[0].metadata.accrualYear,
                student: existingAccruals[0].metadata.studentId
            });
            
            const response = await new Promise((resolve) => {
                const readline = require('readline');
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                rl.question('Do you want to continue and create missing accruals? (y/n): ', (answer) => {
                    rl.close();
                    resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
                });
            });
            
            if (!response) {
                console.log('❌ Operation cancelled by user');
                return;
            }
        }

        // Create accruals for each month (January through December)
        const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        let totalAccrualsCreated = 0;

        for (const month of months) {
            console.log(`\n📅 Creating accruals for ${month}/2025...`);
            
            try {
                const accrualsCreated = await AccountingService.createMonthlyAccruals(month, 2025);
                console.log(`✅ Created ${accrualsCreated} accruals for ${month}/2025`);
                totalAccrualsCreated += accrualsCreated;
            } catch (error) {
                console.log(`⚠️  Month ${month}/2025: ${error.message}`);
            }
        }

        console.log(`\n🎉 COMPLETED! Total accruals created: ${totalAccrualsCreated}`);

        // Now test the accrual basis income statement
        console.log('\n🧪 TESTING ACCRUAL BASIS INCOME STATEMENT...');
        
        try {
            const monthlyProgression = await AccountingService.generateMonthlyProgressionIncomeStatement(2025);
            
            console.log('\n📊 ACCRUAL BASIS INCOME STATEMENT RESULTS:');
            console.log(`Year: ${monthlyProgression.year}`);
            console.log(`Total Residences: ${monthlyProgression.summary.totalResidences}`);
            console.log(`Total Revenue: $${monthlyProgression.summary.totalRevenue}`);
            console.log(`Total Expenses: $${monthlyProgression.summary.totalExpenses}`);
            console.log(`Total Net Income: $${monthlyProgression.summary.totalNetIncome}`);
            
            console.log('\n📅 MONTHLY BREAKDOWN:');
            Object.keys(monthlyProgression.monthlyProgression).forEach(monthNum => {
                const monthData = monthlyProgression.monthlyProgression[monthNum];
                const monthName = monthData.monthName;
                const revenue = monthData.summary.totalRevenue;
                const expenses = monthData.summary.totalExpenses;
                const netIncome = monthData.summary.totalNetIncome;
                
                console.log(`  ${monthName}: Revenue $${revenue}, Expenses $${expenses}, Net $${netIncome}`);
            });

        } catch (error) {
            console.error('❌ Error testing accrual basis income statement:', error.message);
        }

    } catch (error) {
        console.error('❌ Error creating monthly accruals:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 MongoDB connection closed');
    }
}

createMonthlyAccruals2025();

