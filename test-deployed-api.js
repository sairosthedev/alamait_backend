const axios = require('axios');

async function testDeployedAPI() {
  try {
    console.log('🧪 Testing Deployed API...\n');
    
    // Test the deployed income statement API
    const response = await axios.get('https://alamait-backend.onrender.com/api/accounting/income-statement/residences/monthly', {
      params: {
        year: 2025,
        basis: 'accrual'
      }
    });
    
    console.log('✅ API Response Status:', response.status);
    console.log('📊 API Response Data:');
    console.log('=====================================');
    
    const data = response.data;
    
    if (data.success) {
      console.log('✅ Success: true');
      console.log(`📅 Year: ${data.data.year}`);
      console.log(`🏠 Total Residences: ${data.data.summary.totalResidences}`);
      console.log(`💰 Total Revenue: $${data.data.summary.totalRevenue}`);
      
      // Show August data specifically
      const august = data.data.monthlyProgression['8'];
      if (august) {
        console.log('\n📅 AUGUST 2025 BREAKDOWN:');
        console.log('============================');
        console.log(`📊 Month: ${august.monthName} ${august.year}`);
        console.log(`💰 Total Revenue: $${august.summary.totalRevenue}`);
        console.log(`💸 Total Expenses: $${august.summary.totalExpenses}`);
        console.log(`📈 Total Net Income: $${august.summary.totalNetIncome}`);
        
        // Show individual residence breakdown for August
        console.log('\n🏠 Individual Residences (August):');
        console.log('==================================');
        
        for (const [residenceId, residenceData] of Object.entries(august.residences)) {
          console.log(`\n📍 ${residenceData.residenceDetails.name}:`);
          console.log(`   💰 Rental Income: $${residenceData.revenue.rentalIncome}`);
          console.log(`   🏢 Admin Income: $${residenceData.revenue.adminIncome}`);
          console.log(`   💵 Total Revenue: $${residenceData.revenue.total}`);
          console.log(`   📈 Net Income: $${residenceData.netIncome}`);
        }
      }
      
      // Show a few months for comparison
      console.log('\n📊 MONTHLY COMPARISON:');
      console.log('========================');
      
      const months = ['7', '8', '9', '10'];
      months.forEach(monthNum => {
        const monthData = data.data.monthlyProgression[monthNum];
        if (monthData) {
          console.log(`${monthData.monthName}: $${monthData.summary.totalRevenue} revenue`);
        }
      });
      
    } else {
      console.log('❌ Success: false');
      console.log('Error Message:', data.message);
    }
    
  } catch (error) {
    console.error('❌ Error calling deployed API:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', error.response.data);
    }
  }
}

testDeployedAPI();
