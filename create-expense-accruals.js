const mongoose = require('mongoose');
const ExpenseAccrualService = require('./src/services/expenseAccrualService');

// 🔐 User's actual MongoDB Atlas credentials
const MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function createExpenseAccruals() {
    try {
        console.log('🏠 Creating Expense Accruals for Proper Accrual Basis...\n');
        
        // Connect to your MongoDB Atlas cluster
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Connected to your MongoDB Atlas cluster');
        
        // Get a sample residence ID (you'll need to replace this with an actual residence ID)
        const db = mongoose.connection.db;
        const residences = await db.collection('residences').find({}).limit(1).toArray();
        
        if (residences.length === 0) {
            console.log('❌ No residences found. Please create a residence first.');
            return;
        }
        
        const residenceId = residences[0]._id;
        const createdBy = '507f1f77bcf86cd799439011'; // Sample user ID - replace with actual user ID
        
        console.log(`🏠 Using residence: ${residences[0].name || residenceId}`);
        
        // Create expense accruals for 2025
        console.log('\n📊 Creating expense accruals for 2025...');
        
        const accruals = await ExpenseAccrualService.createBulkExpenseAccruals({
            year: 2025,
            residence: residenceId,
            createdBy: createdBy
        });
        
        console.log(`\n✅ Successfully created ${accruals.length} expense accruals!`);
        
        // Show summary of what was created
        console.log('\n📋 Expense Accruals Created:');
        accruals.forEach((accrual, index) => {
            const date = new Date(accrual.date).toLocaleDateString('en-US', { 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric' 
            });
            const amount = accrual.entries[0].debit;
            const description = accrual.description;
            console.log(`  ${index + 1}. ${date}: ${description} - $${amount}`);
        });
        
        console.log('\n🎯 Now your accrual basis will show:');
        console.log('  - Income: When earned (rental accruals)');
        console.log('  - Expenses: When incurred (expense accruals)');
        console.log('  - NOT when cash changes hands!');
        
    } catch (error) {
        console.error('❌ Error creating expense accruals:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the script
createExpenseAccruals();
