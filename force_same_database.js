#!/usr/bin/env node

/**
 * CRITICAL FIX: Force both local and live to use the same database
 * This will ensure identical data between environments
 */

const mongoose = require('mongoose');

async function forceSameDatabase() {
    console.log('🚨 CRITICAL FIX: Forcing same database for both environments...\n');
    
    // Force both environments to use the SAME database
    const PRODUCTION_DB = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';
    
    try {
        console.log('🔌 Connecting to PRODUCTION database...');
        await mongoose.connect(PRODUCTION_DB, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('✅ Connected to production database');
        console.log('📊 Database name:', mongoose.connection.db.databaseName);
        
        // Test the income statement with the same database
        const TransactionEntry = require('./src/models/TransactionEntry');
        
        console.log('\n🔍 Checking accrual entries in production database...');
        const accrualEntries = await TransactionEntry.find({
            date: { $lte: new Date('2025-12-31') },
            source: { $in: ['rental_accrual', 'manual', 'rental_accrual_reversal'] },
            status: 'posted'
        }).sort({ transactionId: 1 });
        
        console.log(`Found ${accrualEntries.length} accrual entries`);
        
        // Log the entries to see what's in production
        console.log('\n📋 Production Database Accrual Entries:');
        accrualEntries.forEach((entry, index) => {
            const totalAmount = entry.entries?.reduce((sum, e) => sum + (e.credit || 0) - (e.debit || 0), 0) || 0;
            console.log(`  ${index + 1}. ${entry.transactionId} - ${entry.description} - $${totalAmount}`);
        });
        
        console.log('\n🎯 SOLUTION:');
        console.log('1. Both environments should use the SAME database');
        console.log('2. Update your local .env to use production database');
        console.log('3. Or sync your local database with production data');
        
        await mongoose.disconnect();
        console.log('\n✅ Database connection closed');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Run the fix
forceSameDatabase();
