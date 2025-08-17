const axios = require('axios');

// Test the status logic for past/current vs future months
async function testStatusLogic() {
    const residenceId = '67d723cf20f89c4ae69804f3'; // Replace with actual residence ID
    const baseUrl = 'https://alamait-backend.onrender.com/api/monthly-requests';
    
    try {
        console.log('🧪 Testing Status Logic for Past/Current vs Future Months\n');
        
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        
        console.log(`Current Date: ${currentDate.toLocaleDateString()}`);
        console.log(`Current Month: ${currentMonth}, Current Year: ${currentYear}\n`);
        
        // 1. Test creating monthly request for past month (should be auto-approved)
        console.log('1️⃣ Testing Past Month Request (should be auto-approved)...');
        const pastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const pastYear = currentMonth === 1 ? currentYear - 1 : currentYear;
        
        const pastMonthRequest = {
            title: 'Past Month Services',
            description: 'Services for past month',
            residence: residenceId,
            month: pastMonth,
            year: pastYear,
            isTemplate: false,
            items: [
                {
                    title: 'Past WiFi Service',
                    description: 'WiFi service for past month',
                    estimatedCost: 150,
                    category: 'utilities'
                }
            ]
        };
        
        const pastResponse = await axios.post(
            baseUrl,
            pastMonthRequest,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                }
            }
        );
        
        console.log(`✅ Past Month Request (${pastMonth}/${pastYear}) Status: ${pastResponse.data.status}`);
        console.log(`   Expected: approved, Got: ${pastResponse.data.status}`);
        
        // 2. Test creating monthly request for current month (should be auto-approved)
        console.log('\n2️⃣ Testing Current Month Request (should be auto-approved)...');
        
        const currentMonthRequest = {
            title: 'Current Month Services',
            description: 'Services for current month',
            residence: residenceId,
            month: currentMonth,
            year: currentYear,
            isTemplate: false,
            items: [
                {
                    title: 'Current WiFi Service',
                    description: 'WiFi service for current month',
                    estimatedCost: 150,
                    category: 'utilities'
                }
            ]
        };
        
        const currentResponse = await axios.post(
            baseUrl,
            currentMonthRequest,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                }
            }
        );
        
        console.log(`✅ Current Month Request (${currentMonth}/${currentYear}) Status: ${currentResponse.data.status}`);
        console.log(`   Expected: approved, Got: ${currentResponse.data.status}`);
        
        // 3. Test creating monthly request for future month (should be pending)
        console.log('\n3️⃣ Testing Future Month Request (should be pending)...');
        const futureMonth = currentMonth === 12 ? 1 : currentMonth + 1;
        const futureYear = currentMonth === 12 ? currentYear + 1 : currentYear;
        
        const futureMonthRequest = {
            title: 'Future Month Services',
            description: 'Services for future month',
            residence: residenceId,
            month: futureMonth,
            year: futureYear,
            isTemplate: false,
            items: [
                {
                    title: 'Future WiFi Service',
                    description: 'WiFi service for future month',
                    estimatedCost: 150,
                    category: 'utilities'
                }
            ]
        };
        
        const futureResponse = await axios.post(
            baseUrl,
            futureMonthRequest,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                }
            }
        );
        
        console.log(`✅ Future Month Request (${futureMonth}/${futureYear}) Status: ${futureResponse.data.status}`);
        console.log(`   Expected: pending, Got: ${futureResponse.data.status}`);
        
        // 4. Test creating template (should always be draft)
        console.log('\n4️⃣ Testing Template Creation (should always be draft)...');
        
        const templateRequest = {
            title: 'Test Template',
            description: 'Test template for status logic',
            residence: residenceId,
            isTemplate: true,
            items: [
                {
                    title: 'Template WiFi Service',
                    description: 'WiFi service template',
                    estimatedCost: 150,
                    category: 'utilities'
                }
            ]
        };
        
        const templateResponse = await axios.post(
            baseUrl,
            templateRequest,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                }
            }
        );
        
        console.log(`✅ Template Status: ${templateResponse.data.status}`);
        console.log(`   Expected: draft, Got: ${templateResponse.data.status}`);
        
        // 5. Test creating from template for different months
        if (templateResponse.data._id) {
            console.log('\n5️⃣ Testing Create from Template for Different Months...');
            
            // Create from template for past month
            const pastFromTemplate = await axios.post(
                `${baseUrl}/templates/${templateResponse.data._id}`,
                {
                    month: pastMonth,
                    year: pastYear
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                    }
                }
            );
            
            console.log(`✅ Past Month from Template (${pastMonth}/${pastYear}) Status: ${pastFromTemplate.data.status}`);
            console.log(`   Expected: approved, Got: ${pastFromTemplate.data.status}`);
            
            // Create from template for future month
            const futureFromTemplate = await axios.post(
                `${baseUrl}/templates/${templateResponse.data._id}`,
                {
                    month: futureMonth,
                    year: futureYear
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
                    }
                }
            );
            
            console.log(`✅ Future Month from Template (${futureMonth}/${futureYear}) Status: ${futureFromTemplate.data.status}`);
            console.log(`   Expected: pending, Got: ${futureFromTemplate.data.status}`);
        }
        
        // 6. Summary
        console.log('\n📊 Status Logic Summary:');
        console.log('✅ Past/Current Months: Auto-approved (no finance approval needed)');
        console.log('✅ Future Months: Pending (requires finance approval)');
        console.log('✅ Templates: Always draft (for management purposes)');
        console.log('✅ Create from Template: Follows same past/current vs future logic');
        
        console.log('\n🎉 Status logic test completed!');
        
    } catch (error) {
        console.error('❌ Error during status logic test:', error.response?.data || error.message);
    }
}

// Instructions
console.log('📋 Instructions for Status Logic Test:');
console.log('1. Replace "YOUR_TOKEN_HERE" with a valid authentication token');
console.log('2. Ensure the residence ID exists in your database');
console.log('3. Run this script to test the status logic');
console.log('4. The script will test:');
console.log('   - Past month requests (should be auto-approved)');
console.log('   - Current month requests (should be auto-approved)');
console.log('   - Future month requests (should be pending)');
console.log('   - Template creation (should be draft)');
console.log('   - Create from template for different months');
console.log('5. This demonstrates the new status logic for historical vs future requests\n');

// Uncomment to run the test
// testStatusLogic(); 