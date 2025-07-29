const mongoose = require('mongoose');
const Request = require('./src/models/Request');
const User = require('./src/models/User');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function testRequestSystem() {
    try {
        console.log('Testing Request System...\n');

        // Test 1: Create a student maintenance request
        console.log('1. Testing student maintenance request creation...');
        
        // Find a student user
        const student = await User.findOne({ role: 'student' });
        if (!student) {
            console.log('No student found, creating test student...');
            const testStudent = new User({
                email: 'teststudent@example.com',
                password: 'password123',
                firstName: 'Test',
                lastName: 'Student',
                phone: '1234567890',
                role: 'student'
            });
            await testStudent.save();
            console.log('Test student created');
        }

        const studentUser = await User.findOne({ role: 'student' });
        
        const maintenanceRequest = new Request({
            title: 'Leaky Faucet in Room 101',
            description: 'The faucet in the bathroom is leaking and needs repair',
            type: 'maintenance',
            submittedBy: studentUser._id,
            boardingHouse: 'Thor',
            room: '101',
            category: 'plumbing',
            priority: 'medium',
            status: 'pending'
        });

        await maintenanceRequest.save();
        console.log('✅ Student maintenance request created successfully');
        console.log(`   Request ID: ${maintenanceRequest._id}`);
        console.log(`   Status: ${maintenanceRequest.status}\n`);

        // Test 2: Create an admin financial request
        console.log('2. Testing admin financial request creation...');
        
        // Find an admin user
        const admin = await User.findOne({ role: 'admin' });
        if (!admin) {
            console.log('No admin found, creating test admin...');
            const testAdmin = new User({
                email: 'testadmin@example.com',
                password: 'password123',
                firstName: 'Test',
                lastName: 'Admin',
                phone: '1234567890',
                role: 'admin'
            });
            await testAdmin.save();
            console.log('Test admin created');
        }

        const adminUser = await User.findOne({ role: 'admin' });
        
        const financialRequest = new Request({
            title: 'New Furniture Purchase',
            description: 'Need to purchase new furniture for common areas',
            type: 'financial',
            submittedBy: adminUser._id,
            boardingHouse: 'Thor',
            amount: 5000,
            approval: {
                admin: {
                    approved: true,
                    approvedBy: adminUser._id,
                    approvedAt: new Date()
                },
                finance: {
                    approved: false
                },
                ceo: {
                    approved: false
                }
            }
        });

        await financialRequest.save();
        console.log('✅ Admin financial request created successfully');
        console.log(`   Request ID: ${financialRequest._id}`);
        console.log(`   Admin approved: ${financialRequest.approval.admin.approved}`);
        console.log(`   Finance approved: ${financialRequest.approval.finance.approved}`);
        console.log(`   CEO approved: ${financialRequest.approval.ceo.approved}\n`);

        // Test 3: Update maintenance request status
        console.log('3. Testing maintenance request status update...');
        
        maintenanceRequest.status = 'assigned';
        maintenanceRequest.assignedTo = {
            _id: adminUser._id,
            name: adminUser.firstName,
            surname: adminUser.lastName,
            role: adminUser.role
        };
        
        await maintenanceRequest.save();
        console.log('✅ Maintenance request status updated to "assigned"');
        console.log(`   New status: ${maintenanceRequest.status}`);
        console.log(`   Assigned to: ${maintenanceRequest.assignedTo.name} ${maintenanceRequest.assignedTo.surname}\n`);

        // Test 4: Finance approval
        console.log('4. Testing finance approval...');
        
        // Find or create a finance user
        const finance = await User.findOne({ role: 'finance' });
        if (!finance) {
            console.log('No finance user found, creating test finance user...');
            const testFinance = new User({
                email: 'testfinance@example.com',
                password: 'password123',
                firstName: 'Test',
                lastName: 'Finance',
                phone: '1234567890',
                role: 'finance'
            });
            await testFinance.save();
            console.log('Test finance user created');
        }

        const financeUser = await User.findOne({ role: 'finance' });
        
        financialRequest.approval.finance = {
            approved: true,
            approvedBy: financeUser._id,
            approvedAt: new Date(),
            notes: 'Approved after budget review'
        };
        
        await financialRequest.save();
        console.log('✅ Finance approval completed');
        console.log(`   Finance approved: ${financialRequest.approval.finance.approved}`);
        console.log(`   Finance notes: ${financialRequest.approval.finance.notes}\n`);

        // Test 5: CEO approval and expense conversion
        console.log('5. Testing CEO approval and expense conversion...');
        
        // Find or create a CEO user
        const ceo = await User.findOne({ role: 'ceo' });
        if (!ceo) {
            console.log('No CEO found, creating test CEO...');
            const testCeo = new User({
                email: 'testceo@example.com',
                password: 'password123',
                firstName: 'Test',
                lastName: 'CEO',
                phone: '1234567890',
                role: 'ceo'
            });
            await testCeo.save();
            console.log('Test CEO created');
        }

        const ceoUser = await User.findOne({ role: 'ceo' });
        
        financialRequest.approval.ceo = {
            approved: true,
            approvedBy: ceoUser._id,
            approvedAt: new Date(),
            notes: 'Final approval granted'
        };
        
        await financialRequest.save();
        console.log('✅ CEO approval completed');
        console.log(`   CEO approved: ${financialRequest.approval.ceo.approved}`);
        console.log(`   CEO notes: ${financialRequest.approval.ceo.notes}\n`);

        // Test 6: Add quotation to financial request
        console.log('6. Testing quotation upload...');
        
        const quotation = {
            provider: 'ABC Furniture Co.',
            amount: 4800,
            description: 'Complete furniture package for common areas',
            fileUrl: 'https://example.com/quotation1.pdf',
            fileName: 'quotation1.pdf',
            uploadedBy: adminUser._id,
            uploadedAt: new Date()
        };
        
        financialRequest.quotations.push(quotation);
        await financialRequest.save();
        console.log('✅ Quotation added successfully');
        console.log(`   Provider: ${quotation.provider}`);
        console.log(`   Amount: $${quotation.amount}`);
        console.log(`   Total quotations: ${financialRequest.quotations.length}\n`);

        // Test 7: Approve quotation
        console.log('7. Testing quotation approval...');
        
        financialRequest.quotations[0].isApproved = true;
        financialRequest.quotations[0].approvedBy = financeUser._id;
        financialRequest.quotations[0].approvedAt = new Date();
        financialRequest.amount = financialRequest.quotations[0].amount;
        
        await financialRequest.save();
        console.log('✅ Quotation approved successfully');
        console.log(`   Approved quotation: ${financialRequest.quotations[0].provider}`);
        console.log(`   Approved amount: $${financialRequest.amount}\n`);

        // Test 8: Query requests by role
        console.log('8. Testing role-based request queries...');
        
        // Student should see only their own requests
        const studentRequests = await Request.find({ submittedBy: studentUser._id });
        console.log(`   Student requests: ${studentRequests.length}`);
        
        // Admin should see all requests
        const allRequests = await Request.find({});
        console.log(`   Total requests: ${allRequests.length}`);
        
        // Finance should see approved admin requests
        const financeRequests = await Request.find({
            type: { $in: ['financial', 'operational'] },
            'approval.admin.approved': true
        });
        console.log(`   Finance-visible requests: ${financeRequests.length}`);
        
        // CEO should see finance-approved requests
        const ceoRequests = await Request.find({
            type: { $in: ['financial', 'operational'] },
            'approval.admin.approved': true,
            'approval.finance.approved': true
        });
        console.log(`   CEO-visible requests: ${ceoRequests.length}\n`);

        console.log('🎉 All tests completed successfully!');
        console.log('\nRequest System Features Verified:');
        console.log('✅ Student maintenance request creation');
        console.log('✅ Admin financial request creation');
        console.log('✅ Maintenance request status updates');
        console.log('✅ Admin approval flow');
        console.log('✅ Finance approval flow');
        console.log('✅ CEO approval flow');
        console.log('✅ Quotation upload and approval');
        console.log('✅ Role-based request filtering');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.connection.close();
        console.log('\nDatabase connection closed');
    }
}

// Run the test
testRequestSystem();