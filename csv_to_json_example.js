// Example: Converting CSV data to the correct JSON format for upload

// Your CSV data (after parsing from file or form)
const csvData = [
  {
    email: "john.doe@example.com",
    firstName: "John",
    lastName: "Doe",
    phone: "+1234567890",
    roomNumber: "A101",
    startDate: "2025-01-15",
    endDate: "2025-07-15",
    monthlyRent: "500",
    status: "active",
    emergencyContact: "{name:Jane Doe,phone:+1234567891}"
  },
  {
    email: "jane.smith@example.com",
    firstName: "Jane",
    lastName: "Smith",
    phone: "+1234567892",
    roomNumber: "A102",
    startDate: "2025-01-15",
    endDate: "2025-07-15",
    monthlyRent: "500",
    status: "active",
    emergencyContact: "{name:John Smith,phone:+1234567893}"
  },
  {
    email: "michael.brown@example.com",
    firstName: "Michael",
    lastName: "Brown",
    phone: "+1234567894",
    roomNumber: "A103",
    startDate: "2025-01-15",
    endDate: "2025-07-15",
    monthlyRent: "500",
    status: "active",
    emergencyContact: "{name:Sarah Brown,phone:+1234567895}"
  },
  {
    email: "emily.jones@example.com",
    firstName: "Emily",
    lastName: "Jones",
    phone: "+1234567896",
    roomNumber: "A104",
    startDate: "2025-01-15",
    endDate: "2025-07-15",
    monthlyRent: "500",
    status: "active",
    emergencyContact: "{name:David Jones,phone:+1234567897}"
  },
  {
    email: "daniel.wilson@example.com",
    firstName: "Daniel",
    lastName: "Wilson",
    phone: "+1234567898",
    roomNumber: "A105",
    startDate: "2025-01-15",
    endDate: "2025-07-15",
    monthlyRent: "500",
    status: "active",
    emergencyContact: "{name:Lisa Wilson,phone:+1234567899}"
  }
];

// The correct request format for the API
const requestData = {
  csvData: csvData,  // ✅ This is the key - use 'csvData' not 'students'
  residenceId: "67d723cf20f89c4ae69804f3",
  defaultStartDate: "2025-08-30",    // Fallback if student doesn't have startDate
  defaultEndDate: "2026-02-26",      // Fallback if student doesn't have endDate
  defaultMonthlyRent: 180            // Fallback if student doesn't have monthlyRent
};

// Example API call
async function uploadStudents() {
  try {
    const response = await fetch('/api/admin/students/upload-csv', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_TOKEN_HERE'
      },
      body: JSON.stringify(requestData)
    });
    
    const result = await response.json();
    console.log('Upload result:', result);
    
    if (result.success) {
      console.log(`✅ Successfully uploaded ${result.data.summary.totalSuccessful} students`);
      console.log(`❌ Failed to upload ${result.data.summary.totalFailed} students`);
    } else {
      console.error('Upload failed:', result.message);
    }
  } catch (error) {
    console.error('Error uploading students:', error);
  }
}

console.log('Correct request format:');
console.log(JSON.stringify(requestData, null, 2));
