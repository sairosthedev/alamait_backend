// Your current data structure (WRONG)
const yourCurrentData = {
  students: [
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
      emergencyContact: "{name:Jane Doe"
    },
    // ... more students
  ],
  defaults: {
    startDate: "2025-08-30",
    endDate: "2026-02-26",
    monthlyRent: 500
  },
  residenceId: "67d723cf20f89c4ae69804f3"
};

// Function to fix your data structure
function fixRequestData(yourData) {
  return {
    csvData: yourData.students,  // Move students array to csvData
    residenceId: yourData.residenceId,
    defaultStartDate: yourData.defaults.startDate,    // Flatten defaults
    defaultEndDate: yourData.defaults.endDate,
    defaultMonthlyRent: yourData.defaults.monthlyRent
  };
}

// Fixed data structure (CORRECT)
const fixedData = fixRequestData(yourCurrentData);

console.log('❌ Your current structure:');
console.log(JSON.stringify(yourCurrentData, null, 2));

console.log('\n✅ Fixed structure:');
console.log(JSON.stringify(fixedData, null, 2));

// Use this fixed data for your API call
// const response = await fetch('/api/admin/students/upload-csv', {
//   method: 'POST',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify(fixedData)  // Use fixedData, not yourCurrentData
// });
