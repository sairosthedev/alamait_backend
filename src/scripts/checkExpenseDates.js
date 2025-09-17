const mongoose = require('mongoose');
const TransactionEntry = require('../models/TransactionEntry');
const Expense = require('../models/finance/Expense');

// Connect to database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';

async function checkExpenseDates() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to database');

        // Find expense accrual transactions
        console.log('🔍 Finding expense accrual transactions...');
        
        const expenseAccruals = await TransactionEntry.find({
            source: 'expense_accrual',
            status: 'posted'
        }).sort({ date: 1 });

        console.log(`Found ${expenseAccruals.length} expense accrual transactions`);

        for (const accrual of expenseAccruals) {
            console.log(`\n🔍 Processing: ${accrual.transactionId}`);
            console.log(`   Date: ${accrual.date.toISOString().split('T')[0]}`);
            console.log(`   Description: ${accrual.description}`);
            console.log(`   Reference: ${accrual.reference}`);

            // Look for expenses that might be related to this accrual
            // Try to find expenses with similar descriptions or references
            const expenseQuery = {
                $or: [
                    { expenseId: { $regex: accrual.reference, $options: 'i' } },
                    { description: { $regex: accrual.description.replace('ACCRUAL: ', ''), $options: 'i' } },
                    { title: { $regex: accrual.description.replace('ACCRUAL: ', ''), $options: 'i' } }
                ]
            };

            const relatedExpenses = await Expense.find(expenseQuery);
            
            if (relatedExpenses.length > 0) {
                console.log(`   ✅ Found ${relatedExpenses.length} related expenses:`);
                relatedExpenses.forEach((expense, index) => {
                    console.log(`     ${index + 1}. ${expense.expenseId}`);
                    console.log(`        Title: ${expense.title}`);
                    console.log(`        Description: ${expense.description}`);
                    console.log(`        Expense Date: ${expense.expenseDate.toISOString().split('T')[0]}`);
                    console.log(`        Amount: $${expense.amount}`);
                });
            } else {
                console.log(`   ⚠️ No related expenses found`);
            }
        }

        // Also check for expenses with "July" in the description
        console.log('\n🔍 Looking for expenses with "July" in description...');
        const julyExpenses = await Expense.find({
            $or: [
                { description: { $regex: 'July', $options: 'i' } },
                { title: { $regex: 'July', $options: 'i' } }
            ]
        }).limit(10);
        
        console.log(`Found ${julyExpenses.length} expenses with "July" in description:`);
        julyExpenses.forEach((expense, index) => {
            console.log(`${index + 1}. ${expense.expenseId}`);
            console.log(`   Title: ${expense.title}`);
            console.log(`   Description: ${expense.description}`);
            console.log(`   Expense Date: ${expense.expenseDate.toISOString().split('T')[0]}`);
            console.log(`   Amount: $${expense.amount}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkExpenseDates();





