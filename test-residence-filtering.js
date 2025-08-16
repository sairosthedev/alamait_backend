const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testResidenceFiltering() {
    console.log('🧪 Testing Residence Filtering in Balance Sheets...\n');
    
    try {
        // Test: Get balance sheet for all residences breakdown
        console.log('📋 Testing GET /api/accounting/balance-sheet/residences?month=8&year=2025');
        const response = await axios.get(`${BASE_URL}/api/accounting/balance-sheet/residences?month=8&year=2025`);
        
        if (response.data.success) {
            console.log('✅ SUCCESS! Residence Filtering is Working!');
            console.log('📊 Response:', JSON.stringify(response.data, null, 2));
        } else {
            console.log('❌ Failed:', response.data.message);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

testResidenceFiltering();
