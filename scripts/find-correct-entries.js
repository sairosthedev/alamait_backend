// Set environment variable for MongoDB URI
process.env.MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const mongoose = require('mongoose');

async function findCorrectEntries() {
    try {
        console.log('🔍 FINDING CORRECT PAYMENT ENTRIES');
        console.log('==================================');
        
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000
        });
        
        console.log('✅ Connected to MongoDB\n');
        
        // Load models
        const TransactionEntry = require('../src/models/TransactionEntry');
        
        // ========================================
        // SEARCH FOR CORRECT PAYMENT ENTRIES
        // ========================================
        console.log('🔍 SEARCHING FOR CORRECT ENTRIES');
        console.log('=================================');
        
        // Search for entries with "Student Rent Payment" in description
        const correctEntries = await TransactionEntry.find({
            description: { $regex: /Student Rent Payment/, $options: 'i' }
        });
        
        console.log(`Found ${correctEntries.length} entries with "Student Rent Payment" in description`);
        
        correctEntries.forEach((entry, index) => {
            console.log(`\n${index + 1}. ${entry.description}`);
            console.log(`   Amount: $${entry.totalCredit}`);
            console.log(`   Source: ${entry.source}`);
            console.log(`   Date: ${new Date(entry.date).toLocaleDateString()}`);
            console.log(`   Status: ${entry.status}`);
        });
        
        // ========================================
        // SEARCH FOR ENTRIES BY TRANSACTION ID
        // ========================================
        console.log('\n\n🔍 SEARCHING BY TRANSACTION ID');
        console.log('===============================');
        
        const transactionIds = [
            'TXN1754436910105TF14766UL',
            'TXN1754436910249MW6LLO29T',
            'TXN17544369103301KTCCBYQN',
            'TXN17544369104112DZBFBGAP',
            'TXN17544369104874LNOLCVOK',
            'TXN1754436910567EAJI6QYG9'
        ];
        
        const entriesByTransactionId = await TransactionEntry.find({
            transactionId: { $in: transactionIds }
        });
        
        console.log(`Found ${entriesByTransactionId.length} entries by transaction ID`);
        
        entriesByTransactionId.forEach((entry, index) => {
            console.log(`\n${index + 1}. Transaction ID: ${entry.transactionId}`);
            console.log(`   Description: ${entry.description}`);
            console.log(`   Amount: $${entry.totalCredit}`);
            console.log(`   Source: ${entry.source}`);
            console.log(`   Date: ${new Date(entry.date).toLocaleDateString()}`);
        });
        
        // ========================================
        // SEARCH FOR ALL RECENT ENTRIES
        // ========================================
        console.log('\n\n🔍 SEARCHING FOR RECENT ENTRIES');
        console.log('===============================');
        
        const recentEntries = await TransactionEntry.find({
            createdAt: { $gte: new Date('2024-12-21') }
        }).sort({ createdAt: -1 });
        
        console.log(`Found ${recentEntries.length} entries created after Dec 21, 2024`);
        
        recentEntries.forEach((entry, index) => {
            console.log(`\n${index + 1}. ${entry.description}`);
            console.log(`   Amount: $${entry.totalCredit}`);
            console.log(`   Source: ${entry.source}`);
            console.log(`   Created: ${new Date(entry.createdAt).toLocaleString()}`);
        });
        
        // ========================================
        // SUMMARY
        // ========================================
        console.log('\n\n📊 SUMMARY');
        console.log('===========');
        
        let totalCorrectAmount = 0;
        correctEntries.forEach(entry => {
            totalCorrectAmount += entry.totalCredit || 0;
        });
        
        let totalTransactionIdAmount = 0;
        entriesByTransactionId.forEach(entry => {
            totalTransactionIdAmount += entry.totalCredit || 0;
        });
        
        console.log(`Correct entries amount: $${totalCorrectAmount.toFixed(2)}`);
        console.log(`Transaction ID entries amount: $${totalTransactionIdAmount.toFixed(2)}`);
        
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
        
    } catch (error) {
        console.error('❌ Search failed:', error.message);
        
        try {
            await mongoose.disconnect();
        } catch (disconnectError) {
            console.error('❌ Error disconnecting:', disconnectError.message);
        }
        
        process.exit(1);
    }
}

// Run the search
findCorrectEntries(); 