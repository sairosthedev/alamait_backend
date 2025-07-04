const mongoose = require('mongoose');
const Payment = require('./src/models/Payment');
const User = require('./src/models/User');
const Application = require('./src/models/Application');

// Test student lookup with the specific payment data
async function testStudentLookup() {
    try {
        // Connect to MongoDB
        await mongoose.connect('mongodb://localhost:27017/alamait', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        const studentId = '68671f498c3609aa58533686';
        console.log('Testing student lookup for ID:', studentId);

        // Test 1: Check if student exists in User collection
        console.log('\n1. Checking User collection...');
        const user = await User.findById(studentId).select('firstName lastName email');
        if (user) {
            console.log('✅ Found in User collection:', user);
        } else {
            console.log('❌ Not found in User collection');
        }

        // Test 2: Check if student exists in Application collection
        console.log('\n2. Checking Application collection...');
        const application = await Application.findById(studentId).select('firstName lastName email');
        if (application) {
            console.log('✅ Found in Application collection:', application);
        } else {
            console.log('❌ Not found in Application collection');
        }

        // Test 3: Check if payments exist for this student
        console.log('\n3. Checking Payment collection...');
        const payments = await Payment.find({ student: studentId });
        console.log(`Found ${payments.length} payments for student ${studentId}`);
        
        if (payments.length > 0) {
            console.log('Sample payment:', {
                paymentId: payments[0].paymentId,
                student: payments[0].student,
                totalAmount: payments[0].totalAmount,
                status: payments[0].status
            });
        }

        // Test 4: Check if any payments have populated student field
        console.log('\n4. Checking populated student field in payments...');
        const populatedPayments = await Payment.find({ student: studentId }).populate('student', 'firstName lastName email');
        if (populatedPayments.length > 0 && populatedPayments[0].student) {
            console.log('✅ Found populated student:', populatedPayments[0].student);
        } else {
            console.log('❌ No populated student field found');
        }

        // Test 5: Simulate our lookup logic
        console.log('\n5. Testing our lookup logic...');
        
        // First, try to find in User collection
        let student = await User.findById(studentId).select('firstName lastName email');
        if (student) {
            console.log('✅ Found in User collection');
        } else {
            // If not found in User, try Application collection
            const app = await Application.findById(studentId).select('firstName lastName email');
            if (app) {
                console.log('✅ Found in Application collection');
                student = {
                    _id: app._id,
                    firstName: app.firstName,
                    lastName: app.lastName,
                    email: app.email
                };
            } else {
                // If still not found, try to find by looking up payments
                const payment = await Payment.findOne({ student: studentId }).populate('student', 'firstName lastName email');
                if (payment && payment.student) {
                    console.log('✅ Found via payment populate');
                    student = payment.student;
                } else {
                    // Last resort: check if payment exists but no student record
                    const paymentExists = await Payment.findOne({ student: studentId });
                    if (paymentExists) {
                        console.log('✅ Found payment but no student record - creating minimal student object');
                        student = {
                            _id: studentId,
                            firstName: 'Unknown',
                            lastName: 'Student',
                            email: 'unknown@student.com'
                        };
                    } else {
                        console.log('❌ Student not found anywhere');
                    }
                }
            }
        }

        if (student) {
            console.log('Final student object:', student);
            
            // Test 6: Try to fetch payments with the found student
            console.log('\n6. Testing payment fetch with found student...');
            let payments = await Payment.find({ student: student._id });
            if (payments.length === 0) {
                payments = await Payment.find({ student: studentId });
            }
            console.log(`Found ${payments.length} payments for student`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the test
testStudentLookup(); 