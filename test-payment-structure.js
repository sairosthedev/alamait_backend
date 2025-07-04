const axios = require('axios');

const BASE_URL = 'https://alamait-backend.onrender.com';

// Test with the specific student ID from the payment data
const TEST_STUDENT_ID = '68671f498c3609aa58533686';

async function testPaymentEndpoints() {
    console.log('Testing payment endpoints with real data structure...\n');

    try {
        // Test 1: Admin student payments endpoint
        console.log('1. Testing GET /api/admin/students/:studentId/payments...');
        console.log('Student ID:', TEST_STUDENT_ID);
        
        const adminPaymentsResponse = await axios.get(`${BASE_URL}/api/admin/students/${TEST_STUDENT_ID}/payments`, {
            headers: {
                'Authorization': 'Bearer YOUR_ADMIN_TOKEN_HERE',
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Admin payments response status:', adminPaymentsResponse.status);
        console.log('✅ Student info:', adminPaymentsResponse.data.student);
        console.log('✅ Payments count:', adminPaymentsResponse.data.payments?.length || 0);
        console.log('✅ Summary:', adminPaymentsResponse.data.summary);
        
        if (adminPaymentsResponse.data.payments && adminPaymentsResponse.data.payments.length > 0) {
            const firstPayment = adminPaymentsResponse.data.payments[0];
            console.log('✅ First payment details:');
            console.log('   - ID:', firstPayment.id);
            console.log('   - Type:', firstPayment.paymentType);
            console.log('   - Amount:', firstPayment.amount);
            console.log('   - Status:', firstPayment.status);
            console.log('   - Method:', firstPayment.method);
            console.log('   - Room:', firstPayment.room);
            console.log('   - Payment Month:', firstPayment.paymentMonth);
        }
        
    } catch (error) {
        console.error('❌ Error testing admin payments:', error.response?.data || error.message);
        console.error('❌ Status:', error.response?.status);
    }

    try {
        // Test 2: Finance student payments endpoint
        console.log('\n2. Testing GET /api/finance/students/:studentId/payments...');
        
        const financePaymentsResponse = await axios.get(`${BASE_URL}/api/finance/students/${TEST_STUDENT_ID}/payments`, {
            headers: {
                'Authorization': 'Bearer YOUR_FINANCE_TOKEN_HERE',
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Finance payments response status:', financePaymentsResponse.status);
        console.log('✅ Student info:', financePaymentsResponse.data.student);
        console.log('✅ Payments count:', financePaymentsResponse.data.payments?.length || 0);
        console.log('✅ Summary:', financePaymentsResponse.data.summary);
        console.log('✅ Pagination:', financePaymentsResponse.data.pagination);
        
    } catch (error) {
        console.error('❌ Error testing finance payments:', error.response?.data || error.message);
        console.error('❌ Status:', error.response?.status);
    }

    try {
        // Test 3: Admin student leases endpoint
        console.log('\n3. Testing GET /api/admin/students/:studentId/leases...');
        
        const adminLeasesResponse = await axios.get(`${BASE_URL}/api/admin/students/${TEST_STUDENT_ID}/leases`, {
            headers: {
                'Authorization': 'Bearer YOUR_ADMIN_TOKEN_HERE',
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Admin leases response status:', adminLeasesResponse.status);
        console.log('✅ Student info:', adminLeasesResponse.data.student);
        console.log('✅ Leases count:', adminLeasesResponse.data.leases?.length || 0);
        
    } catch (error) {
        console.error('❌ Error testing admin leases:', error.response?.data || error.message);
        console.error('❌ Status:', error.response?.status);
    }

    try {
        // Test 4: Finance student leases endpoint
        console.log('\n4. Testing GET /api/finance/students/:studentId/leases...');
        
        const financeLeasesResponse = await axios.get(`${BASE_URL}/api/finance/students/${TEST_STUDENT_ID}/leases`, {
            headers: {
                'Authorization': 'Bearer YOUR_FINANCE_TOKEN_HERE',
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Finance leases response status:', financeLeasesResponse.status);
        console.log('✅ Student info:', financeLeasesResponse.data.student);
        console.log('✅ Leases count:', financeLeasesResponse.data.leases?.length || 0);
        console.log('✅ Pagination:', financeLeasesResponse.data.pagination);
        
    } catch (error) {
        console.error('❌ Error testing finance leases:', error.response?.data || error.message);
        console.error('❌ Status:', error.response?.status);
    }
}

// Test payment type detection with sample data
function testPaymentTypeDetection() {
    console.log('\n\nTesting payment type detection logic...\n');
    
    const testPayments = [
        { rentAmount: 190, adminFee: 20, deposit: 100, expected: 'Rent + Admin Fee + Deposit' },
        { rentAmount: 190, adminFee: 0, deposit: 0, expected: 'Rent' },
        { rentAmount: 0, adminFee: 20, deposit: 0, expected: 'Admin Fee' },
        { rentAmount: 0, adminFee: 0, deposit: 100, expected: 'Deposit' },
        { rentAmount: 190, adminFee: 20, deposit: 0, expected: 'Rent + Admin Fee' },
        { rentAmount: 190, adminFee: 0, deposit: 100, expected: 'Rent + Deposit' },
        { rentAmount: 0, adminFee: 20, deposit: 100, expected: 'Admin Fee + Deposit' }
    ];
    
    testPayments.forEach((payment, index) => {
        let paymentType = 'Other';
        
        if (payment.rentAmount > 0 && payment.adminFee === 0 && payment.deposit === 0) {
            paymentType = 'Rent';
        } else if (payment.deposit > 0 && payment.rentAmount === 0 && payment.adminFee === 0) {
            paymentType = 'Deposit';
        } else if (payment.adminFee > 0 && payment.rentAmount === 0 && payment.deposit === 0) {
            paymentType = 'Admin Fee';
        } else if (payment.rentAmount > 0 && payment.adminFee > 0 && payment.deposit === 0) {
            paymentType = 'Rent + Admin Fee';
        } else if (payment.rentAmount > 0 && payment.deposit > 0 && payment.adminFee === 0) {
            paymentType = 'Rent + Deposit';
        } else if (payment.rentAmount > 0 && payment.adminFee > 0 && payment.deposit > 0) {
            paymentType = 'Rent + Admin Fee + Deposit';
        } else if (payment.adminFee > 0 && payment.deposit > 0 && payment.rentAmount === 0) {
            paymentType = 'Admin Fee + Deposit';
        }
        
        const result = paymentType === payment.expected ? '✅' : '❌';
        console.log(`${result} Test ${index + 1}: ${paymentType} (expected: ${payment.expected})`);
    });
}

// Run tests
testPaymentEndpoints().then(() => {
    testPaymentTypeDetection();
}).catch(console.error); 