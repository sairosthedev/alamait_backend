const mongoose = require('mongoose');
const { createDebtorsForAllStudents } = require('../services/debtorService');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB Connected');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

async function migrateExistingStudents() {
    let connection;
    try {
        console.log('🚀 Starting migration: Creating debtors for existing students...');
        
        // Connect to database
        connection = await connectDB();
        
        // Create debtors for all existing students
        const result = await createDebtorsForAllStudents({
            createdBy: 'system-migration'
        });
        
        console.log('\n📊 Migration Results:');
        console.log(`✅ Successfully created ${result.createdDebtors.length} debtors`);
        
        if (result.errors.length > 0) {
            console.log(`❌ ${result.errors.length} errors occurred:`);
            result.errors.forEach(error => {
                console.log(`   - ${error.student}: ${error.error}`);
            });
        }
        
        console.log('\n🎉 Migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await mongoose.connection.close();
            console.log('Database connection closed');
        }
        process.exit(0);
    }
}

// Run the migration
migrateExistingStudents(); 