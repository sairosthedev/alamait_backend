// Test script to verify Excel upload functionality

const ExcelJS = require('exceljs');

// Create a test Excel file
async function createTestExcelFile() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Students');
    
    // Add headers
    worksheet.addRow([
        'Email',
        'First Name', 
        'Last Name',
        'Phone',
        'Status',
        'Room Number',
        'Start Date',
        'End Date',
        'Monthly Rent',
        'Emergency Contact Name',
        'Emergency Contact Phone'
    ]);
    
    // Add test data
    worksheet.addRow([
        'test.student@example.com',
        'Test',
        'Student',
        '+1234567890',
        'active',
        'A101',
        '2025-01-15',
        '2025-07-15',
        '500',
        'Test Parent',
        '+1234567891'
    ]);
    
    // Save the file
    await workbook.xlsx.writeFile('test_students.xlsx');
    console.log('✅ Test Excel file created: test_students.xlsx');
}

// Test the upload functionality
async function testExcelUpload() {
    try {
        const fs = require('fs');
        const FormData = require('form-data');
        
        // Create test file
        await createTestExcelFile();
        
        // Read the file
        const fileBuffer = fs.readFileSync('test_students.xlsx');
        
        // Create FormData
        const formData = new FormData();
        formData.append('file', fileBuffer, {
            filename: 'test_students.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        formData.append('residenceId', '67d723cf20f89c4ae69804f3');
        formData.append('defaultStartDate', '2025-08-30');
        formData.append('defaultEndDate', '2026-02-26');
        formData.append('defaultMonthlyRent', '180');
        
        console.log('✅ FormData created successfully');
        console.log('📋 Test data prepared for upload');
        console.log('🔗 API endpoint: POST /api/admin/students/upload-excel');
        
    } catch (error) {
        console.error('❌ Error creating test file:', error);
    }
}

// Run the test
testExcelUpload();

console.log('\n📝 Instructions:');
console.log('1. Start your server: npm start');
console.log('2. Use the test_students.xlsx file to test the upload');
console.log('3. Send POST request to /api/admin/students/upload-excel');
console.log('4. Include the file and form data as shown above');
