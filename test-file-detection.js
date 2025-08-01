// Simple test to verify file detection logic
const testFiles = [
    {
        fieldname: 'items[0][quotations][0][quotation]',
        originalname: 'test.pdf',
        size: 1000
    }
];

console.log('Testing file detection logic...');

// Test the exact logic from the backend
const i = 0;
const j = 0;

// First try exact match
const exactFieldname = `items[${i}][quotations][${j}][quotation]`;
let uploadedFile = testFiles.find(file => file.fieldname === exactFieldname);

if (uploadedFile) {
    console.log(`✅ Found file with exact match: ${exactFieldname}`);
} else {
    console.log(`❌ No exact match found for: ${exactFieldname}`);
    
    // Try pattern match as fallback
    uploadedFile = testFiles.find(file => 
        file.fieldname.includes(`items[${i}]`) && 
        file.fieldname.includes(`quotations[${j}]`)
    );
    
    if (uploadedFile) {
        console.log(`✅ Found file with pattern match: ${uploadedFile.fieldname}`);
    } else {
        console.log(`❌ No pattern match found`);
    }
}

console.log('Available files:', testFiles.map(f => f.fieldname));
console.log('Looking for:', exactFieldname);
console.log('Result:', uploadedFile ? 'FOUND' : 'NOT FOUND'); 