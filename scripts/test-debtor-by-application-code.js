const axios = require('axios');

async function testDebtorByApplicationCode() {
  try {
    console.log('🧪 Testing debtor by application code endpoint...\n');
    
    // Test the endpoint with the application code we know exists
    const applicationCode = 'APP1755644723526ND7D7';
    
    console.log(`🔍 Searching for debtors with application code: ${applicationCode}`);
    
    const response = await axios.get(`http://localhost:5000/api/finance/accounts/debtors/application/${applicationCode}`);
    
    console.log('✅ Response:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
    // Show summary
    if (response.data.success) {
      console.log(`\n📊 Summary:`);
      console.log(`   Application Code: ${response.data.applicationCode}`);
      console.log(`   Debtors Found: ${response.data.count}`);
      
      response.data.debtors.forEach((debtor, index) => {
        console.log(`\n   Debtor ${index + 1}:`);
        console.log(`     Code: ${debtor.debtorCode}`);
        console.log(`     User: ${debtor.user?.firstName} ${debtor.user?.lastName}`);
        console.log(`     Application: ${debtor.application?.firstName} ${debtor.application?.lastName}`);
        console.log(`     Status: ${debtor.application?.status}`);
        console.log(`     Start Date: ${debtor.application?.startDate ? new Date(debtor.application.startDate).toDateString() : 'Not set'}`);
        console.log(`     End Date: ${debtor.application?.endDate ? new Date(debtor.application.endDate).toDateString() : 'Not set'}`);
        console.log(`     Current Balance: $${debtor.currentBalance}`);
        console.log(`     Total Owed: $${debtor.totalOwed}`);
        console.log(`     Application Code: ${debtor.applicationCode}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error testing endpoint:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Run the test
testDebtorByApplicationCode();



















