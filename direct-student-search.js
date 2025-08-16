const mongoose = require('mongoose');

/**
 * Direct Student Data Search
 * 
 * This script directly searches for the student application data
 * the user showed me by looking for specific field patterns.
 * 
 * Run with: node direct-student-search.js
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

async function directStudentSearch() {
    try {
        console.log('=============================================');
        console.log('🔍 DIRECT SEARCH FOR STUDENT DATA');
        console.log('=============================================\n');

        const db = mongoose.connection.db;

        // Get all collections
        const collections = await db.listCollections().toArray();
        console.log(`Total Collections Found: ${collections.length}\n`);

        // Search for collections that might contain the student data
        console.log('🔍 SEARCHING FOR STUDENT APPLICATION DATA:');
        console.log('=============================================\n');

        for (const collection of collections) {
            const collectionName = collection.name;
            const collectionData = db.collection(collectionName);
            const count = await collectionData.countDocuments();
            
            if (count > 0) {
                console.log(`📁 Checking: ${collectionName} (${count} documents)`);
                
                try {
                    // Look for documents with firstName field (which the user's data has)
                    const studentDoc = await collectionData.findOne({ firstName: { $exists: true } });
                    
                    if (studentDoc) {
                        console.log(`   ✅ FOUND STUDENT DATA in collection: ${collectionName}!`);
                        console.log(`   📋 Document fields: ${Object.keys(studentDoc).join(', ')}`);
                        
                        // Show the student data
                        if (studentDoc.firstName && studentDoc.lastName) {
                            console.log(`   👤 Student: ${studentDoc.firstName} ${studentDoc.lastName}`);
                            if (studentDoc.email) console.log(`      Email: ${studentDoc.email}`);
                            if (studentDoc.phone) console.log(`      Phone: ${studentDoc.phone}`);
                            if (studentDoc.paymentStatus) console.log(`      Payment: ${studentDoc.paymentStatus}`);
                            if (studentDoc.status) console.log(`      Status: ${studentDoc.status}`);
                            if (studentDoc.allocatedRoom || studentDoc.preferredRoom) {
                                console.log(`      Room: ${studentDoc.allocatedRoom || studentDoc.preferredRoom}`);
                            }
                            if (studentDoc.applicationCode) console.log(`      App Code: ${studentDoc.applicationCode}`);
                        }
                        
                        // Count total students in this collection
                        const totalStudents = await collectionData.countDocuments({ firstName: { $exists: true } });
                        console.log(`   📊 Total students in ${collectionName}: ${totalStudents}`);
                        
                        // Show a few more students
                        const moreStudents = await collectionData.find({ firstName: { $exists: true } }).limit(3).toArray();
                        console.log(`   📋 Sample students:`);
                        moreStudents.forEach((student, index) => {
                            console.log(`      ${index + 1}. ${student.firstName} ${student.lastName} - ${student.paymentStatus || 'unknown'}`);
                        });
                        
                        console.log('');
                        return; // Found the collection, no need to search further
                    }
                } catch (error) {
                    // Collection might not support this query
                }
            }
        }

        // If we didn't find it with firstName, try other approaches
        console.log('🔍 TRYING ALTERNATIVE SEARCH METHODS:');
        console.log('=============================================\n');

        for (const collection of collections) {
            const collectionName = collection.name;
            const collectionData = db.collection(collectionName);
            const count = await collectionData.countDocuments();
            
            if (count > 0) {
                try {
                    // Look for documents with applicationCode field
                    const appDoc = await collectionData.findOne({ applicationCode: { $exists: true } });
                    
                    if (appDoc) {
                        console.log(`   ✅ FOUND APPLICATION DATA in collection: ${collectionName}!`);
                        console.log(`   📋 Document fields: ${Object.keys(appDoc).join(', ')}`);
                        
                        if (appDoc.applicationCode) {
                            console.log(`   📝 Application Code: ${appDoc.applicationCode}`);
                        }
                        
                        // Count total applications
                        const totalApps = await collectionData.countDocuments({ applicationCode: { $exists: true } });
                        console.log(`   📊 Total applications in ${collectionName}: ${totalApps}`);
                        
                        console.log('');
                        return;
                    }
                } catch (error) {
                    // Continue searching
                }
            }
        }

        // If still not found, show all collections with data
        console.log('🔍 SHOWING ALL COLLECTIONS WITH DATA:');
        console.log('=============================================\n');

        for (const collection of collections) {
            const collectionName = collection.name;
            const collectionData = db.collection(collectionName);
            const count = await collectionData.countDocuments();
            
            if (count > 0) {
                console.log(`📁 ${collectionName}: ${count} documents`);
                
                // Show sample document structure
                try {
                    const sample = await collectionData.findOne({});
                    if (sample) {
                        const fields = Object.keys(sample);
                        console.log(`   Fields: ${fields.slice(0, 10).join(', ')}${fields.length > 10 ? '...' : ''}`);
                        
                        // Check if it might be student-related
                        const hasStudentFields = fields.some(field => 
                            field.includes('student') || field.includes('name') || field.includes('email') ||
                            field.includes('phone') || field.includes('room') || field.includes('residence')
                        );
                        
                        if (hasStudentFields) {
                            console.log(`   🎯 POTENTIAL STUDENT DATA COLLECTION!`);
                        }
                    }
                } catch (error) {
                    console.log(`   ❌ Error reading sample document`);
                }
                console.log('');
            }
        }

        console.log('❌ STUDENT DATA NOT FOUND');
        console.log('=============================================\n');
        console.log('The student application data you showed me was not found in any collection.');
        console.log('Possible reasons:');
        console.log('1. The collection name is different from what we searched');
        console.log('2. The data is stored in a different format');
        console.log('3. The data is in a different database');
        console.log('4. The data needs to be imported/created first');
        console.log('');

    } catch (error) {
        console.error('❌ Error in direct student search:', error);
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
        await directStudentSearch();
    } catch (error) {
        console.error('❌ Direct student search failed:', error);
    } finally {
        await cleanup();
        process.exit(0);
    }
}

if (require.main === module) {
    main();
}

module.exports = { directStudentSearch };
