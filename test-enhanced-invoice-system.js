const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Import models and services
const Invoice = require('./src/models/Invoice');
const User = require('./src/models/User');
const Residence = require('./src/models/Residence');
const invoiceController = require('./src/controllers/invoiceController');
const automatedBillingService = require('./src/services/automatedBillingService');
const invoiceReportingService = require('./src/services/invoiceReportingService');

async function testEnhancedInvoiceSystem() {
    try {
        console.log('🧪 Testing Enhanced Invoice System...\n');

        // Test 1: Create Enhanced Invoice
        console.log('1️⃣ Testing Invoice Creation...');
        await testInvoiceCreation();

        // Test 2: Test Payment Recording
        console.log('\n2️⃣ Testing Payment Recording...');
        await testPaymentRecording();

        // Test 3: Test Automated Features
        console.log('\n3️⃣ Testing Automated Features...');
        await testAutomatedFeatures();

        // Test 4: Test Reporting
        console.log('\n4️⃣ Testing Reporting Features...');
        await testReportingFeatures();

        console.log('\n✅ All tests completed successfully!');
        console.log('\n🎉 Enhanced Invoice System is working perfectly!');

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        mongoose.connection.close();
    }
}

async function testInvoiceCreation() {
    // Create test student
    const testStudent = new User({
        firstName: 'Test',
        lastName: 'Student',
        email: 'test.student@example.com',
        phone: '0771234567',
        role: 'student',
        password: 'password123'
    });
    await testStudent.save();

    // Create test residence
    const testResidence = new Residence({
        name: 'Test Residence',
        address: '123 Test Street, Harare',
        capacity: 50
    });
    await testResidence.save();

    // Create test admin
    const testAdmin = new User({
        firstName: 'Test',
        lastName: 'Admin',
        email: 'test.admin@example.com',
        phone: '0771234568',
        role: 'admin',
        password: 'password123'
    });
    await testAdmin.save();

    // Create mock request for invoice creation
    const mockReq = {
        body: {
            student: testStudent._id,
            residence: testResidence._id,
            room: 'Room 101',
            roomType: 'Standard',
            billingPeriod: '2025-01',
            billingStartDate: '2025-01-01',
            billingEndDate: '2025-01-31',
            dueDate: '2025-01-15',
            charges: [
                {
                    description: 'Monthly Rent',
                    amount: 500,
                    quantity: 1,
                    unitPrice: 500,
                    category: 'rent',
                    taxRate: 0,
                    notes: 'Standard monthly rent'
                },
                {
                    description: 'Utilities',
                    amount: 50,
                    quantity: 1,
                    unitPrice: 50,
                    category: 'utilities',
                    taxRate: 0,
                    notes: 'Water and electricity'
                }
            ],
            notes: 'Test invoice for enhanced system',
            terms: 'Payment due within 7 days',
            isRecurring: true,
            lateFeeRate: 5,
            gracePeriod: 3
        },
        user: testAdmin
    };

    const mockRes = {
        status: function(code) {
            this.statusCode = code;
            return this;
        },
        json: function(data) {
            this.responseData = data;
            return this;
        }
    };

    // Create invoice
    await invoiceController.createInvoice(mockReq, mockRes);

    if (mockRes.statusCode === 201) {
        console.log('✅ Invoice created successfully');
        console.log('   Invoice Number:', mockRes.responseData.invoice.invoiceNumber);
        console.log('   Total Amount:', mockRes.responseData.invoice.totalAmount);
        console.log('   Status:', mockRes.responseData.invoice.status);
        
        // Store for other tests
        global.testInvoice = mockRes.responseData.invoice;
        global.testStudent = testStudent;
        global.testAdmin = testAdmin;
    } else {
        throw new Error('Invoice creation failed');
    }
}

async function testPaymentRecording() {
    if (!global.testInvoice) {
        console.log('⚠️ Skipping payment test - no test invoice available');
        return;
    }

    const mockReq = {
        params: { id: global.testInvoice._id },
        body: {
            paymentId: 'PAY' + Date.now(),
            amount: 300,
            paymentMethod: 'Bank Transfer',
            reference: 'REF123456',
            notes: 'Partial payment test'
        },
        user: global.testAdmin
    };

    const mockRes = {
        status: function(code) {
            this.statusCode = code;
            return this;
        },
        json: function(data) {
            this.responseData = data;
            return this;
        }
    };

    // Record payment
    await invoiceController.recordPayment(mockReq, mockRes);

    if (mockRes.statusCode === 200) {
        console.log('✅ Payment recorded successfully');
        console.log('   Payment Amount:', mockReq.body.amount);
        console.log('   New Balance:', mockRes.responseData.invoice.balanceDue);
        console.log('   Payment Status:', mockRes.responseData.invoice.paymentStatus);
    } else {
        throw new Error('Payment recording failed');
    }
}

async function testAutomatedFeatures() {
    console.log('   Testing automated billing service...');
    
    // Test daily tasks
    await automatedBillingService.triggerDailyTasks();
    console.log('   ✅ Daily tasks completed');

    // Test weekly tasks
    await automatedBillingService.triggerWeeklyTasks();
    console.log('   ✅ Weekly tasks completed');

    // Test monthly tasks
    await automatedBillingService.triggerMonthlyTasks();
    console.log('   ✅ Monthly tasks completed');
}

async function testReportingFeatures() {
    console.log('   Testing reporting service...');

    // Test dashboard report
    const dashboardReport = await invoiceReportingService.generateDashboardReport();
    console.log('   ✅ Dashboard report generated');
    console.log('   Total Invoices:', dashboardReport.overall.totalInvoices);
    console.log('   Total Amount:', dashboardReport.overall.totalAmount);
    console.log('   Total Outstanding:', dashboardReport.overall.totalOutstanding);

    // Test overdue report
    const overdueReport = await invoiceReportingService.generateOverdueReport();
    console.log('   ✅ Overdue report generated');
    console.log('   Overdue Invoices:', overdueReport.summary.totalOverdueInvoices);
    console.log('   Overdue Amount:', overdueReport.summary.totalOverdueAmount);

    // Test student report
    if (global.testStudent) {
        const startDate = new Date('2025-01-01');
        const endDate = new Date('2025-12-31');
        const studentReport = await invoiceReportingService.generateStudentReport(
            global.testStudent._id,
            startDate,
            endDate
        );
        console.log('   ✅ Student report generated');
        console.log('   Student:', studentReport.student.name);
        console.log('   Total Invoices:', studentReport.financialSummary.totalInvoices);
    }
}

// Run the test
testEnhancedInvoiceSystem(); 