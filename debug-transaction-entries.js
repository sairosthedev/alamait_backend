const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');
const User = require('./src/models/User');

const ATLAS_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait_test';

async function debugTransactionEntries() {
    try {
        console.log('🔍 Debugging Transaction Entries');
        console.log('=' .repeat(60));

        // Connect to database
        await mongoose.connect(ATLAS_URI);
        console.log('✅ Connected to database');

        // Get a sample of transaction entries
        console.log('\n📊 Sample Transaction Entries:');
        const sampleEntries = await TransactionEntry.find({}).limit(10);
        
        if (sampleEntries.length === 0) {
            console.log('No transaction entries found in the database');
            return;
        }

        console.log(`Found ${sampleEntries.length} sample entries:`);
        sampleEntries.forEach((entry, index) => {
            console.log(`\n${index + 1}. Transaction Entry:`);
            console.log(`   ID: ${entry._id}`);
            console.log(`   Reference: ${entry.reference}`);
            console.log(`   Description: ${entry.description}`);
            console.log(`   Account Code: ${entry.accountCode}`);
            console.log(`   Type: ${entry.entryType}`);
            console.log(`   Debit: ${entry.debit || 0}`);
            console.log(`   Credit: ${entry.credit || 0}`);
        });

        // Check what reference patterns exist
        console.log('\n🔍 Reference Field Analysis:');
        const referencePatterns = await TransactionEntry.aggregate([
            {
                $group: {
                    _id: null,
                    totalEntries: { $sum: 1 },
                    referenceTypes: { $addToSet: { $type: "$reference" } },
                    sampleReferences: { $push: "$reference" }
                }
            },
            {
                $project: {
                    totalEntries: 1,
                    referenceTypes: 1,
                    sampleReferences: { $slice: ["$sampleReferences", 20] }
                }
            }
        ]);

        if (referencePatterns.length > 0) {
            const pattern = referencePatterns[0];
            console.log(`Total entries: ${pattern.totalEntries}`);
            console.log(`Reference field types: ${pattern.referenceTypes.join(', ')}`);
            console.log('Sample references:');
            pattern.sampleReferences.forEach((ref, index) => {
                console.log(`  ${index + 1}. ${ref} (type: ${typeof ref})`);
            });
        }

        // Check if any references look like ObjectIds
        console.log('\n🎯 ObjectId Pattern Analysis:');
        const objectIdPattern = /^[0-9a-fA-F]{24}$/;
        const entries = await TransactionEntry.find({}).select('reference description').limit(100);
        
        let objectIdRefs = 0;
        let possibleStudentRefs = 0;
        const studentIds = new Set();

        // Get some student IDs for comparison
        const students = await User.find({ role: 'student' }).limit(10).select('_id');
        students.forEach(student => studentIds.add(student._id.toString()));

        entries.forEach(entry => {
            if (typeof entry.reference === 'string' && objectIdPattern.test(entry.reference)) {
                objectIdRefs++;
                if (studentIds.has(entry.reference)) {
                    possibleStudentRefs++;
                }
            }
        });

        console.log(`Entries with ObjectId-like references: ${objectIdRefs}/${entries.length}`);
        console.log(`Entries referencing known students: ${possibleStudentRefs}/${entries.length}`);

        // Check for entries that might reference students in other ways
        console.log('\n🔍 Alternative Student Reference Patterns:');
        
        // Check for entries with student IDs in description
        const entriesWithStudentInDesc = await TransactionEntry.find({
            description: { $regex: 'student', $options: 'i' }
        }).limit(5);

        if (entriesWithStudentInDesc.length > 0) {
            console.log('Entries with "student" in description:');
            entriesWithStudentInDesc.forEach((entry, index) => {
                console.log(`  ${index + 1}. ${entry.description} (ref: ${entry.reference})`);
            });
        }

        // Test a specific student ID
        if (students.length > 0) {
            const testStudentId = students[0]._id;
            console.log(`\n🧪 Testing deletion query for student: ${testStudentId}`);
            
            const matchingEntries = await TransactionEntry.find({
                reference: testStudentId.toString()
            });
            
            console.log(`Entries that would be deleted: ${matchingEntries.length}`);
            if (matchingEntries.length > 0) {
                console.log('Sample matching entries:');
                matchingEntries.slice(0, 3).forEach((entry, index) => {
                    console.log(`  ${index + 1}. ${entry.description} (${entry.accountCode})`);
                });
            }
        }

    } catch (error) {
        console.error('❌ Debug failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from database');
    }
}

// Run the debug
if (require.main === module) {
    debugTransactionEntries();
}

module.exports = { debugTransactionEntries }; 