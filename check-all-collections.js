const mongoose = require('mongoose');

/**
 * Check All Collections in Database
 * 
 * This script examines all collections to see what data is available
 * for generating financial reports.
 * 
 * Run with: node check-all-collections.js
 */

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';

async function connectToDatabase() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB successfully!');
        console.log('Database:', mongoose.connection.name);
        console.log('');
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error.message);
        throw error;
    }
}

async function checkAllCollections() {
    try {
        console.log('=============================================');
        console.log('🔍 CHECKING ALL COLLECTIONS IN DATABASE');
        console.log('=============================================\n');

        const db = mongoose.connection.db;

        // Get all collections
        const collections = await db.listCollections().toArray();
        console.log(`Total Collections Found: ${collections.length}\n`);

        // Check each collection for data
        for (const collection of collections) {
            const collectionName = collection.name;
            const collectionData = db.collection(collectionName);
            const documentCount = await collectionData.countDocuments();
            
            console.log(`📁 Collection: ${collectionName}`);
            console.log(`   Documents: ${documentCount}`);
            
            if (documentCount > 0) {
                // Get sample document to see structure
                const sampleDoc = await collectionData.findOne({});
                if (sampleDoc) {
                    console.log(`   Sample Fields: ${Object.keys(sampleDoc).join(', ')}`);
                    
                    // Show first few key values
                    const keyFields = Object.keys(sampleDoc).slice(0, 5);
                    keyFields.forEach(field => {
                        const value = sampleDoc[field];
                        if (value !== null && value !== undefined) {
                            const displayValue = typeof value === 'object' ? JSON.stringify(value).substring(0, 50) : String(value);
                            console.log(`      ${field}: ${displayValue}`);
                        }
                    });
                }
            }
            console.log('');
        }

        // Look for potential student-related collections
        console.log('🎯 POTENTIAL STUDENT DATA COLLECTIONS:');
        console.log('=============================================\n');

        const potentialStudentCollections = [
            'students', 'student', 'applications', 'application', 'leases', 'lease',
            'enrollments', 'enrollment', 'registrations', 'registration',
            'users', 'user', 'profiles', 'profile'
        ];

        for (const potentialName of potentialStudentCollections) {
            try {
                const collection = db.collection(potentialName);
                const count = await collection.countDocuments();
                if (count > 0) {
                    console.log(`✅ Found: ${potentialName} (${count} documents)`);
                    
                    // Check if it contains student-like data
                    const sample = await collection.findOne({});
                    if (sample) {
                        const hasStudentFields = sample.name || sample.studentName || sample.email || sample.studentId;
                        if (hasStudentFields) {
                            console.log(`   📚 Contains student data: ${Object.keys(sample).join(', ')}`);
                        }
                    }
                }
            } catch (error) {
                // Collection doesn't exist
            }
        }

        // Check for any collections with more than 0 documents
        console.log('\n📊 COLLECTIONS WITH DATA:');
        console.log('=============================================\n');

        let collectionsWithData = 0;
        for (const collection of collections) {
            const collectionData = db.collection(collection.name);
            const count = await collectionData.countDocuments();
            if (count > 0) {
                collectionsWithData++;
                console.log(`📁 ${collection.name}: ${count} documents`);
            }
        }

        if (collectionsWithData === 0) {
            console.log('❌ No collections contain any data');
            console.log('   Your database is empty and needs to be populated');
        } else {
            console.log(`\n✅ Found ${collectionsWithData} collections with data`);
        }

        // Recommendations
        console.log('\n💡 RECOMMENDATIONS:');
        console.log('=============================================\n');

        if (collectionsWithData === 0) {
            console.log('🎯 To see real financial reports, you need to:');
            console.log('   1. Add students to the students collection');
            console.log('   2. Create applications in the application collection');
            console.log('   3. Record payments in the payments collection');
            console.log('   4. Add expenses in the expenses collection');
        } else {
            console.log('🎯 Your database has some data but may need:');
            console.log('   1. More student records');
            console.log('   2. Student application data');
            console.log('   3. Payment records');
            console.log('   4. Complete financial transactions');
        }

        console.log('\n🎉 Collection Analysis Complete!');

    } catch (error) {
        console.error('❌ Error checking collections:', error);
    }
}

async function cleanup() {
    try {
        await mongoose.connection.close();
        console.log('✅ Database connection closed');
    } catch (error) {
        console.error('❌ Error closing database connection:', error);
    }
}

async function main() {
    try {
        await connectToDatabase();
        await checkAllCollections();
    } catch (error) {
        console.error('❌ Collection check failed:', error);
    } finally {
        await cleanup();
        process.exit(0);
    }
}

if (require.main === module) {
    main();
}

module.exports = { checkAllCollections };
