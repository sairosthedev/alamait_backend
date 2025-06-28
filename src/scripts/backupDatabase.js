const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import all models to ensure they're registered
const Application = require('../models/Application');
const Payment = require('../models/Payment');
const Student = require('../models/Student');
const Event = require('../models/Event');
const Maintenance = require('../models/Maintenance');
const Message = require('../models/Message');
const Lease = require('../models/Lease');
const Residence = require('../models/Residence');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Room = require('../models/Room');

async function connectToDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
}

async function backupDatabase() {
    try {
        console.log('Starting database backup...');
        
        // Create backup directory with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(__dirname, '..', '..', 'backup', timestamp);
        
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        console.log(`Backup directory created: ${backupDir}`);
        
        // Get all collection names from the database
        const collections = await mongoose.connection.db.listCollections().toArray();
        const collectionNames = collections.map(col => col.name);
        
        console.log(`Found ${collectionNames.length} collections:`, collectionNames);
        
        // Backup each collection
        for (const collectionName of collectionNames) {
            try {
                console.log(`Backing up collection: ${collectionName}`);
                
                // Get all documents from the collection
                const documents = await mongoose.connection.db
                    .collection(collectionName)
                    .find({})
                    .toArray();
                
                // Create backup file
                const backupFile = path.join(backupDir, `${collectionName}.json`);
                
                // Write documents to JSON file with pretty formatting
                fs.writeFileSync(
                    backupFile, 
                    JSON.stringify(documents, null, 2)
                );
                
                console.log(`✓ ${collectionName}: ${documents.length} documents backed up`);
                
            } catch (error) {
                console.error(`✗ Error backing up ${collectionName}:`, error.message);
            }
        }
        
        // Create backup info file
        const backupInfo = {
            timestamp: new Date().toISOString(),
            database: mongoose.connection.db.databaseName,
            collections: collectionNames,
            totalCollections: collectionNames.length,
            backupLocation: backupDir
        };
        
        fs.writeFileSync(
            path.join(backupDir, 'backup-info.json'),
            JSON.stringify(backupInfo, null, 2)
        );
        
        console.log('\n✅ Database backup completed successfully!');
        console.log(`📁 Backup location: ${backupDir}`);
        console.log(`📊 Total collections backed up: ${collectionNames.length}`);
        
        return backupDir;
        
    } catch (error) {
        console.error('❌ Error during backup:', error);
        throw error;
    }
}

async function restoreDatabase(backupDir) {
    try {
        console.log('Starting database restore...');
        console.log(`Restoring from: ${backupDir}`);
        
        // Read backup info
        const backupInfoPath = path.join(backupDir, 'backup-info.json');
        if (!fs.existsSync(backupInfoPath)) {
            throw new Error('Backup info file not found');
        }
        
        const backupInfo = JSON.parse(fs.readFileSync(backupInfoPath, 'utf8'));
        console.log(`Restoring database: ${backupInfo.database}`);
        
        // Restore each collection
        for (const collectionName of backupInfo.collections) {
            try {
                const backupFile = path.join(backupDir, `${collectionName}.json`);
                
                if (!fs.existsSync(backupFile)) {
                    console.log(`⚠️  Backup file not found for ${collectionName}, skipping...`);
                    continue;
                }
                
                // Read backup data
                const documents = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
                
                // Clear existing collection
                await mongoose.connection.db.collection(collectionName).deleteMany({});
                
                // Insert backup documents
                if (documents.length > 0) {
                    await mongoose.connection.db.collection(collectionName).insertMany(documents);
                }
                
                console.log(`✓ ${collectionName}: ${documents.length} documents restored`);
                
            } catch (error) {
                console.error(`✗ Error restoring ${collectionName}:`, error.message);
            }
        }
        
        console.log('\n✅ Database restore completed successfully!');
        
    } catch (error) {
        console.error('❌ Error during restore:', error);
        throw error;
    }
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    if (!command || (command !== 'backup' && command !== 'restore')) {
        console.log('Usage:');
        console.log('  node src/scripts/backupDatabase.js backup');
        console.log('  node src/scripts/backupDatabase.js restore <backup-directory>');
        process.exit(1);
    }
    
    await connectToDatabase();
    
    if (command === 'backup') {
        await backupDatabase();
    } else if (command === 'restore') {
        const backupDir = args[1];
        if (!backupDir) {
            console.error('Please provide backup directory path for restore');
            process.exit(1);
        }
        await restoreDatabase(backupDir);
    }
    
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { backupDatabase, restoreDatabase }; 