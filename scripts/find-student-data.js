const mongoose = require('mongoose');

/**
 * Find Student Data Collections
 * 
 * This script searches for collections that contain the student application data
 * the user showed me.
 * 
 * Run with: node find-student-data.js
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

async function findStudentData() {
    try {
        console.log('=============================================');
        console.log('🔍 SEARCHING FOR STUDENT APPLICATION DATA');
        console.log('=============================================\n');

        const db = mongoose.connection.db;

        // Get all collections
        const collections = await db.listCollections().toArray();
        console.log(`Total Collections Found: ${collections.length}\n`);

        // Search for collections that might contain student data
        const potentialCollections = [
            'applications', 'application', 'students', 'student', 'leases', 'lease',
            'enrollments', 'enrollment', 'registrations', 'registration',
            'requests', 'request', 'bookings', 'booking', 'reservations', 'reservation'
        ];

        console.log('🔍 SEARCHING FOR STUDENT DATA IN COLLECTIONS:');
        console.log('=============================================\n');

        for (const potentialName of potentialCollections) {
            try {
                const collection = db.collection(potentialName);
                const count = await collection.countDocuments();
                
                if (count > 0) {
                    console.log(`📁 Found: ${potentialName} (${count} documents)`);
                    
                    // Check if it contains student-like data
                    const sample = await collection.findOne({});
                    if (sample) {
                        const hasStudentFields = sample.firstName || sample.lastName || sample.email || 
                                               sample.studentName || sample.name || sample.studentId;
                        
                        if (hasStudentFields) {
                            console.log(`   ✅ Contains student data!`);
                            console.log(`   📋 Sample fields: ${Object.keys(sample).join(', ')}`);
                            
                            // Show sample student data
                            if (sample.firstName && sample.lastName) {
                                console.log(`   👤 Sample student: ${sample.firstName} ${sample.lastName}`);
                                if (sample.email) console.log(`      Email: ${sample.email}`);
                                if (sample.paymentStatus) console.log(`      Payment: ${sample.paymentStatus}`);
                                if (sample.status) console.log(`      Status: ${sample.status}`);
                                if (sample.allocatedRoom || sample.preferredRoom) {
                                    console.log(`      Room: ${sample.allocatedRoom || sample.preferredRoom}`);
                                }
                            }
                        } else {
                            console.log(`   ❌ No student data found`);
                        }
                    }
                    console.log('');
                }
            } catch (error) {
                // Collection doesn't exist
            }
        }

        // Also check all collections for any documents with student-like fields
        console.log('🔍 SEARCHING ALL COLLECTIONS FOR STUDENT-LIKE DATA:');
        console.log('=============================================\n');

        for (const collection of collections) {
            const collectionName = collection.name;
            const collectionData = db.collection(collectionName);
            const count = await collectionData.countDocuments();
            
            if (count > 0) {
                // Get a few sample documents to check for student data
                const samples = await collectionData.find({}).limit(3).toArray();
                
                for (const sample of samples) {
                    const hasStudentFields = sample.firstName || sample.lastName || sample.email || 
                                           sample.studentName || sample.name || sample.studentId ||
                                           sample.phone || sample.applicationCode;
                    
                    if (hasStudentFields) {
                        console.log(`📁 Collection: ${collectionName}`);
                        console.log(`   ✅ Found document with student-like fields!`);
                        console.log(`   📋 Fields: ${Object.keys(sample).join(', ')}`);
                        
                        if (sample.firstName && sample.lastName) {
                            console.log(`   👤 Student: ${sample.firstName} ${sample.lastName}`);
                            if (sample.email) console.log(`      Email: ${sample.email}`);
                            if (sample.paymentStatus) console.log(`      Payment: ${sample.paymentStatus}`);
                            if (sample.status) console.log(`      Status: ${sample.status}`);
                        }
                        console.log('');
                        break; // Found student data in this collection, move to next
                    }
                }
            }
        }

        console.log('🎯 RECOMMENDATIONS:');
        console.log('=============================================\n');

        console.log('Based on your data, you should have a collection containing:');
        console.log('• firstName, lastName, email, phone');
        console.log('• requestType, status, paymentStatus');
        console.log('• applicationDate, startDate, endDate');
        console.log('• preferredRoom, allocatedRoom, residence');
        console.log('• applicationCode');
        console.log('');

        console.log('🎉 Student data search complete!');

    } catch (error) {
        console.error('❌ Error searching for student data:', error);
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
        await findStudentData();
    } catch (error) {
        console.error('❌ Student data search failed:', error);
    } finally {
        await cleanup();
        process.exit(0);
    }
}

if (require.main === module) {
    main();
}

module.exports = { findStudentData };
