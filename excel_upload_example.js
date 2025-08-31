// Example: Using Excel Upload for Student Bulk Creation

// 1. Download Excel Template
async function downloadExcelTemplate() {
    try {
        const response = await fetch('/api/admin/students/excel-template', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer YOUR_TOKEN_HERE'
            }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'student_upload_template.xlsx';
            a.click();
            window.URL.revokeObjectURL(url);
        }
    } catch (error) {
        console.error('Error downloading template:', error);
    }
}

// 2. Upload Excel File
async function uploadExcelFile(file, residenceId, defaults = {}) {
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('residenceId', residenceId);
        formData.append('defaultStartDate', defaults.startDate || '2025-08-30');
        formData.append('defaultEndDate', defaults.endDate || '2026-02-26');
        formData.append('defaultMonthlyRent', defaults.monthlyRent || 180);
        
        const response = await fetch('/api/admin/students/upload-excel', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer YOUR_TOKEN_HERE'
            },
            body: formData
        });
        
        const result = await response.json();
        console.log('Upload result:', result);
        
        if (result.success) {
            console.log(`✅ Successfully uploaded ${result.data.summary.totalSuccessful} students`);
            console.log(`❌ Failed to upload ${result.data.summary.totalFailed} students`);
            
            // Show detailed results
            if (result.data.successful.length > 0) {
                console.log('✅ Successful uploads:');
                result.data.successful.forEach(student => {
                    console.log(`  - ${student.name} (${student.email}) - Room: ${student.roomNumber}`);
                });
            }
            
            if (result.data.failed.length > 0) {
                console.log('❌ Failed uploads:');
                result.data.failed.forEach(failure => {
                    console.log(`  - Row ${failure.row}: ${failure.error}`);
                });
            }
        } else {
            console.error('Upload failed:', result.message);
        }
        
        return result;
    } catch (error) {
        console.error('Error uploading Excel file:', error);
        throw error;
    }
}

// 3. Example Usage
document.addEventListener('DOMContentLoaded', function() {
    // Download template button
    const downloadBtn = document.getElementById('download-template');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadExcelTemplate);
    }
    
    // Upload file button
    const uploadBtn = document.getElementById('upload-excel');
    const fileInput = document.getElementById('excel-file');
    const residenceSelect = document.getElementById('residence-id');
    
    if (uploadBtn && fileInput && residenceSelect) {
        uploadBtn.addEventListener('click', async () => {
            const file = fileInput.files[0];
            const residenceId = residenceSelect.value;
            
            if (!file) {
                alert('Please select an Excel file');
                return;
            }
            
            if (!residenceId) {
                alert('Please select a residence');
                return;
            }
            
            try {
                uploadBtn.disabled = true;
                uploadBtn.textContent = 'Uploading...';
                
                const result = await uploadExcelFile(file, residenceId, {
                    startDate: '2025-08-30',
                    endDate: '2026-02-26',
                    monthlyRent: 180
                });
                
                if (result.success) {
                    alert(`Successfully uploaded ${result.data.summary.totalSuccessful} students!`);
                } else {
                    alert(`Upload failed: ${result.message}`);
                }
            } catch (error) {
                alert('Error uploading file: ' + error.message);
            } finally {
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'Upload Excel';
            }
        });
    }
});

// 4. Excel Template Structure
const excelTemplateStructure = {
    headers: [
        'Email',           // Required - Student email address
        'First Name',      // Required - Student first name
        'Last Name',       // Required - Student last name
        'Phone',           // Optional - Student phone number
        'Status',          // Optional - active, inactive, pending (default: active)
        'Room Number',     // Optional - Room assignment (uses default if not provided)
        'Start Date',      // Optional - Lease start date (uses default if not provided)
        'End Date',        // Optional - Lease end date (uses default if not provided)
        'Monthly Rent',    // Optional - Monthly rent amount (uses default if not provided)
        'Emergency Contact Name',    // Optional - Emergency contact name
        'Emergency Contact Phone'    // Optional - Emergency contact phone
    ],
    sampleData: [
        [
            'john.doe@example.com',
            'John',
            'Doe',
            '+1234567890',
            'active',
            'A101',
            '2025-01-15',
            '2025-07-15',
            '500',
            'Jane Doe',
            '+1234567891'
        ]
    ],
    instructions: [
        'First row must contain headers exactly as shown above',
        'Each subsequent row represents one student to be created',
        'Required fields: Email, First Name, Last Name',
        'Optional fields: Phone, Status, Room Number, Start Date, End Date, Monthly Rent, Emergency Contact',
        'Date format: YYYY-MM-DD',
        'Status options: active, inactive, pending',
        'If optional fields are not provided, default values will be used',
        'Empty rows will be skipped',
        'Maximum file size: 10MB'
    ]
};

console.log('Excel upload functionality ready!');
console.log('Template structure:', excelTemplateStructure);
